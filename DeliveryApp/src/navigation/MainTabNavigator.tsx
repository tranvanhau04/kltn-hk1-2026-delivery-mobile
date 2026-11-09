import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Truck, ClipboardList, User } from 'lucide-react-native';
import { COLORS } from '../theme/theme';
import { HomeScreen } from '../screens/tabs/HomeScreen';
import { FleetScreen } from '../screens/tabs/FleetScreen';
import { AccountScreen } from '../screens/tabs/AccountScreen';
import { TaskStackNavigator } from './TaskStackNavigator';

export type MainTabParamList = {
  Home: undefined;
  Fleet: undefined;
  Tasks: undefined;
  Account: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const renderTabBarIcon = (routeName: keyof MainTabParamList, color: string, size: number) => {
  if (routeName === 'Home') return <Home color={color} size={size} />;
  if (routeName === 'Fleet') return <Truck color={color} size={size} />;
  if (routeName === 'Tasks') return <ClipboardList color={color} size={size} />;
  if (routeName === 'Account') return <User color={color} size={size} />;
  return null;
};

export const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.inactive,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          paddingBottom: 4,
          paddingTop: 4,
        },
        tabBarIcon: ({ color, size }) => renderTabBarIcon(route.name, color, size),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Trang chủ' }} />
      <Tab.Screen name="Fleet" component={FleetScreen} options={{ tabBarLabel: 'Đội xe' }} />
      <Tab.Screen name="Tasks" component={TaskStackNavigator} options={{ tabBarLabel: 'Nhiệm vụ' }} />
      <Tab.Screen name="Account" component={AccountScreen} options={{ tabBarLabel: 'Tài khoản' }} />
    </Tab.Navigator>
  );
};

