# Contributing to Test Platform

Thank you for considering contributing to the Test Platform! This document provides guidelines and best practices for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Documentation](#documentation)

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Keep discussions professional and on-topic

## Getting Started

1. **Fork the repository** and clone your fork locally
2. **Set up your development environment** following [DEVELOPMENT.md](./DEVELOPMENT.md)
3. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Branch Naming Convention

Use descriptive branch names that indicate the type of change:

- `feature/add-xyz` - New features
- `fix/bug-description` - Bug fixes
- `refactor/component-name` - Code refactoring
- `docs/update-readme` - Documentation updates
- `test/add-coverage` - Test additions/improvements

### Making Changes

1. **Write tests first** (TDD approach preferred)
2. **Implement your changes**
3. **Run tests** to ensure everything passes:
   ```bash
   npm test
   ```
4. **Run linting and formatting**:
   ```bash
   npm run check
   ```
5. **Test manually** in the browser if applicable

### Feature Development Process

For new features, follow the spec-driven approach:

1. **Create a specification** in `/specs/[feature-number]-[feature-name]/`
   - `spec.md` - Feature specification
   - `plan.md` - Implementation plan
   - `tasks.md` - Actionable task list

2. **Implement following the plan**
3. **Add comprehensive tests**
4. **Update documentation**

## Coding Standards

### TypeScript

- **Use TypeScript** for all new code
- **Avoid `any` types** - use proper typing
- **Use interfaces** for object shapes
- **Export types** that are used across modules

Example:

```typescript
// Good
interface TestReport {
  id: string;
  framework: string;
  status: 'passed' | 'failed';
}

// Avoid
const report: any = { ... };
```

### React Components

- **Use functional components** with hooks
- **Prefer composition** over prop drilling
- **Keep components focused** - single responsibility
- **Use TypeScript** for props

Example:

```typescript
interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}

export function Button({ onClick, children, variant = 'primary' }: ButtonProps) {
  // Implementation
}
```

### File Organization

- **Co-locate** related files (components, styles, tests)
- **Use barrel exports** (`index.ts`) for cleaner imports
- **Group** by feature, not by type

```
components/
├── test-results/
│   ├── grouped-results-table.tsx
│   ├── test-result-card.tsx
│   └── index.ts
```

### Naming Conventions

- **PascalCase**: Components, types, interfaces
- **camelCase**: Functions, variables, files (except components)
- **kebab-case**: CSS classes, file names (non-component)
- **SCREAMING_SNAKE_CASE**: Constants

### Code Style

- **Use Prettier** for formatting (runs automatically)
- **Follow ESLint rules**
- **Max line length**: 100 characters (soft limit)
- **Use meaningful variable names**
- **Add comments** for complex logic only

## Testing Guidelines

### Test Coverage Requirements

- **Unit tests**: All business logic and utilities
- **API tests**: All API endpoints
- **Page tests**: All page routes
- **E2E tests**: Critical user workflows

### Writing Tests

#### Unit Tests

```typescript
import { describe, it, expect } from 'vitest';
import { parseTestResults } from './parser';

describe('parseTestResults', () => {
  it('should parse Playwright test results', () => {
    const input = {
      /* test artifact */
    };
    const result = parseTestResults(input);

    expect(result).toMatchObject({
      framework: 'playwright',
      passed: 5,
      failed: 0,
    });
  });
});
```

#### API Tests

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { testDb } from '@/tests/helpers/test-database';

describe('POST /api/test-reports', () => {
  beforeEach(async () => {
    await testDb.cleanup();
  });

  it('should create a test report', async () => {
    const response = await fetch('http://localhost:3001/api/test-reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${JWT_TOKEN}`,
      },
      body: JSON.stringify({
        /* payload */
      }),
    });

    expect(response.status).toBe(201);
  });
});
```

#### E2E Tests

```typescript
import { test, expect } from '@playwright/test';

