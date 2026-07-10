// Settings → Sports: betting unit size and odds format.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../hooks/useAppState';
import { MoneyInput, SectionCard, TopBar } from '../components/common';

export default function SportsSettingsPage() {
  const app = useAppState();
  const navigate = useNavigate();
  const [unitText, setUnitText] = useState(
    app.settings.betUnitValue === 0 ? '' : String(app.settings.betUnitValue),
  );

  return (
    <>
      <TopBar title="Sports" onBack={() => navigate(-1)} />
      <main className="page" style={{ paddingTop: 0 }}>
        <SectionCard title="Unit size">
          <p className="muted" style={{ margin: 0 }}>
            Shows your betting results in units alongside money (0 = off).
          </p>
          <div className="row">
            <label className="field grow">
              <span>Unit size</span>
              <MoneyInput value={unitText} onChange={setUnitText} />
            </label>
            <button
              type="button"
              className="btn"
              style={{ alignSelf: 'flex-end' }}
              onClick={() =>
                app.updateSettings({ betUnitValue: Number.parseFloat(unitText) || 0 })
              }
            >
              Save
            </button>
          </div>
        </SectionCard>

        <SectionCard title="Odds format">
          <p className="muted" style={{ margin: 0 }}>
            Applies to entering and displaying bet prices.
          </p>
          <div className="segmented" role="group" aria-label="Odds format">
            {(
              [
                ['AMERICAN', 'American (-110)'],
                ['DECIMAL', 'Decimal (1.91)'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={app.settings.oddsFormat === value}
                onClick={() => app.updateSettings({ oddsFormat: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </SectionCard>

        <p className="muted small" style={{ margin: 0 }}>
          Looking for a separate sports bankroll? That lives in Settings → General → Bankroll.
        </p>
      </main>
    </>
  );
}
