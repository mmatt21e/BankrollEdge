// Route table — top-level tabs plus the tool routes.
import { RouteObject, Navigate } from 'react-router-dom';
import SessionsPage from '../pages/SessionsPage';
import StatsPage from '../pages/StatsPage';
import SettingsPage from '../pages/SettingsPage';
import GeneralSettingsPage from '../pages/GeneralSettingsPage';
import DisplaySettingsPage from '../pages/DisplaySettingsPage';
import PokerSettingsPage from '../pages/PokerSettingsPage';
import TableGamesSettingsPage from '../pages/TableGamesSettingsPage';
import SportsSettingsPage from '../pages/SportsSettingsPage';
import ImportPage from '../pages/ImportPage';
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
import MorePage from '../pages/MorePage';
import DeepStatsPage from '../pages/DeepStatsPage';
import StatsBreakdownPage from '../pages/StatsBreakdownPage';
import WalletsPage from '../pages/WalletsPage';
import OddsPage from '../pages/OddsPage';
import MRatioPage from '../pages/MRatioPage';
import ReportPage from '../pages/ReportPage';
import NotepadPage from '../pages/NotepadPage';
import PlayerNotesPage from '../pages/PlayerNotesPage';

export const routes: RouteObject[] = [
  { path: '/', element: <StatsPage /> },
  { path: '/sessions', element: <SessionsPage scope="POKER" /> },
  { path: '/tables', element: <SessionsPage scope="TABLE" /> },
  { path: '/bets', element: <BetsPage /> },
  { path: '/stats', element: <Navigate to="/" replace /> },
  { path: '/stats/deep', element: <DeepStatsPage /> },
  { path: '/stats/by/:dim', element: <StatsBreakdownPage /> },
  { path: '/tools', element: <ToolsPage /> },
  { path: '/more', element: <MorePage /> },
  { path: '/settings', element: <SettingsPage /> },
  { path: '/settings/general', element: <GeneralSettingsPage /> },
  { path: '/settings/display', element: <DisplaySettingsPage /> },
  { path: '/settings/poker', element: <PokerSettingsPage /> },
  { path: '/settings/table-games', element: <TableGamesSettingsPage /> },
  { path: '/settings/sports', element: <SportsSettingsPage /> },
  { path: '/settings/import', element: <ImportPage /> },
  { path: '/session/new', element: <EditorPage /> },
  { path: '/session/:id', element: <EditorPage /> },
  { path: '/bet/new', element: <BetEditorPage /> },
  { path: '/bet/:id', element: <BetEditorPage /> },
  { path: '/bankroll', element: <BankrollPage /> },
  { path: '/wallets', element: <WalletsPage /> },
  { path: '/notepad', element: <NotepadPage /> },
  { path: '/report', element: <ReportPage /> },
  { path: '/players', element: <PlayerNotesPage /> },
  { path: '/tools/odds', element: <OddsPage /> },
  { path: '/tools/mratio', element: <MRatioPage /> },
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
