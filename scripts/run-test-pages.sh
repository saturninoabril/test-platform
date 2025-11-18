#!/bin/bash
# Run page tests with dedicated database

set -e

# Export test type for vitest to load correct env file
export TEST_TYPE=pages

# Load environment from .env.test.pages
set -a
source .env.test.pages
set +a

# Setup database
npx tsx scripts/test-db-setup.ts pages

# Kill any existing process on port 3001
lsof -ti :3001 | xargs kill -9 2>/dev/null || true
sleep 1

# Start dev server in background with explicit env file
echo "Starting test server on port 3001..."
TEST_TYPE=pages npx dotenv -e .env.test.pages -- npm run dev > tests/test-server-pages.log 2>&1 &
DEV_SERVER_PID=$!

# Wait for server to be ready
echo "Waiting for server to be ready..."
timeout 30 bash -c 'until curl -s http://localhost:3001/api/public > /dev/null; do sleep 1; done' || {
  echo "Server failed to start"
  cat tests/test-server-pages.log | tail -20
  kill $DEV_SERVER_PID 2>/dev/null || true
  exit 1
}

echo "Server ready, running tests..."

# Run tests and capture exit code
TEST_TYPE=pages npx vitest run tests/app --exclude tests/app/api
TEST_EXIT_CODE=$?

# Cleanup: kill dev server
kill $DEV_SERVER_PID 2>/dev/null || true

# Exit with test exit code
exit $TEST_EXIT_CODE
