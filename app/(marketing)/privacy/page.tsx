import type { Metadata } from 'next';
import Hero from '@/app/components/sections/Hero';
import Section from '@/app/components/ui/Section';

export const metadata: Metadata = {
  title: 'Privacy Policy | EZ Esports',
  description:
    'How EZ Esports collects, uses, shares, retains, and protects personal information across ezesports.org and league operations.',
};

const sections = [
  { id: 'section-1', label: '1. Scope' },
  { id: 'section-2', label: '2. Information EZ Esports May Collect' },
  { id: 'section-3', label: '3. Sources' },
  { id: 'section-4', label: '4. Purposes' },
  { id: 'section-5', label: '5. Minors' },
  { id: 'section-6', label: '6. When Information May Be Shared' },
  { id: 'section-7', label: '7. Service Providers' },
  { id: 'section-8', label: '8. Retention' },
  { id: 'section-9', label: '9. Security' },
  { id: 'section-10', label: '10. Individual Choices & Requests' },
  { id: 'section-11', label: '11. Cookies & Online Technologies' },
  { id: 'section-12', label: '12. Third-Party Services' },
  { id: 'section-13', label: '13. Changes' },
  { id: 'section-14', label: '14. Contact' },
];

const retentionSchedule = [
  {
    record: 'Preliminary school interest and officer contacts',
    rule: 'Through the relevant season plus 12 months, then renew, delete, or retain only an institutional school contact',
  },
  {
    record: 'Player roster and eligibility data',
    rule: 'Through the relevant season plus 12 months, then delete or deidentify unless a dispute, law, or school agreement requires more',
  },
  {
    record: 'Public schedules, standings, and match results',
    rule: 'May be retained as historical records without private contact data; identifiable display names require continuing authority',
  },
  {
    record: 'Optional marketing list',
    rule: 'Until withdrawal, invalid address, or 24 months without engagement',
  },
  {
    record: 'Account and access records',
    rule: 'While access is active plus a limited security and audit period',
  },
  {
    record: 'Routine security logs',
    rule: 'Normally up to 90 days unless needed for an incident or legal obligation',
  },
  {
    record: 'Consent and contract records',
    rule: 'For the use covered and the applicable legal claims period',
  },
  {
    record: 'Incident and safeguarding records',
    rule: 'Under a restricted schedule approved by counsel based on safety, insurance, school, and legal needs',
  },
  {
    record: 'Unsuccessful staff applications',
    rule: 'Normally 12 months unless the applicant requests earlier deletion or authorizes longer consideration',
  },
];

