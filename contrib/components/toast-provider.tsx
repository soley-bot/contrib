import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';

interface Toast {
  id: number;
  msg: string;
  type: 'error' | 'success';
  removing: boolean;
}

interface ToastContextValue {
  showToast: (msg: string, type?: 'error' | 'success') => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const MAX_TOASTS = 5;
const FADE_OUT_MS = 300;

let nextId = 0;

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: number) => {
    // Clear any existing timer for this toast
    const existing = timersRef.current.get(id);
    if (existing) clearTimeout(existing);
    timersRef.current.delete(id);

    // Start fade-out
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, removing: true } : t)));
    // Remove after animation
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, FADE_OUT_MS);
  }, []);

  const showToast = useCallback((msg: string, type: 'error' | 'success' = 'error') => {
    const id = ++nextId;
    setToasts((prev) => {
      const next = [...prev, { id, msg, type, removing: false }];
      // Enforce max queue: remove oldest toasts beyond the limit
      if (next.length > MAX_TOASTS) {
        const excess = next.slice(0, next.length - MAX_TOASTS);
        for (const t of excess) {
          const timer = timersRef.current.get(t.id);
          if (timer) clearTimeout(timer);
          timersRef.current.delete(t.id);
        }
        return next.slice(next.length - MAX_TOASTS);
      }
      return next;
    });
    const timer = setTimeout(() => {
      timersRef.current.delete(id);
      removeToast(id);
    }, 4000);
    timersRef.current.set(id, timer);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div aria-live="polite" role="status" className="fixed top-[60px] left-1/2 -translate-x-1/2 z-[110] flex flex-col items-center gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto max-w-sm flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium ${
              t.removing ? 'animate-[fadeOut_0.3s_ease-in_forwards]' : 'animate-[fadeIn_0.2s_ease-out]'
            } ${t.type === 'error' ? 'bg-red text-white' : 'bg-green text-white'}`}
          >
            <span>{t.msg}</span>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="ml-1 shrink-0 opacity-70 hover:opacity-100 transition-opacity"
              aria-label="Dismiss"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11 3L3 11M3 3l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
