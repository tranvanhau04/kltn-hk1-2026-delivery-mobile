import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { compressImageUnder1MB } from '../lib/imageCompressor';
import {
  enqueue,
  dequeue,
  getQueue,
  updateQueueItemError,
  markPermanentlyFailed,
  persistPhotoForOffline,
  deleteOfflinePhoto,
  clearQueue,
} from '../lib/offlineQueue';

describe('imageCompressor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return original URI if image is already <= 1MB', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({
      exists: true,
      size: 500 * 1024, // 500 KB
    });

    const uri = 'file:///cache/small-pod.jpg';
    const result = await compressImageUnder1MB(uri);

    expect(result).toBe(uri);
    expect(ImageManipulator.manipulateAsync).not.toHaveBeenCalled();
  });

  it('should compress image with 1280px width and 0.7 quality when > 1MB', async () => {
    // 1. Initial size check: 5MB
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({
      exists: true,
      size: 5 * 1024 * 1024,
    });
    // 2. Manipulated result size check: 350KB
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({
      exists: true,
      size: 350 * 1024,
    });

    const uri = 'file:///cache/large-pod.jpg';
    const result = await compressImageUnder1MB(uri);

    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
      uri,
      [{ resize: { width: 1280 } }],
      { compress: 0.7, format: 'jpeg' }
    );
    expect(result).toBe(`${uri}_compressed.jpg`);
  });

  it('should fallback to original URI if manipulator throws', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockRejectedValueOnce(new Error('Disk error'));

    const uri = 'file:///cache/error-pod.jpg';
    const result = await compressImageUnder1MB(uri);

    expect(result).toBe(uri);
  });
});

describe('offlineQueue', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('should persist photo from cache to documentDirectory', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({ exists: true });

    const cacheUri = 'file:///cache/temp-pod.jpg';
    const persistentUri = await persistPhotoForOffline(cacheUri);

    expect(persistentUri).toContain('offline_pods');
    expect(FileSystem.copyAsync).toHaveBeenCalledWith({
      from: cacheUri,
      to: persistentUri,
    });
  });

  it('should delete offline photo from documentDirectory', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({ exists: true });

    const uri = 'file:///offline_pods/offline_123.jpg';
    await deleteOfflinePhoto(uri);

    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(uri);
  });

  it('should enqueue action with PENDING status and retryCount 0', async () => {
    const action = await enqueue({
      type: 'SUBMIT_POD',
      stopId: 'stop-123',
      orderCode: 'ORD-999',
      payload: { photoUri: 'file:///offline_pods/photo.jpg', codCollected: 50000 },
    });

    expect(action.id).toBeDefined();
    expect(action.status).toBe('PENDING');
    expect(action.retryCount).toBe(0);

    const queue = await getQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].stopId).toBe('stop-123');
  });

  it('should dequeue action after successful sync', async () => {
    const action = await enqueue({
      type: 'SUBMIT_POD',
      stopId: 'stop-123',
    });

    await dequeue(action.id);
    const queue = await getQueue();
    expect(queue.length).toBe(0);
  });

  it('should update retry count and record last error on failure', async () => {
    const action = await enqueue({
      type: 'SUBMIT_POD',
      stopId: 'stop-123',
    });

    await updateQueueItemError(action.id, 'Timeout 504');
    const queue = await getQueue();
    expect(queue[0].retryCount).toBe(1);
    expect(queue[0].lastError).toBe('Timeout 504');
  });

  it('should mark permanently failed when retry reaches threshold', async () => {
    const action = await enqueue({
      type: 'SUBMIT_POD',
      stopId: 'stop-123',
    });

    await markPermanentlyFailed(action.id);
    const queue = await getQueue();
    expect(queue[0].status).toBe('FAILED_PERMANENTLY');
  });

  it('should clear queue and clean up stored offline photos', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });

    await enqueue({
      type: 'SUBMIT_POD',
      stopId: 'stop-123',
      payload: { photoUri: 'file:///offline_pods/photo1.jpg' },
    });

    await clearQueue();
    const queue = await getQueue();
    expect(queue.length).toBe(0);
    expect(FileSystem.deleteAsync).toHaveBeenCalled();
  });
});
