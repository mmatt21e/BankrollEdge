// A simple notepad for quick things — saved as you type, roams with backups.
import { useState } from 'react';
import { useAppState } from '../hooks/useAppState';
import { TopBar, useBack } from '../components/common';

export default function NotepadPage() {
  const app = useAppState();
  const back = useBack('/more');
  const [text, setText] = useState(app.settings.notepad);

  const onChange = (value: string) => {
    setText(value);
    app.updateSettings({ notepad: value });
  };

  return (
    <>
      <TopBar title="Notepad" onBack={back} />
      <main className="page page--with-topbar">
        <label className="field grow">
          <span className="visually-hidden">Notepad</span>
          <textarea
            rows={16}
            value={text}
            placeholder="Jot down anything — saved automatically, included in backups."
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
        <p className="muted small" style={{ margin: 0 }}>
          Saved automatically on this device and included in your JSON backups.
        </p>
      </main>
    </>
  );
}
