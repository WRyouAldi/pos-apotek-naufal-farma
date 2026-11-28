import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { DATABASE_NAME } from '../src/db/schema';
import { migrateDbIfNeeded } from '../src/db/migrate';
import { exportProductsCsv, importProductsCsv } from '../src/db/products-csv';

export default function HomeScreen() {
  const [db, setDb] = useState<SQLiteDatabase | null>(null);
  const [databaseReady, setDatabaseReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [productCount, setProductCount] = useState(0);
  const [notice, setNotice] = useState('Menyiapkan database lokal…');

  async function refreshCount(database: SQLiteDatabase) {
    const row = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM products');
    setProductCount(row?.count ?? 0);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const database = await openDatabaseAsync(DATABASE_NAME);
        await migrateDbIfNeeded(database);
        if (!active) return;
        setDb(database);
        await refreshCount(database);
        setDatabaseReady(true);
        setNotice('Database SQLite siap · data tersimpan di perangkat.');
      } catch (error) {
        if (active) setNotice(error instanceof Error ? error.message : 'Database gagal dibuka.');
      }
    })();
    return () => { active = false; };
  }, []);

  async function handleImport() {
    if (!db || busy) return;
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', '*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled || !picked.assets?.[0]) return;
      setBusy(true);
      setNotice('Memvalidasi CSV dan menyimpan produk…');
      const raw = await FileSystem.readAsStringAsync(picked.assets[0].uri, { encoding: FileSystem.EncodingType.UTF8 });
      const result = await importProductsCsv(db, raw);
      await refreshCount(db);
      setNotice(`Impor selesai: ${result.inserted} produk baru, ${result.updated} diperbarui. Stok lokal produk lama dipertahankan.`);
      Alert.alert('Impor CSV berhasil', `${result.total} baris produk diproses. Stok lokal untuk kode yang sudah ada tidak diubah.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan saat impor CSV.';
      setNotice('Impor dibatalkan · ' + message);
      Alert.alert('Impor CSV gagal', message);
    } finally { setBusy(false); }
  }

  async function handleExport() {
    if (!db || busy) return;
    setBusy(true);
    try {
      const csv = await exportProductsCsv(db);
      const uri = (FileSystem.cacheDirectory ?? '') + 'backup-produk-naufal-farma.csv';
      await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: 'Ekspor master produk CSV' });
        setNotice('CSV berhasil dibuat dan siap dibagikan atau disimpan.');
      } else {
        setNotice('CSV dibuat di penyimpanan cache aplikasi, tetapi fitur berbagi tidak tersedia pada perangkat ini.');
        Alert.alert('CSV dibuat', uri);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan saat ekspor CSV.';
      setNotice('Ekspor gagal · ' + message);
      Alert.alert('Ekspor CSV gagal', message);
    } finally { setBusy(false); }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brandRow}>
          <View style={styles.logo}><Text style={styles.logoText}>NF</Text></View>
          <View><Text style={styles.kicker}>N A U F A L   F A R M A</Text><Text style={styles.brand}>POS Native</Text></View>
        </View>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>DATABASE LOKAL · OFFLINE FIRST</Text>
          <Text style={styles.title}>Master barang, tetap dalam kendali.</Text>
          <Text style={styles.description}>Impor CSV ke SQLite dan ekspor kembali kapan pun. Data transaksi dan aplikasi Capacitor lama tidak disentuh.</Text>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{databaseReady ? productCount.toLocaleString('id-ID') : '—'}</Text>
            <Text style={styles.metricLabel}>PRODUK TERSIMPAN DI SQLITE</Text>
          </View>
          <View style={styles.statusPill}><View style={[styles.dot, databaseReady && styles.dotReady]} /><Text style={styles.statusText}>{databaseReady ? 'SQLite aktif dan siap digunakan' : 'Menyiapkan database…'}</Text></View>
        </View>
        <Text style={styles.sectionTitle}>Pertukaran data CSV</Text>
        <View style={styles.actionCard}>
          <View style={styles.actionIcon}><Text style={styles.actionGlyph}>↑</Text></View>
          <View style={styles.actionCopy}>
            <Text style={styles.actionTitle}>Impor master barang</Text>
            <Text style={styles.actionDetail}>Pilih CSV dari perangkat. Kode produk menjadi kunci pembaruan; stok lokal produk yang sudah ada tetap dipertahankan.</Text>
            <Pressable accessibilityRole="button" testID="csv-import-button" disabled={!databaseReady || busy} onPress={handleImport} style={({ pressed }) => [styles.button, styles.primaryButton, (!databaseReady || busy) && styles.disabled, pressed && styles.pressed]}>
              <Text style={styles.primaryButtonText}>{busy ? 'Memproses…' : 'Pilih file CSV untuk impor'}</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.actionCard}>
          <View style={styles.actionIcon}><Text style={styles.actionGlyph}>↓</Text></View>
          <View style={styles.actionCopy}>
            <Text style={styles.actionTitle}>Ekspor master barang</Text>
            <Text style={styles.actionDetail}>Buat backup-produk-naufal-farma.csv dari seluruh produk SQLite, kompatibel dengan format kolom master lama.</Text>
            <Pressable accessibilityRole="button" testID="csv-export-button" disabled={!databaseReady || busy} onPress={handleExport} style={({ pressed }) => [styles.button, styles.secondaryButton, (!databaseReady || busy) && styles.disabled, pressed && styles.pressed]}>
              <Text style={styles.secondaryButtonText}>Ekspor dan bagikan CSV</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.notice}><Text style={styles.noticeTitle}>Status proses</Text><Text style={styles.noticeText}>{busy ? 'Sedang memproses file…' : notice}</Text></View>
        <Text style={styles.footer}>Naufal Farma · SQLite lokal · CSV UTF-8</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F7F5' },
  content: { padding: 22, paddingBottom: 42, gap: 17 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  logo: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#087F5B', alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#FFFFFF', fontWeight: '900', fontSize: 17 },
  kicker: { color: '#668078', fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
  brand: { color: '#143D32', fontSize: 19, fontWeight: '800', marginTop: 2 },
  hero: { backgroundColor: '#0D654C', borderRadius: 27, padding: 22, marginTop: 9, gap: 11 },
  eyebrow: { color: '#BDE8D6', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: '#FFFFFF', fontSize: 28, lineHeight: 34, fontWeight: '900', letterSpacing: -0.7 },
  description: { color: '#E0F3EA', fontSize: 13, lineHeight: 20 },
  metric: { backgroundColor: '#FFFFFF18', borderRadius: 18, padding: 14, marginTop: 4 },
  metricValue: { color: '#FFFFFF', fontSize: 29, fontWeight: '900' },
  metricLabel: { color: '#CDEBDD', fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginTop: 2 },
  statusPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF20', borderRadius: 30, paddingHorizontal: 11, paddingVertical: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#F5C46A' },
  dotReady: { backgroundColor: '#9BE4B5' },
  statusText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  sectionTitle: { color: '#143D32', fontSize: 18, fontWeight: '900', marginTop: 3 },
  actionCard: { flexDirection: 'row', gap: 13, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#E3ECE7' },
  actionIcon: { width: 37, height: 37, borderRadius: 13, backgroundColor: '#E5F4EC', alignItems: 'center', justifyContent: 'center' },
  actionGlyph: { color: '#087F5B', fontSize: 22, fontWeight: '900' },
  actionCopy: { flex: 1, gap: 8 },
  actionTitle: { color: '#163D32', fontSize: 15, fontWeight: '800' },
  actionDetail: { color: '#62766F', fontSize: 12, lineHeight: 18 },
  button: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 15, paddingVertical: 11, marginTop: 3 },
  primaryButton: { backgroundColor: '#087F5B' },
  secondaryButton: { backgroundColor: '#E5F4EC' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  secondaryButtonText: { color: '#087F5B', fontSize: 12, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  notice: { backgroundColor: '#E9F2ED', borderRadius: 16, padding: 15, gap: 5 },
  noticeTitle: { color: '#315C4D', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  noticeText: { color: '#315C4D', fontSize: 12, lineHeight: 18 },
  footer: { color: '#81928B', fontSize: 11, textAlign: 'center', marginTop: 8 },
});
