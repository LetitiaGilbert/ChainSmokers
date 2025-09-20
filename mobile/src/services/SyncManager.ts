import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Alert, Platform, ToastAndroid } from 'react-native';

export type AyurEntry = {
	id: string;
	herbName: string;
	quantity: string;
	date: string; // ISO string
	qualityGrade: 'A' | 'B' | 'C' | string;
	location: string; // e.g. "lat,lng" or address
	collectorName: string;
	status: string; // e.g. 'Pending', 'Approved'
	synced: boolean;
};

const STORAGE_KEY = 'ayurchain.entries.v1';

async function readAll(): Promise<AyurEntry[]> {
	const raw = await AsyncStorage.getItem(STORAGE_KEY);
	if (!raw) return [];
	try {
		return JSON.parse(raw) as AyurEntry[];
	} catch {
		return [];
	}
}

async function writeAll(entries: AyurEntry[]): Promise<void> {
	await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

async function pushToBlockchainMock(entry: AyurEntry): Promise<void> {
	// Placeholder for Fabric chaincode integration
	await new Promise((res) => setTimeout(res, 1000));
}

export async function saveEntry(entryData: Omit<AyurEntry, 'synced'>): Promise<AyurEntry> {
	const state = await NetInfo.fetch();
	const isOnline = !!state.isConnected && !!state.isInternetReachable;
	const entries = await readAll();
	const normalized: AyurEntry = { ...entryData, synced: false };

	if (isOnline) {
		try {
			await pushToBlockchainMock(normalized);
			normalized.synced = true;
		} catch {
			// Remain unsynced if push fails
			normalized.synced = false;
		}
	}

	await writeAll([normalized, ...entries]);
	return normalized;
}

export async function getAllEntries(): Promise<AyurEntry[]> {
	return readAll();
}

export async function syncPendingEntries(): Promise<{ synced: number; remaining: number }> {
	const state = await NetInfo.fetch();
	const isOnline = !!state.isConnected && !!state.isInternetReachable;
	if (!isOnline) return { synced: 0, remaining: (await readAll()).filter((e) => !e.synced).length };

	const entries = await readAll();
	let syncedCount = 0;
	const updated = [] as AyurEntry[];
	for (const entry of entries) {
		if (!entry.synced) {
			try {
				await pushToBlockchainMock(entry);
				updated.push({ ...entry, synced: true });
				syncedCount += 1;
			} catch {
				updated.push(entry);
			}
		} else {
			updated.push(entry);
		}
	}
	await writeAll(updated);
	return { synced: syncedCount, remaining: updated.filter((e) => !e.synced).length };
}

// Optional: call on app start to auto-sync pending entries
export function startNetworkSyncListener(): () => void {
    // Attempt immediate sync once
    syncPendingEntries().then((res) => {
        if (res.synced > 0) {
            if (Platform.OS === 'android') ToastAndroid.show(`Synced ${res.synced} pending entries`, ToastAndroid.SHORT);
            else Alert.alert('Sync', `Synced ${res.synced} pending entries`);
        }
    }).catch(() => {});

    const unsubscribe = NetInfo.addEventListener(async (state) => {
        const isOnline = !!state.isConnected && !!state.isInternetReachable;
        if (isOnline) {
            try {
                const res = await syncPendingEntries();
                if (res.synced > 0) {
                    if (Platform.OS === 'android') ToastAndroid.show(`Synced ${res.synced} pending entries`, ToastAndroid.SHORT);
                    else Alert.alert('Sync', `Synced ${res.synced} pending entries`);
                }
            } catch (e) {
                // silent
            }
        }
    });
    return unsubscribe;
}
