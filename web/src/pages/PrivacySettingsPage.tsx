// Settings → Privacy: hide balances and the launch PIN. Everything stays
// on-device; these guard against shoulder-surfing and casual access.
import { useState } from 'react';
import { SectionCard, TopBar, useBack, useSectionHighlight } from '../components/common';
import {
  hasPin,
  setPin,
  clearPin,
  loadHideBalances,
  saveHideBalances,
} from '../storage/settings';

export default function PrivacySettingsPage() {
  const back = useBack('/settings');
  useSectionHighlight();
  const [pinSet, setPinSet] = useState(hasPin());
  const [newPin, setNewPin] = useState('');
  const [hide, setHide] = useState(loadHideBalances());

  const applyHide = (value: boolean) => {
    setHide(value);
    saveHideBalances(value);
    document.body.classList.toggle('privacy-hide', value);
  };

  return (
    <>
      <TopBar title="Privacy" onBack={back} />
      <main className="page page--with-topbar">
        <p className="muted" style={{ margin: 0 }}>
          Everything stays on this device — nothing is uploaded anywhere. These controls guard
          against someone glancing at (or opening) the app on your phone.
        </p>

        <SectionCard id="hide" title="Hide balances">
          <div className="row-between">
            <span>Blur all money amounts</span>
            <button
              type="button"
              className="chip"
              aria-pressed={hide}
              style={{ minHeight: 44 }}
              onClick={() => applyHide(!hide)}
            >
              {hide ? 'On' : 'Off'}
            </button>
          </div>
        </SectionCard>

        <SectionCard id="pin" title="PIN lock">
          {pinSet ? (
            <div className="row-between">
              <span>PIN lock is on</span>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  clearPin();
                  setPinSet(false);
                }}
              >
                Remove PIN
              </button>
            </div>
          ) : (
            <div className="row">
              <label className="field grow">
                <span>Set a 4–8 digit PIN (required at launch)</span>
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={newPin}
                  maxLength={8}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                />
              </label>
              <button
                type="button"
                className="btn"
                style={{ alignSelf: 'flex-end' }}
                disabled={newPin.length < 4}
                onClick={async () => {
                  await setPin(newPin);
                  setNewPin('');
                  setPinSet(true);
                }}
              >
                Set PIN
              </button>
            </div>
          )}
          {pinSet && (
            <p className="muted small" style={{ margin: 0 }}>
              Forgot the PIN? Clearing the browser's site data removes it — along with your
              data, so keep a backup exported.
            </p>
          )}
        </SectionCard>
      </main>
    </>
  );
}
