import type { CheckboxGroupKey, CheckboxOptionKey } from '../form-config';
import { fieldWrapperClass, labelClass, requiredMark } from './styles';
import OtherWriteInRow from './OtherWriteInRow';

// The repeated "checkbox group" block used for the games/opportunities
// fields: a `role="group"` wrapper with a legend (plus optional subtext), a
// grid of checkboxes sharing one selection map, an optional "Other"
// write-in row, and error message(s).
export default function CheckboxGroupField<G extends CheckboxGroupKey>({
  name,
  legend,
  subtext,
  entries,
  selection,
  onToggle,
  error,
  isFocused,
  other,
}: {
  name: G;
  legend: React.ReactNode;
  subtext?: React.ReactNode;
  entries: readonly (readonly [CheckboxOptionKey<G> & string, string])[];
  selection: Record<string, boolean>;
  onToggle: (key: CheckboxOptionKey<G>, checked: boolean) => void;
  error?: string;
  isFocused: boolean;
  other?: {
    checked: boolean;
    onToggleChange: React.ChangeEventHandler<HTMLInputElement>;
    textValue: string;
    onTextChange: React.ChangeEventHandler<HTMLInputElement>;
    placeholder: string;
    error?: string;
  };
}) {
  return (
    <div
      id={`field-${name}`}
      className={fieldWrapperClass(isFocused, !!error)}
      role="group"
      aria-labelledby={`${name}-label`}
    >
      <span id={`${name}-label`} className={labelClass}>
        {legend} {requiredMark}
        {subtext && (
          <span className="text-xs text-foreground-secondary font-normal block mt-1 normal-case">{subtext}</span>
        )}
      </span>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        {entries.map(([id, label]) => (
          <label key={id} className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-foreground-secondary hover:text-foreground transition-colors">
            <input
              type="checkbox"
              checked={selection[id]}
              onChange={(e) => onToggle(id, e.target.checked)}
              className="w-4.5 h-4.5 rounded border-line accent-accent cursor-pointer"
            />
            <span>{label}</span>
          </label>
        ))}
        {other && (
          <OtherWriteInRow
            toggleType="checkbox"
            toggleChecked={other.checked}
            onToggleChange={other.onToggleChange}
            textId={`field-${name}Other`}
            textName={`${name}Other`}
            textValue={other.textValue}
            onTextChange={other.onTextChange}
            placeholder={other.placeholder}
          />
        )}
      </div>
      {error && <p className="mt-2 text-xs text-danger font-semibold">{error}</p>}
      {other?.error && <p className="mt-2 text-xs text-danger font-semibold">{other.error}</p>}
    </div>
  );
}
