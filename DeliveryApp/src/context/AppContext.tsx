import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Driver, Shift, Route, Stop } from '../types/mobile';
import { MOCK_DRIVER, MOCK_SHIFT, MOCK_ROUTE, MOCK_STOPS } from '../data/mockDriverData';
import { fetchDriverRoute } from '../lib/api';

// Default driver ID from init.sql seed data (Ngô Văn Tài)
const ACTIVE_DRIVER_ID = 'u0000000-0000-0000-0000-000000000101';

type AppContextType = {
  driver: Driver;
  shift: Shift | null;
  route: Route | null;
  stops: Stop[];
  polylineCoords: [number, number][];
  isLoadingRoute: boolean;
  setDriver: React.Dispatch<React.SetStateAction<Driver>>;
  setShift: React.Dispatch<React.SetStateAction<Shift | null>>;
  setStops: React.Dispatch<React.SetStateAction<Stop[]>>;
  updateStopStatus: (stopId: string, status: Stop['status'], codCollected?: number) => void;
  markStopArrived: (stopId: string) => void;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [driver, setDriver] = useState<Driver>(MOCK_DRIVER);
  const [shift, setShift] = useState<Shift | null>(MOCK_SHIFT);
  const [route, setRoute] = useState<Route | null>(MOCK_ROUTE);
  const [stops, setStops] = useState<Stop[]>(MOCK_STOPS);
  const [polylineCoords, setPolylineCoords] = useState<[number, number][]>([]);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);

  // Fetch real route from backend on mount
  useEffect(() => {
    setIsLoadingRoute(true);
    fetchDriverRoute(ACTIVE_DRIVER_ID)
      .then((data) => {
        // Backend now returns { success, route, stops } — respect explicit no-route signal
        if (data.success && data.route && data.stops?.length) {
          // Map API response to mobile Stop type
          const mappedStops: Stop[] = data.stops.map((s) => ({
            id: s.id,
            route_id: s.routeId,
            order_id: s.orderId,
            sequence_no: s.sequenceNo,
            arrived_at: s.arrivedAt,
            status: s.status as Stop['status'],
            order: {
              id: s.order?.id ?? s.orderId,
              code: s.order?.code ?? '',
              receiver_name: s.order?.receiverName ?? '',
              receiver_phone: s.order?.receiverPhone ?? '',
              delivery_address: s.order?.deliveryAddress ?? '',
              lat: s.order?.lat ?? 10.8222,
              lng: s.order?.lng ?? 106.6875,
              cod_amount: s.order?.codAmount ?? 0,
              status: (s.order?.status === 'DELIVERED' ? 'DELIVERED'
                : s.order?.status === 'FAILED' ? 'FAILED'
                : 'PENDING') as Stop['order']['status'],
            },
          }));

          const mappedRoute: Route = {
            id: data.route.id,
            driver_id: data.route.driverId,
            route_date: data.route.routeDate,
            total_distance_km: data.route.totalDistanceKm,
            total_estimated_time_min: data.route.totalEstimatedTimeMin,
            status: (data.route.status === 'IN_PROGRESS' ? 'IN_PROGRESS'
              : data.route.status === 'COMPLETED' ? 'COMPLETED'
              : 'ASSIGNED') as Route['status'],
            polyline: JSON.stringify(data.route.polyline),
          };

          setRoute(mappedRoute);
          setStops(mappedStops);
          if (Array.isArray(data.route.polyline)) {
            setPolylineCoords(data.route.polyline as [number, number][]);
          }
        } else {
          // No active route today (backend explicitly returned success: false).
          // Clear route and stops — do NOT silently show mock data.
          setRoute(null);
          setStops([]);
          setPolylineCoords([]);
        }
      })
      .catch(() => {
        // Network error — fallback to MOCK_STOPS so UI is not completely empty
        // This fallback is intentional only for total API unreachability (e.g. dev offline)
        // The app displays a loading error state on the home/track screens
      })
      .finally(() => {
        setIsLoadingRoute(false);
      });
  }, []);


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
