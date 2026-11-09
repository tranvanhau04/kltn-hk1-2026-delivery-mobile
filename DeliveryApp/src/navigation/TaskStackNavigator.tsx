import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StopListScreen } from '../screens/tasks/StopListScreen';
import { StopDetailScreen } from '../screens/tasks/StopDetailScreen';
import { PODCompletionScreen } from '../screens/tasks/PODCompletionScreen';
import { DeliveryFailureScreen } from '../screens/tasks/DeliveryFailureScreen';
import { HistorySyncScreen } from '../screens/tasks/HistorySyncScreen';
import { LiveNavigationScreen, LiveNavigationParams } from '../screens/LiveNavigationScreen';

export type TaskStackParamList = {
  StopList: undefined;
  StopDetail: { stopId: string };
  PODCompletion: { stopId: string };
  DeliveryFailure: { stopId: string };
  HistorySync: undefined;
  LiveNavigationScreen: LiveNavigationParams;
};

const Stack = createNativeStackNavigator<TaskStackParamList>();

export const TaskStackNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="StopList"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="StopList" component={StopListScreen} />
      <Stack.Screen name="StopDetail" component={StopDetailScreen} />
      <Stack.Screen name="PODCompletion" component={PODCompletionScreen} />
      <Stack.Screen name="DeliveryFailure" component={DeliveryFailureScreen} />
      <Stack.Screen name="HistorySync" component={HistorySyncScreen} />
      <Stack.Screen name="LiveNavigationScreen" component={LiveNavigationScreen} />
    </Stack.Navigator>
  );
};
