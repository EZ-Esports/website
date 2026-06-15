import type { Metadata } from 'next';
import ContentSection from '@/app/components/sections/ContentSection';
import Hero from '@/app/components/sections/Hero';

export const metadata: Metadata = {
  title: 'Privacy Policy | EZ Esports',
  description:
    'Learn how EZ Esports collects, uses, and protects information gathered through our website and league operations.',
};

export default function PrivacyPage() {
  const lastUpdated = 'June 2025';

  return (
    <main>
      <Hero
        title="Privacy Policy"
        backgroundImage="/images/hero-background.png"
        size="medium"
      />

      <ContentSection heading="" description="" theme="dark">
        <div className="max-w-3xl mx-auto space-y-10 text-foreground-secondary text-sm sm:text-base leading-relaxed">
          <p className="text-xs text-foreground-secondary/60 uppercase tracking-wider">
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
                usernames (IGNs), division placement (Varsity / JV), and performance records
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
                className="text-ez-pink hover:underline"
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

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">6. Data Retention</h2>
            <p>
              We retain personal information only as long as necessary for the purposes described
              in this policy or as required by law. League season data (standings, rosters) may be
              retained indefinitely for archival purposes. You may request deletion of your personal
              data by contacting us (see Section 9).
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">7. Security</h2>
            <p>
              We implement reasonable technical and organizational safeguards to protect information
              against unauthorized access, alteration, disclosure, or destruction. These include
              encrypted connections (HTTPS), access controls on administrative functions, and
              periodic security reviews. No method of transmission over the internet is completely
              secure, and we cannot guarantee absolute security.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">8. Third-Party Links</h2>
            <p>
              Our website may contain links to third-party platforms such as Twitch, YouTube,
              Discord, Instagram, and Twitter/X. This Privacy Policy does not apply to those sites.
              We encourage you to review the privacy policies of any third-party sites you visit.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">9. Your Rights and Choices</h2>
            <p>
              Depending on your jurisdiction, you may have rights to access, correct, or delete your
              personal information, or to object to certain processing. To exercise these rights or
              ask questions about your data, please contact us at:
            </p>
            <p>
              <a
                href="mailto:info@ezesports.org"
                className="text-ez-pink hover:underline font-medium"
              >
                info@ezesports.org
              </a>
            </p>
            <p>
              We will respond to verifiable requests within a reasonable timeframe. Some information
              may need to be retained even after a deletion request to comply with legal obligations
              or legitimate organizational interests.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. When we do, we will update the
              &quot;Last updated&quot; date at the top of this page. Continued use of our website after any
              changes constitutes your acceptance of the revised policy. We encourage you to review
              this page periodically.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">11. Contact Us</h2>
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy or our
              data practices, please reach out to:
            </p>
            <address className="not-italic space-y-1">
              <p className="font-semibold text-foreground">EZ Esports</p>
              <p>
                Email:{' '}
                <a
                  href="mailto:info@ezesports.org"
                  className="text-ez-pink hover:underline"
                >
                  info@ezesports.org
                </a>
              </p>
              <p>New York City, NY</p>
            </address>
          </div>
        </div>
      </ContentSection>
    </main>
  );
}
