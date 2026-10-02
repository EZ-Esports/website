'use client';

import { FiShield } from 'react-icons/fi';
import { CAREER_INTEREST_OPTIONS, RACE_ETHNICITY_OPTIONS } from '../../types';

interface DemographicsStepProps {
  birthDate: string;
  setBirthDate: (val: string) => void;
  gender: string;
  setGender: (val: string) => void;
  selectedRaces: string[];
  setSelectedRaces: (val: string[]) => void;
  countryOfBirth: string;
  setCountryOfBirth: (val: string) => void;
  primaryLanguageAtHome: string;
  setPrimaryLanguageAtHome: (val: string) => void;
  isFreeOrReducedLunch: boolean | undefined;
  setIsFreeOrReducedLunch: (val: boolean | undefined) => void;
  isFirstGenCollege: boolean | undefined;
  setIsFirstGenCollege: (val: boolean | undefined) => void;
  doePetitionConsent: boolean;
  setDoePetitionConsent: (val: boolean) => void;
  ping: string;
  setPing: (val: string) => void;
  hoursPerWeek: string;
  setHoursPerWeek: (val: string) => void;
  internetReliability: string;
  setInternetReliability: (val: string) => void;
  careerInterests: string[];
  setCareerInterests: (val: string[]) => void;
  feedback: string;
  setFeedback: (val: string) => void;
  codeOfConductAccepted: boolean;
  setCodeOfConductAccepted: (val: boolean) => void;
}

