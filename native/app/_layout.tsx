import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { migrateDbIfNeeded } from '../src/db/migrate';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="naufal-farma-native.db" onInit={migrateDbIfNeeded}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F4F7F5' } }} />
    </SQLiteProvider>
  );
}
