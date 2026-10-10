import { useId } from 'react';
import { parseCommuteMinutes } from '../domain/commute';

export function CommuteInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const hintId = useId();
  const invalid = parseCommuteMinutes(value) === null;
  return (
    <div className="col" style={{ gap: 6 }}>
      <label className="field">
        <span>Commute (total minutes, optional)</span>
        <input type="text" inputMode="numeric" value={value}
          aria-invalid={invalid} aria-describedby={hintId}
          onChange={(e) => onChange(e.target.value)} />
      </label>
      <p id={hintId} className="muted small" style={{ margin: 0 }}>
        Total travel for this session, including the return trip if applicable.
        Blank or 0 means none. Play time stays separate; hourly rates follow Display settings.
      </p>
      {invalid && <p role="alert">Enter a non-negative whole number of minutes.</p>}
    </div>
  );
}
