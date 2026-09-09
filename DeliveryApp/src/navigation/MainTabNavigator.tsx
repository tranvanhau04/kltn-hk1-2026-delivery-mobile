import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Truck, ClipboardList, Map, User } from 'lucide-react-native';
import { COLORS } from '../theme/theme';
import { FleetScreen } from '../screens/tabs/FleetScreen';
import { TrackScreen } from '../screens/tabs/TrackScreen';
import { AccountScreen } from '../screens/tabs/AccountScreen';
import { TaskStackNavigator } from './TaskStackNavigator';

export type MainTabParamList = {
  Fleet: undefined;
  Tasks: undefined;
  Track: undefined;
  Account: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

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
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Fleet') return <Truck color={color} size={size} />;
          if (route.name === 'Tasks') return <ClipboardList color={color} size={size} />;
          if (route.name === 'Track') return <Map color={color} size={size} />;
          if (route.name === 'Account') return <User color={color} size={size} />;
        },
      })}
    >
      <Tab.Screen name="Fleet" component={FleetScreen} />
      <Tab.Screen name="Tasks" component={TaskStackNavigator} />
      <Tab.Screen name="Track" component={TrackScreen} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
};
