import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/tasks/HomeScreen';
import { StopListScreen } from '../screens/tasks/StopListScreen';
import { StopDetailScreen } from '../screens/tasks/StopDetailScreen';
import { PODCompletionScreen } from '../screens/tasks/PODCompletionScreen';
import { DeliveryFailureScreen } from '../screens/tasks/DeliveryFailureScreen';
import { HistorySyncScreen } from '../screens/tasks/HistorySyncScreen';

export type TaskStackParamList = {
  Home: undefined;
  StopList: undefined;
  StopDetail: { stopId: string };
  PODCompletion: { stopId: string };
  DeliveryFailure: { stopId: string };
  HistorySync: undefined;
};

const Stack = createNativeStackNavigator<TaskStackParamList>();

export const TaskStackNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="StopList" component={StopListScreen} />
      <Stack.Screen name="StopDetail" component={StopDetailScreen} />
      <Stack.Screen name="PODCompletion" component={PODCompletionScreen} />
      <Stack.Screen name="DeliveryFailure" component={DeliveryFailureScreen} />
      <Stack.Screen name="HistorySync" component={HistorySyncScreen} />
    </Stack.Navigator>
  );
};
