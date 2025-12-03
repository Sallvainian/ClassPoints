#!/usr/bin/env bash
#
# File: .claude/hooks/user-prompt-output.sh
#
# AgentVibes - Finally, your AI Agents can Talk Back! Text-to-Speech WITH personality for AI Assistants!
# Website: https://agentvibes.org
# Repository: https://github.com/paulpreibisch/AgentVibes
#
# Co-created by Paul Preibisch with Claude AI
# Copyright (c) 2025 Paul Preibisch
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# DISCLAIMER: This software is provided "AS IS", WITHOUT WARRANTY OF ANY KIND,
# express or implied, including but not limited to the warranties of
# merchantability, fitness for a particular purpose and noninfringement.
# In no event shall the authors or copyright holders be liable for any claim,
# damages or other liability, whether in an action of contract, tort or
# otherwise, arising from, out of or in connection with the software or the
# use or other dealings in the software.
#
# ---
#
# @fileoverview Auto-detects emoji markers and BMAD party mode in Claude's output and triggers TTS
# @context Implements verbosity system by detecting 💭 🤔 ✓ markers and BMAD party mode agent dialogues
# @architecture Stdin reader, regex matcher, async TTS trigger, agent voice switching
# @dependencies play-tts.sh, tts-verbosity.txt, bmad-voice-manager.sh, .bmad/_cfg/agent-manifest.csv
# @entrypoints Called by Claude Code after each assistant response (user-prompt-output hook)
# @patterns Text stream processing, background job execution, marker-based triggers, party mode detection
# @related session-start-tts.sh, verbosity-manager.sh, bmad-voice-manager.sh, Issue #32, Issue #33
# @aiNotes This hook enables natural emoji-based TTS + BMAD party mode voice switching

# Fix locale warnings
export LC_ALL=C

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLAY_TTS="$SCRIPT_DIR/play-tts.sh"

# Read JSON input from stdin
INPUT=$(cat)

# Extract transcript path from JSON
TRANSCRIPT_PATH=$(echo "$INPUT" | grep -o '"transcript_path":"[^"]*"' | cut -d'"' -f4)

# If no transcript path, exit (shouldn't happen but be safe)
[[ -z "$TRANSCRIPT_PATH" || ! -f "$TRANSCRIPT_PATH" ]] && exit 0

# Get the last assistant message from transcript
# The transcript is JSONL format - each line is a JSON object
# Extract all text content blocks from the last message and join them
LAST_RESPONSE=$(tail -1 "$TRANSCRIPT_PATH" | jq -r '.message.content[] | select(.type == "text") | .text' 2>/dev/null)

# Get verbosity level
VERBOSITY=$(cat "$PROJECT_ROOT/.claude/tts-verbosity.txt" 2>/dev/null || cat ~/.claude/tts-verbosity.txt 2>/dev/null || echo "low")

# Exit early if play-tts.sh doesn't exist (AgentVibes not installed)
[[ ! -f "$PLAY_TTS" ]] && exit 0

