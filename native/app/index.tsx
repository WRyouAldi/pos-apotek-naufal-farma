import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const phases = [
  { title: 'Pemetaan fitur lama', detail: 'Dashboard, kasir, produk, persediaan, laporan, dan pengaturan', status: 'Terpetakan' },
  { title: 'Fondasi SQLite', detail: 'Skema versi 1, indeks, relasi, dan inisialisasi database', status: 'Disiapkan' },
  { title: 'Migrasi transaksi kasir', detail: 'Belum dipindahkan — menunggu verifikasi skema dan aturan stok', status: 'Belum dimulai' },
];

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brandRow}>
          <View style={styles.logo}><Text style={styles.logoText}>NF</Text></View>
          <View><Text style={styles.kicker}>N A U F A L   F A R M A</Text><Text style={styles.brand}>POS Native</Text></View>
        </View>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>MIGRASI ANDROID</Text>
          <Text style={styles.title}>Fondasi baru.{ '\n' }Data tetap aman.</Text>
          <Text style={styles.description}>Aplikasi native Android sedang disiapkan secara terpisah. Versi Capacitor tetap menjadi cadangan dan sumber pembanding.</Text>
          <View style={styles.pill}><View style={styles.dot} /><Text style={styles.pillText}>Tahap fondasi · transaksi belum dipindahkan</Text></View>
        </View>
        <Text style={styles.sectionTitle}>Progres migrasi</Text>
        {phases.map((phase, index) => (
          <View key={phase.title} style={styles.phase}>
            <View style={styles.phaseIndex}><Text style={styles.phaseIndexText}>0{index + 1}</Text></View>
            <View style={styles.phaseBody}><Text style={styles.phaseTitle}>{phase.title}</Text><Text style={styles.phaseDetail}>{phase.detail}</Text><Text style={styles.phaseStatus}>{phase.status}</Text></View>
          </View>
        ))}
        <Text style={styles.footer}>Naufal Farma · Offline-first · Android</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F7F5' },
  content: { padding: 22, paddingBottom: 40, gap: 18 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  logo: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#087F5B', alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#FFFFFF', fontWeight: '900', fontSize: 17 },
  kicker: { color: '#668078', fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
  brand: { color: '#143D32', fontSize: 19, fontWeight: '800', marginTop: 2 },
  hero: { backgroundColor: '#0D654C', borderRadius: 28, padding: 23, marginTop: 12, gap: 12 },
  eyebrow: { color: '#BDE8D6', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: '#FFFFFF', fontSize: 31, lineHeight: 37, fontWeight: '900', letterSpacing: -0.8 },
  description: { color: '#E0F3EA', fontSize: 14, lineHeight: 21 },
  pill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF1F', borderRadius: 30, paddingHorizontal: 12, paddingVertical: 9, marginTop: 4 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#9BE4B5' },
  pillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  sectionTitle: { color: '#143D32', fontSize: 18, fontWeight: '900', marginTop: 4 },
  phase: { flexDirection: 'row', gap: 13, backgroundColor: '#FFFFFF', borderRadius: 19, padding: 16, borderWidth: 1, borderColor: '#E3ECE7' },
  phaseIndex: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#E5F4EC', alignItems: 'center', justifyContent: 'center' },
  phaseIndexText: { color: '#087F5B', fontWeight: '900', fontSize: 12 },
  phaseBody: { flex: 1, gap: 5 },
  phaseTitle: { color: '#163D32', fontSize: 14, fontWeight: '800' },
  phaseDetail: { color: '#62766F', fontSize: 12, lineHeight: 18 },
  phaseStatus: { color: '#087F5B', fontSize: 11, fontWeight: '800', marginTop: 3 },
  footer: { color: '#81928B', fontSize: 11, textAlign: 'center', marginTop: 10 },
});
