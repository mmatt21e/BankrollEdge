// One "Statistics by …" drill-down: sessions grouped along a dimension
// (week, month, game, stake, buy-in, venue, weekday), scoped to a discipline.
import { useParams, useSearchParams } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import { useAppState } from '../hooks/useAppState';
import {
  BREAKDOWN_DIMS,
  BreakdownDim,
  breakdownBy,
} from '../domain/deepStats';
import { isTournamentStyle } from '../models/types';
import { BreakdownList, TopBar, useBack } from '../components/common';

export default function StatsBreakdownPage() {
  const app = useAppState();
  const back = useBack('/stats/deep');
  const { dim } = useParams();
  const [params] = useSearchParams();

  const meta = BREAKDOWN_DIMS.find((d) => d.key === dim);
  if (!meta) return <Navigate to="/stats/deep" replace />;

  const scope = params.get('scope') ?? 'all';
  const sessions = app.filteredSessions.filter((s) => {
    if (scope === 'cash') return s.sessionType === 'CASH';
    if (scope === 'tournament') return isTournamentStyle(s);
    return true;
  });
  const groups = breakdownBy(meta.key as BreakdownDim, sessions);
  const scopeLabel =
    scope === 'cash' ? 'cash games' : scope === 'tournament' ? 'tournaments' : 'all games';

  return (
    <>
      <TopBar title={`By ${meta.label.toLowerCase()}`} onBack={back} />
      <main className="page page--with-topbar">
        <p className="muted small" style={{ margin: 0 }}>
          {sessions.length} session{sessions.length === 1 ? '' : 's'} • {scopeLabel} • current
          filters applied
        </p>
        {groups.length === 0 ? (
          <p className="empty">Nothing to group yet — log sessions first.</p>
        ) : (
          <section className="card">
            <BreakdownList groups={groups} currency={app.settings.currency} />
          </section>
        )}
      </main>
    </>
  );
}
