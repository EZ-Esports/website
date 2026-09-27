import { Field } from '@/app/components/ui/form';
import { fieldWrapperClass, textInputClass } from './styles';

// Labeled text/email input block using the shared form Field primitive:
// label + input + error message + focus/blur wiring.
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
      <Field label={label} htmlFor={name} required error={error}>
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
        />
      </Field>
    </div>
  );
}
