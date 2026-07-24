// Print-friendly session report — use the browser's Print → Save as PDF for
// a shareable/tax-ready document. Respects the current filters.
import { useAppState } from '../hooks/useAppState';
import { activeFilterCount } from '../domain/filter';
import { avgProfit, hourlyRate, winRate } from '../domain/stats';
import {
  duration,
  formatDate,
  percent,
  perHour,
  signedMoney,
} from '../domain/format';
import {
  gameTypeLabel,
  isTableSession,
  profit,
  SESSION_TYPE_LABELS,
  tableGameLabel,
} from '../models/types';
import { sessionStakesLabel } from '../domain/filter';
import { TopBar, profitClass, useBack } from '../components/common';

export default function ReportPage() {
  const app = useAppState();
  const back = useBack('/more');
  const currency = app.settings.currency;
  const sessions = app.filteredSessions;
  const stats = app.filteredStats;
  const filtered = activeFilterCount(app.filter) > 0;

  return (
    <>
      <div className="no-print">
        <TopBar
          title="Session report"
          onBack={back}
          action={
            <button type="button" className="btn" onClick={() => window.print()}>
              Print / PDF
            </button>
          }
        />
      </div>
      <main className="page page--with-topbar print-page">
        <header className="col" style={{ gap: 2 }}>
          <h1>BankrollEdge — Session report</h1>
          <p className="muted small" style={{ margin: 0 }}>
            Generated {formatDate(Date.now())} • {sessions.length} sessions
            {filtered ? ' (filters applied)' : ' (all time)'}
          </p>
        </header>

        <table className="report-table">
          <tbody>
            <tr><th>Total profit</th><td className={profitClass(stats.totalProfit)}>{signedMoney(stats.totalProfit, currency)}</td></tr>
            <tr><th>Sessions</th><td>{stats.sessionCount}</td></tr>
            <tr><th>Hours played</th><td>{stats.totalHours.toFixed(1)}</td></tr>
            <tr><th>Hourly rate</th><td>{perHour(hourlyRate(stats), currency)}</td></tr>
            <tr><th>Average per session</th><td>{signedMoney(avgProfit(stats), currency)}</td></tr>
            <tr><th>Win rate</th><td>{percent(winRate(stats))}</td></tr>
            <tr><th>Biggest win / loss</th><td>{signedMoney(stats.biggestWin, currency)} / {signedMoney(stats.biggestLoss, currency)}</td></tr>
          </tbody>
        </table>

        <h2>By month</h2>
        <table className="report-table">
          <thead>
            <tr><th>Month</th><th>Sessions</th><th>Profit</th></tr>
          </thead>
          <tbody>
            {stats.byMonth.map((m) => (
              <tr key={m.sortKey}>
                <td>{m.label}</td>
                <td>{m.sessionCount}</td>
                <td className={profitClass(m.profit)}>{signedMoney(m.profit, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Sessions</h2>
        <table className="report-table">
          <thead>
            <tr><th>Date</th><th>Type</th><th>Game</th><th>Stakes</th><th>Venue</th><th>Time</th><th>Profit</th></tr>
          </thead>
          <tbody>
            {[...sessions]
              .sort((a, b) => a.startTime - b.startTime)
              .map((s) => (
                <tr key={s.id}>
                  <td>{formatDate(s.startTime)}</td>
                  <td>{SESSION_TYPE_LABELS[s.sessionType]}</td>
                  <td>{isTableSession(s) ? tableGameLabel(s.tableGame) : gameTypeLabel(s.gameType)}</td>
                  <td>{sessionStakesLabel(s) || '—'}</td>
                  <td>{s.location || '—'}</td>
                  <td>{s.durationMinutes > 0 ? duration(s.durationMinutes) : '—'}</td>
                  <td className={profitClass(profit(s))}>{signedMoney(profit(s), s.currency)}</td>
                </tr>
              ))}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={6}>Total</th>
              <th className={profitClass(stats.totalProfit)}>{signedMoney(stats.totalProfit, currency)}</th>
            </tr>
          </tfoot>
        </table>
        <p className="muted small">Session amounts are shown in each session's own currency.</p>
      </main>
    </>
  );
}
