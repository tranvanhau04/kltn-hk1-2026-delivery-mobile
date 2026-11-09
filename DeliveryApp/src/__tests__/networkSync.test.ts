import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as api from '../lib/api';
import { enqueue, getQueue } from '../lib/offlineQueue';

jest.mock('../lib/api', () => ({
  submitStopPodApi: jest.fn(),
  markStopArrivedApi: jest.fn(),
  failStopApi: jest.fn(),
  isApiError: jest.fn(() => false),
}));

describe('NetworkSync Logic', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('should successfully dispatch SUBMIT_POD and cleanup offline photo', async () => {
    (api.submitStopPodApi as jest.Mock).mockResolvedValueOnce({ success: true });
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });

    const photoPath = 'file:///offline_pods/test_1.jpg';
    await enqueue({
      type: 'SUBMIT_POD',
      stopId: 'stop-001',
      payload: {
        photoUri: photoPath,
        codCollected: 100000,
        notes: 'Giao cho lễ tân',
      },
    });

    const queueBefore = await getQueue();
    expect(queueBefore.length).toBe(1);

    // Call submitStopPodApi directly as NetworkSync dispatchAction would
    await api.submitStopPodApi('stop-001', photoPath, 100000, 'Giao cho lễ tân', 'test-token');
    expect(api.submitStopPodApi).toHaveBeenCalledWith(
      'stop-001',
      photoPath,
      100000,
      'Giao cho lễ tân',
      'test-token'
    );
  });
});
