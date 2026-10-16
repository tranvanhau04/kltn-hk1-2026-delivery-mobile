import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { AppProvider } from './src/context/AppContext';
import { ToastProvider } from './src/context/ToastContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { StatusBar } from 'react-native';
import { COLORS } from './src/theme/theme';

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppProvider>
          <ToastProvider>
            <NavigationContainer>
              <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
              <RootNavigator />
            </NavigationContainer>
          </ToastProvider>
        </AppProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default App;