test('user can view test reports', async ({ page }) => {
  await page.goto('/test-reports');

  await expect(page.locator('h1')).toContainText('Test Reports');
  await expect(page.locator('[data-testid="report-card"]')).toHaveCount(3);
});
```

### Test Best Practices

- **Arrange-Act-Assert** pattern
- **One assertion concept** per test
- **Use descriptive test names**
- **Avoid test interdependence**
- **Mock external dependencies**
- **Use test data factories** for consistency

## Commit Guidelines

### Commit Message Format

```
<type>: <subject>

<body>

<footer>
```

### Commit Types

- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring
- `test`: Test additions/updates
- `docs`: Documentation updates
- `style`: Code style changes (formatting)
- `perf`: Performance improvements
- `chore`: Build process, dependencies

### Examples

```bash
feat: add test result filtering by status

Allow users to filter test results by passed/failed/skipped status
using dropdown menu on test reports page.

Closes #123
```

```bash
fix: correct date formatting in test report list

Test report timestamps were showing incorrect timezone.
Now using UTC consistently across the application.
```

### Commit Best Practices

- **Keep commits atomic** - one logical change per commit
- **Write clear messages** - explain why, not what
- **Reference issues** - use "Closes #123" or "Refs #456"
- **Sign commits** (optional but recommended)

## Pull Request Process

### Before Submitting

1. ✅ **All tests pass**: `npm test`
2. ✅ **No linting errors**: `npm run check`
3. ✅ **Code is formatted**: `npm run format`
4. ✅ **Branch is up to date** with `main`
5. ✅ **Commits are clean** and well-organized

### PR Title Format

Use the same format as commit messages:

```
feat: add test result filtering
fix: correct date formatting in reports
```

### PR Description Template

```markdown
## Description

Brief description of the changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] Unit tests added/updated
- [ ] API tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed

## Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests pass locally

## Screenshots (if applicable)

Add screenshots for UI changes

## Related Issues

Closes #123
Refs #456
```

### Review Process

1. **Automated checks** must pass (CI/CD)
2. **At least one approval** required
3. **Address review feedback** promptly
4. **Resolve conflicts** with main branch
5. **Squash commits** if requested

### After Approval

- Maintainers will merge using **squash and merge**
- Delete your feature branch after merge
- Update local main branch:
  ```bash
  git checkout main
  git pull origin main
  ```

## Documentation

### When to Update Documentation

Update documentation when:

- Adding new features
- Changing API endpoints
- Modifying configuration
- Adding dependencies
- Changing development workflow

### Documentation Files

- **DEVELOPMENT.md** - Setup and development guide
- **CONTRIBUTING.md** - This file
- **README.md** - Project overview (if exists)
- **specs/** - Feature specifications
- **Code comments** - Complex logic explanation

### Writing Good Documentation

- **Be clear and concise**
- **Include examples**
- **Keep it up to date**
- **Use proper formatting**
- **Add screenshots** for UI features

## Additional Guidelines

### API Design

- **RESTful conventions**
- **Consistent error responses**
- **Proper HTTP status codes**
- **Input validation**
- **Rate limiting** (where appropriate)

### Security

- **Never commit secrets** or credentials
- **Validate user input**
- **Use parameterized queries**
- **Sanitize output**
- **Follow OWASP guidelines**

### Performance

- **Optimize database queries**
- **Use pagination** for large datasets
- **Lazy load** when appropriate
- **Profile performance** for critical paths

### Accessibility

- **Semantic HTML**
- **ARIA labels** where needed
- **Keyboard navigation**
- **Color contrast** compliance

## Questions?

If you have questions about contributing:

1. Check existing documentation
2. Look at similar PRs for examples
3. Ask in discussions or issues
4. Reach out to maintainers

## Recognition

All contributors will be recognized in the project. Thank you for making Test Platform better!

---

**Happy Contributing!** 🎉
