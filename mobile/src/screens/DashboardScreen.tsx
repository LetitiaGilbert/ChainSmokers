import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Dimensions,
    Image,
    Platform,
    Pressable,
    RefreshControl,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    ToastAndroid,
    View
} from 'react-native';
import { BarChart, PieChart, ProgressChart } from 'react-native-chart-kit';
import Animated, { FadeIn, FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { RootStackParamList } from '../../App';
import { getAllEntries, syncPendingEntries, type AyurEntry } from '../services/SyncManager';

type DashboardScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;

const BG_DARK = ['#0f172a', '#0b2b3b', '#065f46'] as const; // deep blue -> teal/emerald
const BG_ALT = ['#1e1b4b', '#3730a3', '#065f46'] as const; // dark purple -> emerald
const CARD_ACCENT = ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)'] as const;
const CTA_GRADIENT = ['#14b8a6', '#06b6d4', '#22d3ee'] as const; // teal/aqua/cyan
const chartConfig = {
  backgroundGradientFrom: 'transparent',
  backgroundGradientTo: 'transparent',
  decimalPlaces: 2,
  color: (opacity = 1) => `rgba(79, 209, 197, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(207, 237, 234, ${opacity})`,
  propsForBackgroundLines: { stroke: 'rgba(255,255,255,0.1)' },
};

type Stat = { title: string; value: string; icon: keyof typeof MaterialCommunityIcons.glyphMap };
const initialStats: Stat[] = [
	{ title: 'Total Entries', value: '124', icon: 'database' },
	{ title: 'Verified Batches', value: '86', icon: 'shield-check' },
	{ title: 'Pending Approvals', value: '5', icon: 'clipboard-clock' },
];

type CollectionEvent = { id: string; species: string; date: string; status: 'Approved' | 'Pending' | 'Rejected' };
const initialEvents: CollectionEvent[] = [
	{ id: '1', species: 'Turmeric', date: '2024-01-15', status: 'Approved' },
	{ id: '2', species: 'Neem', date: '2024-01-14', status: 'Pending' },
	{ id: '3', species: 'Aloe Vera', date: '2024-01-13', status: 'Rejected' },
	{ id: '4', species: 'Tulsi', date: '2024-01-12', status: 'Approved' },
];

