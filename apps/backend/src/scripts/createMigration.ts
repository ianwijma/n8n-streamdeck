#!/usr/bin/env tsx

import { execSync } from 'child_process';

import path from 'path';

/**
 * Script to create a new Prisma migration
 * Usage: npm run migration:create -- --name "migration_name"
 */

function createMigration() {
  const args = process.argv.slice(2);
  const nameIndex = args.indexOf('--name');

  if (nameIndex === -1 || !args[nameIndex + 1]) {
    console.error('❌ Migration name is required');
    console.log(
      'Usage: npm run migration:create -- --name "your_migration_name"'
    );
    process.exit(1);
  }

  const migrationName = args[nameIndex + 1];

  console.log(`🚀 Creating migration: ${migrationName}`);

  try {
    // Check if we're in development environment
    const nodeEnv = process.env.NODE_ENV || 'development';

    if (nodeEnv === 'development') {
      console.log('📝 Running in development mode - using prisma migrate dev');

      // Use prisma migrate dev for development
      const command = `npx prisma migrate dev --name "${migrationName}"`;
      console.log(`Executing: ${command}`);

      execSync(command, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..', '..'),
        env: { ...process.env, PRISMA_MIGRATE_SKIP_GENERATE: 'false' },
      });
    } else {
      console.log(
        '🏭 Running in production mode - creating migration file only'
      );

      // For production, create migration without applying
      const command = `npx prisma migrate dev --create-only --name "${migrationName}"`;
      console.log(`Executing: ${command}`);

      execSync(command, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..', '..'),
        env: { ...process.env, PRISMA_MIGRATE_SKIP_GENERATE: 'false' },
      });

      console.log(
        '📋 Migration created but not applied. Use "npm run migration:deploy" to apply.'
      );
    }

    console.log('✅ Migration created successfully!');
  } catch (error) {
    console.error('❌ Failed to create migration:', error);
    process.exit(1);
  }
}

function deployMigrations() {
  console.log('🚀 Deploying migrations...');

  try {
    const command = 'npx prisma migrate deploy';
    console.log(`Executing: ${command}`);

    execSync(command, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..', '..'),
    });

    console.log('✅ Migrations deployed successfully!');
  } catch (error) {
    console.error('❌ Failed to deploy migrations:', error);
    process.exit(1);
  }
}

function resetDatabase() {
  console.log('⚠️  Resetting database...');

  const confirm = process.env.CONFIRM_RESET;
  if (confirm !== 'yes') {
    console.error('❌ Database reset requires confirmation');
    console.log('Set CONFIRM_RESET=yes environment variable to confirm');
    process.exit(1);
  }

  try {
    const command = 'npx prisma migrate reset --force';
    console.log(`Executing: ${command}`);

    execSync(command, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..', '..'),
    });

    console.log('✅ Database reset successfully!');
  } catch (error) {
    console.error('❌ Failed to reset database:', error);
    process.exit(1);
  }
}

function showStatus() {
  console.log('📊 Migration status:');

  try {
    const command = 'npx prisma migrate status';
    console.log(`Executing: ${command}`);

    execSync(command, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..', '..'),
    });
  } catch (error) {
    console.error('❌ Failed to get migration status:', error);
    process.exit(1);
  }
}

function generateClient() {
  console.log('🔄 Generating Prisma client...');

  try {
    const command = 'npx prisma generate';
    console.log(`Executing: ${command}`);

    execSync(command, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..', '..'),
    });

    console.log('✅ Prisma client generated successfully!');
  } catch (error) {
    console.error('❌ Failed to generate Prisma client:', error);
    process.exit(1);
  }
}

// Main execution
const command = process.argv[2];

switch (command) {
  case 'create':
    createMigration();
    break;
  case 'deploy':
    deployMigrations();
    break;
  case 'reset':
    resetDatabase();
    break;
  case 'status':
    showStatus();
    break;
  case 'generate':
    generateClient();
    break;
  default:
    console.log('🔧 Prisma Migration Helper');
    console.log('');
    console.log('Available commands:');
    console.log('  create   - Create a new migration');
    console.log('  deploy   - Deploy pending migrations');
    console.log('  reset    - Reset database (requires CONFIRM_RESET=yes)');
    console.log('  status   - Show migration status');
    console.log('  generate - Generate Prisma client');
    console.log('');
    console.log('Examples:');
    console.log('  npm run migration:create -- --name "add_user_preferences"');
    console.log('  npm run migration:deploy');
    console.log('  npm run migration:status');
    console.log('  CONFIRM_RESET=yes npm run migration:reset');
    break;
}
