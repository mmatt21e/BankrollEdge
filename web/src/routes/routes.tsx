// Route table — the PWA equivalent of the Android NavHost graph.
import { RouteObject, Navigate } from 'react-router-dom';
import DashboardPage from '../pages/DashboardPage';
import SessionsPage from '../pages/SessionsPage';
import StatsPage from '../pages/StatsPage';
import SettingsPage from '../pages/SettingsPage';
import EditorPage from '../pages/EditorPage';
import BankrollPage from '../pages/BankrollPage';

export const routes: RouteObject[] = [
  { path: '/', element: <DashboardPage /> },
  { path: '/sessions', element: <SessionsPage /> },
  { path: '/stats', element: <StatsPage /> },
  { path: '/settings', element: <SettingsPage /> },
  { path: '/session/new', element: <EditorPage /> },
  { path: '/session/:id', element: <EditorPage /> },
  { path: '/bankroll', element: <BankrollPage /> },
  { path: '*', element: <Navigate to="/" replace /> },
];
