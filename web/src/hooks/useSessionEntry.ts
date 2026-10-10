import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppState } from './useAppState';
import { SessionEntryScope, SessionEntryState, sessionEntryUrl } from '../domain/sessionEntry';

/** All built-in add buttons use the same route and preserve their origin. */
export function useSessionEntry() {
  const app = useAppState();
  const navigate = useNavigate();
  const location = useLocation();
  const opening = useRef(false);
  useEffect(() => { opening.current = false; }, [location.key]);
  return (scope: SessionEntryScope, trigger: 'dashboard' | 'fab') => {
    if (opening.current) return;
    opening.current = true;
    const state: SessionEntryState = { sessionEntry: {
      returnTo: location.pathname + location.search,
      originIndex: window.history.state?.idx,
      trigger,
    } };
    navigate(sessionEntryUrl(scope, app.settings, app.filter), { state });
  };
}
