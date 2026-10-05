import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StopDetailScreen } from '../screens/tasks/StopDetailScreen';
import { PODCompletionScreen } from '../screens/tasks/PODCompletionScreen';
import { DeliveryFailureScreen } from '../screens/tasks/DeliveryFailureScreen';
import * as api from '../lib/api';

// --- MOCK SETUP ---
jest.mock('../lib/api', () => ({
  markStopArrivedApi: jest.fn(),
  submitStopPodApi: jest.fn(),
  failStopApi: jest.fn(),
  isApiError: jest.fn().mockReturnValue(false),
}));

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  launchCameraAsync: jest.fn(() => Promise.resolve({ canceled: false, assets: [{ uri: 'file://test-pod.jpg' }] })),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('react-native-maps', () => {
  const ReactMock = require('react');
  const MapView = (props: any) => ReactMock.createElement('MapView', props, props.children);
  const Marker = (props: any) => ReactMock.createElement('Marker', props, props.children);
  return {
    __esModule: true,
    default: MapView,
    Marker,
    PROVIDER_DEFAULT: 'default',
  };
});

jest.mock('react-native-webview', () => {
  const ReactMock = require('react');
  const WebView = (props: any) => ReactMock.createElement('WebView', props, props.children);
  return {
    __esModule: true,
    WebView,
  };
});

jest.mock('react-native-safe-area-context', () => {
  const ReactMock = require('react');
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  const SafeAreaInsetsContext = ReactMock.createContext(inset);
  return {
    SafeAreaProvider: ({ children }: any) => ReactMock.createElement(SafeAreaInsetsContext.Provider, { value: inset }, children),
    SafeAreaConsumer: ({ children }: any) => children(inset),
    SafeAreaView: ({ children }: any) => ReactMock.createElement('SafeAreaView', null, children),
    useSafeAreaInsets: () => inset,
    SafeAreaInsetsContext,
  };
});

// Mock Alert to auto-confirm actions
jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
  console.log('Alert fired:', title, buttons?.map(b => b.text));
  if (buttons && buttons.length > 0) {
    const confirmBtn = buttons.find(b => b.text === 'Xác nhận giao' || b.text === 'Xác nhận' || b.text === 'Xong' || b.text === 'Đồng ý');
    if (confirmBtn && confirmBtn.onPress) {
      console.log('Pressing confirm button:', confirmBtn.text);
      confirmBtn.onPress();
    } else {
      console.log('No confirm button found!');
    }
  }
});

const mockToken = 'mock-token';
const mockStopId = 'stop-123';

const mockOrder = {
  id: 'order-1',
  code: 'ORD-TEST',
  receiver_name: 'Nguyen Van A',
  receiver_phone: '0901234567',
  delivery_address: '123 Test St',
  lat: 10,
  lng: 106,
  cod_amount: 500000,
  weight_kg: 2,
  volume_m3: 0.05,
  status: 'PENDING',
};

const mockStop = {
  id: mockStopId,
  route_id: 'route-1',
  order_id: 'order-1',
  sequence_no: 1,
  arrived_at: null as string | null,
  status: 'PENDING',
  order: mockOrder,
};

const Stack = createNativeStackNavigator();

let mockStops: any[] = [];
let mockMarkStopArrived = jest.fn();

jest.mock('../context/AppContext', () => ({
  useAppContext: () => ({
    driver: { user_id: 'd1', name: 'Test Driver', current_shift_status: 'ONLINE_READY' },
    shift: {},
    route: {},
    stops: mockStops,
    polylineCoords: [],
    isLoadingRoute: false,
    refreshRoute: jest.fn(() => Promise.resolve()),
    setDriver: jest.fn(),
    setShift: jest.fn(),
    setStops: jest.fn(),
    updateStopStatus: jest.fn(),
    markStopArrived: mockMarkStopArrived,
  })
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    token: 'mock-token',
    logout: jest.fn(),
    isAuthenticated: true,
    isLoading: false,
    user: { id: 'd1' },
    accessToken: 'mock-token',
    driverProfile: null,
    isLoadingDriver: false,
    login: jest.fn(),
    refreshDriverProfile: jest.fn(),
    toggleShiftStatus: jest.fn(),
  })
}));

// Dummy screen to test navigation back
const DummyStopList = () => null;

