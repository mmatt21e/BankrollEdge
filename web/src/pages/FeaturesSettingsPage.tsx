// Settings → Features & navigation: which parts of the app are on
// (poker, table games, sports) and what sits in the bottom bar.
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../hooks/useAppState';
import { SectionCard, ToggleRow, TopBar, useBack, useSectionHighlight } from '../components/common';

export default function FeaturesSettingsPage() {
  const app = useAppState();
  const navigate = useNavigate();
  const back = useBack('/settings');
  useSectionHighlight();
  const s = app.settings;
  const enabledFeatures = [s.showPoker, s.showTableGames, s.showSports].filter(Boolean).length;

  return (
    <>
      <TopBar title="Features & navigation" onBack={back} />
      <main className="page page--with-topbar">
        <SectionCard id="features" title="Features">
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

        <SectionCard id="nav" title="Bottom navigation">
          <p className="muted" style={{ margin: 0 }}>
            Pick which shortcuts sit in the bottom bar from the More tab — tap the star next to
            any screen to pin it (up to 5). More itself always stays in the bar.
          </p>
          <button type="button" className="btn btn-outline" onClick={() => navigate('/more')}>
            Customize shortcuts
          </button>
        </SectionCard>
      </main>
    </>
  );
}
