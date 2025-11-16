# Test Platform

Your testing hub. Ship with confidence.

A centralized platform for visualizing test results, tracking quality metrics, and managing test artifacts from multiple testing frameworks.

## Features

- 📊 **Test Report Dashboard** - Visualize test results from Playwright and Cypress
- 🔍 **Advanced Search** - Find specific test failures quickly
- 📈 **Quality Metrics** - Track pass/fail rates over time
- 🔄 **Artifact Processing** - Automatic parsing and storage of test artifacts
- 🔐 **Authentication** - Secure API access with JWT tokens
- 📝 **Event Logging** - Track all API interactions for audit and troubleshooting

## Quick Start

```bash
# Install dependencies
npm ci

# Setup environment
cp .env.example .env
npm run generate-jwt

# Setup database
npm run db:push

# Start development server
npm run dev
```

Visit **http://localhost:3001** to see the platform in action.

## Documentation

- **[Development Setup](./docs/DEVELOPMENT.md)** - Complete setup guide for local development
- **[Contributing Guidelines](./docs/CONTRIBUTING.md)** - How to contribute to the project

## Tech Stack

- **Framework**: Next.js 16.0.3 (App Router)
- **Language**: TypeScript 5.9.3
- **Database**: PostgreSQL 17.6 with Drizzle ORM
- **Authentication**: NextAuth.js 5.0
- **Testing**: Playwright 1.48+ & Vitest 4.0.9
- **UI**: React 19 + Tailwind CSS + shadcn/ui

## Requirements

- Node.js >= 24.0.0
- npm >= 10.0.0
- PostgreSQL 17.6

## Scripts

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm test                 # Run all tests
npm run check            # Run linting and format check
```

See [DEVELOPMENT.md](./docs/DEVELOPMENT.md) for complete command reference.

## Project Structure

```
test-platform/
├── app/                # Next.js App Router
├── components/         # React components
├── lib/                # Utilities and business logic
├── tests/              # Test files
├── docs/               # Documentation
└── specs/              # Feature specifications
```

## Contributing

We welcome contributions! Please read our [Contributing Guidelines](./docs/CONTRIBUTING.md) before submitting a pull request.

## License

[Add your license here]

---

Built with ❤️ for better testing workflows
