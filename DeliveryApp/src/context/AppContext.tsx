import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { Driver, Shift, Route, Stop } from '../types/mobile';
import { MOCK_DRIVER, MOCK_SHIFT } from '../data/mockDriverData';
import { fetchDriverRoute } from '../lib/api';
import { useAuth } from './AuthContext';

// Default fallback driver ID from init.sql seed data (Ngô Văn Tài)
const ACTIVE_DRIVER_ID = 'u0000000-0000-0000-0000-000000000101';

type AppContextType = {
  driver: Driver;
  shift: Shift | null;
  route: Route | null;
  stops: Stop[];
  polylineCoords: [number, number][];
  isLoadingRoute: boolean;
  refreshRoute: (overrideDriverId?: string) => Promise<void>;
  setDriver: React.Dispatch<React.SetStateAction<Driver>>;
  setShift: React.Dispatch<React.SetStateAction<Shift | null>>;
  setStops: React.Dispatch<React.SetStateAction<Stop[]>>;
  updateStopStatus: (stopId: string, status: Stop['status'], codCollected?: number) => void;
  markStopArrived: (stopId: string) => void;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const { user, token } = useAuth();
  const [driver, setDriver] = useState<Driver>(MOCK_DRIVER);
  const [shift, setShift] = useState<Shift | null>(MOCK_SHIFT);
  const [route, setRoute] = useState<Route | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [polylineCoords, setPolylineCoords] = useState<[number, number][]>([]);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);

  const refreshRoute = useCallback(async (overrideDriverId?: string) => {
    const driverId = overrideDriverId || user?.id || ACTIVE_DRIVER_ID;
    setIsLoadingRoute(true);
    try {
      const data = await fetchDriverRoute(driverId, token || undefined);
      if (data && data.success && data.route) {
        const routeData = data.route;
        const rawStops = Array.isArray(data.stops) ? data.stops : [];
        const mappedStops: Stop[] = rawStops.map((s, idx) => ({
          id: s?.id || `stop-${idx}`,
          route_id: s?.routeId || routeData.id,
          order_id: s?.orderId || '',
          sequence_no: typeof s?.sequenceNo === 'number' ? s.sequenceNo : idx + 1,
          arrived_at: s?.arrivedAt || null,
          status: (s?.status || 'PENDING') as Stop['status'],
          order: {
            id: s?.order?.id || s?.orderId || '',
            code: s?.order?.code || `ORD-${idx + 1}`,
            receiver_name: s?.order?.receiverName || 'Khách hàng',
            receiver_phone: s?.order?.receiverPhone || '',
            delivery_address: s?.order?.deliveryAddress || 'Địa chỉ giao hàng',
            lat: Number(s?.order?.lat) || 10.8222,
            lng: Number(s?.order?.lng) || 106.6875,
            cod_amount: Number(s?.order?.codAmount) || 0,
            weight_kg: Number((s?.order as any)?.weightKg) || undefined,
            volume_m3: Number((s?.order as any)?.volumeM3) || undefined,
            status: (s?.order?.status === 'DELIVERED' ? 'DELIVERED'
              : s?.order?.status === 'FAILED' ? 'FAILED'
              : 'PENDING') as Stop['order']['status'],
          },
        }));

        let parsedPolyline: [number, number][] = [];
        if (Array.isArray(data.route.polyline)) {
          parsedPolyline = data.route.polyline as [number, number][];
        } else if (typeof data.route.polyline === 'string') {
          try {
            parsedPolyline = JSON.parse(data.route.polyline);
          } catch {
            parsedPolyline = [];
          }
        }

        const mappedRoute: Route = {
          id: data.route.id,
          driver_id: data.route.driverId,
          route_date: data.route.routeDate || new Date().toISOString().split('T')[0],
          total_distance_km: Number(data.route.totalDistanceKm) || 0,
          total_estimated_time_min: Number(data.route.totalEstimatedTimeMin) || 0,
          status: (data.route.status === 'IN_PROGRESS' ? 'IN_PROGRESS'
            : data.route.status === 'COMPLETED' ? 'COMPLETED'
            : 'ASSIGNED') as Route['status'],
          polyline: JSON.stringify(parsedPolyline),
        };

        const sortedStops = [...mappedStops].sort((a, b) => a.sequence_no - b.sequence_no);

        setRoute(mappedRoute);
        setStops(sortedStops);
        setPolylineCoords(parsedPolyline);
      } else {
        setRoute(null);
        setStops([]);
        setPolylineCoords([]);
      }
    } catch (err) {
      console.warn('[AppContext] refreshRoute failed:', err);
    } finally {
      setIsLoadingRoute(false);
    }
  }, [user?.id, token]);

  // Fetch route when user changes
  useEffect(() => {
    refreshRoute();
  }, [refreshRoute]);

  const updateStopStatus = (stopId: string, status: Stop['status'], codCollected?: number) => {
    setStops((prevStops) =>
      prevStops.map((stop) => {
        if (stop.id === stopId) {
          const updatedStop = { ...stop, status };
          if (status === 'COMPLETED') {
            updatedStop.order = { ...stop.order, status: 'DELIVERED' };
          } else if (status === 'FAILED') {
            updatedStop.order = { ...stop.order, status: 'FAILED' };
          }
          return updatedStop;
        }
        return stop;
      })
    );
    if (codCollected && shift) {
      setShift((prevShift) => {
        if (!prevShift) return prevShift;
        return {
          ...prevShift,
          cod_collected: prevShift.cod_collected + codCollected,
        };
      });
    }
  };

  const markStopArrived = (stopId: string) => {
    setStops((prevStops) =>
      prevStops.map((stop) =>
        stop.id === stopId ? { ...stop, arrived_at: new Date().toISOString(), status: 'ARRIVED' } : stop
      )
    );
  };

  return (
    <AppContext.Provider
      value={{
        driver,
        shift,
        route,
        stops,
        polylineCoords,
        isLoadingRoute,
        refreshRoute,
        setDriver,
        setShift,
        setStops,
        updateStopStatus,
        markStopArrived,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
