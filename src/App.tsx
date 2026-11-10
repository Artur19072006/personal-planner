import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { History, House, Inbox, RefreshCw, Search, Settings, WifiOff } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { AppProvider, useData } from './ui/context';

function PwaStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [error, setError] = useState('');
  const { needRefresh: [refresh, setRefresh], updateServiceWorker } = useRegisterSW({
    onRegisterError: () => setError('Офлайн-кэш пока недоступен. Попробуйте обновить приложение при подключении к интернету.'),
  });
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  return <>{!online ? <div className="offline-status"><WifiOff size={14} />Без интернета · данные сохраняются на устройстве</div> : null}
    {refresh ? <div className="update-prompt"><span>Доступна новая версия</span><button className="text-button" onClick={() => { if (window.confirm('Обновить приложение сейчас? Открытая страница перезагрузится.')) void updateServiceWorker(true); }}><RefreshCw size={15} />Обновить</button><button className="text-button" onClick={() => setRefresh(false)}>Позже</button></div> : null}
    {error ? <div role="status" className="offline-status">{error}<button className="text-button" onClick={() => setError('')}>Закрыть</button></div> : null}</>;
}
function AppShell() {
  const location = useLocation();
  const data = useData();
  const entry = location.pathname.startsWith('/entry/') ? data.entries.find(e => e.id === location.pathname.split('/')[2]) : undefined;
  const inboxActive = location.pathname === '/inbox' || Boolean(entry && !entry.categoryId);
  const homeActive = location.pathname === '/' || location.pathname.startsWith('/category/') || Boolean(entry?.categoryId);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [location.pathname]);
  return <div className="app-shell"><a className="skip-link" href="#main">К содержимому</a><header className="app-header"><Link to="/" className="brand" aria-label="Personal Planner — главная"><img className="brand-mark" src="/planner-brand-v2-64.png" srcSet="/planner-brand-v2-64.png 2x, /planner-brand-v2-128.png 4x" width={32} height={32} alt="" /><span>personal planner</span></Link><div className="header-actions"><Link className="icon-button" to="/search" aria-label="Поиск"><Search size={22} strokeWidth={1.8} /></Link><Link className="icon-button" to="/settings" aria-label="Настройки"><Settings size={22} strokeWidth={1.8} /></Link></div></header>
    <PwaStatus /><main id="main" tabIndex={-1}><Outlet /></main>
    <nav className="bottom-nav" aria-label="Основная навигация"><NavLink end to="/" className={homeActive ? 'selected' : ''}><House size={22} strokeWidth={1.7} /><span>Главная</span></NavLink><NavLink to="/inbox" className={inboxActive ? 'selected' : ''}><Inbox size={22} strokeWidth={1.7} /><span>Входящие</span></NavLink><NavLink to="/history"><History size={22} strokeWidth={1.7} /><span>История</span></NavLink></nav>
  </div>;
}
export default function App() { return <AppProvider><AppShell /></AppProvider>; }
