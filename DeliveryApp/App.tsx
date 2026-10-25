import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { AppProvider } from './src/context/AppContext';
import { ToastProvider } from './src/context/ToastContext';
import { NetworkSyncProvider } from './src/context/NetworkSyncContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { StatusBar } from 'react-native';

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppProvider>
          <ToastProvider>
            <NetworkSyncProvider>
              <NavigationContainer>
                <StatusBar barStyle="dark-content" />
                <RootNavigator />
              </NavigationContainer>
            </NetworkSyncProvider>
          </ToastProvider>
        </AppProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default App;
