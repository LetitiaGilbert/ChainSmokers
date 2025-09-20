import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  ToastAndroid,
  View
} from 'react-native';
import { TextInput } from 'react-native-paper';
import Animated, { FadeInUp, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { RootStackParamList } from '../../App';
import { saveEntry } from '../services/SyncManager';

type NewEntryFormNavigationProp = NativeStackNavigationProp<RootStackParamList, 'NewEntryForm'>;

const BG_DARK = ['#0f0c29', '#302b63', '#24243e'] as const;
const CARD_ACCENT = ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)'] as const;
const CTA_GRADIENT = ['#8E2DE2', '#4A00E0', '#00C9A7'] as const;

const NewEntryForm = () => {
	const navigation = useNavigation<NewEntryFormNavigationProp>();
	const [batchId, setBatchId] = useState('');
	const [speciesName, setSpeciesName] = useState('');
	const [harvestDate, setHarvestDate] = useState<Date | null>(null);
	const [quantity, setQuantity] = useState('');
	const [quality, setQuality] = useState<'A' | 'B' | 'C' | ''>('');
	const [gpsCoords, setGpsCoords] = useState('');
	const [notes, setNotes] = useState('');
	const [photoUri, setPhotoUri] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [errors, setErrors] = useState<{ [k: string]: string | undefined }>({});
    const [showDate, setShowDate] = useState(false);

	const saveScale = useSharedValue(1);
	const saveButtonStyle = useAnimatedStyle(() => ({ transform: [{ scale: saveScale.value }] }));

	const colors = useMemo(() => ({
		text: '#EAF7F5',
		subText: 'rgba(255,255,255,0.7)',
		border: 'rgba(255,255,255,0.12)',
		outline: '#7EE8FA',
	}), []);

	const handleBack = () => navigation.goBack();

	const handleCaptureLocation = async () => {
		try {
			const { status } = await Location.requestForegroundPermissionsAsync();
			if (status !== 'granted') {
				setErrors((e) => ({ ...e, gps: 'Location permission denied' }));
				return;
			}
			const pos = await Location.getCurrentPositionAsync({});
			const coords = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
			setGpsCoords(coords);
			setErrors((e) => ({ ...e, gps: undefined }));
		} catch (err) {
			setErrors((e) => ({ ...e, gps: 'Failed to fetch location' }));
		}
	};

	const pickImage = async () => {
		const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (status !== 'granted') {
			setErrors((e) => ({ ...e, photo: 'Media permission denied' }));
			return;
		}
		const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
		if (!result.canceled) {
			setPhotoUri(result.assets[0].uri);
			setErrors((e) => ({ ...e, photo: undefined }));
		}
	};

	const takePhoto = async () => {
		const { status } = await ImagePicker.requestCameraPermissionsAsync();
		if (status !== 'granted') {
			setErrors((e) => ({ ...e, photo: 'Camera permission denied' }));
			return;
		}
		const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
		if (!result.canceled) {
			setPhotoUri(result.assets[0].uri);
			setErrors((e) => ({ ...e, photo: undefined }));
		}
	};

	const validate = () => {
		const next: typeof errors = {};
		if (!batchId.trim()) next.batchId = 'Batch ID is required';
		if (!speciesName.trim()) next.species = 'Herb name is required';
		if (!harvestDate) next.harvestDate = 'Harvest date is required';
		if (!quantity.trim()) next.quantity = 'Quantity is required';
		if (!quality) next.quality = 'Quality grade required';
		if (!gpsCoords.trim()) next.gps = 'GPS required';
		setErrors(next);
		return Object.keys(next).length === 0;
	};

	const handleSave = async () => {
		saveScale.value = withTiming(0.98, { duration: 90 }, () => {
			saveScale.value = withTiming(1, { duration: 120 });
		});
		if (loading) return;
    if (!validate()) {
      if (Platform.OS === 'android') ToastAndroid.show('Please fix errors in the form', ToastAndroid.SHORT);
      else Alert.alert('Validation', 'Please fix errors in the form');
      return;
    }
		setLoading(true);
		try {
			const saved = await saveEntry({
				id: batchId,
				herbName: speciesName,
				quantity,
				date: harvestDate?.toISOString() || new Date().toISOString(),
				qualityGrade: quality || 'A',
				location: gpsCoords,
				collectorName: 'Unknown',
				status: 'Pending',
			});

			if (saved.synced) {
				if (Platform.OS === 'android') ToastAndroid.show('Entry submitted and synced', ToastAndroid.SHORT);
				else Alert.alert('Success', 'Entry submitted and synced');
			} else {
				if (Platform.OS === 'android') ToastAndroid.show('Entry saved locally (offline mode)', ToastAndroid.SHORT);
				else Alert.alert('Saved', 'Entry saved locally (offline mode)');
			}

			// Reset form
			setBatchId('');
			setSpeciesName('');
			setHarvestDate(null);
			setQuantity('');
			setQuality('');
			setGpsCoords('');
			setNotes('');
			setPhotoUri(null);

			navigation.navigate('Dashboard');
		} finally {
			setLoading(false);
		}
	};

	return (
		<View style={styles.flexOne}>
			<StatusBar barStyle={'light-content'} />
			<LinearGradient colors={BG_DARK} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.flexOne}>
				<SafeAreaView style={styles.flexOne}>
					{/* Top Bar */}
					<View style={styles.topBar}>
						<Pressable onPress={handleBack} hitSlop={10} style={styles.backBtn} android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: true }}>
							<MaterialCommunityIcons name="chevron-left" color="#FFFFFF" size={28} />
						</Pressable>
						<Text style={styles.title}>New Collection</Text>
						<View style={{ width: 28 }} />
					</View>

					<Animated.ScrollView entering={FadeInUp.duration(400)} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
			<View style={styles.card} className="backdrop-blur-md">
							<LinearGradient colors={CARD_ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

				<Text style={{ color: colors.subText }} className="text-xs mb-1">Batch ID</Text>
				<View className="flex-row items-center rounded-2xl px-3 h-14 mb-3" style={{ backgroundColor: 'rgba(10,14,22,0.6)', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
					<MaterialCommunityIcons name="identifier" size={18} color="#9BE7C4" />
					<TextInput value={batchId} onChangeText={setBatchId} placeholder="Batch-2025-001" placeholderTextColor={colors.subText} className="flex-1 ml-2 text-white" style={{ color: colors.text }} />
				</View>
				{errors.batchId ? <Text style={styles.errorText}>{errors.batchId}</Text> : null}

				<Text style={{ color: colors.subText }} className="text-xs mb-1">Herb Name</Text>
				<View className="flex-row items-center rounded-2xl px-3 h-14 mb-3" style={{ backgroundColor: 'rgba(10,14,22,0.6)', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
					<MaterialCommunityIcons name="leaf" size={18} color="#9BE7C4" />
					<TextInput value={speciesName} onChangeText={setSpeciesName} placeholder="Turmeric" placeholderTextColor={colors.subText} className="flex-1 ml-2 text-white" style={{ color: colors.text }} />
				</View>
				{errors.species ? <Text style={styles.errorText}>{errors.species}</Text> : null}

				<View className="flex-row gap-3">
					<View className="flex-1">
						<Text style={{ color: colors.subText }} className="text-xs mb-1">Harvest Date</Text>
						<View className="flex-row items-center rounded-2xl px-3 h-14 mb-3" style={{ backgroundColor: 'rgba(10,14,22,0.6)', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
							<MaterialCommunityIcons name="calendar" size={18} color="#9BE7C4" />
							<Pressable onPress={() => setShowDate(true)} className="flex-1 ml-2">
								<Text style={{ color: colors.text }}>{harvestDate ? new Date(harvestDate).toDateString() : 'Select date'}</Text>
							</Pressable>
						</View>
						{errors.harvestDate ? <Text style={styles.errorText}>{errors.harvestDate}</Text> : null}
					</View>
					<View className="flex-1">
						<Text style={{ color: colors.subText }} className="text-xs mb-1">Quantity</Text>
						<View className="flex-row items-center rounded-2xl px-3 h-14 mb-3" style={{ backgroundColor: 'rgba(10,14,22,0.6)', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
							<MaterialCommunityIcons name="scale-bathroom" size={18} color="#9BE7C4" />
							<TextInput value={quantity} onChangeText={setQuantity} placeholder="e.g. 10 kg" keyboardType="decimal-pad" placeholderTextColor={colors.subText} className="flex-1 ml-2 text-white" style={{ color: colors.text }} />
						</View>
						{errors.quantity ? <Text style={styles.errorText}>{errors.quantity}</Text> : null}
					</View>
				</View>

				<Text style={{ color: colors.subText }} className="text-xs mb-1">Quality Grade</Text>
				<View className="flex-row items-center rounded-2xl px-3 h-14 mb-3" style={{ backgroundColor: 'rgba(10,14,22,0.6)', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
					<MaterialCommunityIcons name="shield-check" size={18} color="#9BE7C4" />
					<Pressable onPress={() => setQuality(quality === 'A' ? 'B' : quality === 'B' ? 'C' : 'A')} className="flex-1 ml-2">
						<Text style={{ color: colors.text }}>{quality || 'Select grade (A/B/C)'}</Text>
					</Pressable>
				</View>
                {errors.quality ? <Text style={styles.errorText}>{errors.quality}</Text> : null}
                {errors.species ? <Text style={styles.errorText}>{errors.species}</Text> : null}

                {showDate && (
                    <DateTimePicker
                        value={harvestDate || new Date()}
                        mode="date"
                        display="default"
                        maximumDate={new Date()}
                        onChange={(event, date) => {
                            setShowDate(false);
                            if (date) setHarvestDate(date);
                        }}
                    />
                )}

							<TextInput
								label="GPS Coordinates"
								value={gpsCoords}
								mode="outlined"
								editable={false}
								style={styles.input}
								left={<TextInput.Icon icon="map-marker" />}
								outlineColor={colors.border}
								activeOutlineColor={colors.outline}
								theme={{ colors: { onSurfaceVariant: colors.subText } }}
								error={!!errors.gps}
							/>
							{errors.gps ? <Text style={styles.errorText}>{errors.gps}</Text> : null}

							<View style={styles.row}>
								<Pressable onPress={handleCaptureLocation} style={styles.miniBtn} android_ripple={{ color: 'rgba(0,0,0,0.15)' }}>
									<MaterialCommunityIcons name="crosshairs-gps" size={18} color="#FFFFFF" />
									<Text style={styles.miniBtnText}>Capture GPS</Text>
								</Pressable>
								<Pressable onPress={pickImage} style={styles.miniBtn} android_ripple={{ color: 'rgba(0,0,0,0.15)' }}>
									<MaterialCommunityIcons name="image" size={18} color="#FFFFFF" />
									<Text style={styles.miniBtnText}>Gallery</Text>
								</Pressable>
								<Pressable onPress={takePhoto} style={styles.miniBtn} android_ripple={{ color: 'rgba(0,0,0,0.15)' }}>
									<MaterialCommunityIcons name="camera" size={18} color="#FFFFFF" />
									<Text style={styles.miniBtnText}>Camera</Text>
								</Pressable>
							</View>

							{photoUri ? (
								<View style={styles.previewWrap}>
									<Image source={{ uri: photoUri }} style={styles.preview} />
								</View>
							) : null}

							<TextInput
								label="Notes"
								value={notes}
								onChangeText={setNotes}
								mode="outlined"
								multiline
								numberOfLines={4}
								style={[styles.input, styles.notesInput]}
								outlineColor={colors.border}
								activeOutlineColor={colors.outline}
								theme={{ colors: { onSurfaceVariant: colors.subText } }}
							/>

							<Animated.View style={[styles.saveWrap, saveButtonStyle]}>
								<Pressable onPress={handleSave} disabled={loading} style={styles.savePressable} android_ripple={{ color: 'rgba(0,0,0,0.2)' }}>
									<LinearGradient colors={CTA_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.saveGradient}>
										{loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>Save</Text>}
									</LinearGradient>
								</Pressable>
							</Animated.View>
						</View>
					</Animated.ScrollView>
				</SafeAreaView>
			</LinearGradient>
		</View>
	);
};

const styles = StyleSheet.create({
	flexOne: { flex: 1 },
	topBar: { height: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
	backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
	title: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', letterSpacing: 0.3 },
	content: { padding: 16, paddingBottom: 96 },
	card: {
		borderRadius: 20,
		padding: 16,
		backgroundColor: 'rgba(255,255,255,0.06)',
		borderColor: 'rgba(255,255,255,0.12)',
		borderWidth: StyleSheet.hairlineWidth,
		overflow: 'hidden',
		...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowOffset: { width: 0, height: 12 }, shadowRadius: 24 }, android: { elevation: 12 }, default: {} }),
	},
	input: { marginBottom: 14 },
	notesInput: { minHeight: 100 },
	row: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 8 },
	half: { flex: 1 },
	miniBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)' },
	miniBtnText: { color: '#FFFFFF', marginLeft: 8, fontWeight: '700' },
	previewWrap: { marginTop: 8, marginBottom: 8, borderRadius: 12, overflow: 'hidden', height: 120 },
	preview: { width: '100%', height: '100%' },
	saveWrap: { marginTop: 8, borderRadius: 28, overflow: 'hidden' },
	savePressable: { borderRadius: 28 },
	saveGradient: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
	saveText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', letterSpacing: 0.3 },
	errorText: { color: '#FFCCCB', fontSize: 12, marginTop: -6, marginBottom: 8 },
});

export default NewEntryForm;

