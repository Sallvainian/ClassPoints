#!/bin/bash
# Standalone burn-in execution for flaky test detection
# Usage: ./scripts/burn-in.sh [iterations]
#
# Runs the test suite multiple times to detect flaky tests.
# Default: 10 iterations (matches CI burn-in)

set -e

ITERATIONS="${1:-10}"

echo "🔥 Burn-in Test Runner"
echo "======================"
echo ""
echo "Running $ITERATIONS iterations to detect flaky tests..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0
FAILED_ITERATIONS=""

for i in $(seq 1 "$ITERATIONS"); do
  echo -e "${YELLOW}🔥 Iteration $i/$ITERATIONS${NC}"

  if npm run test:e2e > /dev/null 2>&1; then
    PASSED=$((PASSED + 1))
    echo -e "   ${GREEN}✓ Passed${NC}"
  else
    FAILED=$((FAILED + 1))
    FAILED_ITERATIONS="$FAILED_ITERATIONS $i"
    echo -e "   ${RED}✗ Failed${NC}"
  fi
done

echo ""
echo "======================"
echo "Burn-in Results"
echo "======================"
echo ""
echo -e "Passed: ${GREEN}$PASSED${NC}/$ITERATIONS"
echo -e "Failed: ${RED}$FAILED${NC}/$ITERATIONS"

if [ $FAILED -gt 0 ]; then
  echo ""
  echo -e "${RED}⚠️  FLAKY TESTS DETECTED${NC}"
  echo "Failed iterations:$FAILED_ITERATIONS"
  echo ""
  echo "Run 'npm run test:e2e' to see full failure details."
  echo "Check test-results/ and playwright-report/ for artifacts."
  exit 1
else
  echo ""
  echo -e "${GREEN}✅ All $ITERATIONS iterations passed - tests are stable!${NC}"
fi
