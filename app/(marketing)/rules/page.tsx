import type { Metadata } from 'next';
import Link from 'next/link';
import Hero from '@/app/components/sections/Hero';
import Section from '@/app/components/ui/Section';

export const metadata: Metadata = {
  title: 'League Rulebook & Code of Conduct | EZ Esports',
  description:
    'The competitive rules, eligibility requirements, sportsmanship standards, match operations, and disciplinary and appeals process for all EZ Esports leagues and events.',
};

export default function RulesPage() {
  const lastUpdated = 'September 2026';

  const sections = [
    { id: 'section-1', label: '1. Player & Roster Eligibility' },
    { id: 'section-2', label: '2. Competitive Integrity & Anti-Cheating' },
    { id: 'section-3', label: '3. Sportsmanship & Anti-Harassment' },
    { id: 'section-4', label: '4. Match Operations & Scheduling' },
    { id: 'section-5', label: '5. Disciplinary Actions & Appeals' },
    { id: 'section-6', label: '6. Changes to the Rulebook' },
    { id: 'section-7', label: '7. Contact & Questions' },
  ];

  return (
    <main>
      <Hero
        title="League Rulebook & Code of Conduct"
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
              This League Rulebook &amp; Code of Conduct (the &quot;Rulebook&quot;) sets out the
              eligibility requirements, competitive rules, behavioral standards, match procedures, and
              disciplinary process that apply to every player, coach, advisor, club officer, and
              spectator taking part in an EZ Esports league, tournament, scrimmage, or event. EZ
              Esports is a student-run, non-profit high-school esports league based in New York City,
              and this Rulebook exists to keep competition fair, safe, and welcoming for students of
              every experience level.
            </p>
            <p>
              The Rulebook operates alongside our{' '}
              <Link href="/terms" className="text-accent hover:underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-accent hover:underline">
                Privacy Policy
              </Link>
              . By registering a team, joining a roster, or competing, you agree to follow this
              Rulebook as well as any game-specific ruleset, season handbook, or event policy we
              publish for a particular competition. Where a game-specific ruleset is silent, this
              Rulebook applies; where the two directly conflict, the game-specific ruleset controls
              for that competition unless we state otherwise. League administrators may interpret and
              apply these rules, and may rule on situations the Rulebook does not expressly cover, in
              the interest of fair play.
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
              1. Player &amp; Roster Eligibility
            </h2>
            <p>
              EZ Esports competition is for enrolled high-school students playing under the banner of
              their school. To be eligible to compete, a player must:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Be currently enrolled at the secondary school they represent, in good academic
                standing as defined by that school, and generally in grades 9&ndash;12.
              </li>
              <li>
                Be rostered before the roster lock deadline for the season and listed under their
                real name, with an in-game handle the league can verify.
              </li>
              <li>
                Have a participating adult advisor, coach, or teacher from their school on record, and
                — for players under 18 — a completed parent or guardian consent form on file.
              </li>
              <li>
                Appear on only one active roster per game title per season. A player may compete in
                multiple different game titles.
              </li>
            </ul>
            <p>
              <strong className="text-foreground">Multi-school and co-op teams.</strong> Each team
              should represent a single school. When a school does not have enough players to field a
              full roster, it may petition the league to form a combined team with one or more other
              schools. Combined teams must be approved by the league and by an advisor at every school
              involved, are placed at the discretion of league administrators, and may be limited to
              the Junior Varsity tier. Players may not switch between schools mid-season except
              through a documented school transfer.
            </p>
            <p>
              <strong className="text-foreground">Varsity vs. Junior Varsity.</strong> Most game
              titles run a Varsity tier and a Junior Varsity (JV) tier. Varsity is the school&apos;s
              top competitive team; JV is for newer players and for building depth. Tier placement is
              proposed by the school&apos;s advisor and confirmed by league administrators based on
              roster experience, prior results, and competitive balance. The league may move a team
              or an individual player between tiers between seasons, or during a season in clear cases
              of misplacement, to keep matches competitive. A player rostered on a Varsity team may
              not also play JV in the same game title.
            </p>
            <p>
              A team that competes with an ineligible player may forfeit the matches that player
              appeared in, and repeated eligibility violations may cost a team its standing or its
              place in the season.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-2" className="text-xl font-bold text-foreground scroll-mt-28">
              2. Competitive Integrity &amp; Anti-Cheating
            </h2>
            <p>
              Every match must be won on merit. The following are prohibited before, during, and
              after any EZ Esports match:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-foreground">Cheats and exploits</strong> — aimbots, wallhacks,
                scripts, macros that automate gameplay, memory editors, or the deliberate abuse of
                bugs, map exploits, or unintended mechanics to gain an advantage.
              </li>
              <li>
                <strong className="text-foreground">Unauthorized third-party software</strong> — any
                overlay, tool, or program that reads or modifies the game beyond what the publisher
                and the game-specific ruleset allow. When in doubt, ask an administrator before a
                match.
              </li>
              <li>
                <strong className="text-foreground">Ringers</strong> — fielding a player who is not on
                the team&apos;s approved roster, including a player from another school or an adult,
                whether or not they play under someone else&apos;s name.
              </li>
              <li>
                <strong className="text-foreground">Smurfing</strong> — a player competing on an
                account that hides their true skill level, or intentionally maintaining a low rank to
                be placed in a weaker division or tier.
              </li>
              <li>
                <strong className="text-foreground">Account sharing</strong> — logging into an account
                that belongs to another person, or letting another person play on your account, for
                any league match.
              </li>
              <li>
                <strong className="text-foreground">Match manipulation</strong> — match-fixing,
                intentionally losing, sandbagging, collusion between teams, or any wagering on EZ
                Esports matches.
              </li>
            </ul>
            <p>
              Players must be able to show that they are the account holder if asked, and must keep
              any match evidence the game-specific ruleset requires (for example, screenshots, replays,
              or demo files) until the result is final. Suspected violations should be reported to a
              league administrator promptly, with evidence where possible. Confirmed cheating results
              in match forfeiture at minimum and may lead to removal from the season for the player
              and, where the team knew or should have known, the team.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-3" className="text-xl font-bold text-foreground scroll-mt-28">
              3. Sportsmanship &amp; Anti-Harassment
            </h2>
            <p>
              EZ Esports is a scholastic program first. Everyone involved — players, coaches, advisors,
              casters, and spectators — is expected to help make it a positive place to compete and
              learn. You agree to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Treat opponents, teammates, officials, and viewers with respect, in victory and in defeat.</li>
              <li>Keep text, voice, and stream chat constructive, and follow the instructions of administrators and your school&apos;s advisor.</li>
              <li>Represent your school well at all times when identified with an EZ Esports team.</li>
            </ul>
            <p>The following behavior is not tolerated on any EZ Esports platform, broadcast, or event:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-foreground">Harassment and toxicity</strong> — bullying,
                threats, intimidation, stalking, sexual harassment, or targeted flaming of another
                person.
              </li>
              <li>
                <strong className="text-foreground">Hate speech</strong> — slurs or demeaning
                language directed at race, ethnicity, national origin, religion, disability, gender,
                gender identity, sexual orientation, or age.
              </li>
              <li>
                <strong className="text-foreground">Chat misconduct</strong> — excessive profanity
                aimed at a person, spam, sharing sexually explicit or age-inappropriate content, or
                sharing someone&apos;s private information without consent.
              </li>
              <li>
                <strong className="text-foreground">Unsporting conduct</strong> — deliberate
                disconnects to avoid a loss, excessive taunting, refusing to shake hands or acknowledge
                an opponent, or encouraging others to break these rules.
              </li>
            </ul>
            <p>
              Coaches and advisors are responsible for their players&apos; conduct and are expected to
              model good sportsmanship themselves. Harassment that occurs outside of a match but is
              connected to the league — for example, in a shared Discord server or on social media —
              is also covered by this section. Serious incidents may be reported to the participants&apos;
              schools and, where appropriate, to the relevant platform or to law enforcement.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-4" className="text-xl font-bold text-foreground scroll-mt-28">
              4. Match Operations &amp; Scheduling
            </h2>
            <p>
              Unless a game-specific ruleset says otherwise, the following procedures apply to every
              scheduled match:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-foreground">Check-in.</strong> Teams must check in with a
                league administrator, and have the minimum number of eligible players present and
                ready, by <strong className="text-foreground">15 minutes</strong> before the scheduled
                match time.
              </li>
              <li>
                <strong className="text-foreground">Grace period.</strong> If a team is not ready at
                match time, the opponent should notify an administrator. A team that cannot field the
                minimum number of players within <strong className="text-foreground">15 minutes</strong>{' '}
                of the scheduled start forfeits the match; if neither team is ready, the match may be
                recorded as a double forfeit.
              </li>
              <li>
                <strong className="text-foreground">Rescheduling.</strong> A match may be rescheduled
                only if both teams and a league administrator agree, and the request is made at least{' '}
                <strong className="text-foreground">48 hours</strong> before the original time, except
                in a genuine emergency. The rescheduled match must be played before the week&apos;s
                results deadline.
              </li>
              <li>
                <strong className="text-foreground">Disconnects and pauses.</strong> Follow the
                game-specific ruleset for mid-match disconnects, remakes, and technical pauses. Report
                unresolved technical problems to an administrator rather than abandoning the match.
              </li>
              <li>
                <strong className="text-foreground">Results.</strong> The winning team, or both teams,
                must report the score to the league in the required format by the season&apos;s
                reporting deadline. Disputed results are decided by league administrators based on the
                evidence submitted.
              </li>
            </ul>
            <p>
              <strong className="text-foreground">Forfeit conditions.</strong> A team may forfeit a
              match by failing to check in, failing to field the minimum roster within the grace
              period, using an ineligible player, leaving a match early without cause, or being removed
              by an administrator for a conduct violation. Repeated forfeits — generally three in a
              season — may result in the team being dropped from the remainder of the schedule, with
              its remaining and prior matches recorded as losses at the league&apos;s discretion.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-5" className="text-xl font-bold text-foreground scroll-mt-28">
              5. Disciplinary Actions &amp; Appeals
            </h2>
            <p>
              League administrators may take disciplinary action for any violation of this Rulebook, a
              game-specific ruleset, or the{' '}
              <Link href="/terms" className="text-accent hover:underline">
                Terms of Service
              </Link>
              . Actions are chosen based on the severity of the violation, its impact on others, and
              any prior history.
            </p>
            <p>
              <strong className="text-foreground">Warning tiers.</strong> Most first-time, lower-level
              violations follow an escalating path:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-foreground">Verbal or written warning</strong> — a formal
                notice to the player and their advisor that the behavior must stop.
              </li>
              <li>
                <strong className="text-foreground">In-match penalty or match forfeiture</strong> —
                loss of a map, a round, or the match, or a competitive adjustment such as a side or
                pick-ban penalty.
              </li>
              <li>
                <strong className="text-foreground">Suspension</strong> — the player or team is barred
                from a set number of matches, typically one to three, or from a set period, typically
                up to the remainder of the season for serious or repeated conduct.
              </li>
              <li>
                <strong className="text-foreground">Removal</strong> — the player, team, or club is
                removed from the season, and in the most serious cases barred from future EZ Esports
                competition. Awards and standings may be revoked.
              </li>
            </ul>
            <p>
              Serious violations — cheating, threats, hate speech, or anything that endangers another
              person — may skip directly to suspension or removal without a prior warning. The league
              may report serious violations to the participants&apos; schools.
            </p>
            <p>
              <strong className="text-foreground">Grievance and appeal workflow.</strong> A team or
              player who believes a ruling was made in error, or who wants to raise a grievance about
              another team&apos;s conduct, should follow this process:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-foreground">1. Submit in writing.</strong> Send the appeal or
                grievance to{' '}
                <a href="mailto:info@ezesports.org" className="text-accent hover:underline">
                  info@ezesports.org
                </a>{' '}
                within <strong className="text-foreground">72 hours</strong> of the ruling or
                incident, from the school advisor or with the advisor copied. Include what happened,
                the rule at issue, and any evidence.
              </li>
              <li>
                <strong className="text-foreground">2. Review.</strong> A league administrator who was
                not involved in the original decision reviews the submission, may ask both sides and
                any witnesses for more information, and issues a written decision, normally within{' '}
                <strong className="text-foreground">7 days</strong>.
              </li>
              <li>
                <strong className="text-foreground">3. Final review.</strong> If the outcome is still
                disputed, the school advisor may request a final review by league leadership within{' '}
                <strong className="text-foreground">72 hours</strong> of the decision. Their ruling is
                final.
              </li>
            </ul>
            <p>
              Filing an appeal does not automatically pause a suspension or a forfeit; the league will
              say whether the action is held during review. Retaliation against anyone for reporting a
              violation or filing a grievance in good faith is itself a violation of this Rulebook.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-6" className="text-xl font-bold text-foreground scroll-mt-28">
              6. Changes to the Rulebook
            </h2>
            <p>
              We may update this Rulebook between seasons, and occasionally during a season when a
              rule needs to be clarified or a competitive problem needs to be addressed. When we do,
              we will update the &quot;Last updated&quot; date at the top of this page, and we will
              communicate material changes through our website and league channels. In-season changes
              take effect when posted and are not applied retroactively to matches already played.
              Continuing to compete after a change means your team accepts the revised Rulebook.
            </p>
          </div>

          <div className="space-y-4">
            <h2 id="section-7" className="text-xl font-bold text-foreground scroll-mt-28">
              7. Contact &amp; Questions
            </h2>
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
