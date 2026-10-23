'use client';

interface WizardProgressStepperProps {
  step: number;
  isManager?: boolean;
}

export function WizardProgressStepper({ step, isManager }: WizardProgressStepperProps) {
  const stepTitles = [
    isManager ? 'Manager Information' : 'Student Information',
    'Discord Voice & Community',
    'Riot Game Identity',
    'Demographics & Rules',
    'Terms & Authorization',
  ];

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3 text-xs font-semibold text-foreground-muted">
        <span>Step {step} of 5</span>
        <span>{stepTitles[step - 1]}</span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((s) => (
          <div
            key={s}
            className={`h-2 rounded-full transition-all duration-300 ${
              s <= step ? 'bg-accent' : 'bg-surface-elevated border border-border'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
