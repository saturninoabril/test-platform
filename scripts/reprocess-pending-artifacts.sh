#!/bin/bash

# Reprocess all pending test artifacts
# This script triggers background processing for all artifacts in 'pending' status

set -euo pipefail

# Configuration
API_URL="${API_URL:-http://localhost:3001}"
JWT_SUBJECT="${JWT_SUBJECT:-reprocess-service}"
JWT_ROLES="${JWT_ROLES:-admin}"
JWT_EXPIRES="${JWT_EXPIRES:-1h}"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Reprocess Pending Artifacts${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

# Step 1: Generate JWT token
echo -e "${YELLOW}Step 1: Generating JWT token...${NC}"
JWT_OUTPUT=$(npm run generate-jwt -- --subject "$JWT_SUBJECT" --roles "$JWT_ROLES" --expires "$JWT_EXPIRES" 2>&1)
JWT_TOKEN=$(echo "$JWT_OUTPUT" | grep -E '^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' | head -1)

if [ -z "$JWT_TOKEN" ]; then
  echo -e "${RED}✗ Failed to generate JWT token${NC}"
  echo "Make sure JWT_SECRET is set in your .env file"
  echo "Debug output:"
  echo "$JWT_OUTPUT"
  exit 1
fi

echo -e "${GREEN}✓ JWT token generated${NC}"
echo ""

# Step 2: Fetch all pending artifacts
echo -e "${YELLOW}Step 2: Fetching pending artifacts...${NC}"
PENDING_ARTIFACTS=$(curl -s "${API_URL}/api/test-reports?page=1&pageSize=1000" | jq -r '.data[] | select(.processingStatus == "pending") | .id')

if [ -z "$PENDING_ARTIFACTS" ]; then
  echo -e "${YELLOW}No pending artifacts found${NC}"
  exit 0
fi

# Count artifacts
ARTIFACT_COUNT=$(echo "$PENDING_ARTIFACTS" | wc -l | tr -d ' ')
echo -e "${GREEN}✓ Found ${ARTIFACT_COUNT} pending artifacts${NC}"
echo ""

# Step 3: Trigger reprocessing for each artifact
echo -e "${YELLOW}Step 3: Triggering reprocessing...${NC}"
echo ""

SUCCESS_COUNT=0
FAILED_COUNT=0

while IFS= read -r artifact_id; do
  echo -e "${BLUE}Processing artifact: ${artifact_id}${NC}"

  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    "${API_URL}/api/test-reports/${artifact_id}/reprocess" \
    -H "Authorization: Bearer ${JWT_TOKEN}" \
    -H "Content-Type: application/json")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ Reprocessing triggered${NC}"
    ((SUCCESS_COUNT++))
  else
    echo -e "${RED}✗ Failed (HTTP $HTTP_CODE)${NC}"
    if [ -n "$BODY" ]; then
      echo "$BODY" | jq -r '.error // .message // .' 2>/dev/null || echo "$BODY"
    fi
    ((FAILED_COUNT++))
  fi
  echo ""
done <<< "$PENDING_ARTIFACTS"

# Summary
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "Total pending:   ${YELLOW}${ARTIFACT_COUNT}${NC}"
echo -e "Successfully triggered:  ${GREEN}${SUCCESS_COUNT}${NC}"
echo -e "Failed:          ${RED}${FAILED_COUNT}${NC}"
echo ""

if [ "$FAILED_COUNT" -eq 0 ]; then
  echo -e "${GREEN}✓ All artifacts triggered for reprocessing${NC}"
  exit 0
else
  echo -e "${YELLOW}⚠ Some artifacts failed to trigger${NC}"
  exit 1
fi
