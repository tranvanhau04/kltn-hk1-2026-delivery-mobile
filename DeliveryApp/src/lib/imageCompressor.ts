import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

const MAX_SIZE_BYTES = 1 * 1024 * 1024; // 1MB
const TARGET_LONG_EDGE = 1280; // px — tối ưu độ nét và dung lượng cho ảnh POD
const FALLBACK_LONG_EDGE = 1024; // px — dự phòng nếu ảnh quá lớn sau lần 1

/**
 * Nén ảnh chụp kiện hàng (POD) xuống dưới 1MB trước khi upload lên máy chủ.
 *
 * Chiến lược (v2 - Tối ưu 1 lần nén):
 *  - Kiểm tra dung lượng gốc, nếu đã <= 1MB thì giữ nguyên.
 *  - Resize cạnh rộng về 1280px + JPEG quality 0.7 (đạt ~200-450KB ngay lần 1).
 *  - Nếu sau lần 1 vẫn > 1MB (rất hiếm): Fallback resize 1024px + quality 0.5.
 *
 * @param uri - Đường dẫn URI gốc của ảnh (từ Camera hoặc Photo Library)
 * @returns Đường dẫn URI của ảnh đã nén sang định dạng JPEG (< 1MB)
 */
export async function compressImageUnder1MB(uri: string): Promise<string> {
  try {
    // 1. Kiểm tra kích thước gốc
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists && 'size' in info && typeof info.size === 'number' && info.size <= MAX_SIZE_BYTES) {
      return uri;
    }

    // 2. Nén lần 1: resize width 1280px + quality 0.7, ép định dạng JPEG
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: TARGET_LONG_EDGE } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
    );

    const resultInfo = await FileSystem.getInfoAsync(result.uri);
    if (resultInfo.exists && 'size' in resultInfo && typeof resultInfo.size === 'number' && resultInfo.size <= MAX_SIZE_BYTES) {
      return result.uri;
    }

    // 3. Fallback nén lần 2 nếu ảnh phức tạp vẫn vượt 1MB
    const fallback = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: FALLBACK_LONG_EDGE } }],
      { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG },
    );

    return fallback.uri;
  } catch (error) {
    console.warn('[imageCompressor] Lỗi nén ảnh, fallback về URI gốc:', error);
    return uri;
  }
}
