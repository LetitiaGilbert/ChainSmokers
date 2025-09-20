import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { Easing, FadeInUp, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../../App';

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

const GRADIENT_DARK = ['#0f172a', '#0b2b3b', '#065f46'] as const;
const GRADIENT_LIGHT = ['#e0f7fa', '#f1f8e9', '#e8eaf6'] as const;
const GRADIENT_ACCENT = ['#14b8a6', '#06b6d4', '#22d3ee'] as const;

// --- FIX: FloatingInput component is now defined OUTSIDE of LoginScreen ---
// This prevents it from being re-created on every render, solving the focus loss issue.
const FloatingInput = ({
  label,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  icon,
  inputKey,
  focusedInput,
  onFocus,
  onBlur,
  colors,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: any;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  inputKey: string;
  focusedInput: string | null;
  onFocus: (key: string) => void;
  onBlur: () => void;
  colors: any; // Passed in as a prop now
}) => {
  const active = focusedInput === inputKey || value.length > 0;

  const labelPosition = useSharedValue(active ? -12 : 0);
  const labelSize = useSharedValue(active ? 12 : 15);

  React.useEffect(() => {
      labelPosition.value = withTiming(active ? -12 : 0, { duration: 200 });
      labelSize.value = withTiming(active ? 12 : 15, { duration: 200 });
  }, [active, labelPosition, labelSize]);

  const labelAnimatedStyle = useAnimatedStyle(() => {
      return {
          transform: [{ translateY: labelPosition.value }],
          fontSize: labelSize.value,
      };
  });

  return (
    <View style={styles.inputContainer}>
      <MaterialCommunityIcons name={icon} size={20} color={colors.isDark ? '#9BE7C4' : '#065f46'} style={styles.inputIcon} />
      <View style={styles.inputWrapper}>
        <Animated.Text
          pointerEvents="none"
          style={[styles.inputLabel, { color: colors.subText }, labelAnimatedStyle]}
        >
          {label}
        </Animated.Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder=""
          placeholderTextColor={colors.subText}
          style={[styles.textInput, { color: colors.text }]}
          autoCapitalize="none"
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          onFocus={() => onFocus(inputKey)}
          onBlur={onBlur}
        />
      </View>
    </View>
  );
};


const LoginScreen = () => {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const logoScale = useSharedValue(0.8);
  const logoOpacity = useSharedValue(0);
  const loginPressScale = useSharedValue(1);

  React.useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) });
    logoScale.value = withTiming(1, { duration: 650, easing: Easing.out(Easing.back(1.2)) });
  }, [logoOpacity, logoScale]);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const loginButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: loginPressScale.value }],
  }));

  const colors = useMemo(() => ({
    bg: isDark ? GRADIENT_DARK : GRADIENT_LIGHT,
    cardBg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.6)',
    text: isDark ? '#E6F7F1' : '#1A1A1A',
    subText: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
    border: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
    inputBg: isDark ? 'rgba(10,14,22,0.6)' : 'rgba(255,255,255,0.9)',
    isDark: isDark, // Pass theme info to child component
  }), [isDark]);

  const handleLoginPress = async () => {
    loginPressScale.value = withTiming(0.98, { duration: 90 }, () => {
      loginPressScale.value = withTiming(1, { duration: 110 });
    });
    if (loading) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigation.navigate('Dashboard');
    }, 900);
  };

  const validate = () => {
    if (mode === 'login') {
      return username.trim().length > 0 && password.trim().length > 0;
    }
    return (
      username.trim().length > 0 &&
      phoneNumber.trim().length > 0 &&
      newPassword.trim().length > 0 &&
      otp.trim().length > 0
    );
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }
    await handleLoginPress();
  };

  return (
    <View style={styles.flexOne}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <LinearGradient colors={colors.bg} style={styles.flexOne} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.topBar}>
            <Pressable onPress={() => setIsDark(v => !v)} hitSlop={10} style={styles.themeToggle} android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: true }}>
              <Text style={[styles.toggleText, { color: colors.text }]}>{isDark ? '☾' : '☼'}</Text>
            </Pressable>
          </View>

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
              <Animated.View entering={FadeInUp.duration(500)} style={[styles.logoWrap, logoAnimatedStyle]}>
                <Image
                  source={require('../../assets/images/icon.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
                <Text style={[styles.brand, { color: colors.text }]}>AyurChain</Text>
                <Text style={[styles.tagline, { color: colors.subText }]}>{mode === 'login' ? 'Securely access the herbal supply chain' : 'Create your account to get started'}</Text>
              </Animated.View>

              <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.06)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />

                <FloatingInput
                  label="Username"
                  value={username}
                  onChangeText={setUsername}
                  icon="account"
                  inputKey="username"
                  focusedInput={focusedInput}
                  onFocus={setFocusedInput}
                  onBlur={() => setFocusedInput(null)}
                  colors={colors}
                />

                {mode === 'signup' && (
                  <Animated.View entering={FadeInUp.duration(400)}>
                    <FloatingInput
                      label="Phone Number"
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      icon="phone"
                      inputKey="phone"
                      keyboardType="phone-pad"
                      focusedInput={focusedInput}
                      onFocus={setFocusedInput}
                      onBlur={() => setFocusedInput(null)}
                      colors={colors}
                    />
                  </Animated.View>
                )}

                {mode === 'login' ? (
                  <FloatingInput
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    icon="lock"
                    inputKey="password"
                    secureTextEntry
                    focusedInput={focusedInput}
                    onFocus={setFocusedInput}
                    onBlur={() => setFocusedInput(null)}
                    colors={colors}
                  />
                ) : (
                  <Animated.View entering={FadeInUp.duration(400)}>
                    <FloatingInput
                      label="New Password"
                      value={newPassword}
                      onChangeText={setNewPassword}
                      icon="lock"
                      inputKey="newPassword"
                      secureTextEntry
                      focusedInput={focusedInput}
                      onFocus={setFocusedInput}
                      onBlur={() => setFocusedInput(null)}
                      colors={colors}
                    />
                  </Animated.View>
                )}

                {mode === 'signup' && (
                  <Animated.View entering={FadeInUp.duration(400)}>
                    <FloatingInput
                      label="One-Time Password (OTP)"
                      value={otp}
                      onChangeText={setOtp}
                      icon="key"
                      inputKey="otp"
                      keyboardType="number-pad"
                      focusedInput={focusedInput}
                      onFocus={setFocusedInput}
                      onBlur={() => setFocusedInput(null)}
                      colors={colors}
                    />
                  </Animated.View>
                )}

                <Animated.View style={[styles.loginButtonWrap, loginButtonStyle]}>
                  <Pressable onPress={handleSubmit} disabled={loading} android_ripple={{ color: 'rgba(0,0,0,0.15)' }} style={styles.loginPressable}>
                    <LinearGradient colors={GRADIENT_ACCENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.loginGradient}>
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.loginText}>{mode === 'login' ? 'Login' : 'Sign Up'}</Text>
                      )}
                    </LinearGradient>
                  </Pressable>
                </Animated.View>

                <Pressable onPress={() => setMode(m => (m === 'login' ? 'signup' : 'login'))} android_ripple={{ color: 'rgba(0,0,0,0.15)' }}>
                  <View style={{ alignItems: 'center', paddingVertical: 10, marginTop: 8 }}>
                    <Text style={{ color: '#CFFAFE' }}>
                      {mode === 'login' ? "Don't have an account? Sign Up" : 'Already have an account? Login'}
                    </Text>
                  </View>
                </Pressable>

              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  flexOne: { flex: 1 },
  safeArea: { flex: 1 },
  topBar: { height: 44, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 16 },
  themeToggle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  toggleText: { fontSize: 18 },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  logoWrap: { alignItems: 'center', marginBottom: 24 },
  logo: { width: 84, height: 84, borderRadius: 16 },
  brand: { marginTop: 10, fontSize: 26, fontWeight: '700', letterSpacing: 0.5 },
  tagline: { marginTop: 4, fontSize: 13, opacity: 0.8 },
  card: {
    width: '100%',
    maxWidth: 420,
    padding: 20,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowOffset: { width: 0, height: 12 }, shadowRadius: 24 },
      android: { elevation: 12 },
    }),
  },
  loginButtonWrap: { marginTop: 12, borderRadius: 28, overflow: 'hidden' },
  loginPressable: { borderRadius: 28 },
  loginGradient: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  loginText: { color: '#0A141F', fontSize: 17, fontWeight: '700', letterSpacing: 0.3 },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10,14,22,0.6)',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    height: 58,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  inputWrapper: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
  },
  inputLabel: {
    position: 'absolute',
    left: 0,
  },
  textInput: {
    paddingTop: 16,
    fontSize: 15,
    height: '100%',
  },
});

export default LoginScreen;

