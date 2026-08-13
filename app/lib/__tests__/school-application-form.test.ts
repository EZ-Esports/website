import { describe, expect, it } from 'vitest';

export function validateSchoolApplicationForm(form: {
  presidentFirstName: string;
  presidentLastName: string;
  schoolName: string;
  presidentGradYear: string;
  presidentEmail: string;
  presidentDiscord: string;
  presidentPreferredContact: string;

  vpFirstName: string;
  vpLastName: string;
  vpGradYear: string;
  vpDiscord: string;
  vpEmail: string;
  vpPreferredContact: string;

  officerFirstName: string;
  officerLastName: string;
  officerGradYear: string;
  officerEmail: string;
  officerPreferredContact: string;

  advisorName: string;
  advisorEmail: string;
  activeStudentsCount: string;
  interestedGames: Record<string, boolean>;
  interestedGamesOther?: string;
}) {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const errors: Record<string, string> = {};

  // Layer 1
  if (!form.presidentFirstName.trim()) errors.presidentFirstName = 'President first name is required.';
  if (!form.presidentLastName.trim()) errors.presidentLastName = 'President last name is required.';
  if (!form.schoolName.trim()) errors.schoolName = 'School name is required.';
  if (!form.presidentGradYear) errors.presidentGradYear = 'Please select a graduation year.';
  if (!form.presidentEmail.trim()) errors.presidentEmail = 'President email is required.';
  else if (!EMAIL_RE.test(form.presidentEmail)) errors.presidentEmail = 'Enter a valid email address.';
  if (!form.presidentDiscord.trim()) errors.presidentDiscord = 'Discord username is required.';
  if (!form.presidentPreferredContact.trim()) errors.presidentPreferredContact = 'Please specify best contact platform.';

  // Layer 2
  if (!form.vpFirstName.trim()) errors.vpFirstName = 'Vice President first name is required.';
  if (!form.vpLastName.trim()) errors.vpLastName = 'Vice President last name is required.';
  if (!form.vpGradYear) errors.vpGradYear = 'Please select a graduation year.';
  if (!form.vpDiscord.trim()) errors.vpDiscord = 'Discord username is required.';
  if (!form.vpEmail.trim()) errors.vpEmail = 'Vice President email is required.';
  else if (!EMAIL_RE.test(form.vpEmail)) errors.vpEmail = 'Enter a valid email address.';
  if (!form.vpPreferredContact.trim()) errors.vpPreferredContact = 'Please specify best contact platform.';

  // Layer 3
  if (!form.officerFirstName.trim()) errors.officerFirstName = 'Officer first name is required.';
  if (!form.officerLastName.trim()) errors.officerLastName = 'Officer last name is required.';
  if (!form.officerGradYear) errors.officerGradYear = 'Please select a graduation year.';
  if (!form.officerEmail.trim()) errors.officerEmail = 'Officer email is required.';
  else if (!EMAIL_RE.test(form.officerEmail)) errors.officerEmail = 'Enter a valid email address.';
  if (!form.officerPreferredContact.trim()) errors.officerPreferredContact = 'Please specify best contact platform.';

  // Layer 4
  if (!form.advisorName.trim()) errors.advisorName = 'Club advisor name is required.';
  if (!form.advisorEmail.trim()) errors.advisorEmail = 'Club advisor email is required.';
  else if (!EMAIL_RE.test(form.advisorEmail)) errors.advisorEmail = 'Enter a valid email address.';
  if (!form.activeStudentsCount.trim()) errors.activeStudentsCount = 'Estimated student count is required.';

  const hasGame = Object.values(form.interestedGames).some(Boolean);
  if (!hasGame) {
    errors.interestedGames = 'Select at least one game your club is interested in.';
  } else if (form.interestedGames.other && !form.interestedGamesOther?.trim()) {
    errors.interestedGamesOther = 'Please specify the other game.';
  }

  return errors;
}

describe('School Application Form Validation (4-Layer Structure)', () => {
  const validForm = {
    presidentFirstName: 'Jane',
    presidentLastName: 'Doe',
    schoolName: 'Brooklyn Tech',
    presidentGradYear: "'27",
    presidentEmail: 'jane@example.com',
    presidentDiscord: 'janedoe',
    presidentPreferredContact: 'Discord',

    vpFirstName: 'Alex',
    vpLastName: 'Smith',
    vpGradYear: "'28",
    vpDiscord: 'alexsmith',
    vpEmail: 'alex@example.com',
    vpPreferredContact: 'Email',

    officerFirstName: 'Jordan',
    officerLastName: 'Lee',
    officerGradYear: "'29",
    officerEmail: 'jordan@example.com',
    officerPreferredContact: 'SMS',

    advisorName: 'Mr. Davis',
    advisorEmail: 'davis@schools.nyc.gov',
    activeStudentsCount: '30',
    interestedGames: { valorant: true },
  };

  it('validates a complete 4-layer form with no errors', () => {
    const errors = validateSchoolApplicationForm(validForm);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('requires all 3 points of contact (President, VP, 3rd Officer)', () => {
    const missingVp = { ...validForm, vpFirstName: '', vpEmail: '' };
    const errors = validateSchoolApplicationForm(missingVp);
    expect(errors.vpFirstName).toBeDefined();
    expect(errors.vpEmail).toBeDefined();
  });

  it('requires advisor details and interested games', () => {
    const missingAdvisor = { ...validForm, advisorName: '', interestedGames: { valorant: false } };
    const errors = validateSchoolApplicationForm(missingAdvisor);
    expect(errors.advisorName).toBeDefined();
    expect(errors.interestedGames).toBeDefined();
  });
});
