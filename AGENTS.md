# Agent Guidelines for N8N StreamDeck

## Build/Test Commands

- **Build**: `pnpm build` (all), `pnpm build:fast` (skip tests/lint)
- **Test**: `pnpm test` (all), `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`
- **Single test**: `pnpm --filter @n8n-streamdeck/backend test -- --testNamePattern="test name"`
- **Lint**: `pnpm lint`, `pnpm lint:fix`
- **Typecheck**: `pnpm typecheck`
- **Dev**: `pnpm dev` (starts all services with port management)

## Code Style

- **Formatting**: Prettier (2 spaces, single quotes, semicolons, 80 char width)
- **Linting**: ESLint with TypeScript, unused vars prefixed with `_`
- **Imports**: Absolute imports using workspace aliases (`@n8n-streamdeck/shared`)
- **Types**: Strict TypeScript, explicit interfaces, Zod for validation
- **Naming**: camelCase for variables/functions, PascalCase for classes/components
- **Error handling**: Custom error classes in `errors/CustomErrors.ts`
- **Database**: Prisma ORM with migrations in `apps/backend/prisma/`
- **Frontend**: Next.js with React, Tailwind CSS, React Hook Form + Zod
- **Testing**: Jest for unit/integration, Playwright for E2E
- **File structure**: Monorepo with `apps/` and `packages/`, workspace dependencies

## Key Patterns

- Controllers use dependency injection with services
- Validation with express-validator (backend) and Zod schemas (frontend)
- Authentication via JWT with refresh tokens
- Socket.io for real-time communication
