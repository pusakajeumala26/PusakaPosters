'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { IconAlert, IconCheck } from './icons';

type Tone = 'ok' | 'error';
type ShowToast = (message: string, tone?: Tone) => void;

const ToastContext = createContext<ShowToast>(() => {});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; tone: Tone } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback<ShowToast>((message, tone = 'ok') => {
    clearTimeout(timer.current);
    setToast({ message, tone });
    timer.current = setTimeout(() => setToast(null), tone === 'error' ? 5000 : 2800);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {/* Wadah live region selalu ada agar pembaca layar mengumumkan isi yang berubah */}
      <div role="status" aria-live={toast?.tone === 'error' ? 'assertive' : 'polite'}>
        {toast && (
          <div className={toast.tone === 'error' ? 'toast err' : 'toast'}>
            {toast.tone === 'error' ? <IconAlert size={18} /> : <IconCheck size={18} />}
            {toast.message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
