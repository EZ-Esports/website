import type { Metadata } from 'next';
import Link from 'next/link';
import Hero from '@/app/components/sections/Hero';
import Section from '@/app/components/ui/Section';

export const metadata: Metadata = {
  title: 'Competition Participation Terms & Code of Conduct | EZ Esports',
  description:
    'The eligibility, conduct, competitive integrity, and appeals process that apply to every participant in an EZ Esports competition.',
};

export default function RulesPage() {
  const effectiveDate = 'To be set upon approval';

  const sections = [
    { id: 'section-1', label: '1. Purpose' },
    { id: 'section-2', label: '2. Eligibility & Authority' },
    { id: 'section-3', label: '3. Registration & Rosters' },
    { id: 'section-4', label: '4. Accounts, Equipment & Platforms' },
    { id: 'section-5', label: '5. Scheduling & Match Procedure' },
    { id: 'section-6', label: '6. Competitive Integrity' },
    { id: 'section-7', label: '7. Conduct' },
    { id: 'section-8', label: '8. Privacy & Media' },
    { id: 'section-9', label: '9. Reporting Concerns' },
    { id: 'section-10', label: '10. Review & Discipline' },
    { id: 'section-11', label: '11. Appeals' },
    { id: 'section-12', label: '12. Publisher & Program Changes' },
  ];

  return (
    <main>
      <Hero
        title="Competition Participation Terms & Code of Conduct"
        backgroundImage="/images/hero-background.jpg"
        size="medium"
      />

      <Section width="narrow">
        <div className="max-w-3xl mx-auto space-y-10 text-foreground-secondary text-sm sm:text-base leading-relaxed">
          <p className="text-xs text-foreground-muted uppercase tracking-wider">
            Effective date: {effectiveDate}
          </p>

          <div className="space-y-4">
            <p>
              These Competition Participation Terms and Code of Conduct (this &quot;Rulebook&quot;)
              establish consistent expectations for students, teams, club officers, advisors, coaches,
              staff, and others who participate in an EZ Esports competition. EZ Esports is a
              student-founded organization pursuing nonprofit formation, operating a high-school
              esports league based in New York City.
            </p>
            <p>
              Game-specific rules, schedules, and publisher requirements form part of these Terms.
              Safety, fairness, student development, and school requirements take priority over
              convenience or competitive advantage. This Rulebook operates alongside our{' '}
              <Link href="/terms" className="text-accent hover:underline">
                Terms of Use
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-accent hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </div>

          <nav aria-label="Rulebook sections" className="space-y-3">
            <p className="text-xs text-foreground-muted uppercase tracking-wider">On this page</p>
            <ul className="space-y-2">
              {sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className="text-accent hover:underline">
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-4">
            <h2 id="section-1" className="text-xl font-bold text-foreground scroll-mt-28">
              1. Purpose
            </h2>
            <p>
              These Terms establish consistent expectations for students, teams, club officers,
              advisors, coaches, staff, and others who participate in an EZ Esports competition.
              Game-specific rules, schedules, and publisher requirements form part of these Terms.
              Safety, fairness, student development, and school requirements take priority over
              convenience or competitive advantage.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-2" className="text-xl font-bold text-foreground scroll-mt-28">
              2. Eligibility &amp; Authority
            </h2>
            <p>A participant must:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Attend an eligible high school or meet the published program eligibility rule.</li>
              <li>Appear on an approved roster before competing.</li>
              <li>Use accurate eligibility information and an approved account.</li>
              <li>Meet the age requirements of the game, publisher, platform, and event.</li>
              <li>Obtain guardian consent when required.</li>
              <li>Follow applicable school rules.</li>
              <li>Avoid participation while suspended or otherwise ineligible.</li>
            </ul>
            <p>
              A student club officer may coordinate a team but cannot bind a school or another
              participant. Each school must identify a faculty advisor or other authorized adult
              contact. EZ Esports may request reasonable verification through that contact while
              minimizing student data.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-3" className="text-xl font-bold text-foreground scroll-mt-28">
              3. Registration &amp; Rosters
            </h2>
            <p>
              Preliminary interest does not register a team. Final registration requires the requested
              roster, consent records, eligibility confirmation, and acceptance of these Terms. Teams
              may add or replace players only within published windows or with written approval.
              Participants may not compete for multiple teams in the same division unless the rules
              expressly permit it.
            </p>
            <p>
              Legal names and private contact details remain internal. Public-facing records should
              use a school name, team name, and approved game display name. Offensive, misleading,
              infringing, or personally identifying display names may be rejected.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-4" className="text-xl font-bold text-foreground scroll-mt-28">
              4. Accounts, Equipment &amp; Platforms
            </h2>
            <p>
              Participants are responsible for lawful access to the game and an account in good
              standing. Account sharing, boosting, ban evasion, unauthorized software, exploits, and
              false identity are prohibited. Participants must follow the publisher&apos;s terms and
              the communication or streaming platform&apos;s rules.
            </p>
            <p>
              EZ Esports does not guarantee equipment, connectivity, platform uptime, or technical
              support. A participant should protect credentials and report compromise before
              competing. Staff may request limited technical evidence needed to resolve a match issue
              but should never ask for a password.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-5" className="text-xl font-bold text-foreground scroll-mt-28">
              5. Scheduling &amp; Match Procedure
            </h2>
            <p>
              Teams must monitor the official schedule and designated communication channel. Captains
              should confirm availability, report conflicts by the stated deadline, and preserve match
              evidence required by the rules. Only authorized officials may declare a forfeit,
              reschedule, restart, or final result.
            </p>
            <p>
              Game-specific rules must define lobby settings, maps or stages, side selection, pauses,
              substitutions, disconnects, reporting, protests, and evidence. When a rule is silent,
              officials will make a reasonable decision consistent with fairness, safety, publisher
              requirements, and prior treatment of similar cases.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-6" className="text-xl font-bold text-foreground scroll-mt-28">
              6. Competitive Integrity
            </h2>
            <p>The following are prohibited:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Cheats, unauthorized automation, prohibited modifications, or intentional exploit abuse.</li>
              <li>Match fixing, collusion, intentional loss, result manipulation, or undisclosed conflicts.</li>
              <li>Playing under another person&apos;s account or allowing an ineligible person to play.</li>
              <li>Stream sniping, ghosting, unauthorized coaching, or sharing restricted match information.</li>
              <li>Falsifying screenshots, logs, rosters, consent, or eligibility information.</li>
              <li>Betting or facilitating gambling on an EZ Esports competition.</li>
            </ul>
            <p>
              A participant must report a known material integrity issue privately and preserve
              relevant evidence. Retaliation against a good-faith reporter is prohibited.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-7" className="text-xl font-bold text-foreground scroll-mt-28">
              7. Conduct
            </h2>
            <p>
              Participants must communicate respectfully and help maintain an environment where
              students can compete, lead, create, and belong. Harassment, discrimination, sexual
              misconduct, threats, hazing, bullying, slurs, unwanted contact, doxxing, retaliation, and
              targeted humiliation are prohibited in official spaces and in outside conduct that
              materially affects participant safety or the league.
            </p>
            <p>
              Participants may not bring weapons, illegal drugs, alcohol, or other prohibited items to
              an EZ Esports activity. Sexual or romantic conduct between an adult staff member and a
              minor participant is prohibited. Adults and staff should use approved, observable
              communication channels and should avoid unnecessary private one-to-one contact with a
              minor.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-8" className="text-xl font-bold text-foreground scroll-mt-28">
              8. Privacy &amp; Media
            </h2>
            <p>
              Participants may not record or publish private staff channels, incident reports,
              personal contact information, school records, or another person&apos;s private
              communications without authority. Official broadcasts may display gameplay, school or
              team name, approved display names, and competition results. Use of a participant&apos;s
              face, legal name, voice, interview, or likeness follows the applicable participant and
              guardian media consent.
            </p>
            <p>
              Participants must not use league access to solicit students for commercial products,
              private coaching, gambling, financial products, political campaigns, or unrelated
              organizations without written approval.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-9" className="text-xl font-bold text-foreground scroll-mt-28">
              9. Reporting Concerns
            </h2>
            <p>
              Immediate danger should be reported to emergency services and an appropriate school
              adult. League concerns may be reported to the designated safety contact or{' '}
              <a href="mailto:info@ezesports.org" className="text-accent hover:underline">
                info@ezesports.org
              </a>
              . Reports should include the people involved, approximate time, conduct, witnesses, and
              available evidence without circulating sensitive material more broadly.
            </p>
            <p>
              EZ Esports will limit information to people who need it for safety, investigation,
              school coordination, insurance, or law. Absolute confidentiality cannot be promised.
              Staff must escalate suspected abuse, credible threats, sexual misconduct, self-harm risk,
              or other urgent safety issues under the safeguarding process and applicable reporting
              duties.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-10" className="text-xl font-bold text-foreground scroll-mt-28">
              10. Review &amp; Discipline
            </h2>
            <p>
              EZ Esports may use temporary protective measures while reviewing a serious concern.
              Possible outcomes include:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Education or a warning.</li>
              <li>A match remedy, or loss of a game or match.</li>
              <li>Roster restriction, or removal from a channel or event.</li>
              <li>
                Suspension for a set number of matches or a set period, or disqualification.
              </li>
              <li>Referral to a school, publisher, platform, guardian, or authority.</li>
            </ul>
            <p>
              The response should consider severity, intent, impact, prior conduct, safety,
              cooperation, and consistency. A person should receive notice of the material concern and
              a reasonable opportunity to respond when safety and law permit. The decision should
              identify the rule and effective period.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-11" className="text-xl font-bold text-foreground scroll-mt-28">
              11. Appeals
            </h2>
            <p>
              A participant or school may submit one written appeal within the published deadline. The
              appeal must identify a material rule error, important new evidence, conflict of
              interest, or disproportionate sanction. Disagreement alone is insufficient. A reviewer
              who did not make the original decision should decide the appeal when practical. The
              appeal decision is final within the league, without limiting legal rights.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-12" className="text-xl font-bold text-foreground scroll-mt-28">
              12. Publisher &amp; Program Changes
            </h2>
            <p>
              EZ Esports may amend game rules, schedules, or formats to comply with publisher
              requirements, correct an error, address safety, or preserve a workable competition.
              Material changes will receive notice. A title may be postponed or removed if
              participation, permissions, staffing, platform stability, or safety is insufficient.
            </p>
          </div>

          <div className="space-y-4">
            <p>
              Participants and their guardians accept this Rulebook as part of final player or team
              registration, not at the stage of preliminary interest.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">Changes to This Rulebook</h2>
            <p>
              EZ Esports may update this Rulebook between seasons, and occasionally during a season
              when a rule needs to be clarified or a competitive problem needs to be addressed. This
              page will identify the effective date, and material changes will receive reasonable
              notice.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">Contact &amp; Questions</h2>
            <p>
              If you have a question about how a rule applies, want to report a violation, or need to
              start an appeal, contact the league:
            </p>
            <address className="not-italic space-y-1">
              <p className="font-semibold text-foreground">EZ Esports</p>
              <p>
                Email:{' '}
                <a href="mailto:info@ezesports.org" className="text-accent hover:underline">
                  info@ezesports.org
                </a>
              </p>
              <p>New York City, NY</p>
            </address>
          </div>
        </div>
      </Section>
    </main>
  );
}
