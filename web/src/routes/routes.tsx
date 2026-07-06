// Route table — top-level tabs plus the tool routes.
import { RouteObject, Navigate } from 'react-router-dom';
import DashboardPage from '../pages/DashboardPage';
import SessionsPage from '../pages/SessionsPage';
import StatsPage from '../pages/StatsPage';
import SettingsPage from '../pages/SettingsPage';
import EditorPage from '../pages/EditorPage';
import BankrollPage from '../pages/BankrollPage';
import ToolsPage from '../pages/ToolsPage';
import ClockPage from '../pages/ClockPage';
import HomeGamesPage from '../pages/HomeGamesPage';
import PayoutPage from '../pages/PayoutPage';
import DealPage from '../pages/DealPage';
import StackValuePage from '../pages/StackValuePage';
import ChipsPage from '../pages/ChipsPage';
import CalendarPage from '../pages/CalendarPage';
import HandNotesPage from '../pages/HandNotesPage';
import BetsPage from '../pages/BetsPage';
import BetEditorPage from '../pages/BetEditorPage';

export const routes: RouteObject[] = [
  { path: '/', element: <DashboardPage /> },
  { path: '/sessions', element: <SessionsPage /> },
  { path: '/bets', element: <BetsPage /> },
  { path: '/stats', element: <StatsPage /> },
  { path: '/tools', element: <ToolsPage /> },
  { path: '/settings', element: <SettingsPage /> },
  { path: '/session/new', element: <EditorPage /> },
  { path: '/session/:id', element: <EditorPage /> },
  { path: '/bet/new', element: <BetEditorPage /> },
  { path: '/bet/:id', element: <BetEditorPage /> },
  { path: '/bankroll', element: <BankrollPage /> },
  { path: '/tools/clock', element: <ClockPage /> },
  { path: '/tools/home-games', element: <HomeGamesPage /> },
  { path: '/tools/payout', element: <PayoutPage /> },
  { path: '/tools/deal', element: <DealPage /> },
  { path: '/tools/stack-value', element: <StackValuePage /> },
  { path: '/tools/chips', element: <ChipsPage /> },
  { path: '/tools/calendar', element: <CalendarPage /> },
  { path: '/tools/hands', element: <HandNotesPage /> },
  { path: '*', element: <Navigate to="/" replace /> },
];
