# Tech-Spec: Configurable Sound Effects

**Created:** 2025-12-05
**Status:** Ready for Development

---

## Overview

### Problem Statement

Teachers using ClassPoints have no audio feedback when awarding points to students. Visual-only feedback requires teachers to watch the screen, reducing the "celebration moment" that reinforces positive behaviors. ClassDojo's success is partly due to its satisfying audio cues that create instant, classroom-wide feedback.

### Solution

Add a configurable sound effects system that plays distinct audio for positive and negative behavior awards. Sounds play instantly when points are awarded, with user-configurable volume, mute toggle, and choice of built-in sounds (plus optional custom URLs).

### Scope

**In Scope:**
- Distinct sounds for positive/negative behaviors (Must Have)
- Instant playback with no perceptible delay (Must Have)
- Global mute toggle (Must Have)
- Volume control slider (Should Have)
- Multiple built-in sound options - 3 per category (Should Have)
- Custom sound URL support (Nice to Have)

**Out of Scope:**
- Per-classroom sound customization (deferred to future)
- Sound effects for other actions (undo, delete, etc.)
- Background music or ambient sounds

---

## Context for Development

### Codebase Patterns

| Pattern | Location | Usage |
|---------|----------|-------|
| Custom hooks | `src/hooks/` | Create `useSoundEffects.ts` following existing hook patterns |
| Context providers | `src/contexts/` | Add `SoundContext.tsx` for settings state |
| Settings UI | `src/components/` | Create `settings/SoundSettings.tsx` component |
| App context facade | `src/contexts/AppContext.tsx` | Expose sound functions via `useApp()` if needed |
| Supabase integration | `src/contexts/SupabaseAppContext.tsx` | Sync settings to database |

### Files to Reference

**Integration Points (where sounds trigger):**
- `src/components/points/AwardPointsModal.tsx:56` - Individual student awards
- `src/components/points/ClassAwardModal.tsx:45` - Class-wide awards

**Pattern References:**
- `src/hooks/useRealtimeSubscription.ts` - Hook pattern example
- `src/contexts/HybridAppContext.tsx` - Context provider pattern
- `src/types/index.ts` - Type definition patterns

### Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Audio API | Web Audio API | Lower latency than `<audio>` elements, volume control built-in |
| Sound storage | Base64 embedded | No network latency, works offline, instant playback |
| Settings persistence | Supabase `user_sound_settings` table | Syncs across devices, consistent with app architecture |
| Sound format | MP3 | Universal browser support, small file size |
| Preloading | On app mount | Eliminates first-play delay |

---

## Implementation Plan

### Tasks

- [ ] **Task 1: Create sound assets infrastructure**
  - Create `src/assets/sounds/` directory
  - Add 3 positive sounds (chime, bell, sparkle) as MP3 files
  - Add 3 negative sounds (soft-buzz, low-tone, gentle-womp) as MP3 files
  - Source royalty-free sounds similar to ClassDojo style
  - Convert to base64 and create `src/assets/sounds/index.ts` export

- [ ] **Task 2: Create database schema for sound settings**
  - Create migration `supabase/migrations/XXX_add_sound_settings.sql`
  - Table: `user_sound_settings` with columns:
    - `id` (uuid, PK)
    - `user_id` (uuid, FK to auth.users)
    - `enabled` (boolean, default true)
    - `volume` (float, default 0.7, range 0.0-1.0)
    - `positive_sound` (text, default 'chime')
    - `negative_sound` (text, default 'soft-buzz')
    - `custom_positive_url` (text, nullable)
    - `custom_negative_url` (text, nullable)
    - `created_at`, `updated_at` timestamps
  - Add RLS policies for user-only access
  - Add TypeScript types to `src/types/database.ts`

- [ ] **Task 3: Create SoundContext provider**
  - Create `src/contexts/SoundContext.tsx`
  - Manage sound settings state
  - Preload audio on mount using Web Audio API
  - Fetch/save settings from Supabase
  - Expose: `settings`, `updateSettings()`, `isLoading`

