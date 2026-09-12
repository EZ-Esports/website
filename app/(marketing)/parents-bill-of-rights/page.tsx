import type { Metadata } from 'next';
import Link from 'next/link';
import Hero from '@/app/components/sections/Hero';
import Section from '@/app/components/ui/Section';

export const metadata: Metadata = {
  title: "Parents' Bill of Rights for Data Privacy and Security | EZ Esports",
  description:
    "EZ Esports Parents' Bill of Rights for Data Privacy and Security in compliance with New York State Education Law § 2-D and 8 NYCRR Part 121.",
};

export default function ParentsBillOfRightsPage() {
  const lastUpdated = 'September 2026';

  return (
    <main>
      <Hero
        title="Parents' Bill of Rights for Data Privacy and Security"
        subtitle="New York State Education Law § 2-D & 8 NYCRR Part 121 Compliance"
        backgroundImage="/images/hero-background.jpg"
        size="medium"
      />

      <Section width="narrow">
        <div className="max-w-3xl mx-auto space-y-10 text-foreground-secondary text-sm sm:text-base leading-relaxed">
          <p className="text-xs text-foreground-muted uppercase tracking-wider">
            Last updated: {lastUpdated}
          </p>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">Preamble &amp; Legal Framework</h2>
            <p>
              EZ Esports (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is a student-founded, non-profit high-school esports
              league operating in collaboration with educational agencies, public school districts, and high schools
              across New York City and New York State. We are committed to safeguarding the confidentiality, integrity,
              and availability of student data.
            </p>
            <p>
              In accordance with <strong>New York State Education Law § 2-D</strong>, the Regulations of the Commissioner
              of Education (<strong>8 NYCRR Part 121</strong>), and the Family Educational Rights and Privacy Act
              (<strong>FERPA</strong>, 20 U.S.C. § 1232g), EZ Esports publishes this Parents&apos; Bill of Rights for Data Privacy
              and Security. These protections apply to all parents, legal guardians, and eligible students (students who are 18
              years of age or older or attending an institution of postsecondary education) whose educational records or
              personally identifiable information (PII) are entrusted to us.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">1. Student PII Protections</h2>
            <p>
              Under New York State Education Law § 2-D, student personally identifiable information is protected by stringent
              commercial use prohibitions:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-foreground">Never Sold or Commercialized:</strong> Student PII is never sold,
                rented, leased, or released for any commercial, marketing, or advertising purposes.
              </li>
              <li>
                <strong className="text-foreground">Exclusive Educational Purpose:</strong> Student PII collected by or shared
                with EZ Esports (including student names, school affiliations, academic grade levels, and esports roster entries)
                is used exclusively for legitimate educational and extracurricular league administration purposes authorized
                by participating schools.
              </li>
              <li>
                <strong className="text-foreground">Vendor &amp; Subcontractor Obligations:</strong> Any third-party vendors,
                cloud infrastructure providers, or contractors retained by EZ Esports who receive or access student PII are
                contractually bound to abide by all data protection obligations required by New York State Education Law § 2-D,
                8 NYCRR Part 121, and FERPA. They are strictly prohibited from re-disclosing or using student PII for any
                commercial or non-authorized purpose.
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">2. Parent &amp; Eligible Student Rights</h2>
            <p>
              Parents, legal guardians, and eligible students possess defined rights regarding their education records under
              federal and state law:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-foreground">Right to Inspect &amp; Review:</strong> Parents and eligible students have the
                right to inspect and review the complete contents of the student&apos;s education records maintained by their
                school or educational agency, including any league participation data maintained on behalf of the school.
              </li>
              <li>
                <strong className="text-foreground">Right to Request Correction:</strong> Parents and eligible students have the
                right to seek amendment or correction of education records that are inaccurate, misleading, or in violation of
                the student&apos;s privacy rights. Requests for correction may be submitted to the student&apos;s educational agency
                or directly to EZ Esports via our Designated Privacy Officer, who will coordinate with the school to promptly update
                records.
              </li>
              <li>
                <strong className="text-foreground">Public Data Inventory:</strong> A complete list of all student data elements
                collected by the State of New York is available for public review from the New York State Education Department (NYSED) at{' '}
                <a
                  href="http://www.nysed.gov/data-privacy-security/student-data-inventory"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  NYSED Student Data Inventory
                </a>{' '}
                or by writing to the Chief Privacy Officer, New York State Education Department, 89 Washington Avenue, Albany, NY 12234.
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">3. Data Security &amp; Technical Safeguards</h2>
            <p>
              To maintain the confidentiality, integrity, and security of student PII, EZ Esports implements administrative,
              physical, and technical safeguards aligned with the <strong>National Institute of Standards and Technology (NIST)
              Cybersecurity Framework (CSF)</strong>, as mandated by 8 NYCRR § 121.5:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-foreground">Encryption in Transit:</strong> All data transmitted between user browsers,
                school portals, and our infrastructure is encrypted in transit using industry-standard protocols, including
                Transport Layer Security (TLS 1.2 and TLS 1.3), in accordance with 8 NYCRR § 121.3(c).
              </li>
              <li>
                <strong className="text-foreground">Encryption at Rest:</strong> All stored student PII, database tables, and
                backups are protected with modern, robust encryption at rest using Advanced Encryption Standard (AES-256)
                cryptographic mechanisms.
              </li>
              <li>
                <strong className="text-foreground">Access Control &amp; Least Privilege:</strong> Access to systems storing
                student PII is governed by strict role-based access controls (RBAC) and the principle of least privilege.
                Multi-factor authentication (MFA) is mandated for administrative access, and staff identities are subject to
                continuous verification and revocation protocols.
              </li>
              <li>
                <strong className="text-foreground">Auditing &amp; Monitoring:</strong> System activities, database queries, and
                administrative interactions are tracked via automated audit logging to prevent and detect unauthorized access.
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">4. Data Incident &amp; Breach Notification</h2>
            <p>
              EZ Esports maintains active incident detection and response procedures. In the event of a security incident, breach,
              or unauthorized disclosure of student PII:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-foreground">Prompt Agency Notification:</strong> EZ Esports commits to notifying affected
                educational agencies and partner schools without unreasonable delay, and in no event later than{' '}
                <strong>seven (7) calendar days</strong> from the discovery of the breach, in accordance with 8 NYCRR § 121.11(a).
              </li>
              <li>
                <strong className="text-foreground">Affected Parties Notice:</strong> Educational agencies will notify affected
                parents, guardians, or eligible students in accordance with statutory timelines and NYS Ed Law § 2-D requirements.
              </li>
              <li>
                <strong className="text-foreground">Investigation &amp; Remediation:</strong> EZ Esports will promptly conduct a root
                cause investigation, implement corrective countermeasures, and cooperate fully with educational agencies and state
                authorities to mitigate potential harm.
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">5. Third-Party Contractor Supplemental Information</h2>
            <p>
              In accordance with New York State Education Law § 2-D and 8 NYCRR § 121.3(c), each agreement between EZ Esports and an
              educational agency includes Supplemental Information detailing:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>The exclusive educational and extracurricular purpose for which student PII will be used.</li>
              <li>The contractual terms ensuring subcontractors and vendors abide by equivalent data privacy protections.</li>
              <li>The expiration date of the agreement and procedures for secure disposition (destruction or return) of student PII.</li>
              <li>Procedures for parents, guardians, and eligible students to challenge the accuracy of student records.</li>
              <li>The secure geographic cloud storage locations and technical encryption standards applied to student data.</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">6. Designated Privacy Officer &amp; Complaint Process</h2>
            <p>
              Parents, legal guardians, eligible students, and school administrators have the right to file complaints regarding
              suspected breaches, unauthorized releases, or improper disclosures of student data.
            </p>
            <p>
              Complaints may be submitted directly to EZ Esports&apos; Designated Privacy Officer:
            </p>
            <address className="not-italic space-y-1 p-4 rounded-xl border border-line/60 bg-surface-raised/40">
              <p className="font-semibold text-foreground">EZ Esports Designated Privacy Officer</p>
              <p>
                Email:{' '}
                <a
                  href="mailto:privacy@ezesports.org"
                  className="text-accent hover:underline font-medium"
                >
                  privacy@ezesports.org
                </a>
              </p>
              <p>New York City, NY</p>
            </address>
            <p>
              Complaints may also be submitted directly to the New York State Education Department Chief Privacy Officer:
            </p>
            <address className="not-italic space-y-1 p-4 rounded-xl border border-line/60 bg-surface-raised/40">
              <p className="font-semibold text-foreground">Chief Privacy Officer, New York State Education Department</p>
              <p>89 Washington Avenue, Albany, NY 12234</p>
              <p>
                Email:{' '}
                <a
                  href="mailto:CPO@nysed.gov"
                  className="text-accent hover:underline font-medium"
                >
                  CPO@nysed.gov
                </a>
              </p>
              <p>
                Online Complaint Filing:{' '}
                <a
                  href="https://www.nysed.gov/data-privacy-security/report-improper-disclosure"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline font-medium"
                >
                  NYSED Report an Improper Disclosure
                </a>
              </p>
            </address>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">7. Related Policies &amp; Resources</h2>
            <p>
              For more information about how EZ Esports manages user privacy across our digital services, please consult our{' '}
              <Link href="/privacy" className="text-accent hover:underline font-medium">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
      </Section>
    </main>
  );
}
