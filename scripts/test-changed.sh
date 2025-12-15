#!/bin/bash
# Run only tests for changed files
# Usage: ./scripts/test-changed.sh [base-branch]
#
# Detects changed test files and runs only those tests.
# Useful for quick feedback during development.

set -e

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

BASE_BRANCH="${1:-main}"

echo "🔍 Detecting changed files since $BASE_BRANCH..."
echo ""

# Get changed files with explicit fallback handling
if ! CHANGED_FILES=$(git diff --name-only "$BASE_BRANCH"...HEAD 2>&1); then
  echo -e "${YELLOW}Warning: Could not diff against '$BASE_BRANCH'${NC}"
  echo "  Reason: $CHANGED_FILES"
  echo ""
  echo -e "${YELLOW}Falling back to comparing with HEAD~1${NC}"
  echo ""

  if ! CHANGED_FILES=$(git diff --name-only HEAD~1 2>&1); then
    echo -e "${RED}Error: Could not determine changed files${NC}"
    echo "  Reason: $CHANGED_FILES"
    echo ""
    echo "Ensure you're in a git repository with at least one commit."
    exit 1
  fi
fi

# Filter for test-affecting changes
TEST_FILES=$(echo "$CHANGED_FILES" | grep -E "^e2e/.*\.(ts|tsx)$" || true)
SRC_FILES=$(echo "$CHANGED_FILES" | grep -E "^src/.*\.(ts|tsx)$" || true)

if [ -z "$TEST_FILES" ] && [ -z "$SRC_FILES" ]; then
  echo "📋 No test-affecting changes detected"
  echo "   Changed files:"
  echo "$CHANGED_FILES" | sed 's/^/      /'
  echo ""
  echo "Skipping tests. Run 'npm run test:e2e' for full suite."
  exit 0
fi

echo "📋 Changed files that affect tests:"
if [ -n "$TEST_FILES" ]; then
  echo "   Test files:"
  echo "$TEST_FILES" | sed 's/^/      /'
fi
if [ -n "$SRC_FILES" ]; then
  echo "   Source files:"
  echo "$SRC_FILES" | sed 's/^/      /'
fi

echo ""

# If specific test files changed, run only those
if [ -n "$TEST_FILES" ]; then
  echo "🧪 Running changed test files..."
  # Pass files directly to playwright (not --grep which filters by title)
  echo "$TEST_FILES" | xargs npx playwright test
else
  echo "🧪 Source files changed - running full test suite..."
  npm run test:e2e
fi

echo ""
echo "✅ Selective tests completed!"
