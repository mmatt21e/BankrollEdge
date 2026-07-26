// Route table — top-level tabs plus the tool routes.
import { RouteObject, Navigate } from 'react-router-dom';
import SessionsPage from '../pages/SessionsPage';
import StatsPage from '../pages/StatsPage';
import SettingsPage from '../pages/SettingsPage';
import BankrollSettingsPage from '../pages/BankrollSettingsPage';
import FeaturesSettingsPage from '../pages/FeaturesSettingsPage';
import DisplaySettingsPage from '../pages/DisplaySettingsPage';
import PokerSettingsPage from '../pages/PokerSettingsPage';
import TableGamesSettingsPage from '../pages/TableGamesSettingsPage';
import SportsSettingsPage from '../pages/SportsSettingsPage';
import VenuesSettingsPage from '../pages/VenuesSettingsPage';
import DataSettingsPage from '../pages/DataSettingsPage';
import PrivacySettingsPage from '../pages/PrivacySettingsPage';
import AboutSettingsPage from '../pages/AboutSettingsPage';
import ImportPage from '../pages/ImportPage';
import EditorPage from '../pages/EditorPage';
import BankrollPage from '../pages/BankrollPage';
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
import TravelLogPage from '../pages/TravelLogPage';
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
  // The Tools hub folded into More — old links and pins land there.
  { path: '/tools', element: <Navigate to="/more" replace /> },
  { path: '/more', element: <MorePage /> },
  { path: '/settings', element: <SettingsPage /> },
  // General split into topical pages; old links land on the hub.
  { path: '/settings/general', element: <Navigate to="/settings" replace /> },
  { path: '/settings/bankroll', element: <BankrollSettingsPage /> },
  { path: '/settings/features', element: <FeaturesSettingsPage /> },
  { path: '/settings/display', element: <DisplaySettingsPage /> },
  { path: '/settings/poker', element: <PokerSettingsPage /> },
  { path: '/settings/table-games', element: <TableGamesSettingsPage /> },
  { path: '/settings/sports', element: <SportsSettingsPage /> },
  { path: '/settings/venues', element: <VenuesSettingsPage /> },
  { path: '/settings/data', element: <DataSettingsPage /> },
  { path: '/settings/privacy', element: <PrivacySettingsPage /> },
  { path: '/settings/about', element: <AboutSettingsPage /> },
  { path: '/settings/import', element: <ImportPage /> },
  { path: '/session/new', element: <EditorPage /> },
  { path: '/session/:id', element: <EditorPage /> },
  { path: '/bet/new', element: <BetEditorPage /> },
  { path: '/bet/:id', element: <BetEditorPage /> },
  { path: '/bankroll', element: <BankrollPage /> },
  { path: '/wallets', element: <WalletsPage /> },
  { path: '/travel', element: <TravelLogPage /> },
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
