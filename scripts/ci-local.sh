#!/bin/bash
# Mirror CI execution locally for debugging
# Usage: ./scripts/ci-local.sh
#
# This script replicates the CI pipeline locally to help debug
# failures that occur in GitHub Actions.

set -e

echo "🔍 Running CI pipeline locally..."
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Stage 1: Lint
echo -e "${YELLOW}Stage 1/3: Lint & Type Check${NC}"
echo "-----------------------------"

echo "Running ESLint..."
npm run lint || { echo -e "${RED}❌ ESLint failed${NC}"; exit 1; }
echo -e "${GREEN}✓ ESLint passed${NC}"

echo "Running TypeScript check..."
npm run typecheck || { echo -e "${RED}❌ TypeScript check failed${NC}"; exit 1; }
echo -e "${GREEN}✓ TypeScript check passed${NC}"

echo ""

# Stage 2: Tests
echo -e "${YELLOW}Stage 2/3: E2E Tests${NC}"
echo "--------------------"

npm run test:e2e || { echo -e "${RED}❌ E2E tests failed${NC}"; exit 1; }
echo -e "${GREEN}✓ E2E tests passed${NC}"

echo ""

# Stage 3: Burn-in (reduced iterations for local)
echo -e "${YELLOW}Stage 3/3: Burn-in (3 iterations)${NC}"
echo "----------------------------------"

for i in {1..3}; do
  echo -e "🔥 Burn-in iteration $i/3"
  npm run test:e2e || { echo -e "${RED}❌ Burn-in failed on iteration $i${NC}"; exit 1; }
done

echo -e "${GREEN}✓ Burn-in passed${NC}"

echo ""
echo "================================"
echo -e "${GREEN}✅ Local CI pipeline passed!${NC}"
echo ""
echo "Your changes are ready for push."
