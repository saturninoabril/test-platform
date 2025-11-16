# Test Artifacts Upload Script

A utility script to upload Playwright and Cypress test artifacts to the test reports API with randomized GitHub Actions metadata.

## Features

- ✅ Upload Playwright and/or Cypress test artifacts
- ✅ Randomized GitHub Actions metadata (repository, commit SHA, actor, etc.)
- ✅ Support for multiple uploads with different random data
- ✅ PR metadata simulation (head_ref, base_ref)
- ✅ Colored output with upload statistics
- ✅ Configurable via command-line options

## Prerequisites

- Development server running (`npm run dev`)
- Playwright test artifacts in `test-run/playwright/results/json/test-results.json`
- Cypress test artifacts in `test-run/cypress/results/mochawesome-report/mochawesome.json`
- `jq` installed (for JSON processing)

## Usage

### Basic Usage

```bash
# Upload both Playwright and Cypress artifacts once
./scripts/upload-test-artifacts.sh

# Upload both artifacts 5 times each with different random metadata
./scripts/upload-test-artifacts.sh -c 5

# Upload only Playwright artifacts 3 times
./scripts/upload-test-artifacts.sh -f playwright -c 3

# Upload only Cypress artifacts once
./scripts/upload-test-artifacts.sh -f cypress

# Upload with PR metadata (includes head_ref and base_ref)
./scripts/upload-test-artifacts.sh --pr -c 2
```

### Command-Line Options

| Option                 | Description                                             | Default |
| ---------------------- | ------------------------------------------------------- | ------- |
| `-c, --count NUMBER`   | Number of times to upload each artifact                 | 1       |
| `-f, --framework NAME` | Framework to upload: `playwright`, `cypress`, or `both` | both    |
| `--pr`                 | Generate PR metadata (head_ref, base_ref)               | false   |
| `-h, --help`           | Show help message                                       | -       |

### Environment Variables

| Variable    | Description                  | Default                 |
| ----------- | ---------------------------- | ----------------------- |
| `API_URL`   | API base URL                 | `http://localhost:3001` |
| `JWT_TOKEN` | JWT token for authentication | (required)              |

**Note:** The script automatically loads environment variables from the `.env` file in the project root if present. You can also override them by setting environment variables explicitly or exporting them before running the script.

### Examples

**Populate database with sample data:**

```bash
./scripts/upload-test-artifacts.sh -c 10
```

**Test only Playwright uploads:**

```bash
./scripts/upload-test-artifacts.sh -f playwright -c 5
```

**Generate PR test data:**

```bash
./scripts/upload-test-artifacts.sh --pr -c 3
```

**Upload to production API:**

```bash
export API_URL="https://your-production-api.com"
export JWT_TOKEN="your-jwt-token"
./scripts/upload-test-artifacts.sh -c 5
```

**Generate and use a JWT token:**

```bash
# Option 1: Add to .env file (recommended)
# Generate a JWT token
npm run generate-jwt -- -s "test-script" -r "write:reports" -e "24h"

# Copy the token to your .env file
echo 'JWT_TOKEN="your-generated-jwt-token"' >> .env

# Run the upload script (automatically uses JWT_TOKEN from .env)
./scripts/upload-test-artifacts.sh -c 5

# Option 2: Export manually (for one-time use)
export JWT_TOKEN="your-generated-jwt-token"
./scripts/upload-test-artifacts.sh -c 5
```

## Randomized Data

The script randomizes the following GitHub Actions metadata:

### Repositories

- acme/web-app
- company/api-service
- team/mobile-app
- org/dashboard
- startup/platform
- enterprise/backend
- tech/frontend
- dev/microservice

### Actors

- alice, bob, charlie, diana, evan, frank, grace, henry, iris, jack

### Branches

- main
- develop
- feature/user-auth
- feature/api-integration
- bugfix/login-error
- release/v2.0
- hotfix/critical-bug
- feature/dashboard-redesign

### Runners

- ubuntu-latest
- ubuntu-22.04
- ubuntu-20.04
- macos-latest
- windows-latest

### Job Names

- test
- e2e-tests
- integration-tests
- unit-tests
- smoke-tests
- regression-tests

### Additional Random Data

- **Commit SHA**: Randomly generated 40-character hex string
- **Run Number**: Random number between 1-1000
- **Run ID**: Random 10-digit number
- **Run Attempt**: Random number between 1-3

## Output

The script provides colored output showing:

- Upload progress for each artifact
- Success/failure status for each upload
- Artifact ID for successful uploads
- Randomized metadata used (repository, commit, branch, actor, run info)
- Summary statistics (total, successful, failed uploads)

### Example Output

```
═══════════════════════════════════════════════════════
  Test Artifacts Upload Script
═══════════════════════════════════════════════════════

API URL: http://localhost:3001

Uploading Playwright artifacts (2 times)...

Upload 1 of 2
Uploading playwright artifact...
✓ Success! Artifact ID: 2966976a-4d16-40f4-9015-0065bdf3ae39
  Repository: team/mobile-app
  Commit: 0830d1806ad62ef5928febb6be4d246b5b531441
  Branch: refs/heads/develop
  Actor: jack
  Run #139 (attempt 3)

═══════════════════════════════════════════════════════
  Upload Summary
═══════════════════════════════════════════════════════
Total uploads:      4
Successful:         4
Failed:             0

✓ All uploads completed successfully!
```

## Troubleshooting

### Error: Artifact file not found

Make sure you've run the tests to generate the artifact files:

```bash
# Run Playwright tests
cd test-run/playwright && npm test

# Run Cypress tests
cd test-run/cypress && npm test
```

### Error: Connection refused

Ensure the development server is running:

```bash
npm run dev
```

### Error: Unauthorized or Forbidden

Check that your JWT token is set and valid:

```bash
# Check if JWT_TOKEN is in .env file
grep JWT_TOKEN .env

# Or check if JWT_TOKEN is set in environment
echo $JWT_TOKEN

# Generate a new token if needed
npm run generate-jwt -- -s "test-script" -r "write:reports,admin" -e "24h"

# Add it to .env file
echo 'JWT_TOKEN="paste-token-here"' >> .env
```

## Use Cases

1. **Testing the API**: Quickly generate test data to verify API functionality
2. **Database seeding**: Populate the database with sample data for development
3. **Load testing**: Generate multiple artifacts to test query performance
4. **Dashboard development**: Create diverse data for building analytics/dashboards
5. **CI/CD simulation**: Simulate GitHub Actions uploads for testing workflows

## Notes

- The script uses the actual test artifacts from your test-run directory
- Each upload creates a unique record with different randomized metadata
- The script preserves the original test results within the artifact
- All timestamps are set to the current time when uploaded
- Failed uploads will not stop the script; it continues and reports all failures at the end
