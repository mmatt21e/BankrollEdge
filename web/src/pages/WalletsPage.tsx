// Casino balances & side bankrolls: named money pots outside the tracked
// bankroll (money loaded on casino cards, a separate roll). Informational —
// they sit alongside the bankroll math, not inside it.
import { useState } from 'react';
import { Wallet } from '../models/types';
import { walletStore } from '../storage/db';
import { useAppState, useStoreList } from '../hooks/useAppState';
import { money, formatDate } from '../domain/format';
import { ConfirmDialog, MoneyInput, SectionCard, TopBar, useBack } from '../components/common';

const KIND_LABELS: Record<Wallet['kind'], string> = {
  CASINO: 'Casino card',
  BANKROLL: 'Side bankroll',
};

export default function WalletsPage() {
  const app = useAppState();
  const back = useBack('/more');
  const currency = app.settings.currency;
  const { items: wallets, loaded, save, remove } = useStoreList<Wallet>(walletStore);
  const [pendingDelete, setPendingDelete] = useState<Wallet | null>(null);

  const [name, setName] = useState('');
  const [kind, setKind] = useState<Wallet['kind']>('CASINO');
  const [balance, setBalance] = useState('');

  const addWallet = async () => {
    if (name.trim() === '') return;
    await save({
      id: 0,
      name: name.trim(),
      kind,
      balance: Number.parseFloat(balance) || 0,
      currency,
      notes: '',
      updatedAt: Date.now(),
    });
    setName('');
    setBalance('');
  };

  const setWalletBalance = (w: Wallet, raw: string) =>
    void save({ ...w, balance: Number.parseFloat(raw) || 0, updatedAt: Date.now() });

  const total = wallets.reduce((a, w) => a + w.balance, 0);
  const sorted = [...wallets].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <TopBar title="Casino balances" onBack={back} />
      <main className="page page--with-topbar">
        <section className="card col" style={{ gap: 6 }}>
          <div className="overline">Across {wallets.length} balance{wallets.length === 1 ? '' : 's'}</div>
          <div className="money money-lg">{money(total, currency)}</div>
          <p className="muted small" style={{ margin: 0 }}>
            Money parked on casino cards or in side rolls. Shown for the full picture — it
            doesn't change your tracked bankroll.
          </p>
        </section>

        {!loaded ? null : sorted.length === 0 ? (
          <p className="empty">No balances yet. Add the money sitting on your casino cards below.</p>
        ) : (
          sorted.map((w) => (
            <section key={w.id} className="card col" style={{ gap: 6 }}>
              <div className="row-between">
                <div>
                  <div style={{ fontWeight: 600 }}>{w.name}</div>
                  <div className="muted small">
                    {KIND_LABELS[w.kind]} • updated {formatDate(w.updatedAt)}
                  </div>
                </div>
                <button
                  type="button"
                  className="back"
                  aria-label={`Delete ${w.name}`}
                  onClick={() => setPendingDelete(w)}
                >
                  🗑
                </button>
              </div>
              <div className="row">
                <label className="field grow">
                  <span>Balance</span>
                  <BalanceEditor wallet={w} onCommit={setWalletBalance} />
                </label>
              </div>
            </section>
          ))
        )}

        <SectionCard title="Add a balance">
          <div className="row">
            <label className="field grow">
              <span>Name</span>
              <input
                type="text"
                value={name}
                placeholder="Caesars Rewards card"
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          </div>
          <div className="row">
            <label className="field grow">
              <span>Type</span>
              <select value={kind} onChange={(e) => setKind(e.target.value as Wallet['kind'])}>
                <option value="CASINO">Casino card</option>
                <option value="BANKROLL">Side bankroll</option>
              </select>
            </label>
            <label className="field grow">
              <span>Balance</span>
              <MoneyInput value={balance} onChange={setBalance} />
            </label>
          </div>
          <button type="button" className="btn" disabled={name.trim() === ''} onClick={addWallet}>
            Add
          </button>
        </SectionCard>

        <ConfirmDialog
          open={pendingDelete !== null}
          title="Delete this balance?"
          message={
            pendingDelete
              ? `"${pendingDelete.name}" (${money(pendingDelete.balance, pendingDelete.currency)}) will be removed. This can't be undone.`
              : ''
          }
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            const w = pendingDelete;
            setPendingDelete(null);
            if (w) remove(w.id);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      </main>
    </>
  );
}

/** Raw-string balance editor that commits on blur/Enter — typing decimals
 *  stays smooth, storage stays numeric. */
function BalanceEditor({
  wallet,
  onCommit,
}: {
  wallet: Wallet;
  onCommit: (w: Wallet, raw: string) => void;
}) {
  const [text, setText] = useState(wallet.balance === 0 ? '' : String(wallet.balance));
  return (
    // React's onBlur bubbles, so leaving the inner input commits the value.
    <span onBlur={() => onCommit(wallet, text)}>
      <MoneyInput
        value={text}
        currency={wallet.currency}
        onChange={setText}
        ariaLabel={`${wallet.name} balance`}
        placeholder="0"
      />
    </span>
  );
}
