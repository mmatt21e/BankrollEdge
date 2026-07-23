// Home-game ledger: per-player buy-ins/rebuys/add-ons/cash-outs, paid status,
// seat draw, and an end-of-night settlement with suggested transfers.
// No payment processing — payment method is a note only.
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  HomeGame,
  HomeGamePlayer,
  PaymentMethod,
  PAYMENT_METHOD_LABELS,
} from '../models/types';
import { computeSettlement, drawSeats } from '../domain/settlement';
import { money, signedMoney, formatDate } from '../domain/format';
import { homeGameStore } from '../storage/db';
import { useAppState, useStoreList } from '../hooks/useAppState';
import { ConfirmDialog, TopBar, profitClass, useBack } from '../components/common';

const emptyPlayer = (id: number): HomeGamePlayer => ({
  id,
  name: '',
  buyIn: 0,
  rebuys: 0,
  addOns: 0,
  cashOut: 0,
  paid: false,
  paymentMethod: '',
  seat: 0,
  notes: '',
});

export default function HomeGamesPage() {
  const back = useBack('/tools');
  const { items: games, loaded, save, remove } = useStoreList<HomeGame>(homeGameStore);
  // The open game lives in the URL (?game=<id>) so the system back gesture
  // closes the detail view instead of leaving the page.
  const [params, setParams] = useSearchParams();
  const openId = Number(params.get('game')) || null;
  const open = games.find((g) => g.id === openId) ?? null;
  const openGame = (id: number | null) => {
    if (id === null) setParams({}, { replace: true });
    else setParams({ game: String(id) });
  };

  const createGame = async () => {
    const created = await save({
      id: 0,
      name: `Home game ${formatDate(Date.now())}`,
      date: Date.now(),
      notes: '',
      players: [],
    });
    openGame(created.id);
  };

  if (open) {
    return (
      <GameDetail
        game={open}
        onChange={(g) => void save(g)}
        onBack={() => openGame(null)}
        onDelete={async () => {
          await remove(open.id);
          openGame(null);
        }}
      />
    );
  }

  return (
    <>
      <TopBar title="Home games" onBack={back} />
      <main className="page page--with-topbar">
        <button type="button" className="btn btn-block" onClick={createGame}>
          + New home game
        </button>
        {!loaded ? null : games.length === 0 ? (
          <p className="empty">
            No home games yet. Create one to track buy-ins, cash-outs and who owes whom.
          </p>
        ) : (
          <div className="col">
            {[...games]
              .sort((a, b) => b.date - a.date)
              .map((g) => (
                <button key={g.id} type="button" className="session-row" onClick={() => openGame(g.id)}>
                  <span className="grow col" style={{ gap: 2 }}>
                    <span className="title">{g.name}</span>
                    <span className="muted small">
                      {formatDate(g.date)} • {g.players.length} players
                    </span>
                  </span>
                  <span aria-hidden="true" className="muted">›</span>
                </button>
              ))}
          </div>
        )}
      </main>
    </>
  );
}

