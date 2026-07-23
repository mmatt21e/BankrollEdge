// Port of Android BankrollScreen: balance breakdown, deposit/withdraw form,
// transaction history with delete.
import { useState } from 'react';
import { useAppState } from '../hooks/useAppState';
import { signedAmount, Transaction } from '../models/types';
import { money, signedMoney, formatDate } from '../domain/format';
import { ConfirmDialog, MoneyInput, TopBar, profitClass, useBack } from '../components/common';

export default function BankrollPage() {
  const app = useAppState();
  const back = useBack('/settings');
  const currency = app.settings.currency;
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);

  const parsed = Number.parseFloat(amount);
  const valid = Number.isFinite(parsed) && parsed > 0;

  const submit = async (type: 'DEPOSIT' | 'WITHDRAWAL') => {
    if (!valid) return;
    await app.addTransaction(type, parsed, note);
    setAmount('');
    setNote('');
  };

  return (
    <>
      <TopBar title="Bankroll" onBack={back} />
      <main className="page page--with-topbar">
        <section className="card col" style={{ gap: 6 }}>
          <div className="overline">Current bankroll</div>
          <div className="money money-lg">
            {money(app.bankroll, currency)}
          </div>
          <BreakdownLine label="Starting balance" value={money(app.settings.startingBankroll, currency)} />
          <BreakdownLine
            label="Session profit"
            value={signedMoney(app.allStats.totalProfit, currency)}
            className={profitClass(app.allStats.totalProfit)}
          />
          <BreakdownLine
            label="Sports betting profit"
            value={signedMoney(app.betStats.netProfit, currency)}
            className={profitClass(app.betStats.netProfit)}
          />
          <BreakdownLine
            label="Deposits − withdrawals"
            value={signedMoney(app.transactionsNet, currency)}
            className={profitClass(app.transactionsNet)}
          />
          {app.betStats.pendingStake > 0 && (
            <BreakdownLine
              label="On open bets (not deducted)"
              value={money(app.betStats.pendingStake, currency)}
              className="muted"
            />
          )}
        </section>

        <section className="card col">
          <h2>Add money in or out</h2>
          <label className="field">
            <span>Amount</span>
            <MoneyInput value={amount} onChange={setAmount} />
          </label>
          <label className="field">
            <span>Note (optional)</span>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="row">
            <button type="button" className="btn grow" disabled={!valid} onClick={() => submit('DEPOSIT')}>
              Deposit
            </button>
            <button
              type="button"
              className="btn btn-outline grow"
              disabled={!valid}
              onClick={() => submit('WITHDRAWAL')}
            >
              Withdraw
            </button>
          </div>
        </section>

        {!app.ready ? null : app.transactions.length > 0 ? (
          <>
            <h2>History</h2>
            <div className="col">
              {app.transactions.map((t) => (
                <TransactionRow key={t.id} tx={t} currency={currency} onDelete={() => setPendingDelete(t)} />
              ))}
            </div>
          </>
        ) : (
          <p className="empty">
            No deposits or withdrawals yet. Money you add here is combined with your session
            results to compute the bankroll.
          </p>
        )}

        <ConfirmDialog
          open={pendingDelete !== null}
          title={`Delete this ${pendingDelete?.type === 'DEPOSIT' ? 'deposit' : 'withdrawal'}?`}
          message={
            pendingDelete
              ? `${signedMoney(signedAmount(pendingDelete), currency)} will be removed from the history and your balance will change. This can't be undone.`
              : ''
          }
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            const t = pendingDelete;
            setPendingDelete(null);
            if (t) app.deleteTransaction(t.id);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      </main>
    </>
  );
}

function BreakdownLine({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className="row-between">
      <span className="muted">{label}</span>
      <span className={`money ${className}`} style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function TransactionRow({
  tx,
  currency,
  onDelete,
}: {
  tx: Transaction;
  currency: string;
  onDelete: () => void;
}) {
  const amount = signedAmount(tx);
  return (
    <div className="card row" style={{ padding: '10px 12px 10px 16px' }}>
      <div className="grow">
        <div style={{ fontWeight: 600 }}>{tx.type === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'}</div>
        <div className="muted small">
          {[formatDate(tx.time), tx.note].filter(Boolean).join(' • ')}
        </div>
      </div>
      <span className={`money ${profitClass(amount)}`} style={{ fontWeight: 700 }}>
        {signedMoney(amount, currency)}
      </span>
      <button
        type="button"
        className="back"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', minWidth: 44, minHeight: 44 }}
        aria-label={`Delete ${tx.type === 'DEPOSIT' ? 'deposit' : 'withdrawal'} of ${money(tx.amount, currency)}`}
        onClick={onDelete}
      >
        🗑
      </button>
    </div>
  );
}
