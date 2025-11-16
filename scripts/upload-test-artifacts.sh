#!/bin/bash

# Test Artifacts Upload Script
# Uploads Playwright and Cypress test artifacts with randomized GitHub Actions metadata

set -e

# Load environment variables from .env file if it exists
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -f "$PROJECT_ROOT/.env" ]; then
  # Export variables from .env file
  set -a
  source "$PROJECT_ROOT/.env"
  set +a
fi

# Configuration
API_URL="${API_URL:-http://localhost:3001}"
JWT_TOKEN="${JWT_TOKEN}"

# Default artifact paths
DEFAULT_PLAYWRIGHT_ARTIFACT="test-run/playwright/results/json/test-results.json"
DEFAULT_CYPRESS_ARTIFACT="test-run/cypress/results/mochawesome-report/mochawesome.json"

# Test data artifact paths
TEST_DATA_PLAYWRIGHT_ARTIFACT="test-data/playwright.json"
TEST_DATA_CYPRESS_ARTIFACT="test-data/cypress.json"

# Initialize with default paths
PLAYWRIGHT_ARTIFACT="$DEFAULT_PLAYWRIGHT_ARTIFACT"
CYPRESS_ARTIFACT="$DEFAULT_CYPRESS_ARTIFACT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Random data generators
REPOS=(
  "acme/web-app"
  "company/api-service"
  "team/mobile-app"
  "org/dashboard"
  "startup/platform"
  "enterprise/backend"
  "tech/frontend"
  "dev/microservice"
)

ACTORS=(
  "alice"
  "bob"
  "charlie"
  "diana"
  "evan"
  "frank"
  "grace"
  "henry"
  "iris"
  "jack"
)

BRANCHES=(
  "main"
  "develop"
  "feature/user-auth"
  "feature/api-integration"
  "bugfix/login-error"
  "release/v2.0"
  "hotfix/critical-bug"
  "feature/dashboard-redesign"
)

RUNNERS=(
  "ubuntu-latest"
  "ubuntu-22.04"
  "ubuntu-20.04"
  "macos-latest"
  "windows-latest"
)

JOBS=(
  "test"
  "e2e-tests"
  "integration-tests"
  "unit-tests"
  "smoke-tests"
  "regression-tests"
)

# Function to generate random SHA
generate_sha() {
  echo "$(openssl rand -hex 20)"
}

# Function to get random element from array
get_random() {
  local arr=("$@")
  local size=${#arr[@]}
  local index=$((RANDOM % size))
  echo "${arr[$index]}"
}

# Function to generate random run number
generate_run_number() {
  echo $((RANDOM % 1000 + 1))
}

# Function to generate random run ID
generate_run_id() {
  echo $((RANDOM % 9000000000 + 1000000000))
}

# Function to upload artifact
upload_artifact() {
  local framework=$1
  local artifact_file=$2
  local repo=$3
  local sha=$4
  local ref=$5
  local head_ref=$6
  local base_ref=$7
  local actor=$8
  local run_id=$9
  local run_number=${10}
  local run_attempt=${11}
  local job=${12}
  local runner=${13}

  echo -e "${BLUE}Uploading $framework artifact...${NC}"

  # Check if artifact file exists
  if [ ! -f "$artifact_file" ]; then
    echo -e "${RED}Error: Artifact file not found: $artifact_file${NC}"
    return 1
  fi

  # Read artifact and create payload
  ARTIFACT=$(cat "$artifact_file")

  # Create temporary file for payload (to avoid "Argument list too long" with large files)
  TEMP_PAYLOAD=$(mktemp)
  trap "rm -f '$TEMP_PAYLOAD'" EXIT

  echo "$ARTIFACT" | jq -c \
    --arg framework "$framework" \
    --arg repo "$repo" \
    --arg sha "$sha" \
    --arg ref "$ref" \
    --arg headRef "$head_ref" \
    --arg baseRef "$base_ref" \
    --arg actor "$actor" \
    --arg runId "$run_id" \
    --argjson runNumber "$run_number" \
    --argjson runAttempt "$run_attempt" \
    --arg job "$job" \
    --arg runner "$runner" \
    '{
      framework: $framework,
      artifact: .,
      githubRepository: $repo,
      githubSha: $sha,
      githubRef: $ref,
      githubHeadRef: $headRef,
      githubBaseRef: $baseRef,
      githubActor: $actor,
      githubRunId: $runId,
      githubRunNumber: $runNumber,
      githubRunAttempt: $runAttempt,
      githubJob: $job,
      runnerName: $runner
    }' > "$TEMP_PAYLOAD"

  # Send to API using temporary file
  RESPONSE=$(curl -s -X POST "$API_URL/api/test-reports" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    --data-binary "@$TEMP_PAYLOAD")

  # Clean up temporary file
  rm -f "$TEMP_PAYLOAD"

  # Check if upload was successful
  if echo "$RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    ARTIFACT_ID=$(echo "$RESPONSE" | jq -r '.artifactId')
    echo -e "${GREEN}✓ Success! Artifact ID: $ARTIFACT_ID${NC}"
    echo -e "  Repository: ${YELLOW}$repo${NC}"
    echo -e "  Commit: ${YELLOW}$sha${NC}"
    echo -e "  Branch: ${YELLOW}$ref${NC}"
    echo -e "  Actor: ${YELLOW}$actor${NC}"
    echo -e "  Run #${YELLOW}$run_number${NC} (attempt ${YELLOW}$run_attempt${NC})"
    echo ""
    return 0
  else
    echo -e "${RED}✗ Failed to upload artifact${NC}"
    echo "$RESPONSE" | jq '.'
    echo ""
    return 1
  fi
}

