// Port of Android DashboardScreen: bankroll header (tap to manage), live
// session timer card, cumulative chart, headline tiles, recent sessions.
import { useNavigate } from 'react-router-dom';
import { useAppState, useNow } from '../hooks/useAppState';
import { hourlyRate, roi, winRate } from '../domain/stats';
import {
  money,
  signedMoney,
  perHour,
  percent,
  elapsedClock,
  formatDateTime,
} from '../domain/format';
import { CumulativeProfitChart } from '../components/charts';
import { StatTileGrid, SessionRow, profitClass } from '../components/common';

export default function DashboardPage() {
  const app = useAppState();
  const navigate = useNavigate();
  const stats = app.allStats;
  const currency = app.settings.currency;

  return (
    <main className="page">
      <button
        type="button"
        onClick={() => navigate('/bankroll')}
        style={{ all: 'unset', cursor: 'pointer' }}
        aria-label="Manage bankroll"
      >
        <div className="overline" style={{ color: 'var(--gold-500)' }}>
          Current bankroll ›
        </div>
        <h1 className="money">{money(app.bankroll, currency)}</h1>
        <div className={`muted ${profitClass(stats.totalProfit)}`}>
          {signedMoney(stats.totalProfit, currency)} from sessions all-time • tap to manage
        </div>
      </button>

      <TimerCard />

      <section className="card">
        <div className="overline">Cumulative profit</div>
        <CumulativeProfitChart points={stats.cumulative} currency={currency} />
      </section>

      <StatTileGrid
        tiles={[
          { label: 'Profit', value: signedMoney(stats.totalProfit, currency), className: profitClass(stats.totalProfit) },
          { label: 'Per hour', value: perHour(hourlyRate(stats), currency), className: profitClass(hourlyRate(stats)) },
          { label: 'Sessions', value: String(stats.sessionCount) },
          { label: 'Hours', value: stats.totalHours.toFixed(1) },
          { label: 'Win rate', value: percent(winRate(stats)) },
          { label: 'ROI', value: percent(roi(stats)), className: profitClass(roi(stats)) },
        ]}
      />

      {app.sessions.length > 0 ? (
        <>
          <div className="row-between">
            <h2>Recent sessions</h2>
            <button type="button" className="btn btn-outline" onClick={() => navigate('/sessions')}>
              See all
            </button>
          </div>
          <div className="col">
            {app.sessions.slice(0, 5).map((s) => (
              <SessionRow key={s.id} session={s} />
            ))}
          </div>
        </>
      ) : (
        app.ready && (
          <div className="card empty">
            <h2>No sessions yet</h2>
            <p>Tap the + button to log your first poker session and start tracking your bankroll.</p>
          </div>
        )
      )}
    </main>
  );
}

function TimerCard() {
  const app = useAppState();
  const navigate = useNavigate();
  const running = app.timerStart > 0;
  const now = useNow(running);

  if (!running) {
    return (
      <section className="card row-between">
        <div className="grow">
          <h2>Live session</h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Start a timer now; we'll fill in the duration when you log it.
          </p>
        </div>
        <button type="button" className="btn" onClick={app.startTimer}>
          ▶ Start
        </button>
      </section>
    );
  }

  const stopAndLog = () => {
    const start = app.timerStart;
    const minutes = Math.max(0, Math.floor((Date.now() - start) / 60000));
    app.clearTimer();
    navigate(`/session/new?start=${start}&duration=${minutes}`);
  };

  return (
    <section className="card col" style={{ background: 'var(--primary-container)' }}>
      <div className="overline">Live session</div>
      <div className="money" style={{ fontSize: '2rem', fontWeight: 700 }} role="timer">
        {elapsedClock(now - app.timerStart)}
      </div>
      <div className="muted">Started {formatDateTime(app.timerStart)}</div>
      <div className="row">
        <button type="button" className="btn btn-outline grow" onClick={app.clearTimer}>
          Discard
        </button>
        <button type="button" className="btn grow" onClick={stopAndLog}>
          ■ Stop &amp; log
        </button>
      </div>
    </section>
  );
}
