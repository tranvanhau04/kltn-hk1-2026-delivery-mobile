import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { ToastContainer } from '../components/Toast';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastIdCounter = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (type: ToastType, title: string, message?: string, duration = 3500) => {
      const id = `toast-${Date.now()}-${++toastIdCounter}`;
      const item: ToastItem = { id, type, title, message, duration };

      // Keep max 3 toasts visible at once on mobile
      setToasts((prev) => [...prev.slice(-2), item]);

      if (duration > 0) {
        const timer = setTimeout(() => {
          removeToast(id);
        }, duration);
        timersRef.current.set(id, timer);
      }
    },
    [removeToast],
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return {
    success: (title: string, message?: string, duration?: number) =>
      ctx.showToast('success', title, message, duration),
    error: (title: string, message?: string, duration?: number) =>
      ctx.showToast('error', title, message, duration),
    warning: (title: string, message?: string, duration?: number) =>
      ctx.showToast('warning', title, message, duration),
    info: (title: string, message?: string, duration?: number) =>
      ctx.showToast('info', title, message, duration),
  };
};
