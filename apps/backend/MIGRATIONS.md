# Database Migrations

This document explains how to manage database migrations in the N8N StreamDeck backend.

## Migration Script

The backend includes a comprehensive migration script at `src/scripts/createMigration.ts` that provides several commands for managing database migrations.

## Available Commands

### Create a New Migration

```bash
npm run migration:create -- --name "your_migration_name"
```

Creates a new migration file with the specified name. In development mode, it automatically applies the migration. In production mode, it only creates the migration file.

### Deploy Migrations

```bash
npm run migration:deploy
```

Applies all pending migrations to the database. Use this in production environments.

### Check Migration Status

```bash
npm run migration:status
```

Shows the current status of all migrations (applied/pending).

### Reset Database (Development Only)

```bash
CONFIRM_RESET=yes npm run migration:reset
```

⚠️ **WARNING**: This completely resets the database and applies all migrations from scratch. Requires confirmation via environment variable.

### Generate Prisma Client

```bash
npm run migration:generate
```

Regenerates the Prisma client after schema changes.

## Examples

### Creating a New Migration

```bash
# Add a new field to users table
npm run migration:create -- --name "add_user_preferences"

# Add a new table
npm run migration:create -- --name "create_notifications_table"

# Modify existing constraints
npm run migration:create -- --name "update_session_constraints"
```

### Production Deployment

```bash
# Check what migrations are pending
npm run migration:status

# Deploy all pending migrations
npm run migration:deploy

# Verify deployment
npm run migration:status
```

## Development Workflow

1. **Make Schema Changes**: Edit `prisma/schema.prisma`
2. **Create Migration**: Run `npm run migration:create -- --name "descriptive_name"`
3. **Test Migration**: The migration is automatically applied in development
4. **Commit Changes**: Commit both the schema and migration files

## Production Workflow

1. **Deploy Code**: Deploy your application code with the new migration files
2. **Run Migrations**: Execute `npm run migration:deploy` on the production server
3. **Verify**: Check migration status with `npm run migration:status`

## Migration Files

Migration files are stored in `prisma/migrations/` and contain:

- SQL statements to modify the database
- Metadata about the migration
- Rollback information (where applicable)

## Best Practices

1. **Descriptive Names**: Use clear, descriptive names for migrations
2. **Small Changes**: Keep migrations focused on single logical changes
3. **Test First**: Always test migrations in development before production
4. **Backup**: Always backup production databases before running migrations
5. **Review**: Review generated SQL before applying to production

## Troubleshooting

### Migration Fails

```bash
# Check migration status
npm run migration:status

# If needed, reset in development
CONFIRM_RESET=yes npm run migration:reset
```

### Schema Drift

If your database schema doesn't match your Prisma schema:

```bash
# Push schema changes without creating migration (development only)
npm run db:push

# Or create a migration to fix the drift
npm run migration:create -- --name "fix_schema_drift"
```

### Client Out of Sync

If Prisma client is out of sync:

```bash
npm run migration:generate
```