const DashboardScreen = () => {
  const navigation = useNavigation<DashboardScreenNavigationProp>();
	const [refreshing, setRefreshing] = useState(false);
	const [loading, setLoading] = useState(true);
	const [stats, setStats] = useState<Stat[]>(initialStats);
	const [events, setEvents] = useState<CollectionEvent[]>(initialEvents);
	const [entries, setEntries] = useState<AyurEntry[]>([]);
	const [counts, setCounts] = useState({ total: 0, synced: 0, unsynced: 0, approved: 0, pending: 0, rejected: 0 });
	const [avgByHerb, setAvgByHerb] = useState<{ label: string; value: number }[]>([]);
	const [useAltBg, setUseAltBg] = useState(false);
	const syncAnim = useSharedValue(0);

	const computeFromEntries = (all: AyurEntry[]) => {
		const total = all.length;
		const synced = all.filter(e => e.synced).length;
		const unsynced = total - synced;
		const approved = all.filter(e => e.status === 'Approved').length;
		const pending = all.filter(e => e.status === 'Pending').length;
		const rejected = all.filter(e => e.status === 'Rejected').length;
		setCounts({ total, synced, unsynced, approved, pending, rejected });

		// Average quality grade per herb (A=3, B=2, C=1)
		const gradeToNum: Record<string, number> = { A: 3, B: 2, C: 1 };
		const numToLabel: Record<number, string> = { 3: 'A', 2: 'B', 1: 'C' };
		const map: Record<string, { sum: number; n: number }> = {};
		for (const e of all) {
			const herb = e.herbName || 'Unknown';
			const g = gradeToNum[e.qualityGrade] ?? 0;
			if (!map[herb]) map[herb] = { sum: 0, n: 0 };
			if (g > 0) { map[herb].sum += g; map[herb].n += 1; }
		}
		const avgs = Object.entries(map).map(([label, s]) => ({ label, value: s.n ? s.sum / s.n : 0 }));
		setAvgByHerb(avgs);

		// Update stat cards UI
		setStats([
			{ title: 'Total Entries', value: String(total), icon: 'database' },
			{ title: 'Synced', value: String(synced), icon: 'check-decagram' },
			{ title: 'Unsynced', value: String(unsynced), icon: 'cloud-upload-outline' },
			{ title: 'Approved', value: String(approved), icon: 'shield-check' },
			{ title: 'Pending', value: String(pending), icon: 'clock-outline' },
			{ title: 'Rejected', value: String(rejected), icon: 'close-octagon' },
		]);

		// Recent events: map from entries
		const recent = [...all]
			.sort((a, b) => (b.date > a.date ? 1 : -1))
			.slice(0, 5)
			.map((e, i) => ({ id: e.id || String(i), species: e.herbName, date: new Date(e.date).toDateString(), status: (e.status as any) || 'Pending', synced: e.synced } as any));
		setEvents(recent as any);
	};

	const loadData = useCallback(async () => {
		try {
			const all = await getAllEntries();
			setEntries(all);
			computeFromEntries(all);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadData();
	}, [loadData]);

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		await loadData();
		setRefreshing(false);
	}, [loadData]);

	const bg = useMemo(() => (useAltBg ? BG_ALT : BG_DARK), [useAltBg]);

	const handleNewEntry = () => {
    navigation.navigate('NewEntryForm');
  };

	const handleSyncNow = async () => {
		syncAnim.value = withTiming(1, { duration: 600 }, () => { syncAnim.value = 0; });
		try {
			const res = await syncPendingEntries();
			await loadData();
			if (res.synced > 0) {
				ToastAndroid.show?.(`Synced ${res.synced} pending entries`, ToastAndroid.SHORT);
			} else {
				ToastAndroid.show?.('No pending entries to sync', ToastAndroid.SHORT);
			}
		} catch (e) {
			Alert.alert('Sync failed', 'Please try again later.');
		}
	};

  return (
		<View style={styles.flexOne}>
			<StatusBar barStyle={'light-content'} />
			<LinearGradient colors={bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.flexOne}>
				<SafeAreaView style={styles.flexOne}>
					{/* Top Bar */}
					<View style={styles.topBar}>
						<View style={styles.topBarLeft}>
							<Pressable onPress={() => (navigation as any).openDrawer?.()} hitSlop={10} style={styles.menuBtn} android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: true }}>
								<MaterialCommunityIcons name="menu" size={24} color="#CFFAFE" />
							</Pressable>
							<Image source={require('../../assets/images/icon.png')} style={styles.logo} />
							<Text style={styles.brand}>AyurChain</Text>
						</View>
                        <Pressable style={styles.avatarWrap} onPress={() => navigation.navigate('AccountDetails' as never)} android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: true }}>
							<View style={styles.avatar}>
								<MaterialCommunityIcons name="account" size={22} color="#0f0c29" />
							</View>
						</Pressable>
					</View>

					{loading ? (
						<View style={{ padding: 24 }}>
							<Text style={{ color: '#CFEDEA' }}>Loading...</Text>
						</View>
					) : null}
					<Animated.ScrollView
						entering={FadeIn.duration(450)}
						style={styles.content}
						showsVerticalScrollIndicator={false}
						refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffffff" />}
					>
						{/* Stats Grid */}
						<View style={styles.statsGrid}>
							{stats.map((s, idx) => (
								<StatCard key={s.title} index={idx} title={s.title} value={s.value} icon={s.icon} />
							))}
						</View>

						{/* Charts */}
						<View style={{ marginTop: 12 }}>
							<Text style={styles.sectionTitle}>Herbs vs Avg Quality</Text>
							<BarChart
								width={Dimensions.get('window').width - 32}
								height={180}
								fromZero
								yAxisLabel=""
								yAxisSuffix=""
								data={{ labels: avgByHerb.map(h => h.label), datasets: [{ data: avgByHerb.map(h => Number(h.value.toFixed(2))) }] }}
								chartConfig={chartConfig}
								style={{ borderRadius: 16 }}
							/>
							<Text style={[styles.sectionTitle, { marginTop: 16 }]}>Status Distribution</Text>
							<PieChart
								width={Dimensions.get('window').width - 32}
								height={180}
								accessor="count"
								data={[
									{ name: 'Approved', count: counts.approved, color: '#34d399', legendFontColor: '#CFEDEA', legendFontSize: 12 },
									{ name: 'Pending', count: counts.pending, color: '#fbbf24', legendFontColor: '#CFEDEA', legendFontSize: 12 },
									{ name: 'Rejected', count: counts.rejected, color: '#f87171', legendFontColor: '#CFEDEA', legendFontSize: 12 },
								]}
								chartConfig={chartConfig}
								paddingLeft={"0"}
								backgroundColor="transparent"
							/>
							<Text style={[styles.sectionTitle, { marginTop: 16 }]}>Sync Progress</Text>
							<ProgressChart
								width={Dimensions.get('window').width - 32}
								height={160}
								data={{ labels: ['Synced'], data: [counts.total ? counts.synced / Math.max(counts.total, 1) : 0] }}
								chartConfig={chartConfig}
								hideLegend={false}
								style={{ borderRadius: 16 }}
          />
        </View>

						{/* Recent Entries */}
						<Text style={styles.sectionTitle}>Recent Collections</Text>
						<View>
							{events.map((ev: any, idx) => (
								<Animated.View key={ev.id} entering={FadeInDown.delay(idx * 60).duration(420)} style={styles.eventCard}>
									<LinearGradient colors={CARD_ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
									<View style={styles.eventRow}>
										<View style={styles.eventLeft}>
											<Text style={styles.eventSpecies}>{ev.species}</Text>
											<Text style={styles.eventDate}>{ev.date}</Text>
										</View>
										<View style={[
											styles.statusPill,
											ev.status === 'Approved' ? styles.badgeApproved : ev.status === 'Pending' ? styles.badgePending : styles.badgeRejected,
										]}>
											<Text style={styles.statusText}>{ev.status}</Text>
										</View>
										<View style={[styles.syncDot, { backgroundColor: ev.synced ? '#34d399' : '#fbbf24' }]} />
									</View>
								</Animated.View>
							))}
						</View>
					</Animated.ScrollView>

					{/* Floating Action Buttons */}
					<Animated.View entering={FadeInUp.duration(400)} style={styles.fabWrap}>
						<Pressable onPress={handleNewEntry} android_ripple={{ color: 'rgba(0,0,0,0.2)' }} style={[styles.fabPressable, { marginBottom: 12 }]}>
							<LinearGradient colors={CTA_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabGradient}>
								<MaterialCommunityIcons name="plus" size={26} color="#FFFFFF" />
							</LinearGradient>
						</Pressable>
						<Animated.View style={[styles.fabGradient, { position: 'absolute', right: 0, bottom: -72, transform: [{ rotate: syncAnim.value ? '360deg' : '0deg' }] }]} />
						<Pressable onPress={handleSyncNow} android_ripple={{ color: 'rgba(0,0,0,0.2)' }} style={styles.fabPressable}>
							<LinearGradient colors={['#22d3ee', '#06b6d4', '#14b8a6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabGradient}>
								<MaterialCommunityIcons name="sync" size={24} color="#FFFFFF" />
							</LinearGradient>
						</Pressable>
					</Animated.View>
				</SafeAreaView>
			</LinearGradient>
    </View>
  );
};

const StatCard = ({ title, value, icon, index }: { title: string; value: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; index: number }) => {
	const scale = useSharedValue(1);
	const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
	return (
		<Animated.View entering={FadeInUp.delay(index * 70).duration(420)} style={[styles.statCard, aStyle]}>
			<Pressable
				onPressIn={() => (scale.value = withTiming(0.98, { duration: 90 }))}
				onPressOut={() => (scale.value = withTiming(1, { duration: 120 }))}
				style={styles.statPressable}
				android_ripple={{ color: 'rgba(255,255,255,0.12)' }}
			>
				<LinearGradient colors={CARD_ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statGradient} />
				<View style={styles.statRow}>
					<View style={styles.statIconWrap}>
						<MaterialCommunityIcons name={icon} size={22} color="#9BE7C4" />
					</View>
					<View style={styles.statTextWrap}>
						<Text style={styles.statValue}>{value}</Text>
						<Text style={styles.statTitle}>{title}</Text>
					</View>
				</View>
			</Pressable>
		</Animated.View>
	);
};

const styles = StyleSheet.create({
	flexOne: { flex: 1 },
	content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 96 },
	topBar: { height: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
	topBarLeft: { flexDirection: 'row', alignItems: 'center' },
	menuBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
	logo: { width: 28, height: 28, borderRadius: 6, marginRight: 10 },
	brand: { color: '#EAF7F5', fontSize: 18, fontWeight: '700', letterSpacing: 0.3 },
	avatarWrap: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
	avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EAF7F5', alignItems: 'center', justifyContent: 'center' },
	statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
	statCard: {
		width: '48%',
		borderRadius: 16,
		overflow: 'hidden',
		...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowOffset: { width: 0, height: 12 }, shadowRadius: 24 }, android: { elevation: 8 }, default: {} }),
	},
	statPressable: { borderRadius: 16 },
	statGradient: { ...StyleSheet.absoluteFillObject, borderRadius: 16 },
	statRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
	statIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(155,231,196,0.12)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
	statTextWrap: { flex: 1 },
	statValue: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
	statTitle: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
	sectionTitle: { color: '#CFEDEA', fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 10 },
	eventCard: {
		borderRadius: 16,
    marginBottom: 12,
		padding: 14,
		backgroundColor: 'rgba(255,255,255,0.06)',
		borderColor: 'rgba(255,255,255,0.12)',
		borderWidth: StyleSheet.hairlineWidth,
		overflow: 'hidden',
		...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 8 }, shadowRadius: 16 }, android: { elevation: 6 }, default: {} }),
	},
	eventRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
	eventLeft: {},
	eventSpecies: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
	eventDate: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 },
	statusPill: { paddingHorizontal: 10, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
	badgeApproved: { backgroundColor: 'rgba(45,212,191,0.18)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(45,212,191,0.35)' },
	badgePending: { backgroundColor: 'rgba(250,204,21,0.18)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(250,204,21,0.35)' },
	badgeRejected: { backgroundColor: 'rgba(248,113,113,0.18)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(248,113,113,0.35)' },
	statusText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
	fabWrap: { position: 'absolute', right: 16, bottom: 24, borderRadius: 28, overflow: 'hidden' },
	fabPressable: { borderRadius: 28 },
	fabGradient: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
	syncDot: { width: 10, height: 10, borderRadius: 5 },
});

export default DashboardScreen;

