// PIN gate shown at launch when a PIN is set. Local-only privacy control —
// it protects against shoulder-surfing/casual access, not forensic attack
// (data is not encrypted; documented in docs/pwa-security-notes.md).
import { FormEvent, useState } from 'react';
import { verifyPin } from '../storage/settings';

export function PinLock({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (await verifyPin(pin)) {
      onUnlock();
    } else {
      setError(true);
      setPin('');
    }
  };

  return (
    <div className="pin-screen">
      <form className="col" style={{ alignItems: 'center', gap: 16 }} onSubmit={submit}>
        <div style={{ fontSize: '2.2rem' }} aria-hidden="true">🔒</div>
        <h1 style={{ fontSize: '1.3rem' }}>BankrollEdge is locked</h1>
        <label className="field" style={{ width: 200 }}>
          <span>Enter your PIN</span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            value={pin}
            maxLength={8}
            style={{ textAlign: 'center', fontSize: '1.4rem', letterSpacing: '0.4em' }}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ''));
              setError(false);
            }}
          />
        </label>
        {error && (
          <p className="neg" role="alert" style={{ margin: 0 }}>
            Wrong PIN — try again.
          </p>
        )}
        <button type="submit" className="btn" disabled={pin.length < 4}>
          Unlock
        </button>
      </form>
    </div>
  );
}
