// Player notes: reads on opponents, searchable by name or note text.
import { useState } from 'react';
import { PlayerNote } from '../models/types';
import { playerNoteStore } from '../storage/db';
import { useStoreList } from '../hooks/useAppState';
import { formatDate } from '../domain/format';
import { ConfirmDialog, SectionCard, TopBar, useBack } from '../components/common';

export default function PlayerNotesPage() {
  const back = useBack('/more');
  const { items: notes, loaded, save, remove } = useStoreList<PlayerNote>(playerNoteStore);
  const [query, setQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState<PlayerNote | null>(null);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const addNote = async () => {
    if (saving || name.trim() === '') return;
    setSaving(true);
    try {
      await save({ id: 0, name: name.trim(), notes: text.trim(), updatedAt: Date.now() });
      setName('');
      setText('');
    } finally {
      setSaving(false);
    }
  };

  const q = query.trim().toLowerCase();
  const shown = notes
    .filter((n) => q === '' || n.name.toLowerCase().includes(q) || n.notes.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <TopBar title="Player notes" onBack={back} />
      <main className="page page--with-topbar">
        <div className="field">
          <label>
            <span className="visually-hidden">Search players</span>
            <input
              type="search"
              placeholder="Search players or notes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>

        {!loaded ? null : shown.length === 0 ? (
          <p className="empty">
            {notes.length === 0
              ? 'No player notes yet. Capture reads on your regular opponents below.'
              : 'No players match that search.'}
          </p>
        ) : (
          shown.map((n) => (
            <details key={n.id} className="card">
              <summary>
                <strong>{n.name}</strong>
                <span className="muted small"> — updated {formatDate(n.updatedAt)}</span>
              </summary>
              <div className="col" style={{ marginTop: 8 }}>
                <label className="field">
                  <span className="visually-hidden">Notes for {n.name}</span>
                  <textarea
                    rows={4}
                    defaultValue={n.notes}
                    onBlur={(e) => {
                      const next = e.target.value.trim();
                      if (next !== n.notes) void save({ ...n, notes: next, updatedAt: Date.now() });
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setPendingDelete(n)}
                >
                  Delete player
                </button>
              </div>
            </details>
          ))
        )}

        <SectionCard title="Add a player">
          <label className="field">
            <span>Player name / nickname</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>Notes</span>
            <textarea
              rows={3}
              value={text}
              placeholder="Overfolds rivers, limps big pairs…"
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <button type="button" className="btn" disabled={saving || name.trim() === ''} onClick={addNote}>
            {saving ? 'Saving…' : 'Add player'}
          </button>
        </SectionCard>

        <ConfirmDialog
          open={pendingDelete !== null}
          title="Delete this player?"
          message={pendingDelete ? `"${pendingDelete.name}" and their notes will be removed. This can't be undone.` : ''}
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            const n = pendingDelete;
            setPendingDelete(null);
            if (n) remove(n.id);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      </main>
    </>
  );
}
