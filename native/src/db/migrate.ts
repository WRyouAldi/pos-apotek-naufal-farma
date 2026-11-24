import type { SQLiteDatabase } from 'expo-sqlite';
import { DATABASE_VERSION, MIGRATION_1_SQL } from './schema';

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  const currentVersion = row?.user_version ?? 0;

  if (currentVersion > DATABASE_VERSION) {
    throw new Error(
      `Database version ${currentVersion} is newer than this app supports (${DATABASE_VERSION}).`,
    );
  }

  if (currentVersion < 1) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATION_1_SQL);
      await db.execAsync('PRAGMA user_version = 1;');
    });
  }
}