export function DemographicsStep({
  birthDate,
  setBirthDate,
  gender,
  setGender,
  selectedRaces,
  setSelectedRaces,
  countryOfBirth,
  setCountryOfBirth,
  primaryLanguageAtHome,
  setPrimaryLanguageAtHome,
  isFreeOrReducedLunch,
  setIsFreeOrReducedLunch,
  isFirstGenCollege,
  setIsFirstGenCollege,
  doePetitionConsent,
  setDoePetitionConsent,
  ping,
  setPing,
  hoursPerWeek,
  setHoursPerWeek,
  internetReliability,
  setInternetReliability,
  careerInterests,
  setCareerInterests,
  feedback,
  setFeedback,
  codeOfConductAccepted,
  setCodeOfConductAccepted,
}: DemographicsStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">
          Step 4: Demographics & Research Survey
        </h2>
        <p className="text-xs sm:text-sm text-foreground-muted mt-1">
          Help us keep high school esports free and accessible for all NYC students.
        </p>
      </div>

      {/* Zero-PII Strict Security Privacy Callout */}
      <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 space-y-2">
        <div className="flex items-center gap-2 font-semibold text-xs sm:text-sm text-indigo-200">
          <FiShield className="w-4 h-4 shrink-0" />
          <span>Zero-PII Protection (FERPA & NYS Ed Law § 2-D Compliant)</span>
        </div>
        <p className="text-xs text-indigo-300/90 leading-relaxed">
          Your sensitive demographic responses (race, ethnicity, country of birth, lunch assistance) are encrypted in an isolated, permission-gated vault. They are used exclusively by authorized EZ Esports staff for state/foundation grant compliance and are <strong>strictly hidden from school managers, coaches, and opposing teams</strong>.
        </p>
      </div>

      {/* Core Demographics */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-accent">
          Demographic Background
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="demo-birthdate"
              className="block text-xs font-semibold text-foreground-muted mb-1.5"
            >
              Date of Birth *
            </label>
            <input
              id="demo-birthdate"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              required
            />
          </div>

          <div>
            <label
              htmlFor="demo-gender"
              className="block text-xs font-semibold text-foreground-muted mb-1.5"
            >
              Gender Identity
            </label>
            <select
              id="demo-gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">Select gender identity...</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Non-binary">Non-binary</option>
              <option value="Self-describe">Self-describe</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-foreground-muted mb-1.5">
            Race / Ethnicity (Select all that apply)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {RACE_ETHNICITY_OPTIONS.map((raceOption) => {
              const checked = selectedRaces.includes(raceOption);
              return (
                <label
                  key={raceOption}
                  className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                    checked
                      ? 'bg-accent/10 border-accent/40 text-foreground'
                      : 'bg-surface border-border text-foreground-muted hover:border-border/80'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRaces([...selectedRaces, raceOption]);
                      } else {
                        setSelectedRaces(
                          selectedRaces.filter((r) => r !== raceOption)
                        );
                      }
                    }}
                    className="h-3.5 w-3.5 rounded text-accent focus:ring-accent accent-accent"
                  />
                  <span>{raceOption}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="demo-country-of-birth"
              className="block text-xs font-semibold text-foreground-muted mb-1.5"
            >
              Country of Birth
            </label>
            <input
              id="demo-country-of-birth"
              type="text"
              value={countryOfBirth}
              onChange={(e) => setCountryOfBirth(e.target.value)}
              placeholder="e.g. United States, Dominican Republic"
              className="w-full px-3.5 py-2 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label
              htmlFor="demo-primary-language"
              className="block text-xs font-semibold text-foreground-muted mb-1.5"
            >
              Primary Language Spoken at Home
            </label>
            <input
              id="demo-primary-language"
              type="text"
              value={primaryLanguageAtHome}
              onChange={(e) => setPrimaryLanguageAtHome(e.target.value)}
              placeholder="e.g. English, Spanish, Cantonese"
              className="w-full px-3.5 py-2 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="demo-free-lunch"
              className="block text-xs font-semibold text-foreground-muted mb-1.5"
            >
              Free or Reduced-Price Lunch Eligible (Title I Metric)
            </label>
            <select
              id="demo-free-lunch"
              value={
                isFreeOrReducedLunch === undefined
                  ? ''
                  : isFreeOrReducedLunch
                  ? 'true'
                  : 'false'
              }
              onChange={(e) =>
                setIsFreeOrReducedLunch(
                  e.target.value === ''
                    ? undefined
                    : e.target.value === 'true'
                )
              }
              className="w-full px-3.5 py-2 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">Select option...</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="demo-first-gen"
              className="block text-xs font-semibold text-foreground-muted mb-1.5"
            >
              First-Generation College Student
            </label>
            <select
              id="demo-first-gen"
              value={
                isFirstGenCollege === undefined
                  ? ''
                  : isFirstGenCollege
                  ? 'true'
                  : 'false'
              }
              onChange={(e) =>
                setIsFirstGenCollege(
                  e.target.value === ''
                    ? undefined
                    : e.target.value === 'true'
                )
              }
              className="w-full px-3.5 py-2 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">Select option...</option>
              <option value="true">Yes</option>
              <option value="false">No / Unsure</option>
            </select>
          </div>
        </div>

        <div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={doePetitionConsent}
              onChange={(e) => setDoePetitionConsent(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-border text-accent focus:ring-accent accent-accent"
            />
            <span className="text-xs text-foreground-muted leading-relaxed">
              I support the inclusion of scholastic esports as an officially recognized NYCDOE extracurricular activity.
            </span>
          </label>
        </div>
      </div>

      {/* Tech & Gaming Survey */}
      <div className="space-y-4 pt-4 border-t border-border">
        <h3 className="text-xs font-bold uppercase tracking-wider text-accent">
          Tech & Gaming Survey
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="demo-ping"
              className="block text-xs font-semibold text-foreground-muted mb-1.5"
            >
              Average Home Ping
            </label>
            <select
              id="demo-ping"
              value={ping}
              onChange={(e) => setPing(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="< 20ms">&lt; 20ms</option>
              <option value="20-40ms">20-40ms</option>
              <option value="40-70ms">40-70ms</option>
              <option value="70ms+">70ms+</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="demo-hours-per-week"
              className="block text-xs font-semibold text-foreground-muted mb-1.5"
            >
              Gaming Hours / Week
            </label>
            <select
              id="demo-hours-per-week"
              value={hoursPerWeek}
              onChange={(e) => setHoursPerWeek(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="0-5 hrs">0-5 hrs</option>
              <option value="6-10 hrs">6-10 hrs</option>
              <option value="11-20 hrs">11-20 hrs</option>
              <option value="20+ hrs">20+ hrs</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="demo-internet-reliability"
              className="block text-xs font-semibold text-foreground-muted mb-1.5"
            >
              Internet Reliability
            </label>
            <select
              id="demo-internet-reliability"
              value={internetReliability}
              onChange={(e) => setInternetReliability(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="Fiber (Very stable)">Fiber (Very stable)</option>
              <option value="Cable / Broadband (Stable)">Cable / Broadband (Stable)</option>
              <option value="Wi-Fi (Occasional drops)">Wi-Fi (Occasional drops)</option>
              <option value="Cell / Hotspot (Unstable)">Cell / Hotspot (Unstable)</option>
            </select>
          </div>
        </div>

        <div>
          <span className="block text-xs font-semibold text-foreground-muted mb-1.5">
            Future Career Interests (Select all that apply)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {CAREER_INTEREST_OPTIONS.map((interest) => {
              const checked = careerInterests.includes(interest);
              return (
                <label
                  key={interest}
                  className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                    checked
                      ? 'bg-accent/10 border-accent/40 text-foreground'
                      : 'bg-surface border-border text-foreground-muted hover:border-border/80'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setCareerInterests([...careerInterests, interest]);
                      } else {
                        setCareerInterests(
                          careerInterests.filter((i) => i !== interest)
                        );
                      }
                    }}
                    className="h-3.5 w-3.5 rounded text-accent focus:ring-accent accent-accent"
                  />
                  <span>{interest}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div>
          <label
            htmlFor="demo-feedback"
            className="block text-xs font-semibold text-foreground-muted mb-1.5"
          >
            Anything else staff should know? (Optional)
          </label>
          <textarea
            id="demo-feedback"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={2}
            className="w-full px-3.5 py-2 rounded-lg bg-surface border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="Schedule constraints, accommodations, questions..."
          />
        </div>
      </div>

      {/* Code of Conduct Signature */}
      <div className="pt-4 border-t border-border">
        <label className="flex items-start gap-3 cursor-pointer p-3.5 rounded-xl bg-surface border border-border hover:border-accent/40 transition-colors">
          <input
            type="checkbox"
            checked={codeOfConductAccepted}
            onChange={(e) => setCodeOfConductAccepted(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-border text-accent focus:ring-accent accent-accent"
            required
          />
          <span className="text-xs text-foreground leading-relaxed">
            <strong>Code of Conduct & Rules Agreement *:</strong> I have read and agree to abide by the EZ Esports Rulebook, Code of Conduct, and Tournament Regulations. I understand that unsportsmanlike behavior, toxicity, or ringing will result in immediate disqualification.
          </span>
        </label>
      </div>
    </div>
  );
}
