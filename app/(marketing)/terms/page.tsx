import type { Metadata } from 'next';
import Link from 'next/link';
import Hero from '@/app/components/sections/Hero';
import Section from '@/app/components/ui/Section';

export const metadata: Metadata = {
  title: 'Terms of Service | EZ Esports',
  description:
    'The terms that govern participation in EZ Esports programs, use of the ezesports.org website, conduct expectations, in-person event terms, and dispute resolution.',
};

const CONTACT_EMAIL = 'info@ezesports.org';

function EmailLink() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent hover:underline">
      {CONTACT_EMAIL}
    </a>
  );
}

export default function TermsPage() {
  const effectiveDate = 'November 25, 2026';

  return (
    <main>
      <Hero
        title="Terms of Service"
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
              These Terms of Service (&quot;Terms&quot;) govern your access to and use of the EZ Esports
              website (ezesports.org) and your participation in any EZ Esports league, tournament,
              event, program, or activity (together, the &quot;Services&quot;). EZ Esports
              (&quot;EZ Esports,&quot; &quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is a student-run,
              non-profit high-school esports league based in New York City. Please read these Terms
              carefully.
            </p>
            <p>
              These Terms work alongside our{' '}
              <Link href="/privacy" className="text-accent hover:underline">
                Privacy Policy
              </Link>{' '}
              and our{' '}
              <Link href="/rules" className="text-accent hover:underline">
                League Rulebook &amp; Code of Conduct
              </Link>
              , which explain how we handle data and govern competitive play.
            </p>
            <p>
              You can browse the public pages of our website without signing up for a program. We ask
              you to accept these Terms when you create an account or use a service that requires
              registration. Separate competition rules, consent forms, school agreements, and
              event-specific terms may apply; where a more specific document conflicts with these
              Terms for its particular program, that specific document controls.
            </p>
          </div>

          <div id="eligibility" className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">1. Acceptance &amp; Eligibility</h2>
            <p>
              The Services are intended for enrolled high-school students and for the adult advisors,
              coaches, teachers, and school administrators who support them. By using the Services you
              represent that:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-foreground">Student participants</strong> are currently
                enrolled at a recognized secondary school and meet any grade, age, and academic
                eligibility requirements set out in the applicable league rulebook.
              </li>
              <li>
                <strong className="text-foreground">Advisors, coaches, and staff</strong> are at
                least 18 years old, are affiliated with the school or club they represent, and have
                that school&apos;s authorization to act on its behalf.
              </li>
              <li>
                You will provide accurate, current, and complete information when registering or
                applying, and will keep that information up to date.
              </li>
            </ul>
            <p>
              We may refuse, suspend, or terminate access to the Services for any participant, team,
              club, or school that does not meet these eligibility requirements or that violates
              these Terms or the applicable rulebook.
            </p>
            <p>
              Anyone can browse the public website, even if they are not a student or school
              representative. A person under 13 may not submit personal information directly through
              a student form unless EZ Esports has implemented an appropriate verified parent,
              guardian, or school-authorized process. Participants under 18 must complete the
              applicable separate guardian-authorization process before participating when required.
              A student or club representative cannot bind a school, district, parent, teammate, or
              another person without legal authority. A parent or guardian may withdraw
              participation consent by contacting EZ Esports; withdrawal may end the minor’s
              participation, subject to applicable law and necessary records retention.
            </p>
          </div>

          <div id="conduct" className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">2. Acceptable Use &amp; Conduct</h2>
            <p>
              EZ Esports is built on positive, inclusive, and educational competition. Everyone who
              uses the Services is expected to treat other participants, volunteers, staff, opponents,
              spectators, and broadcast talent with respect. You agree that you will:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Practice good sportsmanship, whether winning or losing, in text, voice, and stream chat.</li>
              <li>Follow the instructions of tournament administrators, referees, event staff, and school advisors.</li>
              <li>Compete only in the division and role for which you are properly rostered and eligible.</li>
            </ul>
            <p>The following behavior is prohibited on our platforms, in official communications, and at our events:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-foreground">Harassment and hate:</strong> bullying,
                threats, sexual harassment, doxxing, or discriminatory or hateful speech targeting
                race, ethnicity, national origin, religion, disability, gender, gender identity,
                sexual orientation, or age.
              </li>
              <li>
                <strong className="text-foreground">Cheating:</strong> use of unauthorized software,
                hacks, exploits, bug abuse, or third-party assistance that provides an unfair
                competitive advantage.
              </li>
              <li>
                <strong className="text-foreground">Roster and identity fraud:</strong> smurfing,
                account sharing, ringers, playing under another person&apos;s identity, or
                misrepresenting a participant&apos;s school enrollment or eligibility.
              </li>
              <li>
                <strong className="text-foreground">Match manipulation:</strong> match-fixing,
                intentional losing, collusion, or any form of wagering or betting on EZ Esports
                matches.
              </li>
              <li>
                <strong className="text-foreground">Disruptive conduct:</strong> spamming, ban
                evasion, impersonating EZ Esports staff, sharing sexually explicit or otherwise
                age-inappropriate content, or promoting illegal activity, including underage use of
                alcohol, tobacco, or controlled substances.
              </li>
              <li>
                <strong className="text-foreground">Security abuse:</strong> attempting to gain
                unauthorized access to our systems, admin portal, or another user&apos;s account, or
                interfering with the normal operation of the Services.
              </li>
            </ul>
            <p>
              We may issue warnings, adjust match results, remove players or teams from competition,
              revoke awards, and issue temporary or permanent bans for conduct violations. Serious
              violations may be reported to the participant&apos;s school and, where appropriate, to
              law enforcement or the relevant game publisher.
            </p>
            <p>
              Users must comply with applicable law, publisher and platform rules; must not collect,
              disclose, or misuse private information, upload malware, probe systems without written
              authorization, circumvent security controls, submit content without necessary rights,
              advertise or solicit without written approval, or falsely imply endorsement by EZ
              Esports, schools, publishers, or partners. Good-faith security reports should be made
              privately to <EmailLink />.
            </p>
          </div>

          <div id="events" className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">
              3. In-Person Events, Tournament Waivers &amp; Event Rules
            </h2>
            <p>
              This Section applies to participants, spectators, and, where applicable, the parents or
              legal guardians of minor participants attending any in-person EZ Esports event,
              including LAN tournaments, finals, showcases, meetups, and watch parties (each, an
              &quot;Event&quot;).
            </p>
            <p>
              In-person tournaments and events may have separate terms, including venue rules, risk
              information, emergency contacts, and parent or guardian permissions where needed.
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-foreground">Assumption of risk:</strong> Participation in or
                attendance at an Event may involve inherent risks, including transportation, crowded
                spaces, gaming equipment, electrical cabling, physical activity, illness, and the
                conduct of other attendees. Participants acknowledge these risks and voluntarily
                participate in Events, subject to applicable law.
              </li>
              <li>
                <strong className="text-foreground">Release of liability:</strong> To the fullest
                extent permitted by law, EZ Esports and its organizers, directors, officers, staff,
                volunteers, partner schools, and venue hosts (the &quot;Released Parties&quot;) shall
                not be held liable for injury, illness, property damage, or loss arising from the
                ordinary inherent risks associated with participation in or attendance at an Event.
                Nothing in these Terms releases liability for gross negligence, reckless conduct,
                willful misconduct, or any other liability that cannot lawfully be waived. Where
                appropriate, separate event-specific waivers may be required.
              </li>
              <li>
                <strong className="text-foreground">Medical and emergency treatment:</strong>{' '}
                Participants and their parents or legal guardians, where applicable, are responsible
                for providing accurate emergency contact information and disclosing relevant medical
                conditions or allergies through the applicable Event registration process. If a
                medical emergency occurs, EZ Esports staff may contact emergency services and seek
                appropriate medical assistance. Any necessary authorization for emergency medical
                treatment of a minor participant shall be obtained separately from the
                participant’s parent or legal guardian. Responsibility for resulting medical expenses
                shall be determined in accordance with applicable law.
              </li>
              <li>
                <strong className="text-foreground">Media and photo release:</strong> Events may be
                photographed, recorded, or livestreamed for league operations, broadcasting,
                educational, and promotional purposes. Permission to use a participant’s name, image,
                likeness, voice, gameplay, or in-game handle shall be obtained where required. Any
                permission to use a minor participant’s image or likeness will be requested
                separately from their parent or legal guardian. Participants or guardians may
                contact <EmailLink /> regarding media preferences or consent withdrawal. EZ Esports
                will make reasonable efforts to accommodate these requests, subject to applicable law
                and previously authorized uses.
              </li>
              <li>
                <strong className="text-foreground">Conduct at the venue:</strong> Attendees must
                follow venue rules, staff directions, and any code of conduct provided for the Event.
                We may remove any attendee for unsafe or disruptive behavior without refund, subject
                to applicable law.
              </li>
            </ul>
            <p>
              Nothing in this Section waives any rights or protections afforded to participants or
              their parents or legal guardians under applicable law. Additional Event-specific
              requirements, permissions, and waivers may apply and must be completed before
              participation where required.
            </p>
          </div>

          <div id="liability" className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">
              4. Limitation of Liability &amp; &quot;As Is&quot; Warranty
            </h2>
            <p>
              The Services are provided on an &quot;as is&quot; and &quot;as available&quot; basis. EZ Esports is a
              volunteer-run non-profit and does not guarantee that the Services will be
              uninterrupted, error-free, secure, or free of delays, and we may modify, suspend, or
              discontinue any part of the Services, including seasons, divisions, schedules, or
              features, at any time.
            </p>
            <p>
              To the fullest extent permitted by law, we disclaim all warranties, express or implied,
              including implied warranties of merchantability, fitness for a particular purpose, and
              non-infringement.
            </p>
            <p>
              To the fullest extent permitted by law, EZ Esports and the Released Parties will not be
              liable for any indirect, incidental, special, consequential, or punitive damages, or
              for lost data, lost opportunities, or lost standing or prizes, arising out of or
              related to your use of the Services.
            </p>
            <p>
              Some jurisdictions do not allow certain limitations, so some of these limitations may
              not apply to you.
            </p>
            <p>
              Game clients, publisher platforms, Discord, streaming services, and other third-party
              tools we use to operate the league are governed by their own terms and are outside our
              control. We are not responsible for the availability, accuracy, or conduct of those
              third-party services.
            </p>
            <p>
              These Terms do not limit any rights or responsibilities that cannot be limited under
              the law. EZ Esports does not guarantee participation, selection, scheduling, prizes,
              educational outcomes, college admissions, or employment opportunities. Applications and
              interest forms do not guarantee acceptance. EZ Esports may postpone, modify, suspend,
              or cancel activities for safety, school, publisher, operational, technical, or other
              legitimate reasons, subject to applicable competition rules and appeals procedures.
              Official notices through designated EZ Esports channels control over outdated
              screenshots or reposts.
            </p>
          </div>

          <div id="ip" className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">
              5. Intellectual Property &amp; Submissions
            </h2>
            <p>
              The EZ Esports name, logo, brackets, broadcast overlays, written content, and other
              original materials are owned by EZ Esports or its licensors and are protected by
              intellectual-property laws. You may not use our marks in a way that suggests
              sponsorship or endorsement without our prior written permission. Game titles,
              characters, and related assets are the property of their respective publishers, and
              nothing in these Terms grants you rights in that material.
            </p>
            <p>You retain ownership of your content.</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                You represent that you own or have the rights to any content you submit and that it
                does not infringe the rights of others or violate Section 2.
              </li>
              <li>
                Feedback you provide is voluntary, and we are free to use it without obligation,
                attribution, or compensation to you.
              </li>
              <li>
                We may remove or decline to use any submitted content at our discretion, and we are
                not obligated to store or return it.
              </li>
            </ul>
            <p>
              If you believe content on our Services infringes your copyright, contact us at{' '}
              <EmailLink /> with a description of the work and the material at issue.
            </p>
            <p>
              Subject to these Terms, users receive a limited, revocable, nonexclusive,
              nontransferable right to access EZ Esports materials for personal, school-club, or
              approved program purposes. Commercial use or altered redistribution requires written
              permission.
            </p>
            <p>
              When submitting material for an EZ Esports program, you grant EZ Esports a
              nonexclusive, worldwide, royalty-free license to host, copy, format, display, and share
              that material only as reasonably necessary for the requested league or program purpose.
              The license ends when that purpose and the applicable retention period end, except for
              lawfully retained records and separately authorized public broadcasts. Submitting
              material does not authorize the promotional use of a minor’s name, image, likeness,
              voice, or handle; such uses require a separate, applicable media release. Copyright or
              other rights complaints should identify the claimant, relevant work or right, location
              of the material, requested action, and basis for the claim.
            </p>
          </div>

          <div id="disputes" className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">
              6. Governing Law &amp; Dispute Resolution
            </h2>
            <p>
              These Terms are governed by the laws of the State of New York, without regard to its
              conflict-of-laws rules.
            </p>
            <p>
              <strong className="text-foreground">Informal resolution first.</strong> Before starting
              a formal proceeding, you agree to contact us at <EmailLink /> and give us at least 30
              days to resolve the issue informally.
            </p>
            <p>
              Disputes may be brought before a court of competent jurisdiction in New York, subject
              to any nonwaivable rights or applicable venue rules. These Terms do not require binding
              arbitration and do not waive jury-trial or class-action rights.
            </p>
          </div>

          <div id="changes" className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">7. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. When we do, we will update the
              &quot;Last updated&quot; date at the top of this page, and we may provide additional notice for
              material changes through our website or league communications.
            </p>
            <p>
              Updates take effect on the date we identify, not before. Where required by law, a new
              material obligation or new optional use of a minor’s information will require
              affirmative consent rather than being imposed solely through continued use.
            </p>
          </div>

          <div id="contact" className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">8. Contact Us</h2>
            <p>
              If you have questions about these Terms, or need to provide notice regarding
              participation, consent, or content, please reach out to:
            </p>
            <address className="not-italic space-y-1">
              <p className="font-semibold text-foreground">EZ Esports</p>
              <p>
                Email: <EmailLink />
              </p>
              <p>New York City, NY</p>
            </address>
          </div>

          <div id="accounts" className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">9. Accounts, Security &amp; Access</h2>
            <p>
              Users must keep credentials confidential, use only their assigned accounts, and
              promptly report suspected account compromise to <EmailLink />. Staff accounts may not
              be shared. EZ Esports may restrict or disable access as reasonably necessary for
              security, safety, investigations, or competitive integrity. Internal access ends when
              the associated role ends.
            </p>
          </div>

          <div id="privacy-third-party" className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">
              10. Privacy, Cookies &amp; Third-Party Services
            </h2>
            <p>
              The EZ Esports Privacy Policy describes collection, use, disclosure, retention, and
              protection of personal information. Any applicable Cookie Notice describes online
              tracking technologies and available choices. Optional processing requires the
              applicable separate consent. Third-party platforms, including Discord, streaming
              services, publishers, and school systems, have independent terms and privacy practices;
              users and guardians should review applicable age and privacy settings.
            </p>
          </div>

          <div id="enforcement" className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">
              11. Enforcement, Notice &amp; Survival
            </h2>
            <p>
              EZ Esports may restrict or terminate access for material or repeated violations, safety
              or security threats, competition interference, or legal requirements. Where practical
              and safe, EZ Esports will provide notice and an opportunity to respond; immediate
              temporary restrictions may be necessary while serious matters are investigated.
              Provisions that by their nature should continue after termination, including
              intellectual-property rights, lawful retention, disclaimers, and dispute provisions,
              survive as applicable.
            </p>
          </div>
        </div>
      </Section>
    </main>
  );
}