describe('Delivery Lifecycle E2E Test (Tasks 8.2 & 8.3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('KỊCH BẢN 1: LUỒNG GIAO HÀNG THÀNH CÔNG (SUCCESSFUL POD FLOW)', async () => {
    console.log('--- BẮT ĐẦU KỊCH BẢN 1 ---');
    (api.markStopArrivedApi as jest.Mock).mockResolvedValue({ success: true });
    (api.submitStopPodApi as jest.Mock).mockResolvedValue({ success: true });

    mockStops = [{ ...mockStop, arrived_at: null, status: 'PENDING' }];
    mockMarkStopArrived = jest.fn((id) => {
      mockStops = mockStops.map(s => s.id === id ? { ...s, arrived_at: new Date().toISOString(), status: 'ARRIVED' } : s);
    });

    const AppTree = (
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="StopDetail" component={StopDetailScreen} initialParams={{ stopId: mockStopId }} />
          <Stack.Screen name="PODCompletion" component={PODCompletionScreen} />
          <Stack.Screen name="StopList" component={DummyStopList} />
        </Stack.Navigator>
      </NavigationContainer>
    );

    let rerender: any;
    try {
      const result = render(AppTree);
      rerender = result.rerender;
    } catch (e) {
      console.error('Render failed:', e);
    }

    console.log('1. Khởi tạo & Kiểm tra Trạng thái 1');
    await waitFor(() => {
      expect(screen.getByText('Nguyen Van A')).toBeTruthy();
      expect(screen.getByText('0901234567')).toBeTruthy();
      expect(screen.getByText('123 Test St')).toBeTruthy();
      expect(screen.getByText(/2 kg/)).toBeTruthy();
      expect(screen.getByText(/50\.0 L/)).toBeTruthy();
      const hasCodAmount = screen.getAllByText(/.*/).some(el => el.props.children && String(el.props.children).includes('500') && String(el.props.children).includes('000'));
      expect(hasCodAmount).toBeTruthy();
    });

    const arriveBtn = screen.getByText('ĐÃ ĐẾN NƠI');
    expect(arriveBtn).toBeTruthy();
    expect(screen.queryByText('Giao thành công')).toBeNull();
    expect(screen.queryByText('Báo thất bại')).toBeNull();

    console.log('2. Bấm "ĐÃ ĐẾN NƠI"');
    fireEvent.press(arriveBtn);

    await waitFor(() => {
      expect(api.markStopArrivedApi).toHaveBeenCalledWith(mockStopId, mockToken);
    });

    console.log('3. Kiểm tra Trạng thái 2 xuất hiện');
    try {
      if (rerender) {
        rerender(AppTree); // Trigger re-render so it picks up the updated mockStops
      } else {
        render(AppTree);
      }
    } catch (e) {
      console.log('Re-render error:', e);
    }
    
    await waitFor(() => {
      expect(screen.queryByText('ĐÃ ĐẾN NƠI')).toBeNull();
      expect(screen.getByText('Giao thành công')).toBeTruthy();
      expect(screen.getByText('Báo thất bại')).toBeTruthy();
    });

    console.log('4. Chuyển sang màn hình POD');
    fireEvent.press(screen.getByText('Giao thành công'));

    await waitFor(() => {
      expect(screen.getByText('Bằng chứng giao hàng (POD)')).toBeTruthy();
    });

    console.log('5. Thao tác trên POD (Chụp ảnh & Xác nhận)');
    fireEvent.press(screen.getByText('Chụp ảnh kiện hàng'));
    
    // ImagePicker mock returns a photo
    await waitFor(() => {
      expect(screen.getByText('Chụp lại')).toBeTruthy(); // Camera preview is showing
    });

    const submitBtn = screen.getByText('XÁC NHẬN GIAO THÀNH CÔNG');
    fireEvent.press(submitBtn);

    await waitFor(() => {
      // The mock alert should auto-confirm, and submitStopPodApi should be called
      expect(api.submitStopPodApi).toHaveBeenCalledWith(
        mockStopId,
        'file://test-pod.jpg',
        500000,
        '', // notes
        mockToken
      );
    });
    
    console.log('KỊCH BẢN 1: PASS ✅');
  });

  it('KỊCH BẢN 2: LUỒNG BÁO GIAO THẤT BẠI (DELIVERY FAILURE FLOW)', async () => {
    console.log('--- BẮT ĐẦU KỊCH BẢN 2 ---');
    (api.failStopApi as jest.Mock).mockResolvedValue({ success: true });

    mockStops = [{ ...mockStop, arrived_at: new Date().toISOString(), status: 'ARRIVED' }];
    
    render(
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="StopDetail" component={StopDetailScreen} initialParams={{ stopId: mockStopId }} />
          <Stack.Screen name="DeliveryFailure" component={DeliveryFailureScreen} />
          <Stack.Screen name="StopList" component={DummyStopList} />
        </Stack.Navigator>
      </NavigationContainer>
    );

    console.log('1. Khởi tạo Trạng thái 2 & Bấm "Báo thất bại"');
    await waitFor(() => {
      expect(screen.getByText('Báo thất bại')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Báo thất bại'));

    await waitFor(() => {
      expect(screen.getByText('Báo cáo giao không thành công')).toBeTruthy();
    });

    // Nhập dữ liệu thất bại
    console.log('2. Nhập dữ liệu thất bại');
    // Mở dropdown
    fireEvent.press(screen.getByText('Chọn lý do cụ thể...'));
    
    // Chọn lý do Boom hàng
    await waitFor(() => {
      expect(screen.getByTestId('option-2')).toBeTruthy();
    });
    
    fireEvent.press(screen.getByTestId('option-2'));
    
    // Đợi state cập nhật (chờ nút Gửi hết bị disabled)
    await waitFor(() => {
      // It will render the selected option in the button itself, so we can verify the text exists
      expect(screen.getAllByText('Khách từ chối nhận hàng (Boom hàng - Chuyển hoàn kho)').length).toBeGreaterThan(0);
    });

    // Nhập ghi chú
    const noteInput = screen.getByPlaceholderText('Mô tả cụ thể tình huống: gọi 3 cuộc lúc 10h15 không nghe máy, cửa khóa ngoài...');
    fireEvent.changeText(noteInput, 'Khách đổi ý không muốn lấy hàng nữa');

    // Chụp ảnh minh chứng
    fireEvent.press(screen.getByText('Chụp ảnh cửa đóng / số nhà'));

    await waitFor(() => {
      expect(screen.getByText('Chụp lại')).toBeTruthy();
    });

    console.log('3. Gửi báo cáo');
    const failBtn = screen.getByTestId('submit-failure-btn');
    fireEvent.press(failBtn);

    await waitFor(() => {
      // The mock alert should auto-confirm, and failStopApi should be called
      expect(api.failStopApi).toHaveBeenCalledWith(
        mockStopId,
        {
          action: 'FAILED',
          failureReason: 'Khách từ chối nhận hàng (Boom hàng - Chuyển hoàn kho) - Khách đổi ý không muốn lấy hàng nữa',
          rescheduledDate: undefined,
          photoUri: 'file://test-pod.jpg',
        },
        mockToken
      );
    });

    console.log('KỊCH BẢN 2: PASS ✅');
  });
});
