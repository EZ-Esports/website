import type { ApplyFormData } from '../ApplyForm';
import { GRAD_YEARS, CLUB_STATUS_OPTIONS } from '../form-config';
import { sectionCardClass } from '../fields/styles';
import SectionHeader from './SectionHeader';
import TextField from '../fields/TextField';
import RadioGroupField from '../fields/RadioGroupField';

// LAYER 1: President Info
export default function PresidentSection({
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
    <div id="section-president" className={sectionCardClass}>
      <SectionHeader sectionId="president" />

      {/* Club Status */}
      <RadioGroupField
        name="clubStatus"
        legend="What is your club's current status for 2026–27?"
        options={CLUB_STATUS_OPTIONS}
        value={form.clubStatus}
        onChange={onTextChange}
        error={fieldErrors.clubStatus}
        isFocused={focusedField === 'clubStatus'}
        layout="stack"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* President First Name */}
        <TextField
          name="presidentFirstName"
          label="President First Name"
          placeholder="Jane"
          value={form.presidentFirstName}
          onChange={onTextChange}
          onFocus={() => onFieldFocus('presidentFirstName')}
          onBlur={onFieldBlur}
          error={fieldErrors.presidentFirstName}
          isFocused={focusedField === 'presidentFirstName'}
        />

        {/* President Last Name */}
        <TextField
          name="presidentLastName"
          label="President Last Name"
          placeholder="Smith"
          value={form.presidentLastName}
          onChange={onTextChange}
          onFocus={() => onFieldFocus('presidentLastName')}
          onBlur={onFieldBlur}
          error={fieldErrors.presidentLastName}
          isFocused={focusedField === 'presidentLastName'}
        />
      </div>

      {/* Name of School */}
      <TextField
        name="schoolName"
        label="Name of School (Ex: Brooklyn Technical High School)"
        placeholder="Brooklyn Technical High School"
        value={form.schoolName}
        onChange={onTextChange}
        onFocus={() => onFieldFocus('schoolName')}
        onBlur={onFieldBlur}
        error={fieldErrors.schoolName}
        isFocused={focusedField === 'schoolName'}
      />

      {/* Graduation Year */}
      <RadioGroupField
        name="presidentGradYear"
        legend="Graduation Year"
        options={GRAD_YEARS}
        value={form.presidentGradYear}
        onChange={onTextChange}
        error={fieldErrors.presidentGradYear}
        isFocused={focusedField === 'presidentGradYear'}
      />

      {/* President Email */}
      <TextField
        name="presidentEmail"
        label="Please type your email below. (Fill this out with the email you check the most often!)"
        type="email"
        placeholder="jsmith@gmail.com"
        value={form.presidentEmail}
        onChange={onTextChange}
        onFocus={() => onFieldFocus('presidentEmail')}
        onBlur={onFieldBlur}
        error={fieldErrors.presidentEmail}
        isFocused={focusedField === 'presidentEmail'}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* President Discord */}
        <TextField
          name="presidentDiscord"
          label="Discord username"
          placeholder="yourusername"
          value={form.presidentDiscord}
          onChange={onTextChange}
          onFocus={() => onFieldFocus('presidentDiscord')}
          onBlur={onFieldBlur}
          error={fieldErrors.presidentDiscord}
          isFocused={focusedField === 'presidentDiscord'}
        />

        {/* Best place to reach you */}
        <TextField
          name="presidentPreferredContact"
          label="Where is the best place to reach you? (platform)"
          placeholder="Discord / Email / SMS"
          value={form.presidentPreferredContact}
          onChange={onTextChange}
          onFocus={() => onFieldFocus('presidentPreferredContact')}
          onBlur={onFieldBlur}
          error={fieldErrors.presidentPreferredContact}
          isFocused={focusedField === 'presidentPreferredContact'}
        />
      </div>
    </div>
  );
}
