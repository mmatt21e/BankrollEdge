import { useEffect, useId, useRef } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Dialog } from '../components/common';
import { StartSessionDialog } from '../components/StartSessionDialog';
import { useAppState } from '../hooks/useAppState';
import { SessionEntryState, sessionEntryDefaults } from '../domain/sessionEntry';
import { SESSION_TYPE_LABELS, gameTypeLabel, tableGameLabel } from '../models/types';
import EditorPage from './EditorPage';

/** The route is the gate, so direct URLs and user-created quick links get
 *  the same choice. Existing live-session finish/resume URLs bypass it. */
export default function NewSessionPage() {
  const app = useAppState();
  const [params] = useSearchParams();
  if (params.has('live')) return <EditorPage />;
  if (!app.ready) return <main className="page"><p role="status">Loading sessions…</p></main>;
  if (app.loadError) return <main className="page"><p role="alert">Your data could not be loaded. Reload before adding a session.</p><Link to="/">Back to dashboard</Link></main>;
  return <SessionEntryFlow key={params.toString()} />;
}

function SessionEntryFlow() {
  const app = useAppState();
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const flow = (location.state as SessionEntryState | null)?.sessionEntry;
  const step = flow?.step;
  const initial = sessionEntryDefaults(params, app.settings, Date.now());
  const fallback = initial.sessionType === 'TABLE' ? '/tables' : '/sessions';
  const returnTo = flow?.returnTo?.startsWith('/') && !flow.returnTo.startsWith('//') && !flow.returnTo.startsWith('/session/')
    ? flow.returnTo : fallback;
  const hintId = useId();
  const transitioning = useRef(false);
  useEffect(() => { transitioning.current = false; }, [location.key]);
  const trigger = flow?.trigger;
  // A routed modal removes its opener from the DOM. Restore focus after
  // the source route remounts, including browser Back and Escape/Cancel.
  useEffect(() => () => {
    if (trigger) requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-session-add="${trigger}"]`)?.focus());
  }, [trigger]);
  const close = () => {
    if (transitioning.current) return;
    transitioning.current = true;
    const index = window.history.state?.idx;
    const originIndex = flow?.originIndex;
    if (typeof originIndex === 'number' && Number.isInteger(originIndex) && originIndex >= 0 && Number.isInteger(index) && index > originIndex) {
      navigate(originIndex - index);
    } else navigate(returnTo, { replace: true });
  };
  const choose = (next: 'live' | 'previous') => {
    if (transitioning.current) return;
    transitioning.current = true;
    navigate(location.pathname + location.search, { state: { sessionEntry: { ...flow, step: next } } satisfies SessionEntryState });
  };
  const backToChoice = () => {
    if (transitioning.current) return;
    transitioning.current = true;
    navigate(-1);
  };
  if (step === 'previous') return <EditorPage onSaved={() => navigate(returnTo, { replace: true })} />;
  if (step === 'live') return <StartSessionDialog initial={initial} onBack={backToChoice} onCancel={close} onStart={(setup) => {
    app.startSession(setup);
    // Replace the form history entry so Forward cannot resubmit it.
    navigate('/', { replace: true });
  }} />;
  const count = app.activeSessions.length;
  return (
    <Dialog label="Add session" onClose={close}>
      <h2>Add session</h2>
      <p className="muted" style={{ margin: 0 }}>How would you like to add this session?</p>
      <p className="small" style={{ margin: 0 }}>{SESSION_TYPE_LABELS[initial.sessionType]} · {initial.sessionType === 'TABLE' ? tableGameLabel(initial.tableGame) : gameTypeLabel(initial.gameType)}{initial.location ? ' · ' + initial.location : ''}</p>
      {count > 0 && <p className="muted small" style={{ margin: 0 }}>{count} live {count === 1 ? 'session is' : 'sessions are'} already running. Starting another keeps them running.</p>}
      <div className="col">
        <button type="button" className="btn" aria-describedby={hintId + '-live'} onClick={() => choose('live')}>Start a live session</button>
        <p id={hintId + '-live'} className="muted small" style={{ margin: 0 }}>Set up the session, then start its play timer.</p>
        <button type="button" className="btn btn-outline" aria-describedby={hintId + '-previous'} onClick={() => choose('previous')}>Record a previous session</button>
        <p id={hintId + '-previous'} className="muted small" style={{ margin: 0 }}>Enter a session you have already played. No timer starts.</p>
      </div>
      <div className="actions"><button type="button" className="btn btn-outline" onClick={close}>Cancel</button></div>
    </Dialog>
  );
}
