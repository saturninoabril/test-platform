#!/bin/bash
# Run E2E tests with dedicated database

set -e

# Export test type for playwright to load correct env file
export TEST_TYPE=e2e

# Load environment from .env.test.e2e
set -a
source .env.test.e2e
set +a

# Setup database
npx tsx scripts/test-db-setup.ts e2e

# Start dev server in background with explicit env file
echo "Starting test server on port 3001..."
TEST_TYPE=e2e npx dotenv -e .env.test.e2e -- npm run dev > tests/test-server-e2e.log 2>&1 &
DEV_SERVER_PID=$!

# Wait for server to be ready
echo "Waiting for server to be ready..."
timeout 30 bash -c 'until curl -s http://localhost:3001/api/public > /dev/null; do sleep 1; done' || {
  echo "Server failed to start"
  cat tests/test-server-e2e.log | tail -20
  kill $DEV_SERVER_PID 2>/dev/null || true
  exit 1
}

echo "Server ready, running tests..."

# Run tests and capture exit code
TEST_TYPE=e2e npx playwright test "$@"
TEST_EXIT_CODE=$?

# Cleanup: kill dev server
kill $DEV_SERVER_PID 2>/dev/null || true

# Exit with test exit code
exit $TEST_EXIT_CODE
