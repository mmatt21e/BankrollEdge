// Port of Android BankrollScreen: balance breakdown, deposit/withdraw form,
// transaction history with delete.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../hooks/useAppState';
import { signedAmount, Transaction } from '../models/types';
import { money, signedMoney, formatDate } from '../domain/format';
import { TopBar, profitClass } from '../components/common';

export default function BankrollPage() {
  const app = useAppState();
  const navigate = useNavigate();
  const currency = app.settings.currency;
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

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
      <TopBar title="Bankroll" onBack={() => navigate(-1)} />
      <main className="page" style={{ paddingTop: 0 }}>
        <section className="card col" style={{ gap: 6 }}>
          <div className="overline">Current bankroll</div>
          <div className="money" style={{ fontSize: '1.8rem', fontWeight: 700 }}>
            {money(app.bankroll, currency)}
          </div>
          <BreakdownLine label="Starting balance" value={money(app.settings.startingBankroll, currency)} />
          <BreakdownLine
            label="Session profit"
            value={signedMoney(app.allStats.totalProfit, currency)}
            className={profitClass(app.allStats.totalProfit)}
          />
          <BreakdownLine
            label="Deposits − withdrawals"
            value={signedMoney(app.transactionsNet, currency)}
            className={profitClass(app.transactionsNet)}
          />
        </section>

        <section className="card col">
          <h2>Add money in or out</h2>
          <label className="field">
            <span>Amount ({currency})</span>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            />
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

        {app.transactions.length > 0 ? (
          <>
            <h2>History</h2>
            <div className="col">
              {app.transactions.map((t) => (
                <TransactionRow key={t.id} tx={t} currency={currency} onDelete={() => app.deleteTransaction(t.id)} />
              ))}
            </div>
          </>
        ) : (
          <p className="muted">
            No deposits or withdrawals yet. Money you add here is combined with your session
            results to compute the bankroll.
          </p>
        )}
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
