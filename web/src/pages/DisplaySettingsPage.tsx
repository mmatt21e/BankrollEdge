// Settings → Display: theme, feature switches, nav tabs, dashboard cards.
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../hooks/useAppState';
import { ThemeMode } from '../models/types';
import { SectionCard, TopBar } from '../components/common';

function ToggleRow({
  label,
  hint,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle-row" style={disabled ? { opacity: 0.55 } : undefined}>
      <span>
        {label}
        {hint && <span className="hint" style={{ display: 'block' }}>{hint}</span>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export default function DisplaySettingsPage() {
  const app = useAppState();
  const navigate = useNavigate();
  const s = app.settings;
  const enabledFeatures = [s.showPoker, s.showTableGames, s.showSports].filter(Boolean).length;

  return (
    <>
      <TopBar title="Display" onBack={() => navigate(-1)} />
      <main className="page" style={{ paddingTop: 0 }}>
        <SectionCard title="Theme">
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

        <SectionCard title="Features">
          <ToggleRow
            label="Poker"
            hint="Cash games, tournaments, sit & gos, home games and the poker tools"
            checked={s.showPoker}
            disabled={s.showPoker && enabledFeatures === 1}
            onChange={(v) => app.updateSettings({ showPoker: v })}
          />
          <ToggleRow
            label="Table games"
            hint="Blackjack, craps and other casino games"
            checked={s.showTableGames}
            disabled={s.showTableGames && enabledFeatures === 1}
            onChange={(v) => app.updateSettings({ showTableGames: v })}
          />
          <ToggleRow
            label="Sports betting"
            hint="The Sports tab and all betting features"
            checked={s.showSports}
            disabled={s.showSports && enabledFeatures === 1}
            onChange={(v) => app.updateSettings({ showSports: v })}
          />
          <p className="muted small" style={{ margin: 0 }}>
            Everything tied to a feature (tabs, filters, tools, presets, settings) hides with
            it. At least one feature always stays on.
          </p>
        </SectionCard>

        <SectionCard title="Tabs">
          {(s.showPoker || s.showTableGames) && (
            <ToggleRow
              label="Sessions tab"
              checked={s.showSessionsTab}
              onChange={(v) => app.updateSettings({ showSessionsTab: v })}
            />
          )}
          <ToggleRow
            label="Dashboard tab"
            checked={s.showDashboardTab}
            onChange={(v) => app.updateSettings({ showDashboardTab: v })}
          />
          <p className="muted small" style={{ margin: 0 }}>
            Play and More always stay in the navigation.
          </p>
        </SectionCard>

        <SectionCard title="Dashboard cards">
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
