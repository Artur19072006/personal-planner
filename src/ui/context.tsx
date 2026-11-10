import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../data/db';
import type { Snapshot } from '../data/models';
import { errorMessage } from '../data/validation';

const DataContext = createContext<Snapshot | null>(null);
const NotifyContext = createContext<(message: string) => void>(() => {});
const MessageContext = createContext('');
export function AppProvider({ children }: { children: ReactNode }) {
  const data = useLiveQuery(() => db.snapshot(), []);
  const [day, setDay] = useState(() => new Date().toDateString());
  useEffect(() => {
    const refresh = () => setDay(new Date().toDateString());
    const interval = setInterval(refresh, 60000);
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(interval); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  const currentData = useMemo(() => data ? { ...data } : null, [data, day]);
  const [message, setMessage] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((value: string) => {
    setMessage(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(''), 6000);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const theme = data?.settings[0]?.theme ?? 'system';
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => { document.documentElement.dataset.theme = theme === 'system' ? media.matches ? 'dark' : 'light' : theme; };
    apply(); media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  return <NotifyContext.Provider value={notify}>
    {currentData ? <MessageContext.Provider value={message}><DataContext.Provider value={currentData}>{children}</DataContext.Provider></MessageContext.Provider> : <div className="loading" role="status">Открываем ваши планы…</div>}
    <div className={`toast ${message ? 'shown' : ''}`} role="status" aria-live="polite">{message}</div>
  </NotifyContext.Provider>;
}
export function useData() { const data = useContext(DataContext); if (!data) throw new Error('Данные недоступны'); return data; }
export const useNotify = () => useContext(NotifyContext);
export const useMessage = () => useContext(MessageContext);
export function useAction() {
  const notify = useNotify();
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  async function run<T>(work: () => Promise<T>, success?: (result: T) => void) {
    if (lock.current) return;
    lock.current = true; setPending(true);
    try { const result = await work(); success?.(result); }
    catch (error) { notify(errorMessage(error)); }
    finally { lock.current = false; setPending(false); }
  }
  return { run, pending };
}
export function useDraft(key: string) {
  const [value, update] = useState(() => { try { return sessionStorage.getItem(key) ?? ''; } catch { return ''; } });
  const latest = useRef(value);
  function setValue(next: string | ((current: string) => string)) {
    const result = typeof next === 'function' ? next(latest.current) : next;
    latest.current = result; update(result);
    try { if (result) sessionStorage.setItem(key, result); else sessionStorage.removeItem(key); } catch { /* Draft remains in memory if session storage is unavailable. */ }
  }
  return [value, setValue] as const;
}
