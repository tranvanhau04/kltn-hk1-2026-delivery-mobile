import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Driver, Shift, Route, Stop } from '../types/mobile';
import { MOCK_DRIVER, MOCK_SHIFT, MOCK_ROUTE, MOCK_STOPS } from '../data/mockDriverData';

type AppContextType = {
  driver: Driver;
  shift: Shift | null;
  route: Route | null;
  stops: Stop[];
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
