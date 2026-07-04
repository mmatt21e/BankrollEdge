// Plain-English insight cards. Every insight is a deterministic computation
// over the (filtered) session list with explicit minimum-sample thresholds —
// nothing opaque. An insight is omitted when there isn't enough data.
import {
  Session,
  profit,
  isTournamentStyle,
  stakesLabel,
  totalInvested,
} from '../models/types';
import { signedMoney, percent } from './format';

export interface Insight {
  id: string;
  text: string;
  /** 'good' | 'bad' | 'neutral' — drives the card accent. */
  tone: 'good' | 'bad' | 'neutral';
}

const MIN_SESSIONS = 3;
const MIN_HOURS = 5;

export function computeInsights(sessions: Session[], currency: string): Insight[] {
  const out: Insight[] = [];
  if (sessions.length < MIN_SESSIONS) return out;

  const bestSpot = bestHourlySpot(sessions);
  if (bestSpot) {
    out.push({
      id: 'best-spot',
      tone: 'good',
      text: `Your best hourly rate is ${signedMoney(bestSpot.rate, currency)}/hr playing ${bestSpot.label} (${bestSpot.count} sessions).`,
    });
  }

  const mtts = sessions.filter(isTournamentStyle);
  if (mtts.length >= MIN_SESSIONS) {
    const invested = mtts.reduce((a, s) => a + totalInvested(s), 0);
    const net = mtts.reduce((a, s) => a + profit(s), 0);
    if (invested > 0) {
      const r = net / invested;
      out.push({
        id: 'mtt-roi',
        tone: r >= 0 ? 'good' : 'bad',
        text: `Your tournament ROI is ${r >= 0 ? 'positive' : 'negative'} at ${percent(r)} over ${mtts.length} tournaments.`,
      });
    }
  }

  const lateNight = compareSubset(
    sessions,
    (s) => {
      const h = new Date(s.startTime).getHours();
      return h >= 0 && h < 6;
    },
  );
  if (lateNight) {
    out.push({
      id: 'late-night',
      tone: lateNight.delta < 0 ? 'bad' : 'good',
      text: `Your sessions starting after midnight average ${signedMoney(lateNight.subsetAvg, currency)} vs ${signedMoney(lateNight.overallAvg, currency)} overall — they're ${lateNight.delta < 0 ? 'underperforming' : 'outperforming'} your average.`,
    });
  }

  const losingStreak = longestLosingStreak(sessions);
  if (losingStreak >= 3) {
    out.push({
      id: 'losing-streak',
      tone: 'neutral',
      text: `Your longest losing streak was ${losingStreak} sessions. Variance is normal — watch the trend, not the streak.`,
    });
  }

  const liveOnline = liveVsOnline(sessions);
  if (liveOnline) {
    out.push({
      id: 'live-online',
      tone: 'neutral',
      text: `You perform better in ${liveOnline.better} games: ${signedMoney(liveOnline.betterAvg, currency)} vs ${signedMoney(liveOnline.worseAvg, currency)} average per session.`,
    });
  }

  const focus = compareSubset(
    sessions.filter((s) => s.focus > 0),
    (s) => s.focus >= 4,
  );
  if (focus && focus.delta > 0) {
    out.push({
      id: 'focus',
      tone: 'good',
      text: `When you rate your focus 4+ you average ${signedMoney(focus.subsetAvg, currency)} per session vs ${signedMoney(focus.overallAvg, currency)} otherwise.`,
    });
  }

  const gq = compareSubset(
    sessions.filter((s) => s.gameQuality !== ''),
    (s) => s.gameQuality === 'GOOD' || s.gameQuality === 'GREAT',
  );
  if (gq) {
    out.push({
      id: 'game-quality',
      tone: gq.delta > 0 ? 'good' : 'neutral',
      text: `In games you rated Good or Great you average ${signedMoney(gq.subsetAvg, currency)} vs ${signedMoney(gq.overallAvg, currency)} in weaker games — table selection ${gq.delta > 0 ? 'is paying off' : 'is not showing an edge yet'}.`,
    });
  }

  return out;
}

/** Best $/hr among stakes+location groups with enough volume. */
function bestHourlySpot(
  sessions: Session[],
): { label: string; rate: number; count: number } | null {
  const groups = new Map<string, Session[]>();
  for (const s of sessions) {
    if (isTournamentStyle(s) || s.durationMinutes <= 0) continue;
    const stakes = stakesLabel(s);
    if (!stakes) continue;
    const key = `${stakes}${s.location ? ` at ${s.location}` : ''}`;
    const list = groups.get(key);
    if (list) list.push(s);
    else groups.set(key, [s]);
  }
  let best: { label: string; rate: number; count: number } | null = null;
  for (const [label, list] of groups) {
    const hours = list.reduce((a, s) => a + s.durationMinutes, 0) / 60;
    if (list.length < MIN_SESSIONS || hours < MIN_HOURS) continue;
    const rate = list.reduce((a, s) => a + profit(s), 0) / hours;
    if (!best || rate > best.rate) best = { label, rate, count: list.length };
  }
  return best && best.rate > 0 ? best : null;
}

/** Average of a subset vs the average of the rest (null if too few of either). */
function compareSubset(
  sessions: Session[],
  isSubset: (s: Session) => boolean,
): { subsetAvg: number; overallAvg: number; delta: number } | null {
  const subset = sessions.filter(isSubset);
  const rest = sessions.filter((s) => !isSubset(s));
  if (subset.length < MIN_SESSIONS || rest.length < MIN_SESSIONS) return null;
  const avg = (list: Session[]) => list.reduce((a, s) => a + profit(s), 0) / list.length;
  const subsetAvg = avg(subset);
  const overallAvg = avg(rest);
  return { subsetAvg, overallAvg, delta: subsetAvg - overallAvg };
}

function longestLosingStreak(sessions: Session[]): number {
  const chrono = [...sessions].sort((a, b) => a.startTime - b.startTime);
  let worst = 0;
  let run = 0;
  for (const s of chrono) {
    run = profit(s) < 0 ? run + 1 : 0;
    if (run > worst) worst = run;
  }
  return worst;
}

function liveVsOnline(
  sessions: Session[],
): { better: string; betterAvg: number; worseAvg: number } | null {
  const live = sessions.filter((s) => s.venueType !== 'ONLINE');
  const online = sessions.filter((s) => s.venueType === 'ONLINE');
  if (live.length < MIN_SESSIONS || online.length < MIN_SESSIONS) return null;
  const avg = (list: Session[]) => list.reduce((a, s) => a + profit(s), 0) / list.length;
  const liveAvg = avg(live);
  const onlineAvg = avg(online);
  return liveAvg >= onlineAvg
    ? { better: 'live', betterAvg: liveAvg, worseAvg: onlineAvg }
    : { better: 'online', betterAvg: onlineAvg, worseAvg: liveAvg };
}
