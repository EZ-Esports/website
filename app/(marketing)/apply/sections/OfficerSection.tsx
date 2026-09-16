import type { ApplyFormData } from '../ApplyForm';
import { GRAD_YEARS } from '../form-config';
import { sectionCardClass } from '../fields/styles';
import SectionHeader from './SectionHeader';
import TextField from '../fields/TextField';
import RadioGroupField from '../fields/RadioGroupField';

// LAYER 3: 3rd Student Club Officer Info
export default function OfficerSection({
  form,
  fieldErrors,
  focusedField,
  onFieldFocus,
  onFieldBlur,
  onTextChange,
}: {
  form: ApplyFormData;
  fieldErrors: Record<string, string>;
  focusedField: string | null;
  onFieldFocus: (name: string) => void;
  onFieldBlur: () => void;
  onTextChange: React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
}) {
  return (
    <div id="section-thirdOfficer" className={sectionCardClass}>
      <SectionHeader sectionId="thirdOfficer" />

      <div className="bg-surface-raised/40 border border-line/60 rounded-xl p-4 text-xs text-foreground-secondary">
        <p>
          Please fill this out with the <strong className="text-foreground">officer</strong> that is most <strong className="text-foreground">active</strong> and likely to interact with EZEsports! If you already filled the previous section with an officer, pick the second most active student. Thank you!
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Officer First Name */}
        <TextField
          name="officerFirstName"
          label="Officer First Name"
          placeholder="Jordan"
          value={form.officerFirstName}
          onChange={onTextChange}
          onFocus={() => onFieldFocus('officerFirstName')}
          onBlur={onFieldBlur}
          error={fieldErrors.officerFirstName}
          isFocused={focusedField === 'officerFirstName'}
        />

        {/* Officer Last Name */}
        <TextField
          name="officerLastName"
          label="Officer Last Name"
          placeholder="Lee"
          value={form.officerLastName}
          onChange={onTextChange}
          onFocus={() => onFieldFocus('officerLastName')}
          onBlur={onFieldBlur}
          error={fieldErrors.officerLastName}
          isFocused={focusedField === 'officerLastName'}
        />
      </div>

      {/* Officer Graduation Year */}
      <RadioGroupField
        name="officerGradYear"
        legend="Graduation Year"
        options={GRAD_YEARS}
        value={form.officerGradYear}
        onChange={onTextChange}
        error={fieldErrors.officerGradYear}
        isFocused={focusedField === 'officerGradYear'}
      />

      {/* Officer Email */}
      <TextField
        name="officerEmail"
        label="Please type your email below. (Fill this out with the email you check the most often!)"
        type="email"
        placeholder="jordanl@gmail.com"
        value={form.officerEmail}
        onChange={onTextChange}
        onFocus={() => onFieldFocus('officerEmail')}
        onBlur={onFieldBlur}
        error={fieldErrors.officerEmail}
        isFocused={focusedField === 'officerEmail'}
      />

      {/* Officer Preferred Contact */}
      <TextField
        name="officerPreferredContact"
        label="Where is the best place to reach you? (platform)"
        placeholder="Discord / Email / SMS"
        value={form.officerPreferredContact}
        onChange={onTextChange}
        onFocus={() => onFieldFocus('officerPreferredContact')}
        onBlur={onFieldBlur}
        error={fieldErrors.officerPreferredContact}
        isFocused={focusedField === 'officerPreferredContact'}
      />
    </div>
  );
}
