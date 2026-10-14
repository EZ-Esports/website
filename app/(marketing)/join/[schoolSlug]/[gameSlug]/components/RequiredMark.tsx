/** Prominent required-field marker. The asterisk is decorative; the text is for screen readers. */
export function RequiredMark() {
  return (
    <>
      <span
        aria-hidden="true"
        className="ml-1 text-base font-black leading-none text-danger-on-tint"
      >
        *
      </span>
      <span className="sr-only"> (required)</span>
    </>
  );
}
