import { app } from './app.js';
import { config } from './config.js';
import { db } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { runSeed } from './db/seed.js';

async function main() {
  console.log('Running migrations...');
  await runMigrations(config.DATABASE_URL);
  console.log('Migrations up to date');

  await runSeed(db);

  app.listen(config.PORT, () => {
    console.log(`api listening on port ${config.PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start api', err);
  process.exit(1);
});
