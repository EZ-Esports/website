import { fieldWrapperClass, labelClass, requiredMark, textInputClass } from './styles';

// The repeated "labeled text/email input" block used by every plain text
// field across the President/VP/Officer/Club Info sections: label + input +
// error message + focus/blur wiring, all keyed off the field's `name` (which
// doubles as the input id, the `field-${name}` wrapper id, and the
// `${name}-error` message id).
export default function TextField({
  name,
  label,
  type = 'text',
  placeholder,
  value,
  error,
  isFocused,
  onChange,
  onFocus,
  onBlur,
}: {
  name: string;
  label: React.ReactNode;
  type?: 'text' | 'email';
  placeholder: string;
  value: string;
  error?: string;
  isFocused: boolean;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  onFocus: () => void;
  onBlur: () => void;
}) {
  return (
    <div id={`field-${name}`} className={fieldWrapperClass(isFocused, !!error)}>
      <label htmlFor={name} className={labelClass}>
        {label} {requiredMark}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        className={textInputClass(!!error)}
        required
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
      />
      {error && (
        <p id={`${name}-error`} className="mt-1.5 text-xs text-danger font-semibold">{error}</p>
      )}
    </div>
  );
}
