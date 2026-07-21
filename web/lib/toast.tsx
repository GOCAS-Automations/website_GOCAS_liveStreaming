'use client';

import { createContext, useCallback, useContext, useState } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';
interface Toast {
  id: number;
  type: ToastType;
  message: string;
}
interface ToastApi {
  push: (type: ToastType, message: string) => void;
  success: (m: string) => void;
  error: (m: string) => void;
  warning: (m: string) => void;
  info: (m: string) => void;
}

const ToastCtx = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}

const STYLE: Record<ToastType, { bar: string; label: string; icon: string }> = {
  success: { bar: '#3d4a2a', label: 'Listo', icon: '✓' },
  error: { bar: '#b0472c', label: 'Error', icon: '!' },
  warning: { bar: '#d97a3c', label: 'Atención', icon: '!' },
  info: { bar: '#6b7553', label: 'Info', icon: 'i' },
};

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (type: ToastType, message: string) => {
      counter += 1;
      const id = counter;
      setToasts((t) => [...t.slice(-4), { id, type, message }]);
      const ttl = type === 'error' ? 8000 : type === 'warning' ? 6000 : 4500;
      setTimeout(() => remove(id), ttl);
    },
    [remove],
  );

  const api: ToastApi = {
    push,
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    warning: (m) => push('warning', m),
    info: (m) => push('info', m),
  };

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toast-wrap" role="status" aria-live="polite">
        {toasts.map((t) => {
          const s = STYLE[t.type];
          return (
            <div key={t.id} className="toast" style={{ borderLeftColor: s.bar }}>
              <span className="toast-icon" style={{ background: s.bar }}>
                {s.icon}
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p className="toast-label" style={{ color: s.bar }}>
                  {s.label}
                </p>
                <p className="toast-msg">{t.message}</p>
              </div>
              <button className="toast-close" onClick={() => remove(t.id)} aria-label="Cerrar">
                ×
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