function GameDetail({
  game,
  onChange,
  onBack,
  onDelete,
}: {
  game: HomeGame;
  onChange: (g: HomeGame) => void;
  onBack: () => void;
  onDelete: () => void;
}) {
  const app = useAppState();
  const currency = app.settings.currency;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newName, setNewName] = useState('');
  const settlement = useMemo(() => computeSettlement(game.players), [game.players]);

  const setPlayer = (id: number, patch: Partial<HomeGamePlayer>) =>
    onChange({
      ...game,
      players: game.players.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });

  const addPlayer = () => {
    const name = newName.trim();
    if (!name) return;
    const nextId = Math.max(0, ...game.players.map((p) => p.id)) + 1;
    onChange({ ...game, players: [...game.players, { ...emptyPlayer(nextId), name }] });
    setNewName('');
  };

  const runSeatDraw = () => {
    const seats = drawSeats(game.players.map((p) => p.id));
    onChange({
      ...game,
      players: game.players.map((p) => ({ ...p, seat: seats.get(p.id) ?? 0 })),
    });
  };

  const moneyInput = (
    label: string,
    value: number,
    onValue: (v: number) => void,
  ) => (
    <label className="field grow">
      <span>{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value === 0 ? '' : String(value)}
        placeholder="0"
        onChange={(e) =>
          onValue(Number.parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0)
        }
      />
    </label>
  );

  return (
    <>
      <TopBar
        title={game.name}
        onBack={onBack}
        action={
          <button type="button" className="back" aria-label="Delete game" onClick={() => setConfirmDelete(true)}>
            🗑
          </button>
        }
      />
      <main className="page" style={{ paddingTop: 0 }}>
        <div className="row">
          <label className="field grow">
            <span>Game name</span>
            <input type="text" value={game.name} onChange={(e) => onChange({ ...game, name: e.target.value })} />
          </label>
        </div>
        <label className="field">
          <span>Host notes</span>
          <input type="text" value={game.notes} onChange={(e) => onChange({ ...game, notes: e.target.value })} />
        </label>

        <section className="card col">
          <h2>Players</h2>
          <div className="row">
            <label className="field grow">
              <span>Add player</span>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPlayer())}
              />
            </label>
            <button type="button" className="btn" style={{ alignSelf: 'flex-end' }} onClick={addPlayer}>
              Add
            </button>
          </div>
          {game.players.length >= 2 && (
            <button type="button" className="btn btn-outline" onClick={runSeatDraw}>
              🎲 Draw seats
            </button>
          )}
        </section>

        {game.players.map((p) => (
          <details key={p.id} className="card">
            <summary>
              <span style={{ fontWeight: 600 }}>
                {p.seat > 0 ? `Seat ${p.seat} — ` : ''}{p.name}
              </span>{' '}
              <span className={`money ${profitClass(p.cashOut - (p.buyIn + p.rebuys + p.addOns))}`}>
                {signedMoney(p.cashOut - (p.buyIn + p.rebuys + p.addOns), currency)}
              </span>
              {!p.paid && p.cashOut - (p.buyIn + p.rebuys + p.addOns) !== 0 && (
                <span className="muted small"> • unsettled</span>
              )}
            </summary>
            <div className="col" style={{ marginTop: 10 }}>
              <div className="row">
                {moneyInput('Buy-in', p.buyIn, (v) => setPlayer(p.id, { buyIn: v }))}
                {moneyInput('Rebuys', p.rebuys, (v) => setPlayer(p.id, { rebuys: v }))}
              </div>
              <div className="row">
                {moneyInput('Add-ons', p.addOns, (v) => setPlayer(p.id, { addOns: v }))}
                {moneyInput('Cash-out', p.cashOut, (v) => setPlayer(p.id, { cashOut: v }))}
              </div>
              <div className="row">
                <label className="field grow">
                  <span>Payment method (note only)</span>
                  <select
                    value={p.paymentMethod}
                    onChange={(e) => setPlayer(p.id, { paymentMethod: e.target.value as PaymentMethod })}
                  >
                    <option value="">—</option>
                    {(Object.keys(PAYMENT_METHOD_LABELS) as Exclude<PaymentMethod, ''>[]).map((m) => (
                      <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
                    ))}
                  </select>
                </label>
                <label className="field" style={{ justifyContent: 'flex-end' }}>
                  <span>Settled?</span>
                  <button
                    type="button"
                    className="chip"
                    aria-pressed={p.paid}
                    style={{ minHeight: 44 }}
                    onClick={() => setPlayer(p.id, { paid: !p.paid })}
                  >
                    {p.paid ? '✓ Paid' : 'Unpaid'}
                  </button>
                </label>
              </div>
              <label className="field">
                <span>Player notes</span>
                <input type="text" value={p.notes} onChange={(e) => setPlayer(p.id, { notes: e.target.value })} />
              </label>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => onChange({ ...game, players: game.players.filter((x) => x.id !== p.id) })}
              >
                Remove player
              </button>
            </div>
          </details>
        ))}

        {game.players.length > 0 && (
          <section className="card col">
            <h2>Settlement</h2>
            <div className="row-between"><span className="muted">Total buy-ins</span><span className="money">{money(settlement.totalBuyIns, currency)}</span></div>
            <div className="row-between"><span className="muted">Total rebuys</span><span className="money">{money(settlement.totalRebuys, currency)}</span></div>
            <div className="row-between"><span className="muted">Total add-ons</span><span className="money">{money(settlement.totalAddOns, currency)}</span></div>
            <div className="row-between"><span className="muted">Total cash-outs</span><span className="money">{money(settlement.totalCashOuts, currency)}</span></div>
            <div className="row-between" style={{ fontWeight: 700 }}>
              <span>Unresolved balance</span>
              <span className={`money ${settlement.unresolved === 0 ? 'pos' : 'neg'}`}>
                {money(settlement.unresolved, currency)}
              </span>
            </div>
            {settlement.unresolved !== 0 && (
              <p className="muted small" style={{ margin: 0 }}>
                Money in doesn't match money out — chips may still be in play, or a
                buy-in/cash-out entry is off by this amount.
              </p>
            )}

            <div className="overline" style={{ marginTop: 8 }}>Net per player</div>
            {settlement.nets.map((n) => (
              <div key={n.playerId} className="row-between">
                <span>{n.name}{n.paid ? ' ✓' : ''}</span>
                <span className={`money ${profitClass(n.net)}`}>{signedMoney(n.net, currency)}</span>
              </div>
            ))}

            {settlement.transfers.length > 0 && (
              <>
                <div className="overline" style={{ marginTop: 8 }}>Suggested payments</div>
                {settlement.transfers.map((t, ti) => (
                  <div key={ti} className="row-between">
                    <span>{t.from} → {t.to}</span>
                    <span className="money">{money(t.amount, currency)}</span>
                  </div>
                ))}
              </>
            )}
          </section>
        )}
      </main>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this home game?"
        message="This removes the game and its ledger. This can't be undone."
        confirmLabel="Delete"
        danger
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
