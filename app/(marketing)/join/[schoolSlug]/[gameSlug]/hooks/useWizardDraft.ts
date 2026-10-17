'use client';

import { useState } from 'react';
import { saveOnboardingDraft } from '@/app/lib/onboarding/wizard-actions';
import { RIOT_ID_REGEX, deriveTrackerUrl } from '@/app/lib/onboarding/adapters/riot-manual';
import {
  DEFAULT_MANAGER_SEASON,
  GRADUATION_YEAR_OPTIONS,
  MANAGER_SEASON_OPTIONS,
  type InviteData,
  type WizardFormData,
} from '../types';

export function useWizardDraft(token: string, inviteData: InviteData) {
  const initialDraft = inviteData.submissionDraft || {};
  const isManager = inviteData.role === 'manager';

  const [saveDraftPending, setSaveDraftPending] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Step 1: Account Information
  const [legalFirstName, setLegalFirstName] = useState(
    initialDraft.legalFirstName || inviteData.intendedFirstName || ''
  );
  const [legalLastName, setLegalLastName] = useState(
    initialDraft.legalLastName || inviteData.intendedLastName || ''
  );
  const [email, setEmail] = useState(initialDraft.email || '');
  const [password, setPassword] = useState(initialDraft.password || '');
  // Drafts saved with a year that is no longer offered (e.g. 2026) start unset instead of blank-but-valid.
  const [graduationYear, setGraduationYear] = useState<number>(
    GRADUATION_YEAR_OPTIONS.some((o) => o.value === Number(initialDraft.graduationYear))
      ? Number(initialDraft.graduationYear)
      : 0
  );
  // Manager only: season applied for. The admin invite may seed it; stale/unknown seasons fall back to the default.
  const [academicYear, setAcademicYear] = useState<string>(
    (MANAGER_SEASON_OPTIONS as readonly string[]).includes(initialDraft.academicYear)
      ? initialDraft.academicYear
      : DEFAULT_MANAGER_SEASON
  );

  // Step 2: Discord Connection
  const [discordUsername, setDiscordUsername] = useState(
    initialDraft.discordUsername || ''
  );
  const [discordJoinedConfirmed, setDiscordJoinedConfirmed] = useState<boolean>(
    Boolean(
      initialDraft.discordJoinedConfirmed ??
        initialDraft.discordConnected ??
        (initialDraft.discordUsername ? true : false)
    )
  );

  // Step 3: Riot Games Identity
  const [riotId, setRiotId] = useState(initialDraft.riotId || '');
  const [ignConfirmed, setIgnConfirmed] = useState<boolean>(
    Boolean(initialDraft.ignConfirmed)
  );

  // Step 4: Demographics & Research Survey
  const [birthDate, setBirthDate] = useState(initialDraft.birthDate || '');
  const [gender, setGender] = useState(initialDraft.gender || '');
  const [selectedRaces, setSelectedRaces] = useState<string[]>(
    Array.isArray(initialDraft.race) ? initialDraft.race : []
  );
  const [countryOfBirth, setCountryOfBirth] = useState(
    initialDraft.countryOfBirth || ''
  );
  const [primaryLanguageAtHome, setPrimaryLanguageAtHome] = useState(
    initialDraft.primaryLanguageAtHome || ''
  );
  const [isFreeOrReducedLunch, setIsFreeOrReducedLunch] = useState<boolean | undefined>(
    initialDraft.isFreeOrReducedLunch
  );
  const [isFirstGenCollege, setIsFirstGenCollege] = useState<boolean | undefined>(
    initialDraft.isFirstGenCollege
  );
  const [doePetitionConsent, setDoePetitionConsent] = useState<boolean>(
    Boolean(initialDraft.doePetitionConsent ?? true)
  );

  // Tech & Gaming Survey
  const [ping, setPing] = useState(initialDraft.surveyDetails?.ping || '');
  const [hoursPerWeek, setHoursPerWeek] = useState(
    initialDraft.surveyDetails?.hoursPerWeek || ''
  );
  const [internetReliability, setInternetReliability] = useState(
    initialDraft.surveyDetails?.internetReliability || ''
  );
  const [careerInterests, setCareerInterests] = useState<string[]>(
    Array.isArray(initialDraft.surveyDetails?.careerInterests)
      ? initialDraft.surveyDetails.careerInterests
      : []
  );
  const [feedback, setFeedback] = useState(
    initialDraft.surveyDetails?.feedback || ''
  );

  // Rules Acceptance
  const [codeOfConductAccepted, setCodeOfConductAccepted] = useState<boolean>(
    Boolean(initialDraft.codeOfConductAccepted)
  );

  // Computed state
  const isRiotIdValid = RIOT_ID_REGEX.test(riotId.trim());
  const trackerUrl = isRiotIdValid
    ? deriveTrackerUrl(inviteData.gameSlug, riotId.trim())
    : null;

  function buildCurrentPayload(): WizardFormData {
    return {
      legalFirstName,
      legalLastName,
      email,
      password: isManager ? password : undefined,
      graduationYear,
      academicYear: isManager ? academicYear : undefined,
      discordUsername,
      discordJoinedConfirmed,
      discordConnected: Boolean(discordUsername && discordJoinedConfirmed),
      riotId,
      ignConfirmed,
      birthDate,
      gender,
      race: selectedRaces,
      countryOfBirth,
      primaryLanguageAtHome,
      isFreeOrReducedLunch,
      isFirstGenCollege,
      doePetitionConsent,
      surveyDetails: {
        ping,
        hoursPerWeek,
        internetReliability,
        careerInterests,
        feedback,
      },
      codeOfConductAccepted,
    };
  }

  async function handleSaveDraft() {
    setSaveDraftPending(true);
    setSaveStatus(null);
    try {
      const draft = buildCurrentPayload();
      await saveOnboardingDraft({
        token,
        draftData: draft,
      });
      setSaveStatus('Draft saved successfully');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err: any) {
      setSaveStatus(`Failed to save draft: ${err.message || 'Unknown error'}`);
    } finally {
      setSaveDraftPending(false);
    }
  }

  function validateStep1(): boolean {
    setErrorMessage(null);
    if (!legalFirstName.trim()) {
      setErrorMessage('Please enter your legal first name.');
      return false;
    }
    if (!legalLastName.trim()) {
      setErrorMessage('Please enter your legal last name.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      setErrorMessage(
        isManager
          ? 'Please enter a valid email address.'
          : 'Please enter a valid student email address.'
      );
      return false;
    }
    if (isManager && (!password || password.length < 8)) {
      setErrorMessage(
        'Please enter a password with at least 8 characters to access the School Manager Portal.'
      );
      return false;
    }
    if (!GRADUATION_YEAR_OPTIONS.some((o) => o.value === graduationYear)) {
      setErrorMessage('Please select your anticipated high school graduation year.');
      return false;
    }
    if (isManager && !(MANAGER_SEASON_OPTIONS as readonly string[]).includes(academicYear)) {
      setErrorMessage('Please select the season you are applying for.');
      return false;
    }
    return true;
  }

  function validateStep2(): boolean {
    setErrorMessage(null);
    if (!discordUsername.trim()) {
      setErrorMessage('Please enter your Discord handle or username.');
      return false;
    }
    if (!discordJoinedConfirmed) {
      setErrorMessage(
        'Please confirm that you have joined the official EZ Esports Discord server.'
      );
      return false;
    }
    return true;
  }

  function validateStep3(): boolean {
    setErrorMessage(null);
    if (!riotId.trim()) {
      setErrorMessage('Please enter your Riot ID.');
      return false;
    }
    if (!RIOT_ID_REGEX.test(riotId.trim())) {
      setErrorMessage(
        'Invalid Riot ID format. Expected Name#Tag (e.g., Demon1#NA1), where name is 3-16 characters and tag is 3-5 alphanumeric characters.'
      );
      return false;
    }
    if (!ignConfirmed) {
      setErrorMessage(
        'You must confirm that this IGN matches your active in-game account.'
      );
      return false;
    }
    return true;
  }

  function validateStep4(): boolean {
    setErrorMessage(null);
    if (!birthDate) {
      setErrorMessage('Please provide your date of birth.');
      return false;
    }
    if (!codeOfConductAccepted) {
      setErrorMessage(
        'You must accept the EZ Esports Code of Conduct and Tournament Rules.'
      );
      return false;
    }
    return true;
  }

  return {
    // Form fields & setters
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
    academicYear,
    setAcademicYear,
    discordUsername,
    setDiscordUsername,
    discordJoinedConfirmed,
    setDiscordJoinedConfirmed,
    riotId,
    setRiotId,
    ignConfirmed,
    setIgnConfirmed,
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

    // Status
    saveDraftPending,
    saveStatus,
    errorMessage,
    setErrorMessage,
    isRiotIdValid,
    trackerUrl,
    isManager,

    // Actions
    buildCurrentPayload,
    handleSaveDraft,
    validateStep1,
    validateStep2,
    validateStep3,
    validateStep4,
  };
}
