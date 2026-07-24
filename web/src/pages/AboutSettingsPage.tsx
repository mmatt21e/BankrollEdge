// Settings → About: what the app is, the version, and install notes.
import { SectionCard, TopBar, useBack, useSectionHighlight } from '../components/common';

export default function AboutSettingsPage() {
  const back = useBack('/settings');
  useSectionHighlight();

  return (
    <>
      <TopBar title="About" onBack={back} />
      <main className="page page--with-topbar">
        <SectionCard id="about" title="BankrollEdge">
          <p className="muted" style={{ margin: 0 }}>
            A bankroll tracker for poker, casino table games and sports betting. Version{' '}
            {__APP_VERSION__} — works fully offline; all data stays on this device. Install it
            from your browser menu for an app-like experience.
          </p>
        </SectionCard>
      </main>
    </>
  );
}
