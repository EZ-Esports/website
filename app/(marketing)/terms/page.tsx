import type { Metadata } from 'next';
import Link from 'next/link';
import Hero from '@/app/components/sections/Hero';
import Section from '@/app/components/ui/Section';

export const metadata: Metadata = {
  title: 'Terms of Use | EZ Esports',
  description:
    'The Terms of Use that govern access to ezesports.org and other online services operated by EZ Esports.',
};

export default function TermsPage() {
  const effectiveDate = 'To be set upon approval';

  const sections = [
    { id: 'section-1', label: '1. Eligibility & Minors' },
    { id: 'section-2', label: '2. Accounts & Security' },
    { id: 'section-3', label: '3. Acceptable Use' },
    { id: 'section-4', label: '4. EZ Esports Content & Intellectual Property' },
    { id: 'section-5', label: '5. User Submissions' },
    { id: 'section-6', label: '6. Applications, Competitions & Availability' },
    { id: 'section-7', label: '7. Third-Party Services' },
    { id: 'section-8', label: '8. Privacy' },
    { id: 'section-9', label: '9. Copyright & Rights Concerns' },
    { id: 'section-10', label: '10. Disclaimers' },
    { id: 'section-11', label: '11. Limitation of Liability' },
    { id: 'section-12', label: '12. Enforcement & Termination' },
    { id: 'section-13', label: '13. Changes' },
    { id: 'section-14', label: '14. Governing Law & Questions' },
  ];

  return (
    <main>
      <Hero
        title="Terms of Use"
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
              These Terms of Use (&quot;Terms&quot;) govern access to ezesports.org and other online
              services that link to these Terms, including applications, registration pages,
              schedules, standings, directories, and staff portals operated by EZ Esports
              (&quot;EZ Esports,&quot; &quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). EZ Esports is a
              student-founded organization pursuing nonprofit formation, operating a high-school
              esports league based in New York City. &quot;Services&quot; means those websites and
              online features.
            </p>
            <p>
              Separate competition rules, consent forms, school agreements, and event terms may also
              apply. If a separate document conflicts with these Terms for a specific program, the
              more specific document controls for that program. By using the Services, a user agrees
              to these Terms. A person who does not agree should not use the Services. Merely viewing
              a public page does not enroll anyone in a league or bind a school.
            </p>
          </div>

          <nav aria-label="Terms sections" className="space-y-3">
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
              1. Eligibility &amp; Minors
            </h2>
            <p>
              The public informational portions of the Services are available to general visitors. A
              person must be at least 13 years old to submit personal information directly through a
              student form unless EZ Esports has established a verified parent, guardian, or
              school-authorized process for that person.
            </p>
            <p>
              Users under 18 should review these Terms with a parent or legal guardian. Participation
              in competitions, events, staff roles, or media activities may require separate guardian
              consent. A student representative may provide planning information for a school club but
              may not bind a school, district, parent, teammate, or other person unless legally
              authorized to do so.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-2" className="text-xl font-bold text-foreground scroll-mt-28">
              2. Accounts &amp; Security
            </h2>
            <p>
              Users must provide accurate information, keep credentials confidential, and use only
              accounts assigned to them. Users may not share staff accounts, bypass access controls,
              or allow another person to act under their identity. Users must promptly report
              suspected compromise to{' '}
              <a href="mailto:info@ezesports.org" className="text-accent hover:underline">
                info@ezesports.org
              </a>
              .
            </p>
            <p>
              EZ Esports may suspend or disable access when reasonably necessary to protect users,
              investigate misuse, preserve competitive integrity, or secure the Services. Access to
              internal systems ends when the related role ends.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-3" className="text-xl font-bold text-foreground scroll-mt-28">
              3. Acceptable Use
            </h2>
            <p>Users may not:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Violate law, these Terms, competition rules, publisher rules, or platform rules.</li>
              <li>
                Harass, threaten, exploit, impersonate, stalk, dox, or discriminate against another
                person.
              </li>
              <li>Collect, expose, or misuse another person&apos;s private information.</li>
              <li>
                Upload malware, probe systems without written authorization, interfere with
                operations, or evade security controls.
              </li>
              <li>
                Cheat, manipulate results, fix matches, gamble on EZ Esports competitions, or help
                another person do so.
              </li>
              <li>Submit content they do not have permission to use.</li>
              <li>Use the Services to advertise or solicit without written approval.</li>
              <li>
                Falsely suggest that EZ Esports, a school, a publisher, or a partner endorses a
                person, product, or event.
              </li>
            </ul>
            <p>
              Good-faith security reports should be sent privately to{' '}
              <a href="mailto:info@ezesports.org" className="text-accent hover:underline">
                info@ezesports.org
              </a>
              . Public disclosure of a vulnerability before EZ Esports has a reasonable opportunity to
              investigate may place users at risk.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-4" className="text-xl font-bold text-foreground scroll-mt-28">
              4. EZ Esports Content &amp; Intellectual Property
            </h2>
            <p>
              The Services, including original text, league graphics, software, databases, schedules,
              formats, and audiovisual material, may be protected by copyright, trademark, and other
              laws. Subject to these Terms, EZ Esports grants users a limited, revocable, nonexclusive,
              nontransferable right to access the Services for personal, school-club, or approved
              program use.
            </p>
            <p>
              No license is granted to use EZ Esports names, logos, broadcast packages, or other brand
              assets for commercial purposes or to imply endorsement. Schools and teams may share
              approved league materials to promote their participation if they preserve credits and do
              not materially alter the content.
            </p>
            <p>
              Game titles, publisher names, logos, artwork, and other third-party materials belong to
              their respective owners. EZ Esports is not affiliated with or endorsed by a game
              publisher unless a specific written statement says otherwise.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-5" className="text-xl font-bold text-foreground scroll-mt-28">
              5. User Submissions
            </h2>
            <p>
              Users retain ownership of original material they submit. By submitting material for a
              requested league purpose, the user gives EZ Esports a nonexclusive, worldwide,
              royalty-free license to host, copy, format, and share the material only as reasonably
              necessary to provide that purpose. The license ends when the purpose and required
              retention period end, except for material already incorporated into an authorized public
              record or broadcast.
            </p>
            <p>
              Media involving a minor is governed by the applicable participant and guardian release.
              EZ Esports will not treat a general website submission as permission to use a minor&apos;s
              identity or likeness in sponsor advertising.
            </p>
            <p>
              Users represent that their submissions are accurate to the best of their knowledge and
              that they have permission to submit them. EZ Esports may remove content that violates
              these Terms, another person&apos;s rights, safety rules, or legal obligations.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-6" className="text-xl font-bold text-foreground scroll-mt-28">
              6. Applications, Competitions &amp; Availability
            </h2>
            <p>
              An application or interest form does not guarantee acceptance, schedule availability, a
              particular title, a roster spot, a broadcast, a prize, or continued participation. EZ
              Esports may change, postpone, suspend, or cancel a feature or program when reasonably
              necessary because of participation levels, school restrictions, publisher requirements,
              safety, technical failures, or circumstances outside its control.
            </p>
            <p>
              Competition decisions follow the applicable rules and appeal process. Website standings
              and schedules may contain errors or change after review. Official notices sent through
              designated league channels control over stale screenshots or third-party reposts.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-7" className="text-xl font-bold text-foreground scroll-mt-28">
              7. Third-Party Services
            </h2>
            <p>
              The Services may link to or interact with Discord, Twitch, YouTube, game publishers,
              social networks, school systems, and other third-party services. Their terms and privacy
              practices apply separately. EZ Esports does not control those services and cannot
              guarantee their availability, security, content, or accessibility. Users and guardians
              should review the age requirements and privacy settings of each service before use.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-8" className="text-xl font-bold text-foreground scroll-mt-28">
              8. Privacy
            </h2>
            <p>
              The{' '}
              <Link href="/privacy" className="text-accent hover:underline">
                Privacy Policy
              </Link>{' '}
              explains how EZ Esports collects, uses, shares, retains, and protects personal
              information. Optional consent is governed by the language shown when consent is
              requested and may be withdrawn as described there.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-9" className="text-xl font-bold text-foreground scroll-mt-28">
              9. Copyright &amp; Rights Concerns
            </h2>
            <p>
              A person who believes content on the Services infringes their copyright, privacy,
              publicity, or other rights may email{' '}
              <a href="mailto:info@ezesports.org" className="text-accent hover:underline">
                info@ezesports.org
              </a>{' '}
              with their contact information, the work or right at issue, the location of the
              material, the requested action, and a statement explaining the basis of the request. EZ
              Esports may request verification and will review good-faith notices promptly.
            </p>
            <p>
              EZ Esports has not designated a formal agent under the Digital Millennium Copyright Act
              and does not claim the formal safe-harbor procedures available under that law.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-10" className="text-xl font-bold text-foreground scroll-mt-28">
              10. Disclaimers
            </h2>
            <p>
              To the fullest extent permitted by law, the Services are provided as available without
              warranties that they will be uninterrupted, error-free, secure, or suitable for a
              particular purpose. Nothing in these Terms excludes a warranty or responsibility that law
              does not permit EZ Esports to exclude.
            </p>
            <p>
              EZ Esports provides an extracurricular program and does not provide legal, medical,
              mental-health, educational-placement, employment, or college-admissions advice.
              References to professional development describe program goals, not guaranteed
              employment or academic outcomes.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-11" className="text-xl font-bold text-foreground scroll-mt-28">
              11. Limitation of Liability
            </h2>
            <p>
              To the fullest extent permitted by law, EZ Esports and its directors, officers, staff,
              and volunteers will not be liable for indirect, incidental, special, exemplary, or
              consequential damages arising from use of the Services. This limitation does not apply
              to liability that cannot lawfully be limited, including as applicable liability for
              intentional misconduct, gross negligence, or legally protected rights.
            </p>
            <p>
              These Terms do not ask a minor or guardian to waive claims that New York law does not
              permit them to waive. Event-specific risks and insurance should be addressed separately.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-12" className="text-xl font-bold text-foreground scroll-mt-28">
              12. Enforcement &amp; Termination
            </h2>
            <p>
              EZ Esports may restrict or terminate access for material or repeated violations, threats
              to safety or security, interference with competitions, or legal requirements. When
              practical and safe, EZ Esports will provide notice and an opportunity to respond.
              Immediate temporary action may occur while a serious matter is investigated.
            </p>
            <p>
              Sections that by their nature should continue after termination, including intellectual
              property, records, disclaimers, and permitted limitations of liability, will survive.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-13" className="text-xl font-bold text-foreground scroll-mt-28">
              13. Changes
            </h2>
            <p>
              EZ Esports may update these Terms prospectively. This page will identify the effective
              date, and material changes will receive reasonable notice. When a change creates a new
              material obligation or authorizes a new optional use of a minor&apos;s data, EZ Esports
              will seek new consent where required rather than relying only on continued use.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-14" className="text-xl font-bold text-foreground scroll-mt-28">
              14. Governing Law &amp; Questions
            </h2>
            <p>
              New York law governs these Terms without regard to conflict-of-law rules. Any dispute
              that cannot be resolved informally may be brought in a court with lawful jurisdiction in
              New York, subject to rights that cannot be waived. These Terms do not require
              arbitration or waive class-action rights.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">Contact Us</h2>
            <p>
              Questions about these Terms may be sent to:
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
