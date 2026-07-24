// Settings → Sports: betting unit size and odds format.
import { useState } from 'react';
import { useAppState } from '../hooks/useAppState';
import { MessageBanner, MoneyInput, SectionCard, TopBar, useBack, useSectionHighlight } from '../components/common';

export default function SportsSettingsPage() {
  const app = useAppState();
  const back = useBack('/settings');
  useSectionHighlight();
  const [unitText, setUnitText] = useState(
    app.settings.betUnitValue === 0 ? '' : String(app.settings.betUnitValue),
  );
  const [message, setMessage] = useState('');

  return (
    <>
      <TopBar title="Sports" onBack={back} />
      <main className="page page--with-topbar">
        <MessageBanner>{message}</MessageBanner>
        <SectionCard id="unit" title="Unit size">
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
              disabled={(Number.parseFloat(unitText) || 0) === app.settings.betUnitValue}
              onClick={() => {
                app.updateSettings({ betUnitValue: Number.parseFloat(unitText) || 0 });
                setMessage('Unit size saved.');
              }}
            >
              Save
            </button>
          </div>
        </SectionCard>

        <SectionCard id="odds" title="Odds format">
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
          Looking for a separate sports bankroll? That lives in Settings → Bankroll &amp; currency.
        </p>
      </main>
    </>
  );
}
