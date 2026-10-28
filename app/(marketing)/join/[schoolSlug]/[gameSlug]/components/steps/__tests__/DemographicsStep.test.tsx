import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { DemographicsStep } from '../DemographicsStep';

const noop = () => {};
const baseProps = {
  birthDate: '',
  setBirthDate: noop,
  gender: '',
  setGender: noop,
  selectedRaces: [],
  setSelectedRaces: noop,
  countryOfBirth: '',
  setCountryOfBirth: noop,
  primaryLanguageAtHome: '',
  setPrimaryLanguageAtHome: noop,
  isFreeOrReducedLunch: undefined,
  setIsFreeOrReducedLunch: noop,
  isFirstGenCollege: undefined,
  setIsFirstGenCollege: noop,
  doePetitionConsent: true,
  setDoePetitionConsent: noop,
  ping: '',
  setPing: noop,
  hoursPerWeek: '',
  setHoursPerWeek: noop,
  internetReliability: '',
  setInternetReliability: noop,
  careerInterests: [],
  setCareerInterests: noop,
  feedback: '',
  setFeedback: noop,
  codeOfConductAccepted: false,
  setCodeOfConductAccepted: noop,
};

describe('DemographicsStep acknowledgement', () => {
  it('states that offensive usernames and submitted information are not allowed', () => {
    const html = renderToStaticMarkup(<DemographicsStep {...baseProps} />);
    expect(html).toContain('offensive usernames and offensive information submitted on this form are not allowed');
  });

  it('links the Rulebook / Code of Conduct to /rules', () => {
    const html = renderToStaticMarkup(<DemographicsStep {...baseProps} />);
    expect(html).toMatch(/<a[^>]*href="\/rules"[^>]*>Rulebook \/ Code of Conduct<\/a>/);
  });
});
