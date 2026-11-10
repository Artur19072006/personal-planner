import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from './App';
import { HomePage, CategoryPage } from './pages/home';
import { InboxPage } from './pages/inbox';
import './styles.css';

function ErrorScreen() { return <div className="error-screen"><h1>Не удалось открыть планер</h1><p>Данные не удалены. Попробуй перезагрузить страницу и проверь, разрешено ли браузеру локальное хранение.</p><button className="button primary" onClick={() => window.location.reload()}>Перезагрузить</button></div>; }
class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Planner error', error, info.componentStack); }
  render() { return this.state.error ? <ErrorScreen /> : this.props.children; }
}
const router = createBrowserRouter([{ element: <App />, errorElement: <ErrorScreen />, children: [
  { path: '/', element: <HomePage /> }, { path: '/inbox', element: <InboxPage /> },
  { path: '/category/:id', element: <CategoryPage /> },
  { path: '/entry/:id', lazy: async () => ({ Component: (await import('./pages/entry')).EntryPage }) },
  { path: '/history', lazy: async () => ({ Component: (await import('./pages/history')).HistoryPage }) },
  { path: '/search', lazy: async () => ({ Component: (await import('./pages/search')).SearchPage }) },
  { path: '/settings', lazy: async () => ({ Component: (await import('./pages/settings')).SettingsPage }) },
  { path: '/settings/categories', lazy: async () => ({ Component: (await import('./pages/settings')).ManageCategoriesPage }) },
  { path: '*', element: <div className="empty"><h1>Страница не найдена</h1><a href="/">Вернуться к планам</a></div> },
] }]);
createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><RouterProvider router={router} /></ErrorBoundary></StrictMode>);