export default function PrivacyPage() {
  const effectiveDate = 'To be set upon approval';

  return (
    <main>
      <Hero
        title="Privacy Policy"
        backgroundImage="/images/hero-background.jpg"
        size="medium"
      />

      <Section width="narrow">
        <div className="max-w-3xl mx-auto space-y-10 text-foreground-secondary text-sm sm:text-base leading-relaxed">
          <p className="text-xs text-foreground-muted uppercase tracking-wider">
            Effective date: {effectiveDate}
          </p>

          <nav aria-label="Privacy Policy sections" className="space-y-3">
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
              1. Scope
            </h2>
            <p>
              This Privacy Policy explains how EZ Esports handles personal information through
              ezesports.org, school-interest and player-registration forms, league operations,
              events, broadcasts, communications, staff systems, and other services that link to
              this Policy. This Policy does not replace a school contract or data addendum. When
              EZ Esports receives education-record information from a New York educational agency
              under a written agreement, the agreement, the school&apos;s privacy policy, New York
              Education Law Section 2-d, Part 121, and applicable federal law may impose
              additional duties.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-2" className="text-xl font-bold text-foreground scroll-mt-28">
              2. Information EZ Esports May Collect
            </h2>
            <p>
              EZ Esports may collect only information reasonably needed for an identified program
              purpose, including:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                identity and contact information, such as name, email, school, graduation year,
                role, guardian contact, and preferred communication channel;
              </li>
              <li>
                league identifiers, such as team name, game display name, platform username,
                division, eligibility status, roster assignment, match result, and disciplinary
                eligibility status;
              </li>
              <li>
                school and club information, such as advisor contact, club status, membership
                estimates, scheduling constraints, and requested support;
              </li>
              <li>application, volunteer, partnership, sponsor, and vendor information;</li>
              <li>
                event and media information, such as attendance, approved photographs,
                recordings, voice, interviews, and consent choices;
              </li>
              <li>
                communications and reports, including support requests, rule questions, incident
                reports, and appeals;
              </li>
              <li>
                account and security data, such as authentication records, access role, sign-in
                time, audit log, browser type, device information, IP address, and security
                events; and
              </li>
              <li>website activity collected through cookies and similar online technologies.</li>
            </ul>
            <p>
              EZ Esports should not collect a full date of birth, home address, government
              identification number, health record, school disciplinary record, or other
              sensitive information unless a documented need and approved safeguard exist.
              Graduation year or an age-band confirmation should replace birth date when
              sufficient.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-3" className="text-xl font-bold text-foreground scroll-mt-28">
              3. Sources
            </h2>
            <p>
              Information may come directly from a student, parent or guardian, school club
              officer, faculty advisor, authorized school representative, volunteer, applicant,
              sponsor, vendor, website browser, service provider, or public competition record. EZ
              Esports will identify the source when that distinction affects access, consent, or
              deletion rights.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-4" className="text-xl font-bold text-foreground scroll-mt-28">
              4. Purposes
            </h2>
            <p>EZ Esports may use personal information to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>review school interest and plan game offerings, schedules, staffing, and support;</li>
              <li>
                verify eligibility, create rosters, administer matches, maintain standings, and
                resolve disputes;
              </li>
              <li>communicate necessary program information;</li>
              <li>
                protect students, respond to incidents, enforce conduct rules, and preserve
                competitive integrity;
              </li>
              <li>operate accounts, authenticate authorized users, secure systems, and investigate misuse;</li>
              <li>organize events, broadcasts, volunteer work, and approved media;</li>
              <li>
                manage contracts, sponsors, vendors, records, insurance, accounting, and legal
                compliance; and
              </li>
              <li>
                measure program operations using aggregated or deidentified information where
                practical.
              </li>
            </ul>
            <p>
              EZ Esports does not sell personal information. It does not use student information
              for behavioral advertising or create advertising profiles about students.
              School-provided education-record information will not be used for marketing,
              advertising, or another commercial purpose.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-5" className="text-xl font-bold text-foreground scroll-mt-28">
              5. Minors
            </h2>
            <p>
              EZ Esports primarily serves high-school communities and therefore expects many
              users to be under 18. The organization will design youth-facing services with
              privacy protection by default. A person under 13 may not directly submit personal
              information through the ordinary student workflow. If participation by a child
              under 13 becomes necessary, EZ Esports must first use a process approved for
              verifiable parental consent or properly documented school authorization for an
              educational purpose, as applicable.
            </p>
            <p>
              For a New York user aged 13 through 17, EZ Esports will process information needed
              to provide a requested league or program service, maintain safety and security,
              comply with law, or carry out another permitted purpose. EZ Esports will request
              separate informed consent before optional processing that is not strictly
              necessary. The request will explain that the processing is optional, place the
              refusal option prominently, and provide a comparably easy method to withdraw
              consent.
            </p>
            <p>
              Parents and guardians may contact{' '}
              <a href="mailto:info@ezesports.org" className="text-accent hover:underline">
                info@ezesports.org
              </a>{' '}
              to ask about information associated with their child, subject to identity
              verification and rights held directly by an older minor or eligible student.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-6" className="text-xl font-bold text-foreground scroll-mt-28">
              6. When Information May Be Shared
            </h2>
            <p>EZ Esports may share information only as reasonably necessary with:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>authorized EZ Esports personnel whose roles require access;</li>
              <li>
                a student&apos;s school, advisor, coach, parent, or guardian when authorized or
                reasonably necessary for program administration or safety;
              </li>
              <li>
                hosting, database, authentication, email, form, storage, streaming,
                communications, and security providers acting under appropriate restrictions;
              </li>
              <li>
                tournament publishers and platforms when required to provide a requested
                competition and permitted by the relevant terms;
              </li>
              <li>
                professional advisers, insurers, fiscal sponsors, and auditors subject to
                appropriate confidentiality duties;
              </li>
              <li>
                government, law enforcement, or another party when required by valid legal
                process or reasonably necessary to protect a person&apos;s vital interests; or
              </li>
              <li>
                a successor organization in a lawful restructuring that accepts the same privacy
                obligations, after appropriate notice and approvals.
              </li>
            </ul>
            <p>
              EZ Esports will not publicly disclose private contact information. Public
              competition records should be limited to school or team name, game title, division,
              schedule, result, and an approved display name. A legal name, photograph, voice, or
              identifiable interview should be published only under the applicable consent.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-7" className="text-xl font-bold text-foreground scroll-mt-28">
              7. Service Providers
            </h2>
            <p>
              EZ Esports maintains an accurate internal register of every provider that can
              access personal information, the purpose of access, the data involved, location,
              retention, security terms, and deletion method. Its contracts with providers
              require confidentiality, appropriate safeguards, incident notice, purpose limits,
              deletion, and assistance with rights requests. A provider may not use student
              information for its own advertising or product development when the law or school
              agreement prohibits that use.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-8" className="text-xl font-bold text-foreground scroll-mt-28">
              8. Retention
            </h2>
            <p>
              EZ Esports will keep identifiable information only for the documented purpose and a
              reasonable legal or operational period. The approved retention schedule uses the
              following starting points:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-line">
                    <th className="py-2 pr-4 font-semibold text-foreground">Record</th>
                    <th className="py-2 font-semibold text-foreground">Starting retention rule</th>
                  </tr>
                </thead>
                <tbody>
                  {retentionSchedule.map((row) => (
                    <tr key={row.record} className="border-b border-line/60 align-top">
                      <td className="py-2 pr-4 text-foreground-secondary whitespace-normal">
                        {row.record}
                      </td>
                      <td className="py-2 text-foreground-secondary whitespace-normal">
                        {row.rule}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              When information no longer has a permitted purpose, EZ Esports will delete it,
              direct relevant providers to delete it, or deidentify it so it cannot reasonably be
              linked to a person.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-9" className="text-xl font-bold text-foreground scroll-mt-28">
              9. Security
            </h2>
            <p>
              EZ Esports will use reasonable administrative, technical, and physical safeguards
              appropriate to the information and organizational size. Its internal security plan
              requires role-based access, multifactor authentication for privileged accounts,
              encryption in transit, secure configuration, timely account removal, backups where
              needed, vendor review, staff training, incident reporting, and secure deletion.
            </p>
            <p>
              No system is perfectly secure. Users should avoid sending sensitive information
              through ordinary email or public Discord channels and should promptly report
              suspected compromise.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-10" className="text-xl font-bold text-foreground scroll-mt-28">
              10. Individual Choices &amp; Requests
            </h2>
            <p>
              Subject to identity verification and applicable law, a person may ask EZ Esports
              to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>explain whether it maintains their information;</li>
              <li>provide access to or a copy of information they supplied;</li>
              <li>correct inaccurate information;</li>
              <li>delete information that no longer must be kept;</li>
              <li>withdraw optional consent; or</li>
              <li>stop nonessential communications.</li>
            </ul>
            <p>
              Requests should be sent to{' '}
              <a href="mailto:info@ezesports.org" className="text-accent hover:underline">
                info@ezesports.org
              </a>
              . EZ Esports will acknowledge a request, verify authority, search relevant systems,
              document the result, and respond within a reasonable period required by applicable
              law or school agreement. Withdrawing consent does not make earlier authorized use
              unlawful and may not remove material already incorporated into a completed
              broadcast or printed publication, but it will stop new optional use where reasonably
              possible.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-11" className="text-xl font-bold text-foreground scroll-mt-28">
              11. Cookies &amp; Online Technologies
            </h2>
            <p>
              Strictly necessary security and authentication technologies may operate by default.
              On portions of the Services directed to minors, nonessential analytics, advertising,
              or similar tracking remain off unless valid separate consent or another lawful basis
              applies. EZ Esports does not permit targeted advertising based on student activity.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-12" className="text-xl font-bold text-foreground scroll-mt-28">
              12. Third-Party Services
            </h2>
            <p>
              Discord, Twitch, YouTube, game publishers, social networks, and other linked
              services have their own privacy practices and age requirements. EZ Esports avoids
              requiring a platform for a student when the platform&apos;s minimum age or school
              rules make that use inappropriate, and offers a reasonable advisor-based alternative
              for essential communications when practical.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-13" className="text-xl font-bold text-foreground scroll-mt-28">
              13. Changes
            </h2>
            <p>
              EZ Esports may update this Policy to reflect operational or legal changes. It will
              post the effective date and provide reasonable notice of material changes. A
              materially new optional use of a minor&apos;s information will require new consent
              where applicable. EZ Esports will preserve prior versions needed to interpret
              recorded consent.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-14" className="text-xl font-bold text-foreground scroll-mt-28">
              14. Contact
            </h2>
            <p>Privacy questions and requests may be sent to:</p>
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
