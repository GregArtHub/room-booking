import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

type Kind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  message: string;
  kind: Kind;
}

interface ToastApi {
  push: (message: string, kind?: Kind) => void;
}

const ToastContext = createContext<ToastApi>({ push: () => undefined });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, kind: Kind = 'success') => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), 4500);
  }, []);

  const api = useMemo(() => ({ push }), [push]);
  const tone: Record<Kind, string> = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-indigo-600',
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="fixed inset-x-3 bottom-3 z-50 flex flex-col items-end gap-2 sm:left-auto sm:right-4 sm:w-96"
      >
        {items.map((i) => (
          <div
            key={i.id}
            role="status"
            className={`w-full rounded-md px-4 py-3 text-sm text-white shadow-lg ${tone[i.kind]}`}
          >
            {i.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
