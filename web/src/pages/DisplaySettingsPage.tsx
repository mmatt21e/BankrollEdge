// Settings → Display: theme, card deck colors and dashboard cards.
// Feature switches and bottom-nav shortcuts live under Features & navigation.
import { useAppState } from '../hooks/useAppState';
import { ThemeMode } from '../models/types';
import { SectionCard, ToggleRow, TopBar, useBack, useSectionHighlight } from '../components/common';

export default function DisplaySettingsPage() {
  const app = useAppState();
  const back = useBack('/settings');
  useSectionHighlight();
  const s = app.settings;

  return (
    <>
      <TopBar title="Display" onBack={back} />
      <main className="page page--with-topbar">
        <SectionCard id="theme" title="Theme">
          <div className="segmented" role="group" aria-label="Theme">
            {(
              [
                ['SYSTEM', 'System'],
                ['LIGHT', 'Light'],
                ['DARK', 'Dark'],
              ] as [ThemeMode, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={s.theme === value}
                onClick={() => app.updateSettings({ theme: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </SectionCard>

        {s.showPoker && (
          <SectionCard id="deck" title="Card deck">
            <p className="muted" style={{ margin: 0 }}>
              How playing cards render in the poker tools (odds calculator, deck picker).
            </p>
            <div className="segmented" role="group" aria-label="Deck colors">
              {(
                [
                  ['TWO', 'Two colors'],
                  ['FOUR', 'Four colors'],
                ] as ['TWO' | 'FOUR', string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={s.deckColors === value}
                  onClick={() => app.updateSettings({ deckColors: value })}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="muted small" style={{ margin: 0 }}>
              Four colors: ♠ black, <span className="card-red">♥ red</span>,{' '}
              <span className="card-diamond">♦ blue</span>, <span className="card-club">♣ green</span>.
            </p>
          </SectionCard>
        )}

        <SectionCard id="stats" title="Statistics">
          <ToggleRow
            label="Count travel time in hourly rates"
            hint="Recorded round-trip travel is added to the time side of $/hr and hours totals on stats screens. Session durations themselves stay play-time only."
            checked={s.travelInHourly}
            onChange={(v) => app.updateSettings({ travelInHourly: v })}
          />
        </SectionCard>

        <SectionCard id="dash" title="Dashboard cards">
          <ToggleRow
            label="Profit chart"
            checked={s.dashChart}
            onChange={(v) => app.updateSettings({ dashChart: v })}
          />
          <ToggleRow
            label="Stat tiles"
            checked={s.dashTiles}
            onChange={(v) => app.updateSettings({ dashTiles: v })}
          />
          <ToggleRow
            label="Daily results calendar"
            checked={s.dashHeatmap}
            onChange={(v) => app.updateSettings({ dashHeatmap: v })}
          />
          {s.showSports && (
            <ToggleRow
              label="Sports snapshot"
              checked={s.dashSports}
              onChange={(v) => app.updateSettings({ dashSports: v })}
            />
          )}
        </SectionCard>
      </main>
    </>
  );
}
