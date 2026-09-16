// Shared "Other:" toggle + conditional write-in text field, reused by every
// option group (radio or checkbox) that offers a free-text escape hatch.
export default function OtherWriteInRow({
  toggleType,
  toggleName,
  toggleValue,
  toggleChecked,
  onToggleChange,
  textId,
  textName,
  textValue,
  onTextChange,
  placeholder,
  spanTwoCols = true,
}: {
  toggleType: 'radio' | 'checkbox';
  toggleName?: string;
  toggleValue?: string;
  toggleChecked: boolean;
  onToggleChange: React.ChangeEventHandler<HTMLInputElement>;
  textId: string;
  textName: string;
  textValue: string;
  onTextChange: React.ChangeEventHandler<HTMLInputElement>;
  placeholder: string;
  spanTwoCols?: boolean;
}) {
  const toggleClass =
    toggleType === 'checkbox' ? 'w-4.5 h-4.5 rounded border-line accent-accent cursor-pointer' : 'w-4.5 h-4.5 accent-accent cursor-pointer';
  return (
    <div className={`${spanTwoCols ? 'sm:col-span-2 ' : ''}flex flex-col sm:flex-row sm:items-center gap-2 mt-1`}>
      <label className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-foreground-secondary hover:text-foreground transition-colors shrink-0">
        <input
          type={toggleType}
          name={toggleName}
          value={toggleValue}
          checked={toggleChecked}
          onChange={onToggleChange}
          className={toggleClass}
        />
        <span>Other:</span>
      </label>
      {toggleChecked && (
        <input
          id={textId}
          type="text"
          name={textName}
          placeholder={placeholder}
          value={textValue}
          onChange={onTextChange}
          className="w-full sm:flex-1 px-3 py-1.5 bg-surface border border-line rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        />
      )}
    </div>
  );
}
