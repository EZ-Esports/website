import type { Metadata } from 'next';
import Hero from '@/app/components/sections/Hero';
import Section from '@/app/components/ui/Section';

export const metadata: Metadata = {
  title: 'Privacy Policy | EZ Esports',
  description:
    'Learn how EZ Esports collects, uses, and protects information gathered through our website and league operations.',
};

export default function PrivacyPage() {
  const lastUpdated = 'September 2026';

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
            Last updated: {lastUpdated}
          </p>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">1. Introduction</h2>
            <p>
              EZ Esports (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) operates as a student-run, non-profit
              high-school esports league based in New York City. We are committed to protecting the
              privacy of all visitors to our website (ezesports.org) and all students, coaches, and
              school administrators who participate in our programs. This Privacy Policy explains
              what information we collect, how we use it, and your rights regarding that information.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">2. Information We Collect</h2>
            <p>We may collect the following categories of information:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-foreground">Contact and identification information</strong> — name,
                school name, email address, and role (e.g., student, coach, administrator) submitted
                through application or contact forms.
              </li>
              <li>
                <strong className="text-foreground">Usage data</strong> — browser type, pages visited,
                referring URLs, and general geographic region collected automatically through standard
                server logs and analytics tools.
              </li>
              <li>
                <strong className="text-foreground">Player and roster information</strong> — in-game
                usernames, division placement (Varsity / Junior Varsity), and performance records
                entered by authorized school staff for league management purposes.
              </li>
              <li>
                <strong className="text-foreground">Communications</strong> — content of messages sent
                to us via email or contact forms.
              </li>
            </ul>
            <p>
              We do not knowingly collect personal information from children under 13. If you
              believe a child under 13 has submitted information to us without parental consent,
              please contact us at{' '}
              <a
                href="mailto:info@ezesports.org"
                className="text-accent hover:underline"
              >
                info@ezesports.org
              </a>{' '}
              so we can remove it promptly.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Process school applications and respond to inquiries.</li>
              <li>Operate, maintain, and improve league standings, schedules, and rosters.</li>
              <li>Send administrative communications about league events, schedule changes, or
                important announcements.</li>
              <li>Analyze aggregate usage trends to improve our website and services.</li>
              <li>Comply with applicable laws and protect the rights and safety of our
                participants.</li>
            </ul>
            <p>
              We do not sell, rent, or trade your personal information to third parties for
              marketing purposes.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">4. Cookies and Tracking</h2>
            <p>
              Our website may use cookies and similar technologies to maintain session state (e.g.,
              for our staff admin portal) and to collect aggregate analytics data. You may disable
              cookies through your browser settings; note that some site functionality (such as the
              admin portal) may not work correctly without cookies.
            </p>
            <p>
              We may use third-party analytics services (e.g., Vercel Analytics) that collect
              anonymized usage data under their own privacy policies. No individually identifiable
              data is shared with these services.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">5. Data Sharing and Disclosure</h2>
            <p>We may share information in the following limited circumstances:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-foreground">Service providers</strong> — trusted vendors who
                assist with hosting, database infrastructure, or email delivery, bound by
                confidentiality obligations.
              </li>
              <li>
                <strong className="text-foreground">School administrators</strong> — roster and player
                data may be shared with the relevant school&apos;s authorized staff.
              </li>
              <li>
                <strong className="text-foreground">Legal requirements</strong> — when required by law,
                court order, or governmental authority.
              </li>
              <li>
                <strong className="text-foreground">Safety</strong> — to protect the safety and
                well-being of our participants or the public.
              </li>
            </ul>
          </div>

          <div id="media-minor-likeness" className="space-y-4 scroll-mt-28">
            <h2 className="text-xl font-bold text-foreground">
              6. Media Broadcasts, Event Photography &amp; Minor Likeness Rights
            </h2>
            <p>
              As a scholastic esports league celebrating student achievements across New York City, EZ Esports produces public live match broadcasts, captures event photography, and publishes tournament results:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-foreground">Live Streaming &amp; Broadcasts</strong> — Competitive league matches may be live-streamed and archived on public video platforms including Twitch and YouTube. Broadcasts may include live in-game gameplay, player camera feeds, caster commentary, and student gamer tags.
              </li>
              <li>
                <strong className="text-foreground">Event Photography &amp; Community Gallery</strong> — In-person events such as LAN finals, seasonal tournaments, workshops, and championship celebrations may be photographed. Selected high-resolution photographs showcasing participants, teams, and attendees may appear in our public community gallery, on our website, or in official league announcements.
              </li>
              <li>
                <strong className="text-foreground">Public Match Scoreboards &amp; Standings</strong> — Official match outcomes, scores, leaderboards, and team rosters (displaying student gamer tags and school affiliations) are made publicly available to ensure competitive transparency and celebrate student performance.
              </li>
            </ul>
            <p>
              <strong className="text-foreground">Parental/Guardian Consent &amp; School Verification:</strong> Because the majority of our student competitors are minors enrolled in high school, participating schools (via their designated faculty advisor, coach, or club leadership) are required to verify that they have obtained requisite parental or guardian media release forms or confirmed compliance with their local school district&apos;s media consent regulations (such as NYC Public Schools media consent policies) prior to submitting students for public broadcast rosters or event photography.
            </p>
            <div className="bg-surface-raised/40 border border-line/60 rounded-xl p-4 sm:p-5 space-y-3">
              <h3 className="text-base font-bold text-foreground">
                Privacy Holds &amp; Media Opt-Out Procedure for Students, Parents, and Faculty
              </h3>
              <p>
                We respect the privacy and safety of all participants. Students with active privacy flags, protective court orders, sensitive family situations, or personal objections—as well as their parents, legal guardians, or school faculty—may opt out of event photography and public likeness display at any time without forfeiting league participation:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong className="text-foreground">How to Request an Opt-Out:</strong> Submit a written request to{' '}
                  <a
                    href="mailto:privacy@ezesports.org"
                    className="text-accent hover:underline font-semibold"
                  >
                    privacy@ezesports.org
                  </a>{' '}
                  specifying the student&apos;s name, school, current gamer tag, and desired accommodations (e.g., photography opt-out, broadcast camera suppression, or full scoreboard anonymity).
                </li>
                <li>
                  <strong className="text-foreground">Anonymized Gamer Tags &amp; Scoreboards:</strong> Approved privacy-hold participants may compete under anonymized, randomized player aliases (e.g., &quot;Player 1&quot; or designated pseudonyms) on public match scoreboards and broadcast overlays to protect their real-world identities.
                </li>
                <li>
                  <strong className="text-foreground">Takedown &amp; Photo Modification:</strong> If a student with an active privacy hold is identified in any community gallery photo or broadcast archive, we will promptly blur, crop, or remove the media upon notice to{' '}
                  <a
                    href="mailto:privacy@ezesports.org"
                    className="text-accent hover:underline font-semibold"
                  >
                    privacy@ezesports.org
                  </a>
                  .
                </li>
              </ul>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">7. Data Retention</h2>
            <p>
              We retain personal information only as long as necessary for the purposes described
              in this policy or as required by law. League season data (standings, rosters) may be
              retained indefinitely for archival purposes. You may request deletion of your personal
              data by contacting us (see Section 10).
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">8. Security</h2>
            <p>
              We implement reasonable technical and organizational safeguards to protect information
              against unauthorized access, alteration, disclosure, or destruction. These include
              encrypted connections (HTTPS), access controls on administrative functions, and
              periodic security reviews. No method of transmission over the internet is completely
              secure, and we cannot guarantee absolute security.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">9. Third-Party Links</h2>
            <p>
              Our website may contain links to third-party platforms such as Twitch, YouTube,
              Discord, Instagram, and Twitter/X. This Privacy Policy does not apply to those sites.
              We encourage you to review the privacy policies of any third-party sites you visit.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">10. Your Rights and Choices</h2>
            <p>
              Depending on your jurisdiction, you may have rights to access, correct, or delete your
              personal information, or to object to certain processing. To exercise these rights or
              ask questions about your data, please contact us at:
            </p>
            <p className="flex flex-wrap gap-x-4 gap-y-1">
              <a
                href="mailto:info@ezesports.org"
                className="text-accent hover:underline font-medium"
              >
                info@ezesports.org
              </a>
              <span className="text-foreground-muted">·</span>
              <a
                href="mailto:privacy@ezesports.org"
                className="text-accent hover:underline font-medium"
              >
                privacy@ezesports.org
              </a>
            </p>
            <p>
              We will respond to verifiable requests within a reasonable timeframe. Some information
              may need to be retained even after a deletion request to comply with legal obligations
              or legitimate organizational interests.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. When we do, we will update the
              &quot;Last updated&quot; date at the top of this page. Continued use of our website after any
              changes constitutes your acceptance of the revised policy. We encourage you to review
              this page periodically.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">12. Contact Us</h2>
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy, media
              releases, privacy holds, or our data practices, please reach out to:
            </p>
            <address className="not-italic space-y-1">
              <p className="font-semibold text-foreground">EZ Esports</p>
              <p>
                General Inquiries:{' '}
                <a
                  href="mailto:info@ezesports.org"
                  className="text-accent hover:underline"
                >
                  info@ezesports.org
                </a>
              </p>
              <p>
                Privacy &amp; Media Release Holds:{' '}
                <a
                  href="mailto:privacy@ezesports.org"
                  className="text-accent hover:underline"
                >
                  privacy@ezesports.org
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
