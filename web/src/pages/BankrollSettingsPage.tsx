// Settings → Bankroll & currency: starting bankroll (and the separate
// sports roll), plus the default currency. Deposits/withdrawals live on
// the Manage bankroll screen — linked from here, not duplicated.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../hooks/useAppState';
import {
  MessageBanner,
  MoneyInput,
  SectionCard,
  TopBar,
  useBack,
  useSectionHighlight,
} from '../components/common';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'SEK', 'BRL', 'MXN', 'JPY'];

export default function BankrollSettingsPage() {
  const app = useAppState();
  const navigate = useNavigate();
  const back = useBack('/settings');
  useSectionHighlight();
  const [bankrollText, setBankrollText] = useState(
    app.settings.startingBankroll === 0 ? '' : String(app.settings.startingBankroll),
  );
  const [sportsBankrollText, setSportsBankrollText] = useState(
    app.settings.startingSportsBankroll === 0 ? '' : String(app.settings.startingSportsBankroll),
  );
  const [message, setMessage] = useState('');

  return (
    <>
      <TopBar title="Bankroll & currency" onBack={back} />
      <main className="page page--with-topbar">
        <MessageBanner>{message}</MessageBanner>

        <SectionCard id="starting" title="Bankroll">
          <p className="muted" style={{ margin: 0 }}>
            Your starting bankroll is added to session profits and transactions to show your
            current bankroll.
          </p>
          <div className="row">
            <label className="field grow">
              <span>Starting amount</span>
              <MoneyInput value={bankrollText} onChange={setBankrollText} />
            </label>
            <button
              type="button"
              className="btn"
              style={{ alignSelf: 'flex-end' }}
              disabled={(Number.parseFloat(bankrollText) || 0) === app.settings.startingBankroll}
              onClick={() => {
                app.updateSettings({ startingBankroll: Number.parseFloat(bankrollText) || 0 });
                setMessage('Starting bankroll saved.');
              }}
            >
              Save
            </button>
          </div>
          {app.settings.showSports && (
            <>
              <div className="segmented" role="group" aria-label="Bankroll mode">
                {(
                  [
                    [false, 'One bankroll for all'],
                    [true, 'Separate sports roll'],
                  ] as [boolean, string][]
                ).map(([value, label]) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={app.settings.separateBankrolls === value}
                    onClick={() => app.updateSettings({ separateBankrolls: value })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {app.settings.separateBankrolls && (
                <div className="row">
                  <label className="field grow">
                    <span>Sports starting bankroll</span>
                    <MoneyInput value={sportsBankrollText} onChange={setSportsBankrollText} />
                  </label>
                  <button
                    type="button"
                    className="btn"
                    style={{ alignSelf: 'flex-end' }}
                    disabled={
                      (Number.parseFloat(sportsBankrollText) || 0) ===
                      app.settings.startingSportsBankroll
                    }
                    onClick={() => {
                      app.updateSettings({
                        startingSportsBankroll: Number.parseFloat(sportsBankrollText) || 0,
                      });
                      setMessage('Sports bankroll saved.');
                    }}
                  >
                    Save
                  </button>
                </div>
              )}
            </>
          )}
          <button type="button" className="btn btn-outline" onClick={() => navigate('/bankroll')}>
            Deposits, withdrawals & history
          </button>
        </SectionCard>

        <SectionCard id="currency" title="Default currency">
          <label className="field">
            <span>Applied to new sessions; existing sessions keep their own currency.</span>
            <select
              value={app.settings.currency}
              onChange={(e) => app.updateSettings({ currency: e.target.value })}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
        </SectionCard>
      </main>
    </>
  );
}
