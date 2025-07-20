# Database Integration

This document describes the SQLite database integration with Prisma ORM that has been added to the N8N StreamDeck backend.

## Overview

The backend now includes:

- SQLite database for persistent data storage
- Prisma ORM for database abstraction and type safety
- Repository pattern for data access
- Database service for connection management
- Automatic database initialization on startup

## Database Schema

The database includes the following entities:

### Device

- Stores StreamDeck device information
- Tracks connection status and device metadata
- Related to buttons, folders, and profiles

### Button

- Stores button configurations for each device
- Includes action types, styling, and N8N workflow integration
- Linked to devices and can be organized in folders

### Folder

- Organizes buttons into hierarchical structures
- Supports nested folders
- Device-specific organization

### DeviceProfile

- Allows multiple button/folder configurations per device
- Enables switching between different setups

### User

- User authentication and management
- Stores credentials and user preferences

### Session

- Manages user sessions and authentication tokens
- Automatic cleanup of expired sessions

## Files Added/Modified

### Database Configuration

- `prisma/schema.prisma` - Database schema definition
- `.env` - Added DATABASE_URL configuration
- `generated/prisma/` - Generated Prisma client (auto-generated)

### Services

- `src/services/databaseService.ts` - Database connection and management
- `src/services/authServiceDb.ts` - Database-backed authentication service
- `src/services/repositories/` - Repository classes for data access
  - `deviceRepository.ts`
  - `buttonRepository.ts`
  - `userRepository.ts`
  - `sessionRepository.ts`

### Application Startup

- `src/index.ts` - Added database initialization and cleanup

### Package Configuration

- `package.json` - Added Prisma dependencies and database scripts

## Database Scripts

The following npm scripts are available:

```bash
# Generate Prisma client after schema changes
npm run db:generate

# Push schema changes to database (development)
npm run db:push

# Create and run migrations (production)
npm run db:migrate

# Open Prisma Studio (database GUI)
npm run db:studio

# Reset database (WARNING: deletes all data)
npm run db:reset
```

## Usage

### Database Service

```typescript
import { databaseService } from './services/databaseService';

// Get Prisma client
const prisma = databaseService.getClient();

// Health check
const isHealthy = await databaseService.healthCheck();

// Run in transaction
await databaseService.transaction(async (tx) => {
  // Database operations
});
```

### Repository Pattern

```typescript
import { DeviceRepository } from './services/repositories';

const deviceRepo = new DeviceRepository();

// Find all devices
const devices = await deviceRepo.findAll();

// Create new device
const device = await deviceRepo.create({
  name: 'My StreamDeck',
  type: 'STREAMDECK_ORIGINAL',
  serialNumber: '12345',
  buttonCount: 15,
});

// Update device
await deviceRepo.update(device.id, {
  isConnected: true,
});
```

### Authentication Service

```typescript
import { AuthServiceDb } from './services/authServiceDb';

const authService = new AuthServiceDb();

// Check if setup is required
const needsSetup = await authService.isSetupRequired();

// Setup admin user
if (needsSetup) {
  await authService.setup({
    username: 'admin',
    password: 'secure-password',
    email: 'admin@example.com',
  });
}

// Login user
const loginResult = await authService.login(
  { username: 'admin', password: 'secure-password' },
  '127.0.0.1',
  'User-Agent'
);
```

## Environment Variables

Add to your `.env` file:

```env
# Database Configuration
DATABASE_URL="file:./dev.db"

# Optional: JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="15m"
REFRESH_TOKEN_EXPIRES_IN="7d"
BCRYPT_ROUNDS="12"
```

## Migration from In-Memory Storage

The existing services that used in-memory storage (Maps, arrays) can be gradually migrated to use the database repositories. The new `AuthServiceDb` class demonstrates how to replace the original `AuthService` with database-backed storage.

## Production Considerations

1. **Database Location**: In production, consider using an absolute path for the SQLite database
2. **Backups**: Implement regular database backups
3. **Migrations**: Use proper Prisma migrations instead of `db push`
4. **Connection Pooling**: For high-load scenarios, consider PostgreSQL with connection pooling
5. **Monitoring**: Add database performance monitoring

## Development Workflow

1. Modify `prisma/schema.prisma` for schema changes
2. Run `npm run db:push` to apply changes in development
3. Run `npm run db:generate` to update the Prisma client
4. Update repository classes as needed
5. Test the changes

For production deployments, use proper migrations:

1. Run `npm run db:migrate` to create migration files
2. Commit migration files to version control
3. Deploy and run migrations in production environment
