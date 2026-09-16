import Link from 'next/link';
import type { ApplyFormData } from '../ApplyForm';
import Button from '@/app/components/ui/Button';
import { Textarea } from '@/app/components/ui/form';
import {
  ADVISOR_CONFIRMED_OPTIONS,
  CLUB_BARRIER_ENTRIES,
  CONTRIBUTE_BEYOND_SCHOOL_ENTRIES,
  GAME_ENTRIES,
  INCLUSIVE_OPPORTUNITY_ENTRIES,
  NON_ROSTER_OPPORTUNITY_ENTRIES,
  type CheckboxGroupKey,
  type CheckboxOptionKey,
} from '../form-config';
import { fieldWrapperClass, labelClass, requiredMark, sectionCardClass } from '../fields/styles';
import SectionHeader from './SectionHeader';
import TextField from '../fields/TextField';
import RadioGroupField from '../fields/RadioGroupField';
import CheckboxGroupField from '../fields/CheckboxGroupField';
import OtherWriteInRow from '../fields/OtherWriteInRow';

// LAYER 4: Club Info
export default function ClubInfoSection({
  form,
  fieldErrors,
  focusedField,
  onFieldFocus,
  onFieldBlur,
  onTextChange,
  onClubBarriersChange,
  onCheckboxGroupChange,
  onConsentChange,
  loading,
  error,
  onClearForm,
}: {
  form: ApplyFormData;
  fieldErrors: Record<string, string>;
  focusedField: string | null;
  onFieldFocus: (name: string) => void;
  onFieldBlur: () => void;
  onTextChange: React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  onClubBarriersChange: React.ChangeEventHandler<HTMLInputElement>;
  onCheckboxGroupChange: <G extends CheckboxGroupKey>(group: G, key: CheckboxOptionKey<G>, checked: boolean) => void;
  onConsentChange: (field: 'agreedToRules' | 'agreedToTerms' | 'agreedToPrivacy', checked: boolean) => void;
  loading: boolean;
  error: string;
  onClearForm: () => void;
}) {
  return (
    <div id="section-clubInfo" className={sectionCardClass}>
      <SectionHeader sectionId="clubInfo" />

      <div className="bg-surface-raised/40 border border-line/60 rounded-xl p-4 text-xs text-foreground-secondary">
        <p>
          Every part is <strong className="text-foreground">crucial</strong>! Please double check to ensure that all information filled out is <strong className="text-foreground">accurate</strong>.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Club's Instagram account link */}
        <TextField
          name="instagramLink"
          label="Club's Instagram account link"
          placeholder="https://instagram.com/bkltechnesports"
          value={form.instagramLink}
          onChange={onTextChange}
          onFocus={() => onFieldFocus('instagramLink')}
          onBlur={onFieldBlur}
          error={fieldErrors.instagramLink}
          isFocused={focusedField === 'instagramLink'}
        />

        {/* Club's Discord link */}
        <TextField
          name="discordLink"
          label="Club's Discord link"
          placeholder="https://discord.gg/..."
          value={form.discordLink}
          onChange={onTextChange}
          onFocus={() => onFieldFocus('discordLink')}
          onBlur={onFieldBlur}
          error={fieldErrors.discordLink}
          isFocused={focusedField === 'discordLink'}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Name of Club Advisor */}
        <TextField
          name="advisorName"
          label="Name of Club Advisor (Mr./Ms. ...)"
          placeholder="Mr. John Davis"
          value={form.advisorName}
          onChange={onTextChange}
          onFocus={() => onFieldFocus('advisorName')}
          onBlur={onFieldBlur}
          error={fieldErrors.advisorName}
          isFocused={focusedField === 'advisorName'}
        />

        {/* Email of Club Advisor */}
        <TextField
          name="advisorEmail"
          label="Email of Club Advisor (@schools.nyc.gov)"
          type="email"
          placeholder="jdavis@schools.nyc.gov"
          value={form.advisorEmail}
          onChange={onTextChange}
          onFocus={() => onFieldFocus('advisorEmail')}
          onBlur={onFieldBlur}
          error={fieldErrors.advisorEmail}
          isFocused={focusedField === 'advisorEmail'}
        />
      </div>

      {/* Advisor Confirmed */}
      <RadioGroupField
        name="advisorConfirmed"
        legend="Is the faculty advisor of your esports club confirmed?"
        options={ADVISOR_CONFIRMED_OPTIONS}
        value={form.advisorConfirmed}
        onChange={onTextChange}
        error={fieldErrors.advisorConfirmed}
        isFocused={focusedField === 'advisorConfirmed'}
      />

      {/* Estimated active student count */}
      <TextField
        name="activeStudentsCount"
        label="Estimated amount of students active in club / attending meetings (# input only)"
        placeholder="25"
        value={form.activeStudentsCount}
        onChange={onTextChange}
        onFocus={() => onFieldFocus('activeStudentsCount')}
        onBlur={onFieldBlur}
        error={fieldErrors.activeStudentsCount}
        isFocused={focusedField === 'activeStudentsCount'}
      />

      {/* Interested Games Checkboxes */}
      <CheckboxGroupField
        name="interestedGames"
        legend="What games are you and your club members interested in competing for this year?"
        subtext="(note: we want to organize other games if there is interest, so please include games you feel confident organizing teams for)"
        entries={GAME_ENTRIES}
        selection={form.interestedGames}
        onToggle={(key, checked) => onCheckboxGroupChange('interestedGames', key, checked)}
        error={fieldErrors.interestedGames}
        isFocused={focusedField === 'interestedGames'}
        other={{
          checked: form.interestedGames.other,
          onToggleChange: (e) => onCheckboxGroupChange('interestedGames', 'other', e.target.checked),
          textValue: form.interestedGamesOther,
          onTextChange: onTextChange,
          placeholder: 'Specify game name...',
          error: fieldErrors.interestedGamesOther,
        }}
      />

      {/* Club's Biggest Barriers */}
      <div
        id="field-clubBarriers"
        className={fieldWrapperClass(focusedField === 'clubBarriers', !!fieldErrors.clubBarriers)}
        role="group"
        aria-labelledby="clubBarriers-label"
      >
        <span id="clubBarriers-label" className={labelClass}>
          What are your club&apos;s biggest barriers? {requiredMark}
        </span>
        <div className="flex flex-col gap-2 mt-2">
          {CLUB_BARRIER_ENTRIES.map(([id, label]) => (
            <label key={id} className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-foreground-secondary hover:text-foreground transition-colors">
              <input
                type="radio"
                name="clubBarriers"
                value={id}
                checked={form.clubBarriers === id}
                onChange={onClubBarriersChange}
                className="w-4.5 h-4.5 accent-accent cursor-pointer"
              />
              <span>{label}</span>
            </label>
          ))}
          <OtherWriteInRow
            toggleType="radio"
            toggleName="clubBarriers"
            toggleValue="other"
            toggleChecked={form.clubBarriers === 'other'}
            onToggleChange={onClubBarriersChange}
            textId="field-clubBarriersOther"
            textName="clubBarriersOther"
            textValue={form.clubBarriersOther}
            onTextChange={onTextChange}
            placeholder="Specify barrier..."
            spanTwoCols={false}
          />
        </div>
        {fieldErrors.clubBarriers && (
          <p className="mt-2 text-xs text-danger font-semibold">{fieldErrors.clubBarriers}</p>
        )}
        {fieldErrors.clubBarriersOther && (
          <p className="mt-2 text-xs text-danger font-semibold">{fieldErrors.clubBarriersOther}</p>
        )}
      </div>

      {/* Non-roster opportunities */}
      <CheckboxGroupField
        name="nonRosterOpportunities"
        legend="Which opportunities would interest students who are not on a competitive roster?"
        entries={NON_ROSTER_OPPORTUNITY_ENTRIES}
        selection={form.nonRosterOpportunities}
        onToggle={(key, checked) => onCheckboxGroupChange('nonRosterOpportunities', key, checked)}
        error={fieldErrors.nonRosterOpportunities}
        isFocused={focusedField === 'nonRosterOpportunities'}
        other={{
          checked: form.nonRosterOpportunities.other,
          onToggleChange: (e) => onCheckboxGroupChange('nonRosterOpportunities', 'other', e.target.checked),
          textValue: form.nonRosterOpportunitiesOther,
          onTextChange: onTextChange,
          placeholder: 'Specify opportunity...',
          error: fieldErrors.nonRosterOpportunitiesOther,
        }}
      />

      {/* Inclusive participation opportunities */}
      <CheckboxGroupField
        name="inclusiveOpportunities"
        legend="We want to make EZ Esports as inclusive as possible and are considering ways to include students who might not make it past try-outs for your esports teams but still want to participate in an esports environment. How might you approach this, or which additional opportunities would be most valuable to students at your school?"
        entries={INCLUSIVE_OPPORTUNITY_ENTRIES}
        selection={form.inclusiveOpportunities}
        onToggle={(key, checked) => onCheckboxGroupChange('inclusiveOpportunities', key, checked)}
        error={fieldErrors.inclusiveOpportunities}
        isFocused={focusedField === 'inclusiveOpportunities'}
        other={{
          checked: form.inclusiveOpportunities.other,
          onToggleChange: (e) => onCheckboxGroupChange('inclusiveOpportunities', 'other', e.target.checked),
          textValue: form.inclusiveOpportunitiesOther,
          onTextChange: onTextChange,
          placeholder: 'Specify opportunity...',
          error: fieldErrors.inclusiveOpportunitiesOther,
        }}
      />

      {/* Separate gaming clubs/groups */}
      <div id="field-separateGamingClubs" className={fieldWrapperClass(focusedField === 'separateGamingClubs', !!fieldErrors.separateGamingClubs)}>
        <label htmlFor="separateGamingClubs" className={labelClass}>
          Because your esports club leadership understands your school community best, we&apos;d value your help identifying any gaming clubs or groups that operate separately from your esports club, including communities centered around titles such as Super Smash Bros. Ultimate, Tetris, etc. If one exists, which game(s) do they organize, how does your club currently interact with them, and would you be open to helping coordinate a conversation about opportunities that could benefit your school&apos;s video game community? {requiredMark}
          <span className="text-xs text-foreground-secondary font-normal block mt-1 normal-case">
            Write &quot;N/A&quot; if this doesn&apos;t apply to your school.
          </span>
        </label>
        <Textarea
          id="separateGamingClubs"
          name="separateGamingClubs"
          rows={3}
          placeholder="Describe any separate gaming clubs/groups, or write N/A..."
          value={form.separateGamingClubs}
          onChange={onTextChange}
          onFocus={() => onFieldFocus('separateGamingClubs')}
          onBlur={onFieldBlur}
        />
        {fieldErrors.separateGamingClubs && (
          <p className="mt-1.5 text-xs text-danger font-semibold">{fieldErrors.separateGamingClubs}</p>
        )}
      </div>

      {/* Contribute beyond representing school */}
      <CheckboxGroupField
        name="contributeBeyondSchool"
        legend="Would you or another officer be interested in contributing to EZ Esports beyond representing your school?"
        subtext="Expressing interest does not commit you to a role."
        entries={CONTRIBUTE_BEYOND_SCHOOL_ENTRIES}
        selection={form.contributeBeyondSchool}
        onToggle={(key, checked) => onCheckboxGroupChange('contributeBeyondSchool', key, checked)}
        error={fieldErrors.contributeBeyondSchool}
        isFocused={focusedField === 'contributeBeyondSchool'}
      />

      {/* Feedback */}
      <div id="field-feedback" className={fieldWrapperClass(focusedField === 'feedback', false)}>
        <label htmlFor="feedback" className={labelClass}>
          Feedback or suggestions for EZ Esports
          <span className="text-xs text-foreground-secondary font-normal block mt-1 normal-case">
            (Please include any feedback from you or your club about enhancing your school&apos;s experience with EZ Esports.)
          </span>
        </label>
        <Textarea
          id="feedback"
          name="feedback"
          rows={3}
          placeholder="Share any thoughts, ideas, or feature requests..."
          value={form.feedback}
          onChange={onTextChange}
          onFocus={() => onFieldFocus('feedback')}
          onBlur={onFieldBlur}
        />
      </div>

      {/* Legal Consent: split into three independently-required checkboxes
          (issue #127) — previously a single checkbox bundled rules +
          competitive integrity + participation terms with no links to
          any of the documents being agreed to. Each consent now links
          to its actual document and must be checked on its own. */}
      <div className="rounded-xl border border-line bg-accent/5 p-4 sm:p-5 space-y-4">
        <span className={labelClass}>Legal Agreements {requiredMark}</span>

        {/* League Rules & Code of Conduct */}
        <div
          id="field-agreedToRules"
          className={`border-l-2 pl-3 transition-colors ${fieldErrors.agreedToRules ? 'border-danger' : 'border-transparent'}`}
        >
          <label className="flex items-start gap-2.5 cursor-pointer text-sm font-semibold text-foreground-secondary hover:text-foreground transition-colors">
            <input
              type="checkbox"
              checked={form.agreedToRules}
              onChange={(e) => onConsentChange('agreedToRules', e.target.checked)}
              className="w-4.5 h-4.5 mt-0.5 rounded border-line accent-accent cursor-pointer shrink-0"
              aria-invalid={!!fieldErrors.agreedToRules}
              aria-describedby={fieldErrors.agreedToRules ? 'agreedToRules-error' : undefined}
            />
            <span>
              I have read and agree to the EZ Esports{' '}
              <Link
                href="/rules"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline hover:text-accent-secondary"
                onClick={(e) => e.stopPropagation()}
              >
                League Rules &amp; Code of Conduct
              </Link>
              , including its competitive integrity and sportsmanship policies. {requiredMark}
            </span>
          </label>
          {fieldErrors.agreedToRules && (
            <p id="agreedToRules-error" className="mt-1.5 ml-7 text-xs text-danger font-semibold">{fieldErrors.agreedToRules}</p>
          )}
        </div>

        {/* Terms of Service */}
        <div
          id="field-agreedToTerms"
          className={`border-l-2 pl-3 transition-colors ${fieldErrors.agreedToTerms ? 'border-danger' : 'border-transparent'}`}
        >
          <label className="flex items-start gap-2.5 cursor-pointer text-sm font-semibold text-foreground-secondary hover:text-foreground transition-colors">
            <input
              type="checkbox"
              checked={form.agreedToTerms}
              onChange={(e) => onConsentChange('agreedToTerms', e.target.checked)}
              className="w-4.5 h-4.5 mt-0.5 rounded border-line accent-accent cursor-pointer shrink-0"
              aria-invalid={!!fieldErrors.agreedToTerms}
              aria-describedby={fieldErrors.agreedToTerms ? 'agreedToTerms-error' : undefined}
            />
            <span>
              I have read and agree to the EZ Esports{' '}
              <Link
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline hover:text-accent-secondary"
                onClick={(e) => e.stopPropagation()}
              >
                Terms of Service
              </Link>
              . {requiredMark}
            </span>
          </label>
          {fieldErrors.agreedToTerms && (
            <p id="agreedToTerms-error" className="mt-1.5 ml-7 text-xs text-danger font-semibold">{fieldErrors.agreedToTerms}</p>
          )}
        </div>

        {/* Privacy / data handling */}
        <div
          id="field-agreedToPrivacy"
          className={`border-l-2 pl-3 transition-colors ${fieldErrors.agreedToPrivacy ? 'border-danger' : 'border-transparent'}`}
        >
          <label className="flex items-start gap-2.5 cursor-pointer text-sm font-semibold text-foreground-secondary hover:text-foreground transition-colors">
            <input
              type="checkbox"
              checked={form.agreedToPrivacy}
              onChange={(e) => onConsentChange('agreedToPrivacy', e.target.checked)}
              className="w-4.5 h-4.5 mt-0.5 rounded border-line accent-accent cursor-pointer shrink-0"
              aria-invalid={!!fieldErrors.agreedToPrivacy}
              aria-describedby={fieldErrors.agreedToPrivacy ? 'agreedToPrivacy-error' : undefined}
            />
            <span>
              I have read and agree to the EZ Esports{' '}
              <Link
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline hover:text-accent-secondary"
                onClick={(e) => e.stopPropagation()}
              >
                Privacy Policy
              </Link>
              , and consent to the collection of the officer and advisor contact details in this form. {requiredMark}
            </span>
          </label>
          {fieldErrors.agreedToPrivacy && (
            <p id="agreedToPrivacy-error" className="mt-1.5 ml-7 text-xs text-danger font-semibold">{fieldErrors.agreedToPrivacy}</p>
          )}
        </div>
      </div>

      {/* Privacy / data-use notice (issue #127): this form collects PII
          belonging to minors (student officer names, emails, Discord
          handles, grad years, advisor contact) — say plainly what's
          collected, why, and who sees it, right where applicants are
          about to submit it. */}
      <p className="text-xs text-foreground-muted leading-relaxed bg-surface-raised/40 border border-line/60 rounded-xl p-3">
        <strong className="text-foreground-secondary">How we use this information: </strong>
        We collect the names, emails, Discord usernames, graduation years, and advisor contact info above to verify your club, register your school for the season, and reach your officers and advisor about league logistics. It&apos;s visible only to EZ Esports league staff and is never sold or shared with third parties. See our{' '}
        <Link
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline hover:text-accent-secondary"
        >
          Privacy Policy
        </Link>{' '}
        for details.
      </p>

      {/* Submit Action Bar */}
      <div className="flex flex-col gap-3 pt-4 border-t border-line/50">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto min-h-[46px] shadow-lg shadow-accent/5 hover:shadow-accent/20 hover:scale-[1.02] transition-all"
          >
            {loading ? 'Submitting…' : 'Submit Application'}
          </Button>

          <button
            type="button"
            onClick={onClearForm}
            className="text-xs text-foreground-muted hover:text-foreground hover:underline font-semibold focus:outline-none transition-colors duration-200 cursor-pointer"
          >
            Clear Form Responses
          </button>
        </div>

        {error && (
          <p role="alert" className="text-danger text-sm font-semibold mt-2">{error}</p>
        )}
      </div>
    </div>
  );
}