#
# @function extract_and_speak
# @context Extracts text after emoji markers and triggers TTS asynchronously
# @architecture Uses grep to find markers, extracts text, launches TTS in background
# @dependencies play-tts.sh
# @entrypoints Called based on verbosity level
# @aiNotes Background execution (&) prevents blocking Claude's output
#
extract_and_speak() {
  local pattern="$1"

  # Extract lines matching the pattern
  # Pattern format: "emoji text" or "emoji [text]"
  while IFS= read -r line; do
    # Try to extract text after emoji
    # Handles formats: "💭 text", "💭 [text]", "💭text"
    if echo "$line" | grep -qE "$pattern"; then
      # Extract everything after the emoji (and optional space/bracket)
      text=$(echo "$line" | sed -E "s/^.*($pattern)[[:space:]]*\[?[[:space:]]*//" | sed 's/\]$//')

      # Skip if text is empty or too short
      [[ -z "$text" || ${#text} -lt 3 ]] && continue

      # Speak it in background (don't block)
      bash "$PLAY_TTS" "$text" >/dev/null 2>&1 &
    fi
  done <<< "$LAST_RESPONSE"
}

#
# @function is_party_mode_enabled
# @context Check if BMAD party mode voice integration is enabled
# @architecture Auto-enable for BMAD users, opt-out via disable flag
# @dependencies .bmad/_cfg/agent-manifest.csv, .claude/config/bmad-voices-enabled.flag
# @returns 0=enabled, 1=disabled
# @aiNotes Auto-enabled when BMAD detected, respects opt-out flag for user control
#
is_party_mode_enabled() {
  # Explicit opt-out takes precedence
  [[ -f "$PROJECT_ROOT/.claude/plugins/bmad-party-mode-disabled.flag" ]] && return 1

  # Auto-enable if BMAD detected + voice plugin enabled
  if [[ -f "$PROJECT_ROOT/.bmad/_cfg/agent-manifest.csv" ]] && \
     [[ -f "$PROJECT_ROOT/.claude/config/bmad-voices-enabled.flag" ]]; then
    return 0
  fi

  return 1
}

#
# @function map_display_name_to_agent_id
# @context Map BMAD agent display name to agent ID for voice lookup
# @architecture Parses agent-manifest.csv, matches displayName column to name column
# @dependencies .bmad/_cfg/agent-manifest.csv
# @param $1 Display name (e.g., "Winston", "John", "Amelia")
# @returns Agent ID (e.g., "architect", "pm", "dev") or empty string if not found
# @aiNotes Case-insensitive matching, handles quoted CSV values
#
map_display_name_to_agent_id() {
  local display_name="$1"

  # Check for BMAD v6 manifest
  if [[ ! -f "$PROJECT_ROOT/.bmad/_cfg/agent-manifest.csv" ]]; then
    return 1
  fi

  # CSV format: name,displayName,title,icon,role,...
  # Extract 'name' (column 1) where displayName (column 2) matches
  # Case-insensitive grep, remove quotes, get first match
  local agent_id=$(grep -i ",\"*${display_name}\"*," "$PROJECT_ROOT/.bmad/_cfg/agent-manifest.csv" | \
                   head -1 | \
                   cut -d',' -f1 | \
                   tr -d '"')

  echo "$agent_id"
}

#
# @function detect_and_speak_party_mode_dialogue
# @context Detect BMAD party mode agent responses and speak with agent-specific voices
# @architecture Pattern matches [Agent Name]: format, maps to agent voice, triggers TTS
# @dependencies map_display_name_to_agent_id, bmad-voice-manager.sh, play-tts.sh
# @aiNotes Runs in background to avoid blocking, graceful fallback for unmapped agents
#
detect_and_speak_party_mode_dialogue() {
  # Pattern: [Agent Name]: dialogue
  # Must start at beginning of line, agent name can include spaces/hyphens
  while IFS= read -r line; do
    if echo "$line" | grep -qE '^\[([A-Za-z\s-]+)\]:'; then
      # Extract agent display name and dialogue
      local agent_name=$(echo "$line" | sed -E 's/^\[([A-Za-z\s-]+)\]:.*/\1/')
      local dialogue=$(echo "$line" | sed -E 's/^\[[^]]+\]:[[:space:]]*//')

      # Skip if dialogue is empty or too short
      [[ -z "$dialogue" || ${#dialogue} -lt 3 ]] && continue

      # Map display name to agent ID
      local agent_id=$(map_display_name_to_agent_id "$agent_name")

      # Get agent's voice from bmad-voice-manager.sh
      local agent_voice=""
      if [[ -n "$agent_id" ]] && [[ -f "$SCRIPT_DIR/bmad-voice-manager.sh" ]]; then
        agent_voice=$("$SCRIPT_DIR/bmad-voice-manager.sh" get-voice "$agent_id" 2>/dev/null)
      fi

      # Speak with agent's voice (or default if not mapped)
      # Run in foreground to ensure audio completes
      if [[ -n "$agent_voice" ]]; then
        bash "$PLAY_TTS" "$dialogue" "$agent_voice" &
      else
        # Fallback to default voice if agent not in voice mapping
        bash "$PLAY_TTS" "$dialogue" &
      fi
    fi
  done
}

# Process based on verbosity level
case "$VERBOSITY" in
  high)
    # HIGH: Speak ALL markers (💭 🤔 ✓)
    # Don't speak ✅ here - that's handled by manual TTS completion call
    extract_and_speak "💭|🤔|✓"
    ;;

  medium)
    # MEDIUM: Speak decisions and findings (🤔 ✓)
    extract_and_speak "🤔|✓"
    ;;

  low)
    # LOW: No automatic extraction (only manual ACK/COMPLETE TTS calls)
    # Don't process any markers
    ;;
esac

# BMAD Party Mode Integration (Issue #33)
# Auto-enabled for BMAD users, opt-out available
if is_party_mode_enabled; then
  # Detect party mode activation announcement
  if echo "$LAST_RESPONSE" | grep -q "🎉 PARTY MODE ACTIVATED! 🎉"; then
    bash "$PLAY_TTS" "Party Mode Activated! All agents are here for a group discussion!" &
  fi

  # Detect agent dialogues
  echo "$LAST_RESPONSE" | detect_and_speak_party_mode_dialogue
fi

# Exit successfully
exit 0
