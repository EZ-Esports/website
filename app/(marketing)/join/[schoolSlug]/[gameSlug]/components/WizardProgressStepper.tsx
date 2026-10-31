'use client';

interface WizardProgressStepperProps {
  step: number;
  isManager?: boolean;
  /** Steps in this wizard: 5, or 6 when staff have configured the onboarding Google Form. */
  totalSteps?: number;
}

export function WizardProgressStepper({ step, isManager, totalSteps = 5 }: WizardProgressStepperProps) {
  const stepTitles = [
    isManager ? 'Manager Information' : 'Student Information',
    'Discord Voice & Community',
    'Riot Game Identity',
    'Date of Birth & Rules',
    'Terms & Authorization',
    'Onboarding Form',
  ].slice(0, totalSteps);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3 text-xs font-semibold text-foreground-muted">
        <span>
          Step {step} of {totalSteps}
        </span>
        <span>{stepTitles[step - 1]}</span>
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${totalSteps}, minmax(0, 1fr))` }}>
        {stepTitles.map((_, i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all duration-300 ${
              i + 1 <= step ? 'bg-accent' : 'bg-surface-elevated border border-border'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
