import type { Metadata } from 'next';
import Link from 'next/link';
import Hero from '@/app/components/sections/Hero';
import Section from '@/app/components/ui/Section';

export const metadata: Metadata = {
  title: 'Terms of Service | EZ Esports',
  description:
    'The terms that govern participation in EZ Esports programs, use of the ezesports.org website, conduct expectations, event waivers, and dispute resolution.',
};

export default function TermsPage() {
  const lastUpdated = 'September 2025';

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
            Last updated: {lastUpdated}
          </p>

          <div className="space-y-4">
            <p>
              These Terms of Service (&quot;Terms&quot;) govern your access to and use of the EZ Esports
              website (ezesports.org) and your participation in any EZ Esports league, tournament,
              event, program, or activity (together, the &quot;Services&quot;). EZ Esports
              (&quot;EZ Esports,&quot; &quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is a student-run,
              non-profit high-school esports league based in New York City. Please read these Terms
              carefully. By using the Services, registering a school or club, submitting an
              application, or attending an event, you agree to be bound by these Terms.
            </p>
            <p>
              These Terms work alongside our{' '}
              <Link href="/privacy" className="text-accent hover:underline">
                Privacy Policy
              </Link>
              , which explains how we collect, use, and protect information. By agreeing to these
              Terms you also acknowledge the practices described in the Privacy Policy. Where a
              specific league rulebook, competitive ruleset, or event-specific policy applies, that
              document supplements these Terms; if there is a direct conflict, these Terms control
              unless the other document expressly states otherwise.
            </p>
          </div>

          <div className="space-y-4">
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
              <strong className="text-foreground">Consent for minors.</strong> Any participant under
              the age of 18 must have a parent or legal guardian review and consent to these Terms,
              including the event waiver in Section 3, before participating. We may require a signed
              parent or guardian consent form, and a school-affiliated adult advisor must supervise
              student participation. A parent or guardian may withdraw consent for their child at any
              time by contacting us, after which that student&apos;s participation will end.
            </p>
            <p>
              We may refuse, suspend, or terminate access to the Services for any participant, team,
              club, or school that does not meet these eligibility requirements or that violates
              these Terms or the applicable rulebook.
            </p>
          </div>

          <div className="space-y-4">
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
                <strong className="text-foreground">Harassment and hate</strong> — bullying,
                threats, sexual harassment, doxxing, or discriminatory or hateful speech targeting
                race, ethnicity, national origin, religion, disability, gender, gender identity,
                sexual orientation, or age.
              </li>
              <li>
                <strong className="text-foreground">Cheating</strong> — use of unauthorized software,
                hacks, exploits, bug abuse, or third-party assistance that provides an unfair
                competitive advantage.
              </li>
              <li>
                <strong className="text-foreground">Roster and identity fraud</strong> — smurfing,
                account sharing, ringers, playing under another person&apos;s identity, or
                misrepresenting a participant&apos;s school enrollment or eligibility.
              </li>
              <li>
                <strong className="text-foreground">Match manipulation</strong> — match-fixing,
                intentional losing, collusion, or any form of wagering or betting on EZ Esports
                matches.
              </li>
              <li>
                <strong className="text-foreground">Disruptive conduct</strong> — spamming, ban
                evasion, impersonating EZ Esports staff, sharing sexually explicit or otherwise
                age-inappropriate content, or promoting illegal activity, including underage use of
                alcohol, tobacco, or controlled substances.
              </li>
              <li>
                <strong className="text-foreground">Security abuse</strong> — attempting to gain
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
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">
              3. In-Person / LAN Tournament Waiver
            </h2>
            <p>
              This Section applies to any participant, and to the parent or legal guardian of any
              participant under 18, who attends or competes in a physical EZ Esports event, including
              LAN tournaments, finals, showcases, meetups, and watch parties (each, an &quot;Event&quot;).
              By attending or allowing a child to attend an Event, you agree to the following:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-foreground">Assumption of risk.</strong> Attendance at an
                Event involves inherent risks, including travel to and from the venue, crowded
                spaces, equipment and cabling, physical activity, illness, and the actions of other
                attendees. You knowingly and voluntarily accept these risks on your own behalf and,
                if applicable, on behalf of the minor participant.
              </li>
              <li>
                <strong className="text-foreground">Release of liability.</strong> To the fullest
                extent permitted by law, you release and agree not to sue EZ Esports and its
                organizers, volunteers, staff, directors, partner schools, and venue hosts (the
                &quot;Released Parties&quot;) from claims for injury, illness, loss, or damage to person or
                property arising out of participation in or attendance at an Event, except for injury
                or damage caused by a Released Party&apos;s gross negligence or willful misconduct.
              </li>
              <li>
                <strong className="text-foreground">Medical and emergency treatment.</strong> If you
                or the minor participant needs medical attention during an Event and a parent or
                guardian cannot be reached, you authorize EZ Esports staff to seek and consent to
                emergency medical care, and you are responsible for the resulting costs. You are
                responsible for disclosing relevant medical conditions, allergies, and emergency
                contact information on the Event registration form.
              </li>
              <li>
                <strong className="text-foreground">Media and photo release.</strong> Events may be
                photographed, recorded, and streamed. You grant EZ Esports permission to capture and
                use your (or the minor participant&apos;s) name, image, likeness, voice, gameplay,
                and in-game handle in photos, video, broadcasts, highlights, and promotional
                materials, in any medium, without additional compensation. If you do not want a
                participant featured, notify us in writing before the Event and identify the
                participant to Event staff on arrival; we will make reasonable efforts to
                accommodate, though incidental capture in wide or crowd shots may still occur.
              </li>
              <li>
                <strong className="text-foreground">Conduct at the venue.</strong> Attendees must
                follow venue rules, staff directions, and any code of conduct provided for the Event.
                We may remove any attendee for unsafe or disruptive behavior without refund.
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">
              4. Limitation of Liability &amp; &quot;As Is&quot; Warranty
            </h2>
            <p>
              The Services are provided on an &quot;as is&quot; and &quot;as available&quot; basis. EZ Esports is a
              volunteer-run non-profit and does not guarantee that the Services will be
              uninterrupted, error-free, secure, or free of delays, and we may modify, suspend, or
              discontinue any part of the Services, including seasons, divisions, schedules, or
              features, at any time. To the fullest extent permitted by law, we disclaim all
              warranties, express or implied, including implied warranties of merchantability,
              fitness for a particular purpose, and non-infringement.
            </p>
            <p>
              To the fullest extent permitted by law, EZ Esports and the Released Parties will not be
              liable for any indirect, incidental, special, consequential, or punitive damages, or
              for lost data, lost opportunities, or lost standing or prizes, arising out of or
              related to your use of the Services. Our total aggregate liability for any claim
              relating to the Services will not exceed one hundred U.S. dollars (US $100), or the
              amount you paid to EZ Esports in connection with the matter giving rise to the claim,
              whichever is greater. Some jurisdictions do not allow certain limitations, so some of
              these limitations may not apply to you.
            </p>
            <p>
              Game clients, publisher platforms, Discord, streaming services, and other third-party
              tools we use to operate the league are governed by their own terms and are outside our
              control. We are not responsible for the availability, accuracy, or conduct of those
              third-party services.
            </p>
          </div>

          <div className="space-y-4">
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
            <p>
              <strong className="text-foreground">Your content and feedback.</strong> If you submit
              content to us, such as team logos, highlight clips, screenshots, written entries,
              artwork, or forum and application-form responses, or if you send us feedback,
              suggestions, or ideas, you grant EZ Esports a worldwide, non-exclusive, royalty-free,
              transferable, sublicensable license to use, reproduce, display, distribute, adapt, and
              create derivative works from that content for the purposes of operating, promoting, and
              improving the league and its broadcasts. You retain ownership of your content.
            </p>
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
              <a href="mailto:info@ezesports.org" className="text-accent hover:underline">
                info@ezesports.org
              </a>{' '}
              with a description of the work and the material at issue.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">
              6. Governing Law &amp; Dispute Resolution
            </h2>
            <p>
              These Terms are governed by the laws of the State of New York, without regard to its
              conflict-of-laws rules. Subject to the arbitration provision below, you agree that the
              exclusive venue for any dispute that is not arbitrated will be the state or federal
              courts located in the County of New York, State of New York, and you consent to the
              personal jurisdiction of those courts.
            </p>
            <p>
              <strong className="text-foreground">Informal resolution first.</strong> Before starting
              a formal proceeding, you agree to contact us at{' '}
              <a href="mailto:info@ezesports.org" className="text-accent hover:underline">
                info@ezesports.org
              </a>{' '}
              and give us at least 30 days to resolve the issue informally.
            </p>
            <p>
              <strong className="text-foreground">Binding arbitration.</strong> If we cannot resolve
              a dispute informally, it will be settled by final and binding arbitration administered
              in the County of New York under the rules of a recognized arbitration provider, before
              a single arbitrator, rather than in court, except that either party may bring an
              individual claim in small-claims court. Disputes will be handled on an individual
              basis; to the extent permitted by law, you and EZ Esports each waive any right to a
              jury trial and to participate in a class or representative action. Nothing in this
              Section prevents either party from seeking injunctive relief in court to protect
              intellectual-property rights or address unauthorized access to the Services. Where a
              participant is a minor, this Section is agreed to by the participant&apos;s parent or
              legal guardian on the participant&apos;s behalf. If any part of this Section is found
              unenforceable, the remainder stays in effect, except that if the class-action waiver is
              held unenforceable, this arbitration provision will not apply to that dispute.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">7. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. When we do, we will update the
              &quot;Last updated&quot; date at the top of this page, and we may provide additional notice for
              material changes through our website or league communications. Changes are effective
              when posted. Your continued use of the Services after an update means you accept the
              revised Terms; if you do not agree, you should stop using the Services.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">8. Contact Us</h2>
            <p>
              If you have questions about these Terms, or need to provide notice regarding
              participation, consent, or content, please reach out to:
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
