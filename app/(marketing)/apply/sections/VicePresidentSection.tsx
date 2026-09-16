import type { ApplyFormData } from '../ApplyForm';
import { GRAD_YEARS } from '../form-config';
import { sectionCardClass } from '../fields/styles';
import SectionHeader from './SectionHeader';
import TextField from '../fields/TextField';
import RadioGroupField from '../fields/RadioGroupField';

// LAYER 2: Vice President Info
export default function VicePresidentSection({
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
    <div id="section-vicePresident" className={sectionCardClass}>
      <SectionHeader sectionId="vicePresident" />

      <div className="bg-surface-raised/40 border border-line/60 rounded-xl p-4 text-xs text-foreground-secondary space-y-1">
        <p className="italic font-semibold text-foreground">also applies to co-presidents</p>
        <p>
          If this role does not apply to your club, please fill out below with a <strong className="text-foreground">manager</strong> (could be for a certain team, your club, etc.) or an officer that is most active and likely to interact with <strong className="text-foreground">EZEsports</strong>. Thank you for your time!
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* VP First Name */}
        <TextField
          name="vpFirstName"
          label="Vice President First Name"
          placeholder="Alex"
          value={form.vpFirstName}
          onChange={onTextChange}
          onFocus={() => onFieldFocus('vpFirstName')}
          onBlur={onFieldBlur}
          error={fieldErrors.vpFirstName}
          isFocused={focusedField === 'vpFirstName'}
        />

        {/* VP Last Name */}
        <TextField
          name="vpLastName"
          label="Vice President Last Name"
          placeholder="Taylor"
          value={form.vpLastName}
          onChange={onTextChange}
          onFocus={() => onFieldFocus('vpLastName')}
          onBlur={onFieldBlur}
          error={fieldErrors.vpLastName}
          isFocused={focusedField === 'vpLastName'}
        />
      </div>

      {/* VP Graduation Year */}
      <RadioGroupField
        name="vpGradYear"
        legend="Graduation Year"
        options={GRAD_YEARS}
        value={form.vpGradYear}
        onChange={onTextChange}
        error={fieldErrors.vpGradYear}
        isFocused={focusedField === 'vpGradYear'}
      />

      {/* VP Discord */}
      <TextField
        name="vpDiscord"
        label="Discord Username"
        placeholder="alextaylor"
        value={form.vpDiscord}
        onChange={onTextChange}
        onFocus={() => onFieldFocus('vpDiscord')}
        onBlur={onFieldBlur}
        error={fieldErrors.vpDiscord}
        isFocused={focusedField === 'vpDiscord'}
      />

      {/* VP Email */}
      <TextField
        name="vpEmail"
        label="Please type your email below. (Fill this out with the email you check the most often!)"
        type="email"
        placeholder="alext@gmail.com"
        value={form.vpEmail}
        onChange={onTextChange}
        onFocus={() => onFieldFocus('vpEmail')}
        onBlur={onFieldBlur}
        error={fieldErrors.vpEmail}
        isFocused={focusedField === 'vpEmail'}
      />

      {/* VP Preferred Contact */}
      <TextField
        name="vpPreferredContact"
        label="Where is the best place to reach you? (platform)"
        placeholder="Discord / Email / SMS"
        value={form.vpPreferredContact}
        onChange={onTextChange}
        onFocus={() => onFieldFocus('vpPreferredContact')}
        onBlur={onFieldBlur}
        error={fieldErrors.vpPreferredContact}
        isFocused={focusedField === 'vpPreferredContact'}
      />
    </div>
  );
}