- [ ] **Task 4: Create useSoundEffects hook**
  - Create `src/hooks/useSoundEffects.ts`
  - Consume SoundContext
  - API: `playPositive()`, `playNegative()`, `setVolume(n)`, `toggleMute()`
  - Handle custom URL loading with error fallback to default
  - Preload all sounds into AudioBuffer cache
  - Create `validateAudioUrl()` utility function:
    - Validate URL format (prevent XSS)
    - Check Content-Type header is `audio/*`
    - Set 3-second timeout for loading
    - Return `{ valid: boolean, error?: string }`
    - Fallback to default sound on ANY validation error
  - Handle browser autoplay restrictions gracefully (catch errors, log warning, don't crash)

- [ ] **Task 5: Integrate sounds into award flows**
  - Update `AwardPointsModal.tsx:49-61`:
    - Use `behavior.category` to determine which sound function to call
    - Call `playPositive()` or `playNegative()` AFTER `awardPoints()` succeeds
    - Play sound BEFORE `onClose()` so celebration happens while modal visible
  - Update `ClassAwardModal.tsx:44-47`:
    - Same pattern: check `behavior.category`, play appropriate sound before `onClose()`
  - Both files already have access to `behavior` object with `category` field

- [ ] **Task 6: Create SoundSettings UI component**
  - Create `src/components/settings/SoundSettings.tsx`
  - Master enable/disable toggle at top
  - Volume slider (0-100% mapped to 0.0-1.0)
  - Dropdown for positive sound selection with preview button
  - Dropdown for negative sound selection with preview button
  - Optional: Custom URL input fields (collapsible "Advanced" section)
  - Save button or auto-save on change

- [ ] **Task 7: Add SoundSettings to app and wire up provider**
  - Add `SoundProvider` to `App.tsx` provider hierarchy:
    - Position: `AuthProvider → AuthGuard → SoundProvider → HybridAppProvider`
    - SoundProvider needs auth context for user_id database access
  - Add sound settings access to UI (MVP approach):
    - Add 🔊 icon button to app header (top right area)
    - Opens `SoundSettingsModal.tsx` - focused modal just for sound settings
    - Simpler than full settings page, faster to ship
  - Create `src/components/settings/SoundSettingsModal.tsx` wrapper

- [ ] **Task 8: Add tests**
  - Unit tests for `useSoundEffects` hook:
    - Mock `AudioContext` to verify correct sound buffer is played
    - Test volume calculations (0-100% → 0.0-1.0)
    - Test mute toggle behavior
    - Test `validateAudioUrl()` with valid/invalid URLs
  - Unit tests for SoundContext:
    - Test settings load/save with mocked Supabase
    - Test default values when no settings exist
  - Integration tests:
    - Spy on hook to confirm award flows trigger sound functions
    - Verify `playPositive()` called for positive behaviors
    - Verify `playNegative()` called for negative behaviors
  - E2E test:
    - Award points flow completes without errors
    - Settings modal opens and saves correctly
  - Add `testMode` flag to hook that logs instead of playing (for E2E verification)

### Acceptance Criteria

- [ ] **AC1:** Given sounds are enabled and a positive behavior is awarded, when the award succeeds, then a positive sound plays immediately
- [ ] **AC2:** Given sounds are enabled and a negative behavior is awarded, when the award succeeds, then a negative sound plays immediately
- [ ] **AC3:** Given sounds are muted, when any behavior is awarded, then no sound plays
- [ ] **AC4:** Given the user adjusts volume to 50%, when a sound plays, then it plays at half volume
- [ ] **AC5:** Given the user selects "Bell" as positive sound, when a positive behavior is awarded, then the bell sound plays (not chime or sparkle)
- [ ] **AC6:** Given the user enters a custom URL for positive sound, when that URL is valid audio, then it plays instead of built-in sounds
- [ ] **AC7:** Given the user enters an invalid custom URL, when sound should play, then the default sound plays as fallback
- [ ] **AC8:** Given sound settings are saved, when the user logs in on another device, then the same settings are applied
- [ ] **AC9:** Given browser blocks autoplay (e.g., iOS Safari), when an award happens, then the app continues without crashing and logs a warning to console

---

## Additional Context

### Dependencies

| Dependency | Purpose | Action |
|------------|---------|--------|
| Web Audio API | Audio playback | Built into browsers, no package needed |
| Royalty-free sounds | Audio assets | Source from freesound.org or similar |
| Supabase | Settings persistence | Already integrated |

### Testing Strategy

| Test Type | Coverage |
|-----------|----------|
| Unit tests | `useSoundEffects` hook logic, volume calculations, sound selection |
| Integration | SoundContext + Supabase sync |
| E2E | Award flow doesn't break, settings persist |
| Manual | Audio actually plays, sounds are distinct, volume works |

### Sound Asset Sourcing

Recommended sources for ClassDojo-style sounds:
- [Freesound.org](https://freesound.org) - Search "notification chime", "positive ding", "error buzz"
- [Mixkit](https://mixkit.co/free-sound-effects/) - Free for commercial use
- Keep sounds under 1 second duration for instant feedback feel
- Target file size: <50KB per sound (MP3 at 128kbps)

### Notes

- **Latency is critical** - ClassDojo's magic is the instant feedback. Use AudioContext for lowest latency.
- **Preload everything** - Don't lazy-load sounds; users will notice the first-play delay.
- **Graceful degradation** - If audio fails for any reason, the app should continue working silently (no crashes).
- **Mobile considerations** - iOS requires user interaction before audio can play. The award button tap satisfies this.

---

## File Structure (New Files)

```
src/
├── assets/
│   └── sounds/
│       ├── index.ts          # Base64 exports
│       ├── chime.mp3
│       ├── bell.mp3
│       ├── sparkle.mp3
│       ├── soft-buzz.mp3
│       ├── low-tone.mp3
│       └── gentle-womp.mp3
├── contexts/
│   └── SoundContext.tsx      # Sound settings provider
├── hooks/
│   └── useSoundEffects.ts    # Sound playback hook
├── utils/
│   └── validateAudioUrl.ts   # URL validation utility
└── components/
    └── settings/
        ├── SoundSettings.tsx       # Settings form UI
        └── SoundSettingsModal.tsx  # Modal wrapper with trigger button

supabase/
└── migrations/
    └── XXX_add_sound_settings.sql
```

## Provider Hierarchy (Updated)

```
AuthProvider
  └── AuthGuard
        └── SoundProvider        ← NEW (needs auth for user_id)
              └── HybridAppProvider
                    └── App content
```
