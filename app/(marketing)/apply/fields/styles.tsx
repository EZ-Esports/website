// Shared style helpers for the apply form's field/section components. Pure
// functions/values (no component state) so both the ApplyForm orchestrator
// and its section/field components can compute identical classNames without
// importing from each other.

export const labelClass = 'block text-xs sm:text-sm font-bold text-foreground mb-2 tracking-wide uppercase';

export const requiredMark = <span className="text-accent ml-1" aria-hidden="true">*</span>;

export const sectionCardClass =
  'bg-surface/90 backdrop-blur-md rounded-2xl border border-line/75 p-6 sm:p-8 shadow-sm space-y-5 scroll-mt-28';

export const textInputClass = (hasError: boolean) =>
  `w-full px-4 py-3 bg-surface border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 transition-all text-sm shadow-sm ${
    hasError
      ? 'border-danger focus:ring-danger/20'
      : 'border-line focus:ring-accent/20 focus:border-accent/50'
  }`;

// Takes `isFocused` directly (rather than a fieldId + closure over
// `focusedField` state, as in the pre-decomposition monolith) so this can be
// a plain function shared by every section/field component instead of being
// redefined per component with access to that state.
export const fieldWrapperClass = (isFocused: boolean, hasError: boolean) =>
  `transition-all duration-300 border-l-2 pl-3 w-full ${
    hasError ? 'border-danger' : isFocused ? 'border-accent' : 'border-transparent'
  }`;
