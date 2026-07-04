// Lightweight hand capture: quick text entry, session linking, review-later
// flag, and a shareable text summary. Deliberately not a solver.
import { FormEvent, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { HandNote, stakesLabel } from '../models/types';
import { formatDate, formatDateTime } from '../domain/format';
import { handNoteStore } from '../storage/db';
import { useAppState, useStoreList } from '../hooks/useAppState';
import { TopBar } from '../components/common';

const emptyForm = {
  stakes: '',
  position: '',
  holeCards: '',
  board: '',
  potSize: '',
  actionSummary: '',
  result: '',
  tagsText: '',
  notes: '',
  reviewLater: false,
};

export default function HandNotesPage() {
  const navigate = useNavigate();
  const app = useAppState();
  const [params] = useSearchParams();
  const { items: notes, save, remove } = useStoreList<HandNote>(handNoteStore);

  const [sessionId, setSessionId] = useState(Number(params.get('session')) || 0);
  const [form, setForm] = useState(emptyForm);
  const [reviewOnly, setReviewOnly] = useState(false);

  const set = (patch: Partial<typeof emptyForm>) => setForm((prev) => ({ ...prev, ...patch }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.holeCards.trim() && !form.notes.trim() && !form.actionSummary.trim()) return;
    const linked = app.getSession(sessionId);
    await save({
      id: 0,
      sessionId,
      createdAt: Date.now(),
      stakes: form.stakes.trim() || (linked ? stakesLabel(linked) : ''),
      position: form.position.trim(),
      holeCards: form.holeCards.trim(),
      board: form.board.trim(),
      potSize: Number.parseFloat(form.potSize) || 0,
      actionSummary: form.actionSummary.trim(),
      result: form.result.trim(),
      tags: form.tagsText.split(',').map((t) => t.trim()).filter(Boolean),
      notes: form.notes.trim(),
      reviewLater: form.reviewLater,
    });
    setForm(emptyForm);
  };

  const shareText = (n: HandNote): string =>
    [
      `Hand ${n.stakes ? `(${n.stakes}${n.position ? `, ${n.position}` : ''})` : ''}`.trim(),
      n.holeCards && `Hole cards: ${n.holeCards}`,
      n.board && `Board: ${n.board}`,
      n.potSize > 0 && `Pot: ${n.potSize}`,
      n.actionSummary && `Action: ${n.actionSummary}`,
      n.result && `Result: ${n.result}`,
      n.notes && `Notes: ${n.notes}`,
    ]
      .filter(Boolean)
      .join('\n');

  const shown = [...notes]
    .filter((n) => !reviewOnly || n.reviewLater)
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <>
      <TopBar title="Hand notes" onBack={() => navigate(-1)} />
      <main className="page" style={{ paddingTop: 0 }}>
        <form className="card col" onSubmit={onSubmit}>
          <h2>New hand</h2>
          <label className="field">
            <span>Link to session (optional)</span>
            <select value={sessionId} onChange={(e) => setSessionId(Number(e.target.value))}>
              <option value={0}>Not linked</option>
              {app.sessions.slice(0, 50).map((s) => (
                <option key={s.id} value={s.id}>
                  {formatDate(s.startTime)} — {s.location || stakesLabel(s) || 'session'}
                </option>
              ))}
            </select>
          </label>
          <div className="row">
            <label className="field grow">
              <span>Stakes</span>
              <input type="text" value={form.stakes} onChange={(e) => set({ stakes: e.target.value })} placeholder="1/2" />
            </label>
            <label className="field grow">
              <span>Position</span>
              <input type="text" value={form.position} onChange={(e) => set({ position: e.target.value })} placeholder="BTN" />
            </label>
          </div>
          <div className="row">
            <label className="field grow">
              <span>Hole cards</span>
              <input type="text" value={form.holeCards} onChange={(e) => set({ holeCards: e.target.value })} placeholder="Ah Kh" />
            </label>
            <label className="field grow">
              <span>Pot size</span>
              <input
                type="text"
                inputMode="decimal"
                value={form.potSize}
                onChange={(e) => set({ potSize: e.target.value.replace(/[^0-9.]/g, '') })}
              />
            </label>
          </div>
          <label className="field">
            <span>Board</span>
            <input type="text" value={form.board} onChange={(e) => set({ board: e.target.value })} placeholder="Qh 7d 2c / 9s / 3h" />
          </label>
          <label className="field">
            <span>Action summary</span>
            <textarea rows={2} value={form.actionSummary} onChange={(e) => set({ actionSummary: e.target.value })} placeholder="UTG opens 15, I 3-bet 45 on the button…" />
          </label>
          <div className="row">
            <label className="field grow">
              <span>Result</span>
              <input type="text" value={form.result} onChange={(e) => set({ result: e.target.value })} placeholder="Won 320" />
            </label>
            <label className="field grow">
              <span>Tags</span>
              <input type="text" value={form.tagsText} onChange={(e) => set({ tagsText: e.target.value })} placeholder="3bet-pot, river" />
            </label>
          </div>
          <label className="field">
            <span>Notes</span>
            <textarea rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </label>
          <div className="row">
            <button
              type="button"
              className="chip"
              aria-pressed={form.reviewLater}
              onClick={() => set({ reviewLater: !form.reviewLater })}
            >
              {form.reviewLater ? '★ Review later' : '☆ Review later'}
            </button>
            <button type="submit" className="btn grow">Save hand</button>
          </div>
        </form>

        <div className="row-between">
          <h2>{shown.length} hands</h2>
          <button type="button" className="chip" aria-pressed={reviewOnly} onClick={() => setReviewOnly(!reviewOnly)}>
            ★ Review queue
          </button>
        </div>

        {shown.length === 0 ? (
          <p className="empty">No hand notes yet. Capture spots you want to study later.</p>
        ) : (
          shown.map((n) => {
            const linked = n.sessionId > 0 ? app.getSession(n.sessionId) : undefined;
            return (
              <details key={n.id} className="card">
                <summary>
                  {n.reviewLater ? '★ ' : ''}
                  <strong>{n.holeCards || 'Hand'}</strong>
                  {n.stakes && <span className="muted"> {n.stakes}</span>}
                  {n.position && <span className="muted"> · {n.position}</span>}
                  <span className="muted small"> — {formatDateTime(n.createdAt)}</span>
                </summary>
                <div className="col" style={{ marginTop: 8, gap: 4 }}>
                  {linked && (
                    <div className="muted small">
                      Session: {formatDate(linked.startTime)} {linked.location && `@ ${linked.location}`}
                    </div>
                  )}
                  {n.board && <div><span className="muted">Board:</span> {n.board}</div>}
                  {n.potSize > 0 && <div><span className="muted">Pot:</span> {n.potSize}</div>}
                  {n.actionSummary && <div>{n.actionSummary}</div>}
                  {n.result && <div><span className="muted">Result:</span> {n.result}</div>}
                  {n.notes && <div className="muted">{n.notes}</div>}
                  {n.tags.length > 0 && <div className="muted small">#{n.tags.join(' #')}</div>}
                  <div className="row" style={{ marginTop: 6 }}>
                    <button
                      type="button"
                      className="btn btn-outline grow"
                      onClick={() => void save({ ...n, reviewLater: !n.reviewLater })}
                    >
                      {n.reviewLater ? 'Done reviewing' : 'Review later'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline grow"
                      onClick={() => {
                        const text = shareText(n);
                        if (navigator.share) void navigator.share({ text }).catch(() => undefined);
                        else void navigator.clipboard?.writeText(text);
                      }}
                    >
                      Share
                    </button>
                    <button type="button" className="back" aria-label="Delete hand note" onClick={() => remove(n.id)}>
                      🗑
                    </button>
                  </div>
                </div>
              </details>
            );
          })
        )}
      </main>
    </>
  );
}
