import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    Pressable,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    View
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import type { RootStackParamList } from '../../App';

const BG_DARK = ['#0f172a', '#0b2b3b', '#065f46'] as const;
const CARD_ACCENT = ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)'] as const;
const CTA_GRADIENT = ['#14b8a6', '#06b6d4', '#22d3ee'] as const;

type Nav = NativeStackNavigationProp<RootStackParamList>;

const AccountDetails = () => {
	const navigation = useNavigation<Nav>();
	const [loading, setLoading] = useState(false);

	const handleBack = () => navigation.goBack();

	const handleLogout = async () => {
		if (loading) return;
		setLoading(true);
		setTimeout(() => {
			setLoading(false);
			navigation.reset({ index: 0, routes: [{ name: 'Login' as any }] });
		}, 900);
	};

	return (
		<View style={{ flex: 1 }}>
			<StatusBar barStyle={'light-content'} />
			<LinearGradient colors={BG_DARK} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
				<SafeAreaView style={{ flex: 1 }}>
					<View style={styles.topBar}>
						<Pressable onPress={handleBack} hitSlop={10} style={styles.backBtn} android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: true }}>
							<MaterialCommunityIcons name="chevron-left" color="#FFFFFF" size={28} />
						</Pressable>
						<Text style={styles.title}>Account Details</Text>
						<View style={{ width: 28 }} />
					</View>

					<View style={styles.center}>
						<Animated.View entering={FadeInUp.duration(400)} style={styles.avatarWrap}>
							<View style={styles.avatarCircle}>
								<MaterialCommunityIcons name="account" size={40} color="#0f172a" />
							</View>
						</Animated.View>

						<Animated.View entering={FadeInUp.delay(80).duration(400)} style={styles.card}>
							<LinearGradient colors={CARD_ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
							<Text style={styles.label}>Username</Text>
							<Text style={styles.value}>demo_user</Text>
						</Animated.View>

						<Animated.View entering={FadeInUp.delay(140).duration(400)} style={styles.card}>
							<LinearGradient colors={CARD_ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
							<Text style={styles.label}>Joined</Text>
							<Text style={styles.value}>Joined on Jan 1, 2025</Text>
						</Animated.View>

						<Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.logoutWrap}>
							<Pressable onPress={handleLogout} disabled={loading} style={styles.logoutPressable} android_ripple={{ color: 'rgba(0,0,0,0.2)' }}>
								<LinearGradient colors={CTA_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logoutGradient}>
									{loading ? <ActivityIndicator color="#FFFFFF" /> : (
										<View style={{ flexDirection: 'row', alignItems: 'center' }}>
											<MaterialCommunityIcons name="logout" size={18} color="#FFFFFF" />
											<Text style={styles.logoutText}>Logout</Text>
										</View>
									)}
								</LinearGradient>
							</Pressable>
						</Animated.View>
					</View>
				</SafeAreaView>
			</LinearGradient>
		</View>
	);
};

const styles = StyleSheet.create({
	topBar: { height: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
	backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
	title: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', letterSpacing: 0.3 },
	center: { flex: 1, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'flex-start' },
	avatarWrap: { marginTop: 24, marginBottom: 12 },
	avatarCircle: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#EAF7F5', alignItems: 'center', justifyContent: 'center' },
	card: {
		width: '100%',
		maxWidth: 480,
		padding: 16,
		borderRadius: 18,
		marginTop: 12,
		backgroundColor: 'rgba(255,255,255,0.06)',
		borderColor: 'rgba(255,255,255,0.12)',
		borderWidth: StyleSheet.hairlineWidth,
		overflow: 'hidden',
		...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowOffset: { width: 0, height: 12 }, shadowRadius: 24 }, android: { elevation: 10 }, default: {} }),
	},
	label: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 6 },
	value: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
	logoutWrap: { marginTop: 24, borderRadius: 28, overflow: 'hidden', width: '100%', maxWidth: 480 },
	logoutPressable: { borderRadius: 28 },
	logoutGradient: { height: 54, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
	logoutText: { color: '#FFFFFF', marginLeft: 8, fontWeight: '700' },
});

export default AccountDetails;