# Function to upload with random data
upload_random() {
  local framework=$1
  local artifact_file=$2
  local is_pr=${3:-false}

  # Generate random data
  local repo=$(get_random "${REPOS[@]}")
  local sha=$(generate_sha)
  local branch=$(get_random "${BRANCHES[@]}")
  local actor=$(get_random "${ACTORS[@]}")
  local run_id=$(generate_run_id)
  local run_number=$(generate_run_number)
  local run_attempt=$((RANDOM % 3 + 1))
  local job=$(get_random "${JOBS[@]}")
  local runner=$(get_random "${RUNNERS[@]}")

  local ref="refs/heads/$branch"
  local head_ref=""
  local base_ref=""

  # If it's a PR, set head_ref and base_ref
  if [ "$is_pr" = true ]; then
    head_ref="$branch"
    base_ref="main"
    ref="refs/pull/$((RANDOM % 500 + 1))/merge"
  fi

  upload_artifact "$framework" "$artifact_file" "$repo" "$sha" "$ref" \
    "$head_ref" "$base_ref" "$actor" "$run_id" "$run_number" \
    "$run_attempt" "$job" "$runner"
}

# Main script
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Test Artifacts Upload Script${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "API URL: ${YELLOW}$API_URL${NC}"
echo ""

# Parse command line arguments
COUNT=1
FRAMEWORK="both"
IS_PR=false
USE_TEST_DATA=false

while [[ $# -gt 0 ]]; do
  case $1 in
    -c|--count)
      COUNT="$2"
      shift 2
      ;;
    -f|--framework)
      FRAMEWORK="$2"
      shift 2
      ;;
    --pr)
      IS_PR=true
      shift
      ;;
    -t|--test-data)
      USE_TEST_DATA=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  -c, --count NUMBER     Number of times to upload each artifact (default: 1)"
      echo "  -f, --framework NAME   Framework to upload: playwright, cypress, or both (default: both)"
      echo "  -t, --test-data        Use artifacts from test-data folder instead of test-run"
      echo "  --pr                   Generate PR metadata (head_ref, base_ref)"
      echo "  -h, --help             Show this help message"
      echo ""
      echo "Environment Variables:"
      echo "  API_URL                API base URL (default: http://localhost:3001)"
      echo "  JWT_TOKEN              JWT token for authentication (required)"
      echo ""
      echo "Note: The script automatically loads variables from .env file if present."
      echo ""
      echo "Examples:"
      echo "  $0                          # Upload both artifacts once"
      echo "  $0 -c 5                     # Upload both artifacts 5 times each"
      echo "  $0 -f playwright -c 3       # Upload only Playwright 3 times"
      echo "  $0 --pr -c 2                # Upload with PR metadata 2 times each"
      echo "  $0 --test-data -c 10        # Upload test-data artifacts 10 times each"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Use -h or --help for usage information"
      exit 1
      ;;
  esac
done

# Validate count
if ! [[ "$COUNT" =~ ^[0-9]+$ ]] || [ "$COUNT" -lt 1 ]; then
  echo -e "${RED}Error: Count must be a positive integer${NC}"
  exit 1
fi

# Switch to test-data artifacts if requested
if [ "$USE_TEST_DATA" = true ]; then
  PLAYWRIGHT_ARTIFACT="$TEST_DATA_PLAYWRIGHT_ARTIFACT"
  CYPRESS_ARTIFACT="$TEST_DATA_CYPRESS_ARTIFACT"
  echo -e "${YELLOW}Using test data artifacts from test-data folder${NC}"
  echo ""
fi

# Track statistics
TOTAL_UPLOADS=0
SUCCESSFUL_UPLOADS=0
FAILED_UPLOADS=0

# Upload Playwright artifacts
if [ "$FRAMEWORK" = "playwright" ] || [ "$FRAMEWORK" = "both" ]; then
  echo -e "${BLUE}Uploading Playwright artifacts ($COUNT times)...${NC}"
  echo ""

  for i in $(seq 1 $COUNT); do
    echo -e "${YELLOW}Upload $i of $COUNT${NC}"
    if upload_random "playwright" "$PLAYWRIGHT_ARTIFACT" "$IS_PR"; then
      ((SUCCESSFUL_UPLOADS++))
    else
      ((FAILED_UPLOADS++))
    fi
    ((TOTAL_UPLOADS++))
  done
fi

# Upload Cypress artifacts
if [ "$FRAMEWORK" = "cypress" ] || [ "$FRAMEWORK" = "both" ]; then
  echo -e "${BLUE}Uploading Cypress artifacts ($COUNT times)...${NC}"
  echo ""

  for i in $(seq 1 $COUNT); do
    echo -e "${YELLOW}Upload $i of $COUNT${NC}"
    if upload_random "cypress" "$CYPRESS_ARTIFACT" "$IS_PR"; then
      ((SUCCESSFUL_UPLOADS++))
    else
      ((FAILED_UPLOADS++))
    fi
    ((TOTAL_UPLOADS++))
  done
fi

# Print summary
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Upload Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "Total uploads:      ${YELLOW}$TOTAL_UPLOADS${NC}"
echo -e "Successful:         ${GREEN}$SUCCESSFUL_UPLOADS${NC}"
echo -e "Failed:             ${RED}$FAILED_UPLOADS${NC}"
echo ""

if [ $FAILED_UPLOADS -eq 0 ]; then
  echo -e "${GREEN}✓ All uploads completed successfully!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some uploads failed${NC}"
  exit 1
fi
