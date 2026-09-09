import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PermissionScreen } from '../screens/auth/PermissionScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { MainTabNavigator } from './MainTabNavigator';
import { EndShiftModal } from '../screens/modals/EndShiftModal';

export type RootStackParamList = {
  Permission: undefined;
  Login: undefined;
  MainTabs: undefined;
  EndShiftModal: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator = () => {
  // Simple mock auth state for demonstration purposes
  const isAuthenticated = true; 
  const hasPermissions = true;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!hasPermissions ? (
        <Stack.Screen name="Permission" component={PermissionScreen} />
      ) : !isAuthenticated ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={MainTabNavigator} />
          <Stack.Screen 
            name="EndShiftModal" 
            component={EndShiftModal} 
            options={{ presentation: 'fullScreenModal' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
};
