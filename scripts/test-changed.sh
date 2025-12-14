#!/bin/bash
# Run only tests for changed files
# Usage: ./scripts/test-changed.sh [base-branch]
#
# Detects changed test files and runs only those tests.
# Useful for quick feedback during development.

set -e

BASE_BRANCH="${1:-main}"

echo "🔍 Detecting changed files since $BASE_BRANCH..."
echo ""

# Get changed files
CHANGED_FILES=$(git diff --name-only "$BASE_BRANCH"...HEAD 2>/dev/null || git diff --name-only HEAD~1)

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
  # Convert file paths to test filter
  TEST_FILTER=$(echo "$TEST_FILES" | tr '\n' '|' | sed 's/|$//')
  npx playwright test --grep "$TEST_FILTER"
else
  echo "🧪 Source files changed - running full test suite..."
  npm run test:e2e
fi

echo ""
echo "✅ Selective tests completed!"
