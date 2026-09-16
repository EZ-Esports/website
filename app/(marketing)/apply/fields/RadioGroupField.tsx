import { fieldWrapperClass, labelClass, requiredMark } from './styles';

// The repeated "radio button group" block used for club status, graduation
// year, and advisor-confirmed fields: a `role="group"` wrapper with a
// legend, a set of radio options (value === label) sharing one `name`, and
// an error message.
export default function RadioGroupField({
  name,
  legend,
  options,
  value,
  onChange,
  error,
  isFocused,
  layout = 'wrap',
}: {
  name: string;
  legend: React.ReactNode;
  options: readonly string[];
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  error?: string;
  isFocused: boolean;
  layout?: 'stack' | 'wrap';
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
      </span>
      <div className={layout === 'stack' ? 'flex flex-col gap-2 mt-2' : 'flex flex-wrap gap-4 mt-2'}>
        {options.map((option) => (
          <label key={option} className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-foreground-secondary hover:text-foreground transition-colors">
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={onChange}
              className="w-4.5 h-4.5 accent-accent cursor-pointer"
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-danger font-semibold">{error}</p>}
    </div>
  );
}
