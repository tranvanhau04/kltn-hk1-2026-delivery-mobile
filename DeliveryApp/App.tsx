import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { AppProvider } from './src/context/AppContext';
import { ToastProvider } from './src/context/ToastContext';
import { NetworkSyncProvider } from './src/context/NetworkSyncContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { StatusBar } from 'react-native';
import { COLORS } from './src/theme/theme';
import { navigationRef } from './src/navigation/navigationRef';
import { SocketNotificationHandler } from './src/components/SocketNotificationHandler';

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <AuthProvider>
          <AppProvider>
            <NetworkSyncProvider>
              <NavigationContainer ref={navigationRef}>
                <StatusBar barStyle="dark-content" {...({ backgroundColor: COLORS.background } as any)} />
                <SocketNotificationHandler />
                <RootNavigator />
              </NavigationContainer>
            </NetworkSyncProvider>
          </AppProvider>
        </AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}

export default App;
