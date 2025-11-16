# Development Setup

This guide will help you set up the Test Platform for local development.

## Prerequisites

- **Node.js**: >= 24.0.0
- **npm**: >= 10.0.0
- **PostgreSQL**: 17.6 (or compatible version)
- **Git**: For version control

## Initial Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd test-platform
```

### 2. Install Dependencies

```bash
npm ci
```

### 3. Database Setup

#### Start PostgreSQL

Make sure PostgreSQL is running on your system. Default connection:

- Host: `localhost`
- Port: `5432`
- User: `change_user`
- Password: `change_password`
- Database: `test_db`

#### Create Database

```bash
createdb test_db
```

#### Configure Environment

Create a `.env` file in the project root:

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=change_user
DB_PASSWORD=change_password
DB_NAME=test_db

# Application
NODE_ENV=development
BASE_URL=http://localhost:3001
NEXTAUTH_URL=http://localhost:3001

# Authentication
NEXTAUTH_SECRET=your-secret-here
JWT_SECRET=your-jwt-secret-here
```

Generate JWT secret and token:

```bash
# Generate JWT secret
npm run generate-jwt-secret

# Generate JWT token for API access
npm run generate-jwt
```

#### Push Database Schema

```bash
npm run db:push
```

### 4. Start Development Server

```bash
npm run dev
```

The application will be available at: **http://localhost:3001**

## Development Commands

### Running the App

```bash
npm run dev          # Start development server (port 3001)
npm run build        # Build for production
npm run start        # Start production server
```

### Code Quality

```bash
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
npm run format:check # Check code formatting
npm run check        # Run lint + format check
```

### Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit           # Unit tests only
npm run test:unit:coverage  # Unit tests with coverage
npm run test:api            # API tests
npm run test:pages          # Page tests
npm run test:e2e            # E2E tests with Playwright
npm run test:e2e:ui         # E2E tests with UI
npm run test:e2e:debug      # E2E tests in debug mode
npm run test:coverage       # All tests with coverage
```

### Database Management

```bash
npm run db:generate  # Generate migrations
npm run db:migrate   # Run migrations
npm run db:push      # Push schema to database
npm run db:studio    # Open Drizzle Studio (database GUI)
```

## Project Structure

```
test-platform/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # Dashboard page
│   └── test-reports/      # Test reports pages
├── components/            # React components
│   ├── ui/               # UI components (shadcn/ui)
│   └── test-results/     # Test result components
├── lib/                   # Utility libraries
│   ├── db/               # Database schema and client
│   ├── errors/           # Error handling
│   └── services/         # Business logic
├── tests/                 # Test files
│   ├── app/              # API and page tests (Vitest)
│   ├── e2e/              # E2E tests (Playwright)
│   ├── helpers/          # Test utilities
│   └── unit/             # Unit tests
├── scripts/               # Build and utility scripts
├── specs/                 # Feature specifications
└── test-run/              # External test artifacts
```

## Database Schema

The application uses PostgreSQL with Drizzle ORM. Main tables:

- **`test_artifacts`** - Raw test artifact uploads
- **`api_events`** - API event logs
- **`users`** - User accounts
- **`accounts`** - OAuth accounts
- **`sessions`** - User sessions

## Testing Infrastructure

### Test Isolation

Each test file gets its own PostgreSQL database for complete isolation:

```
Test File Path                              Database Name
─────────────────────────────────────────   ───────────────────────────────────
tests/app/api/test-reports/route.test.ts    tests_app_api_testreports_route_db
tests/app/api/users/route.test.ts            tests_app_api_users_route_db
```

Individual tests within a file use transaction rollback for isolation.

### Test Data

- **Unit/API/Page tests**: Use `/test-run/` folder artifacts
- **E2E tests**: Use `/test-data/` folder artifacts

### Running Tests Locally

Tests automatically:

1. Create isolated database per test file
2. Push schema to test database
3. Run tests with transaction rollback
4. Clean up test databases

## Authentication

The platform uses NextAuth.js v5 with JWT tokens:

- **Sign in**: `/auth/signin`
- **API authentication**: Bearer token in `Authorization` header
- **Session management**: JWT-based sessions

## API Endpoints

### Public Endpoints

- `GET /api/public` - Health check

### Protected Endpoints (require authentication)

- `POST /api/test-reports` - Upload test artifact
- `GET /api/test-reports` - List test reports
- `GET /api/test-reports/[id]` - Get test report details
- `POST /api/test-reports/[id]/reprocess` - Reprocess test artifact
- `GET /api/test-results/[artifactId]/files` - Get test result files
- `GET /api/test-results/[artifactId]/search` - Search test results
- `GET /api/events` - List API events
- `GET /api/events/[id]` - Get event details

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
pg_isready

# Verify connection details in .env
cat .env | grep DB_
```

### Port Already in Use

If port 3001 is already in use:

```bash
# Find process using port 3001
lsof -ti:3001

# Kill the process
kill -9 $(lsof -ti:3001)
```

### Test Database Issues

```bash
# Drop all test databases
psql -U change_user -c "DROP DATABASE IF EXISTS tests_*"

# Tests will recreate databases automatically
npm run test:api
```

### Dependency Issues

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

## IDE Setup

### VS Code

Recommended extensions:

- ESLint
- Prettier - Code formatter
- Tailwind CSS IntelliSense
- Drizzle ORM

### Environment Variables

Create `.vscode/settings.json`:

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode"
}
```

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [Playwright Documentation](https://playwright.dev)
- [Vitest Documentation](https://vitest.dev)
- [NextAuth.js Documentation](https://authjs.dev)

## Getting Help

If you encounter issues:

1. Check this documentation
2. Review existing test files for examples
3. Check the `/specs` folder for feature specifications
4. Open an issue on GitHub
