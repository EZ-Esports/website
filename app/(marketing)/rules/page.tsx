import type { Metadata } from 'next';
import Hero from '@/app/components/sections/Hero';
import Section from '@/app/components/ui/Section';

export const metadata: Metadata = {
  title: 'League Rulebook & Code of Conduct | EZ Esports',
  description:
    'Official EZ Esports League Handbook & Code of Conduct: player eligibility, competitive integrity, scholastic sportsmanship, match operations, and disciplinary appeal procedures.',
};

export default function RulesPage() {
  const effectiveDate = '2026–2027 Academic Year';
  const lastUpdated = 'September 2026';

  const sections = [
    { id: 'eligibility', title: '1. Player & Roster Eligibility' },
    { id: 'integrity', title: '2. Competitive Integrity & Anti-Cheating' },
    { id: 'sportsmanship', title: '3. Sportsmanship & Scholastic Conduct' },
    { id: 'operations', title: '4. Match Operations & Scheduling' },
    { id: 'disciplinary', title: '5. Disciplinary Actions & Formal Appeals' },
  ];

  return (
    <main>
      <Hero
        title="League Rulebook & Code of Conduct"
        subtitle="Official competitive rules, eligibility standards, match procedures, and code of conduct for EZ Esports."
        backgroundImage="/images/hero-background.jpg"
        size="medium"
      />

      <Section width="narrow">
        <div className="max-w-3xl mx-auto space-y-12 text-foreground-secondary text-sm sm:text-base leading-relaxed">
          {/* Metadata banner */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-4 text-xs text-foreground-muted uppercase tracking-wider">
            <span>Effective: {effectiveDate}</span>
            <span>Last revised: {lastUpdated}</span>
          </div>

          {/* Preamble & Mission Statement */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">Preamble &amp; Scholastic Mission</h2>
            <p>
              EZ Esports was founded by high school students to provide structured, accessible, and high-standard
              interscholastic esports competition across New York City. As an educational and community-first league,
              our competitions prioritize sportsmanship, fair play, leadership development, and academic excellence alongside
              high-level gameplay.
            </p>
            <p>
              All participating students, team captains, coaches, faculty advisors, and club officers are required to understand
              and uphold this League Rulebook &amp; Code of Conduct. Registration and participation in any EZ Esports event, match,
              or community channel constitutes unconditional acceptance of these regulations.
            </p>
          </div>

          {/* Table of Contents */}
          <nav aria-label="Table of Contents" className="p-5 rounded-2xl bg-surface-raised/60 border border-line space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Rulebook Sections</h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm font-medium">
              {sections.map((sec) => (
                <li key={sec.id}>
                  <a
                    href={`#${sec.id}`}
                    className="text-accent hover:underline flex items-center gap-1.5 transition-colors"
                  >
                    <span className="text-accent/60">#</span>
                    <span>{sec.title}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Section 1: Player & Roster Eligibility */}
          <section id="eligibility" className="space-y-6 pt-4">
            <div className="border-b border-line/60 pb-2">
              <h2 className="text-2xl font-bold text-foreground tracking-tight">1. Player &amp; Roster Eligibility</h2>
              <p className="text-xs text-accent font-semibold uppercase tracking-wider mt-1">Student, Roster &amp; School Criteria</p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-foreground">1.1 High School Enrollment &amp; Academic Standing</h3>
              <p>
                To participate in EZ Esports tournaments and regular season matches, a player must be currently enrolled as a
                full-time student in grades 9 through 12 at an accredited high school within New York City or an approved partner district.
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-sm">
                <li>
                  <strong className="text-foreground">Scholastic Standing:</strong> Students must maintain satisfactory academic standing
                  as defined by their individual high school or district policies (e.g., meeting minimum GPA or passing course thresholds).
                </li>
                <li>
                  <strong className="text-foreground">Disciplinary Standing:</strong> Students under active disciplinary suspension or
                  expulsion from their school are ineligible to compete in league fixtures during the period of their suspension.
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-foreground">1.2 Student Age &amp; Standing Limits</h3>
              <p>
                Students must not have reached their 19th birthday prior to September 1 of the current academic year. Students who have
                graduated high school or earned a high school equivalency diploma (GED) prior to the competitive season are not eligible,
                even if taking supplementary coursework.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-foreground">1.3 Varsity vs. Junior Varsity (JV) Placement</h3>
              <p>
                EZ Esports supports distinct competitive tiers to ensure balanced and fair matches for both premier competitors and developing players:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-sm">
                <li>
                  <strong className="text-foreground">Varsity Division:</strong> Represents the highest level of competitive play for a school.
                  There are no rank caps, but schools may only field their primary starting roster and registered substitutes.
                </li>
                <li>
                  <strong className="text-foreground">Junior Varsity (JV) Division:</strong> Geared toward developmental competition. Title-specific
                  in-game rank ceilings may be enforced by league operations to preserve competitive balance.
                </li>
                <li>
                  <strong className="text-foreground">Dual-Roster Restriction:</strong> A student cannot compete for both a school&apos;s Varsity
                  and JV rosters in the same game title during the same match week. If a JV player is called up to play in three (3) or more
                  Varsity matches, they become permanently locked to the Varsity roster for the remainder of the season.
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-foreground">1.4 Multi-School Teams &amp; District Consortia</h3>
              <p>
                To support students attending high schools without sufficient player headcount or an official esports program, EZ Esports
                permits multi-school consortia under strict guidelines:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-sm">
                <li>
                  A student whose school does not field a team in a particular game title may apply to join a neighboring school&apos;s roster
                  within the same educational campus or geographic borough.
                </li>
                <li>
                  All multi-school team arrangements must receive written approval from the host school&apos;s faculty advisor and official
                  clearance from EZ Esports League Operations prior to the roster lock deadline.
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-foreground">1.5 Roster Locks, Substitutes &amp; Verification</h3>
              <p>
                All team rosters must be officially submitted via the EZ Esports registration portal. Faculty advisors or club officers must verify
                player identities and in-game names (IGNs). Rosters lock 72 hours before the start of Week 1 matches. Any mid-season substitution
                requests must be submitted at least 48 hours prior to the scheduled match and approved by league administrators.
              </p>
            </div>
          </section>

          {/* Section 2: Competitive Integrity & Anti-Cheating */}
          <section id="integrity" className="space-y-6 pt-4">
            <div className="border-b border-line/60 pb-2">
              <h2 className="text-2xl font-bold text-foreground tracking-tight">2. Competitive Integrity &amp; Anti-Cheating</h2>
              <p className="text-xs text-accent font-semibold uppercase tracking-wider mt-1">Zero Tolerance for Unfair Advantages</p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-foreground">2.1 Zero Tolerance for Third-Party Software &amp; Exploits</h3>
              <p>
                EZ Esports maintains an absolute zero-tolerance policy toward cheating, hacking, and unauthorized game modification.
                Any participant found using external software or unauthorized game modifications will face immediate disciplinary expulsion.
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-sm">
                <li>
                  <strong className="text-foreground">Prohibited Tools:</strong> Aimbots, wallhacks, triggerbots, map hacks, speed hacks,
                  automated macros, network throttling software, and any memory-injecting or client-hooking utilities are strictly forbidden.
                </li>
                <li>
                  <strong className="text-foreground">Bug &amp; Glitch Exploits:</strong> Intentionally exploiting publisher-unintended glitches,
                  out-of-bounds map breaches, character model geometry exploits, or mechanics under active developer review is prohibited.
                  If an accidental glitch occurs, captains must pause the match immediately and alert league staff.
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-foreground">2.2 Smurfing, Account Sharing &amp; Ringers</h3>
              <p>
                Fair competition relies upon transparent identity. Playing under an alias or disguised account subverts the integrity of all matches:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-sm">
                <li>
                  <strong className="text-foreground">Account Ownership:</strong> Players may only compete using the primary personal account
                  registered and verified on their EZ Esports roster profile.
                </li>
                <li>
                  <strong className="text-foreground">Smurfing:</strong> Playing on secondary or lower-ranked alternate accounts to gain an unfair
                  advantage or circumvent JV division rank caps is strictly illegal.
                </li>
                <li>
                  <strong className="text-foreground">Ringers &amp; Impersonation:</strong> Permitting any individual who is not the registered student
                  to play on a registered account—or fielding non-rostered collegiate, alumni, or outside players—is considered severe fraud and will
                  result in immediate match forfeiture and team disqualification.
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-foreground">2.3 Match Recording &amp; Replay Preservation</h3>
              <p>
                For games with built-in replay tools (e.g., League of Legends, TETR.IO), both teams are required to retain match replay files.
                In titles without server-side replays (e.g., Valorant), at least one player per team is strongly recommended to record local POV footage.
                League officials reserve the right to request replay files or match recordings during any post-match investigation.
              </p>
            </div>
          </section>

          {/* Section 3: Sportsmanship & Scholastic Conduct */}
          <section id="sportsmanship" className="space-y-6 pt-4">
            <div className="border-b border-line/60 pb-2">
              <h2 className="text-2xl font-bold text-foreground tracking-tight">3. Sportsmanship &amp; Scholastic Conduct</h2>
              <p className="text-xs text-accent font-semibold uppercase tracking-wider mt-1">Representing Your School with Honor</p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-foreground">3.1 Respectful Communication &amp; Chat Standards</h3>
              <p>
                All competitors represent their respective high schools, student bodies, and communities. All communication—whether in game lobbies,
                all-chat, voice channels, official Discord servers, or social media—must reflect high standards of maturity and mutual respect.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-foreground">3.2 Prohibition of Toxic Behavior, Harassment &amp; Hate Speech</h3>
              <p>
                EZ Esports strictly forbids unsportsmanlike behavior across all league touchpoints:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-sm">
                <li>
                  <strong className="text-foreground">Toxic Chat &amp; Taunting:</strong> Excessive all-chat taunting, vulgarity, spamming,
                  and inflammatory remarks aimed at demeaning opponents or officials will not be tolerated.
                </li>
                <li>
                  <strong className="text-foreground">Zero Tolerance for Hate Speech:</strong> Any derogatory remarks, slurs, harassment, or
                  discrimination based on race, ethnicity, nationality, gender identity, sexual orientation, disability, or religion will result
                  in an immediate, indefinite league ban and formal notification to school administrators.
                </li>
                <li>
                  <strong className="text-foreground">Cyberbullying &amp; Doxxing:</strong> Targeted online harassment, doxxing, or threats of physical
                  harm directed at any student, coach, or administrator will result in immediate permanent expulsion and potential referral to authorities.
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-foreground">3.3 Representation of Schools &amp; Faculty Oversight</h3>
              <p>
                Students are accountable to both the EZ Esports Code of Conduct and their respective school district codes of behavior.
                School faculty advisors retain full authority to bench or remove students from team rosters for scholastic or behavioral infractions
                occurring either on campus or within league competition.
              </p>
            </div>
          </section>

          {/* Section 4: Match Operations & Scheduling */}
          <section id="operations" className="space-y-6 pt-4">
            <div className="border-b border-line/60 pb-2">
              <h2 className="text-2xl font-bold text-foreground tracking-tight">4. Match Operations &amp; Scheduling</h2>
              <p className="text-xs text-accent font-semibold uppercase tracking-wider mt-1">Procedures, Punctuality &amp; Reporting</p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-foreground">4.1 Official Match Times &amp; Check-In Windows</h3>
              <p>
                Matches are scheduled weekly according to the official league calendar published on the EZ Esports website. Team captains
                must check in on the official league Discord server at least 15 minutes prior to the scheduled match start time. Both teams
                must confirm readiness and exchange in-game lobby invites promptly.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-foreground">4.2 15-Minute Grace Period &amp; Forfeit Criteria</h3>
              <p>
                Punctuality is essential to maintain broadcasting schedules and respect competitors&apos; academic obligations:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-sm">
                <li>
                  <strong className="text-foreground">Grace Period:</strong> A strict 15-minute grace period from the scheduled match start
                  time is granted for technical setup or player arrival.
                </li>
                <li>
                  <strong className="text-foreground">Automatic Forfeiture:</strong> If a team is unable to field a complete, eligible roster
                  in the game lobby within 15 minutes after scheduled match time, the match is scored as an automatic forfeit (win awarded to
                  the ready team).
                </li>
                <li>
                  <strong className="text-foreground">Double Forfeit:</strong> If neither team can field a full roster by the expiration of the
                  grace period, a double forfeit will be recorded, resulting in a loss for both programs.
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-foreground">4.3 Rescheduling Protocol</h3>
              <p>
                Matches may only be rescheduled due to school-sanctioned events, campus closures, exam conflicts, or documented emergencies:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-sm">
                <li>
                  Both team captains and/or faculty advisors must agree upon a proposed new match time in writing.
                </li>
                <li>
                  Reschedule requests must be submitted to League Operations via the designated portal at least 48 hours prior to the original match time.
                </li>
                <li>
                  All rescheduled matches must be completed before the subsequent week&apos;s round of regular season competition commences.
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-foreground">4.4 Match Reporting &amp; Scoreboard Verification</h3>
              <p>
                The winning team captain is responsible for reporting final match results within two (2) hours of match completion.
                Submissions must include uncropped, clear screenshots of the end-game scoreboard displaying player in-game names, statistics,
                and victory status. The opposing captain has 24 hours to confirm or dispute the reported result.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-foreground">4.5 Technical Disconnects &amp; Pauses</h3>
              <p>
                In titles supporting in-game pauses, each team is allowed a maximum of 10 minutes of tactical or technical pause time per game.
                Pauses may only be called during freeze time or non-combat phases, with the reason clearly stated in chat. If a player disconnects,
                teams must pause immediately. Matches will not be remade unless a server-wide crash occurs within the first 60 seconds of play.
              </p>
            </div>
          </section>

          {/* Section 5: Disciplinary Actions & Formal Appeals */}
          <section id="disciplinary" className="space-y-6 pt-4">
            <div className="border-b border-line/60 pb-2">
              <h2 className="text-2xl font-bold text-foreground tracking-tight">5. Disciplinary Actions &amp; Formal Appeals</h2>
              <p className="text-xs text-accent font-semibold uppercase tracking-wider mt-1">Penalty Tiers &amp; Fair Process</p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-foreground">5.1 Tiered Penalty Structure</h3>
              <p>
                Violations of this Rulebook and Code of Conduct are assessed by the EZ Esports Rules &amp; Operations Committee under a progressive,
                tiered disciplinary framework:
              </p>

              <div className="space-y-3 mt-3">
                <div className="p-4 rounded-xl border border-line bg-surface/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-foreground">Tier 1: Formal Warning &amp; Probation</span>
                    <span className="text-[11px] font-semibold text-accent uppercase tracking-wider">Minor Infractions</span>
                  </div>
                  <p className="text-xs text-foreground-secondary">
                    Issued for minor lobby delays, first-time minor chat incivility, unverified in-game tags, or late score reporting.
                    Two Tier 1 warnings in a single season automatically trigger an escalation to Tier 2.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-line bg-surface/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-foreground">Tier 2: Match Forfeiture &amp; Player Suspension</span>
                    <span className="text-[11px] font-semibold text-accent uppercase tracking-wider">Moderate Infractions</span>
                  </div>
                  <p className="text-xs text-foreground-secondary">
                    Issued for repeated unsportsmanlike conduct, fielding an unapproved substitute, unexcused no-shows, or intentional
                    pause abuse. Results in forfeiture of the affected match and a minimum one-match suspension for involved individuals.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-line bg-surface/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-foreground">Tier 3: Multi-Week or Season Disqualification</span>
                    <span className="text-[11px] font-semibold text-accent uppercase tracking-wider">Severe Infractions</span>
                  </div>
                  <p className="text-xs text-foreground-secondary">
                    Issued for ringers, smurfing, intentional exploit abuse, toxic harassment, or intentional falsification of match records.
                    Results in loss of playoff eligibility, forfeiture of all contested points, and suspension for the remainder of the season.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-line bg-surface/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-foreground">Tier 4: Indefinite League Ban &amp; School Notice</span>
                    <span className="text-[11px] font-semibold text-accent uppercase tracking-wider">Critical Infractions</span>
                  </div>
                  <p className="text-xs text-foreground-secondary">
                    Issued for malicious cheating (hacks/scripts), hate speech, cyberbullying, doxxing, or threats of violence.
                    Results in a permanent league ban, forfeiture of school standing, and direct written notification to school principals and faculty advisors.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-foreground">5.2 Grievance &amp; Dispute Submission</h3>
              <p>
                Teams wishing to dispute a match result or report an alleged rules violation must file a formal grievance within 24 hours of
                match completion. Grievances must be emailed to{' '}
                <a href="mailto:info@ezesports.org" className="text-accent hover:underline font-medium">
                  info@ezesports.org
                </a>{' '}
                and include:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-sm">
                <li>Match ID, date, game title, and participating school names.</li>
                <li>Specific rulebook sections alleged to have been violated.</li>
                <li>Verifiable, unedited evidence (e.g., timestamps, video recordings, screenshots, chat logs).</li>
              </ul>
              <p className="text-xs text-foreground-muted">
                Unsubstantiated claims, edited screenshots, or disputes filed beyond the 24-hour window will not be reviewed.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-foreground">5.3 Formal Appeals Workflow</h3>
              <p>
                A school whose player or roster has been penalized under Tier 2 or higher may appeal the ruling through the following workflow:
              </p>
              <ol className="list-decimal pl-6 space-y-1.5 text-sm">
                <li>
                  <strong className="text-foreground">Written Notice of Appeal:</strong> Must be submitted by the school&apos;s faculty advisor
                  or designated head coach to League Operations within 48 hours of penalty notification.
                </li>
                <li>
                  <strong className="text-foreground">Committee Review:</strong> An independent three-member Appeals Board comprising non-conflicted
                  league officials and advisory board members will review the case record and evidence.
                </li>
                <li>
                  <strong className="text-foreground">Final Ruling:</strong> The Appeals Board will render a written verdict within 72 hours of appeal
                  filing. All decisions of the Appeals Board are final and binding for the competitive season.
                </li>
              </ol>
            </div>
          </section>

          {/* Contact & Governance Footer */}
          <div className="border-t border-line pt-8 space-y-3">
            <h3 className="text-base font-bold text-foreground">League Rules Administration</h3>
            <p className="text-sm">
              For questions regarding eligibility exceptions, consortium requests, or rulebook clarification, please contact our operations team:
            </p>
            <address className="not-italic text-sm space-y-1 text-foreground-secondary">
              <p className="font-semibold text-foreground">EZ Esports Rules &amp; Operations Committee</p>
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
