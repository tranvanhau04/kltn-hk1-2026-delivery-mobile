import { isNavigationDisabled, Stop } from '../types/mobile';

describe('isNavigationDisabled logic', () => {
  const baseStop: Stop = {
    id: 'stop-1',
    route_id: 'route-1',
    order_id: 'order-1',
    sequence_no: 1,
    arrived_at: null,
    status: 'PENDING',
    order: {
      id: 'order-1',
      code: 'ORD-001',
      receiver_name: 'Nguyen Van A',
      receiver_phone: '0901234567',
      delivery_address: '123 Nguyen Trai, Q1',
      lat: 10.762622,
      lng: 106.660172,
      cod_amount: 150000,
      status: 'PENDING',
    },
  };

  it('Case 1: Don cho giao (PENDING / ARRIVED) -> enables navigation (false)', () => {
    const pendingStop = { ...baseStop, status: 'PENDING' as const };
    expect(isNavigationDisabled(pendingStop)).toBe(false);

    const arrivedStop = { ...baseStop, status: 'ARRIVED' as const };
    expect(isNavigationDisabled(arrivedStop)).toBe(false);
  });

  it('Case 2: Don da giao thanh cong (COMPLETED / DELIVERED) -> always disables navigation (true)', () => {
    const completedStop = { ...baseStop, status: 'COMPLETED' as const };
    expect(isNavigationDisabled(completedStop)).toBe(true);

    const deliveredOrderStop = {
      ...baseStop,
      order: { ...baseStop.order, status: 'DELIVERED' as const },
    };
    expect(isNavigationDisabled(deliveredOrderStop)).toBe(true);
  });

  it('Case 3: Don giao that bai (FAILED khong hen lai) -> always disables navigation (true)', () => {
    const failedStop = {
      ...baseStop,
      status: 'FAILED' as const,
      order: { ...baseStop.order, status: 'FAILED' as const },
      failure_reason: 'Khach khong nghe may 3 lan',
    };
    expect(isNavigationDisabled(failedStop)).toBe(true);
  });

  it('Case 4: Don hen giao lai (RESCHEDULED / co rescheduled_date)', () => {
    const now = new Date('2026-11-16T10:00:00.000Z').getTime();

    // 4a. Chua den gio hen (tuong lai) -> DISABLE (true)
    const futureDate = '2026-11-16T15:30:00.000Z';
    const futureRescheduledStop = {
      ...baseStop,
      status: 'SKIPPED' as const,
      rescheduled_date: futureDate,
      failure_reason: 'Khach hen chieu giao sau 15h',
      order: {
        ...baseStop.order,
        status: 'RESCHEDULED' as const,
        rescheduled_date: futureDate,
      },
    };
    expect(isNavigationDisabled(futureRescheduledStop, now)).toBe(true);

    // 4b. Da den gio hen (dung gio hoac qua gio) -> MO KHOA LAI (false)
    const pastDate = '2026-11-16T09:00:00.000Z';
    const pastRescheduledStop = {
      ...baseStop,
      status: 'SKIPPED' as const,
      rescheduled_date: pastDate,
      failure_reason: 'Khach hen sang som giao lai',
      order: {
        ...baseStop.order,
        status: 'RESCHEDULED' as const,
        rescheduled_date: pastDate,
      },
    };
    expect(isNavigationDisabled(pastRescheduledStop, now)).toBe(false);

    // 4c. Chinh xac thoi diem gio hen (now == rescheduleTime) -> MO KHOA LAI (false)
    const exactDate = '2026-11-16T10:00:00.000Z';
    const exactRescheduledStop = {
      ...baseStop,
      status: 'SKIPPED' as const,
      rescheduled_date: exactDate,
      order: {
        ...baseStop.order,
        status: 'RESCHEDULED' as const,
        rescheduled_date: exactDate,
      },
    };
    expect(isNavigationDisabled(exactRescheduledStop, now)).toBe(false);
  });
});
