import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, beforeAll } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ApplyForm from '../ApplyForm';
import PrivacyPage from '@/app/(marketing)/privacy/page';
import {
  validateSchoolApplicationForm,
  compileApplicationPayload,
  buildSchoolApplicationDetails,
} from '@/app/lib/school-application-form';

describe('Parental Media & Photo Likeness Release Workflow (#109)', () => {
  beforeAll(() => {
    // Mock IntersectionObserver for client component rendering in node environment
    if (typeof global.IntersectionObserver === 'undefined') {
      global.IntersectionObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      } as unknown as typeof IntersectionObserver;
    }
  });

  describe('ApplyForm Component & Source Verification', () => {
    const applyFormSource = readFileSync(
      resolve(process.cwd(), 'app/(marketing)/apply/ApplyForm.tsx'),
      'utf8'
    );

    it('renders the Media & Photo Likeness Consent & Release section in markup', () => {
      const html = renderToStaticMarkup(<ApplyForm />);
      expect(html).toContain('Media &amp; Photo Likeness Consent &amp; Release for Minors');
      expect(html).toContain('field-agreedMediaRelease');
      expect(html).toContain('name="agreedMediaRelease"');
    });

    it('contains clear disclosure of broadcasts, gallery photos, and scoreboards', () => {
      expect(applyFormSource).toContain('Participating high school students may appear in public live match broadcasts (Twitch, YouTube)');
      expect(applyFormSource).toContain('event photographs in the community gallery');
      expect(applyFormSource).toContain('official match scoreboards');
    });

    it('requires confirmation that school advisor/coach has obtained parental media release forms or district consent', () => {
      expect(applyFormSource).toContain('school advisor, coach, or club leadership has obtained the necessary parental/guardian media release forms or local school district consent according to school policies');
    });

    it('contains an explicit privacy hold notice and opt-out email privacy@ezesports.org', () => {
      expect(applyFormSource).toContain('Privacy Hold Notice:');
      expect(applyFormSource).toContain('students with privacy flags or protective holds may opt out of photography and public name display, participating under anonymized gamer tags');
      expect(applyFormSource).toContain('href="mailto:privacy@ezesports.org"');
      expect(applyFormSource).toContain('privacy@ezesports.org');
    });

    it('links to Privacy Policy media minor likeness section with target="_blank"', () => {
      expect(applyFormSource).toContain('href="/privacy#media-minor-likeness"');
      expect(applyFormSource).toContain('target="_blank"');
    });

    it('includes agreedMediaRelease in clubInfo requiredChecks for progress calculation', () => {
      expect(applyFormSource).toContain('form.agreedMediaRelease');
    });
  });

  describe('Form Validation & Payload Compliance', () => {
    const baseForm = {
      clubStatus: 'Active and returning',
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
      instagramLink: 'https://instagram.com/bkltechnesports',
      discordLink: 'https://discord.gg/bkltech',
      advisorName: 'Mr. Davis',
      advisorEmail: 'davis@schools.nyc.gov',
      advisorConfirmed: 'Yes',
      activeStudentsCount: '30',
      interestedGames: { valorant: true },
      clubBarriers: 'recruitingPlayers',
      nonRosterOpportunities: { oneDayTournaments: true },
      inclusiveOpportunities: { friendlyScrimmages: true },
      separateGamingClubs: 'N/A',
      contributeBeyondSchool: { notAtThisTime: true },
      feedback: 'Ready to play!',
      agreedRules: true,
      agreedMediaRelease: false,
    };

    it('flags an error when agreedMediaRelease is false', () => {
      const errors = validateSchoolApplicationForm(baseForm);
      expect(errors.agreedMediaRelease).toBe(
        'You must confirm the media and photo likeness release for minors.'
      );
    });

    it('passes validation when agreedMediaRelease is true', () => {
      const errors = validateSchoolApplicationForm({ ...baseForm, agreedMediaRelease: true });
      expect(errors.agreedMediaRelease).toBeUndefined();
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('compiles application payload with Media Release Agreement status', () => {
      const payloadAgreed = compileApplicationPayload({ ...baseForm, agreedMediaRelease: true });
      expect(payloadAgreed.message).toContain('Media Release Agreement: Agreed');

      const payloadDisagreed = compileApplicationPayload({ ...baseForm, agreedMediaRelease: false });
      expect(payloadDisagreed.message).toContain('Media Release Agreement: Disagreed');
    });

    it('builds structured details with agreedMediaRelease field', () => {
      const details = buildSchoolApplicationDetails({ ...baseForm, agreedMediaRelease: true });
      expect(details.agreedMediaRelease).toBe(true);
    });
  });

  describe('Privacy Policy Minor Likeness & Media Release Section', () => {
    const privacyHtml = renderToStaticMarkup(PrivacyPage());

    it('renders dedicated section for Media Broadcasts, Event Photography & Minor Likeness Rights', () => {
      expect(privacyHtml).toContain('Media Broadcasts, Event Photography &amp; Minor Likeness Rights');
      expect(privacyHtml).toContain('id="media-minor-likeness"');
    });

    it('details live streaming on Twitch and YouTube', () => {
      expect(privacyHtml).toContain('Live Streaming &amp; Broadcasts');
      expect(privacyHtml).toContain('Twitch');
      expect(privacyHtml).toContain('YouTube');
    });

    it('details event photography in the community gallery', () => {
      expect(privacyHtml).toContain('Event Photography &amp; Community Gallery');
      expect(privacyHtml).toContain('community gallery');
    });

    it('details public match scoreboards and standings', () => {
      expect(privacyHtml).toContain('Public Match Scoreboards &amp; Standings');
      expect(privacyHtml).toContain('Official match outcomes, scores, leaderboards, and team rosters');
    });

    it('specifies parental consent and school district verification responsibility', () => {
      expect(privacyHtml).toContain('Parental/Guardian Consent &amp; School Verification:');
      expect(privacyHtml).toContain('parental or guardian media release forms');
      expect(privacyHtml).toContain('local school district');
      expect(privacyHtml).toContain('media consent regulations');
    });

    it('clearly outlines privacy hold and opt-out procedure for students, parents, and faculty', () => {
      expect(privacyHtml).toContain('Privacy Holds &amp; Media Opt-Out Procedure for Students, Parents, and Faculty');
      expect(privacyHtml).toContain('href="mailto:privacy@ezesports.org"');
      expect(privacyHtml).toContain('privacy@ezesports.org');
    });

    it('describes accommodations for privacy holds including anonymized gamer tags and photo removal', () => {
      expect(privacyHtml).toContain('Anonymized Gamer Tags &amp; Scoreboards');
      expect(privacyHtml).toContain('anonymized, randomized player aliases');
      expect(privacyHtml).toContain('Takedown &amp; Photo Modification');
      expect(privacyHtml).toContain('blur, crop, or remove the media');
    });
  });
});
