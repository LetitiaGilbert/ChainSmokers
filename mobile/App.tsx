import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { PaperProvider } from 'react-native-paper';
import { startNetworkSyncListener } from './src/services/SyncManager';

// Import your screens
import DashboardScreen from './src/screens/DashboardScreen';
import LoginScreen from './src/screens/LoginScreen';
import NewEntryForm from './src/screens/NewEntryForm';

const Stack = createNativeStackNavigator();

export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  NewEntryForm: undefined;
  AccountDetails: undefined;
};

export default function App() {
  useEffect(() => {
    const unsub = startNetworkSyncListener();
    return () => {
      try { unsub && unsub(); } catch {}
    };
  }, []);

  return (
    <PaperProvider>
      <NavigationContainer>
        <Stack.Navigator 
          initialRouteName="Login"
          screenOptions={{ headerShown: false }} // This hides the default header
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="NewEntryForm" component={NewEntryForm} />
          <Stack.Screen name="AccountDetails" component={require('./src/screens/AccountDetails').default} />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}