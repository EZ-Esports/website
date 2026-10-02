'use client';

interface AccountInfoStepProps {
  legalFirstName: string;
  setLegalFirstName: (val: string) => void;
  legalLastName: string;
  setLegalLastName: (val: string) => void;
  email: string;
  setEmail: (val: string) => void;
  password?: string;
  setPassword?: (val: string) => void;
  graduationYear: number;
  setGraduationYear: (val: number) => void;
  isManager: boolean;
}

export function AccountInfoStep({
  legalFirstName,
  setLegalFirstName,
  legalLastName,
  setLegalLastName,
  email,
  setEmail,
  password,
  setPassword,
  graduationYear,
  setGraduationYear,
  isManager,
}: AccountInfoStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">
          Step 1: Student Information
        </h2>
        <p className="text-xs sm:text-sm text-foreground-muted mt-1">
          Verify your legal name and student email address for tournament roster eligibility.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1.5">
            Legal First Name *
          </label>
          <input
            type="text"
            value={legalFirstName}
            onChange={(e) => setLegalFirstName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="e.g. Alex"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1.5">
            Legal Last Name *
          </label>
          <input
            type="text"
            value={legalLastName}
            onChange={(e) => setLegalLastName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="e.g. Chen"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1.5">
          {isManager ? 'Manager Email Address *' : 'Student Email Address *'}
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          placeholder={
            isManager
              ? 'e.g. coach@school.edu'
              : 'e.g. achen@nycstudents.net or student@gmail.com'
          }
          required
        />
        <p className="text-xs text-foreground-muted mt-1">
          {isManager
            ? 'Used to sign in to your School Manager Portal account and receive league updates.'
            : 'Used for tournament notifications, official roster verification, and bracket updates.'}
        </p>
      </div>

      {isManager && setPassword && (
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1.5">
            Create Portal Account Password *
          </label>
          <input
            type="password"
            value={password || ''}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            data-1p-ignore="true"
            data-lpignore="true"
            required
          />
          <p className="text-xs text-foreground-muted mt-1">
            Required to sign in to the School Manager Portal at /portal/login.
          </p>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1.5">
          {isManager
            ? 'Affiliation / Academic Year *'
            : 'Anticipated High School Graduation Year *'}
        </label>
        <select
          value={graduationYear}
          onChange={(e) => setGraduationYear(Number(e.target.value))}
          className="w-full px-3.5 py-2.5 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        >
          {isManager ? (
            <>
              <option value={2025}>2024-2025</option>
              <option value={2026}>2025-2026 (Current Academic Year)</option>
              <option value={2027}>2026-2027</option>
              <option value={2028}>2027-2028</option>
            </>
          ) : (
            <>
              <option value={2025}>Class of 2025 (12th Grade / Senior)</option>
              <option value={2026}>Class of 2026 (11th Grade / Junior)</option>
              <option value={2027}>Class of 2027 (10th Grade / Sophomore)</option>
              <option value={2028}>Class of 2028 (9th Grade / Freshman)</option>
              <option value={2029}>Class of 2029 (8th Grade)</option>
            </>
          )}
        </select>
      </div>
    </div>
  );
}
