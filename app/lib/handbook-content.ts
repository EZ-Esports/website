/**
 * Built-in text of the 2026-27 Student Handbook, rendered by /handbook when
 * staff have not uploaded a PDF. Converted from the leadership team's
 * interactive pamphlet (last modified October 18, 2026).
 *
 * This is the fallback, not the source of truth: once staff upload a PDF the
 * page leads with it. Edit this file only to refresh the fallback copy.
 */

export type HandbookInline = string | { text: string; href: string };

export type HandbookBlock =
  | { type: 'paragraph'; content: HandbookInline[] }
  | { type: 'list'; items: HandbookInline[][] }
  | { type: 'timeline'; items: { when: string; content: HandbookInline[] }[] }
  | { type: 'note'; content: HandbookInline[] };

export interface HandbookSection {
  id: string;
  title: string;
  blocks: HandbookBlock[];
}

export const HANDBOOK_EDITION = '2026-27 · 5th Year Anniversary';
export const HANDBOOK_LAST_MODIFIED = 'October 18, 2026';
export const HANDBOOK_GOOGLE_DOC_URL =
  'https://docs.google.com/document/d/1ACCrJu9b9_rNjE7yoT28Tb0EeK5z2QPvoMSnjqkPm8U/edit?usp=sharing';

const DISCORD = 'https://discord.com/invite/RajSZqNyvu';
const TICKET = 'https://discord.com/channels/1022187805742469212/1024423188777680896/1547425917926908006';
const INSTAGRAM = 'https://www.instagram.com/e.z.esports/';
const TWITCH = 'https://www.twitch.tv/ezesportsNYC';

const openTicket: HandbookInline[] = [
  { text: 'Open a Ticket', href: TICKET },
  ' (join our Discord → find “#open-a-ticket”)',
];

export const HANDBOOK_SECTIONS: HandbookSection[] = [
  {
    id: 'key-links',
    title: '0. Key Links',
    blocks: [
      {
        type: 'list',
        items: [
          ['Discord (where the majority of matches and community events are facilitated): ', { text: 'discord.com/invite/RajSZqNyvu', href: DISCORD }],
          ['Website (rosters, schedules, stats; applications are always submitted and displayed here): ', { text: 'ezesports.org', href: '/' }],
          ['Register your school’s interest: ', { text: 'ezesports.org/apply', href: '/apply' }],
          ['Instagram (all updates and announcements, plus previous event pics): ', { text: 'instagram.com/e.z.esports', href: INSTAGRAM }],
          ['Twitch Partnered (live broadcasts): ', { text: 'twitch.tv/ezesportsNYC', href: TWITCH }],
          ['YouTube (reviving!): ', { text: 'youtube.com/@ezesportsnyc', href: 'https://www.youtube.com/@ezesportsnyc' }],
          ['LinkedIn: ', { text: 'linkedin.com/company/nyc-ez-esports', href: 'https://www.linkedin.com/company/nyc-ez-esports' }],
          ['Email: ', { text: 'ezesportsleague@gmail.com', href: 'mailto:ezesportsleague@gmail.com' }],
          ['All student inquiries or feedback: ', ...openTicket],
        ],
      },
    ],
  },
  {
    id: 'who-we-are',
    title: '1. Who and what is EZ Esports?',
    blocks: [
      {
        type: 'paragraph',
        content: [
          'In 2021, we were a group of high schoolers at different schools across NYC who wanted to compete against each other in video games. A high school senior led the initiative to bring our schools and video game club leaders together, and we built nonprofit EZ Esports: the New York City High School Esports League. Today, we organize over 300 interschool matches each year across dozens of schools. Our mission is to shape the leaders of tomorrow through their passion for esports today. You can read more here: ',
          { text: 'SILive News Article (non-paywall version)', href: 'https://web.archive.org/web/20240826100640/https://www.silive.com/sports/2023/01/game-on-susan-wagner-student-spurred-a-city-wide-esports-league-which-is-now-home-to-hundreds-of-members.html' },
          '.',
        ],
      },
      {
        type: 'paragraph',
        content: [
          '98% of EZ Esports staff are volunteer NYC Public School students, teachers, or alumni, and every year, about ⅓ of our student-staff get accepted to top-25 nationally ranked universities (view our legacy of staff on our ',
          { text: 'Leadership pages', href: '/leadership' },
          '). Based on a survey of over 1,000 students who played in an EZ Esports match, 85% say more infrastructure for interschool esports would better support their academic extracurricular interests and 77% say they had developed stronger teamwork and communication skills.',
        ],
      },
    ],
  },
  {
    id: 'games',
    title: '2. What games are organized?',
    blocks: [
      {
        type: 'paragraph',
        content: [
          'Each year, we choose which games to organize based on expressed interest from community members and school esports club leaders. Please express interest any time on our ',
          { text: 'Discord', href: DISCORD },
          '! Some are organized in the form of periodic and large open community-based short tournaments, others in the form of our flagship annual interschool league!',
        ],
      },
      { type: 'paragraph', content: ['In the past, we’ve hosted:'] },
      {
        type: 'list',
        items: [
          ['Rocket League'],
          ['Teamfight Tactics'],
          ['osu!'],
          ['Tetr.io'],
          ['Minecraft'],
          ['Call of Duty'],
          ['Overwatch'],
          ['Valorant* (Nov 2026 – Jan 2027)'],
          ['League of Legends* (Feb 2027 – May 2027)'],
        ],
      },
      {
        type: 'note',
        content: [
          '* indicates games always organized in the form of our (1) flagship annual interschool league and (2) a highly likely community-wide tournament.',
        ],
      },
    ],
  },
  {
    id: 'communities',
    title: '3. Three Communities of EZ Esports',
    blocks: [
      {
        type: 'paragraph',
        content: [
          'Flagship Interschool Esports League community: ',
          'This is for highly competitive current NYC high school students with verified enrollment and parent/guardian approval. Esports clubs across NYC high schools organize their best teams and compete against other high schools in a traditional season format that unfolds into an in-person EZ Esports playoffs NYC championship. We live-broadcast select matches on our Twitch Partner channel ',
          { text: '@ezesportsnyc', href: TWITCH },
          ' (awarded by Twitch to the top <1% of Twitch streamers); when individual school schedules are released on our website, we’ll let our community know how they may request specific matches they’d like us to live stream.',
        ],
      },
      {
        type: 'paragraph',
        content: [
          'To participate in the interschool league, your school must have an official organized gaming or esports club with a confirmed faculty advisor and three student officers: a President, Vice President, and Third Officer. These officers share responsibility for communicating with EZ Esports, meeting deadlines, and supporting their club throughout the season. Other logistical details are later in this document.',
        ],
      },
      {
        type: 'paragraph',
        content: [
          'Chill community: ',
          'Casual student players, alumni, and teachers will have opportunities to join periodically organized (once every several months) big open tournaments and other community events (e.g. watch parties) designed for good vibes! We strive to be inclusive to all gamers, so there are opportunities for the wider NYC community to participate too. Follow Instagram ',
          { text: '@e.z.esports', href: INSTAGRAM },
          ' and join our ',
          { text: 'Discord', href: DISCORD },
          ' for announcements.',
        ],
      },
      {
        type: 'paragraph',
        content: [
          'Careers + Academics community: ',
          'We host periodic academic workshops and career-oriented events where anyone in our community can meet peers and learn from speakers at leading universities and in a range of careers. Follow Instagram ',
          { text: '@e.z.esports', href: INSTAGRAM },
          ' and join our ',
          { text: 'Discord', href: DISCORD },
          ' for these announcements.',
        ],
      },
    ],
  },
  {
    id: 'join-staff',
    title: 'Join our staff or start a club',
    blocks: [
      {
        type: 'paragraph',
        content: [
          'We recognize many of us are also passionate about building the scholastic esports community; if this is you or someone you know, we’d love to meet you and see if you’re a fit on our EZ Esports staff! Our student-staff get great exposure and experience building our various systems that directly impact how we facilitate EZ Esports for our community, with our network of alumni and legacy staff. Visit our ',
          { text: 'Careers page', href: '/careers' },
          ' to learn more. Experience is softly preferred, but not required. We care much more about passion, intellectual curiosity, and being self-motivated. Apply as soon as possible, as we do rolling consideration for all our part-time volunteer staff opportunities (10~15 hrs/week) across our cross-functional Divisions:',
        ],
      },
      {
        type: 'list',
        items: [
          ['Productions Crew (live-broadcast shoutcasters, observers, or overlay designers/producers)'],
          ['Software Engineering'],
          ['Data Science'],
          ['Marketing (manages our public-facing channels, including Instagram, LinkedIn, and more. Our creatives typically lead each post from planning and production through publishing, then use engagement data to improve future content and shape broader marketing strategy)'],
          ['Operations (decide how EZ Esports programs are facilitated and oversee logistics across schools and the community)'],
          ['Game Regulations'],
          ['Business'],
          ['Legal'],
          [
            'EZ Esports Student-Ambassador Program (2~4 hrs/week): reviving this from our 2021 inaugural year, we’re seeking 1-2 ambassadors from each school to meet weekly with EZ Esports staff to share and help shape ongoing initiatives. This role’s application is facilitated through ',
            { text: 'this form', href: 'https://forms.gle/2N9kNLmNLFmfJLJD6' },
            '.',
          ],
        ],
      },
      { type: 'paragraph', content: ['If you have any questions about any staff application process, ', ...openTicket, '.'] },
      {
        type: 'paragraph',
        content: [
          'Don’t have an esports club at your school? You’ll need to be part of your school’s esports club to compete in our interschool league, but you’re welcome to join all our other events! If you’re interested in starting a club or rebuilding one, we encourage you to give it a try! Many students have started clubs at their schools because they wanted to compete in EZ Esports. To help you get started, we invited presidents of successful esports clubs to share their advice: ',
          { text: 'How to build an esports community at your school', href: 'https://www.instagram.com/p/DePRZIAxE0v/' },
          '. For any additional inquiries, ',
          ...openTicket,
          '.',
        ],
      },
    ],
  },
  {
    id: 'timeline',
    title: '4. 2026–27 Key Dates and the Interschool League Timeline',
    blocks: [
      {
        type: 'paragraph',
        content: ['Competing to be NYC Champions. Every date below can change; see the note at the end of this section.'],
      },
      {
        type: 'timeline',
        items: [
          { when: 'Oct 16 – Oct 24, 2026', content: ['Esports club leadership who registered their school’s interest for interschool Valorant receive an offer of participation by email to join EZ Esports, with next steps on how to confirm their spot and officialize their school to compete. Club leadership must submit the Offer Acceptance Form within 72 hours of receiving the email (unless a different deadline is stated). This form also includes a Welcome Meeting with EZ Esports staff. Schools that miss their deadline will have their offers expire and move to the waitlist.'] },
          { when: 'Oct 23, 2026', content: ['Priority deadline for a school’s esports club leadership to ', { text: 'register their school’s interest', href: '/apply' }, '.'] },
          { when: 'Oct 23 – 30, 2026', content: ['Via Instagram ', { text: '@e.z.esports', href: INSTAGRAM }, ', first public reveal of confirmed schools playing in the EZ Esports Valorant interschool league.'] },
          { when: 'Oct 27 – Nov 3, 2026', content: ['Esports club leaderships who are approved and submitted interest for Valorant receive an email to facilitate “EZ Esports Valorant Interschool Student Onboard” from our Valorant, Software Engineering, and Operations Divisions staff. Part of this email includes the “Valorant Handbook” that reviews all specific logistics, guidelines, expectations, and code of conduct to play in EZ Esports Interschool Valorant. Each school leadership is provided a link to create an account for their school’s esports club on our website. From there, school leadership can access our school manager portal, where they invite their students to onboard, review each student’s completed onboarding to confirm they belong on the team, and finalize their school’s roster. If any issues are found with a student’s onboarding, EZ Esports staff will reach out to the respective esports club leadership to help resolve it before registration closes.'] },
          { when: 'Nov 3 – 8, 2026', content: ['LoL Worlds Knockout Stage EZ Esports Discord watch party.'] },
          { when: 'Nov 6, 2026', content: ['All Valorant registration closes. Valorant rosters are finalized by esports club leadership and no changes can be made. Staff will continue to communicate any additional logistical details via Discord and Instagram.'] },
          { when: 'Nov 13 – 19, 2026', content: ['Valorant schedules are released on ezesports.org.'] },
          { when: 'Nov 14, 2026', content: ['LoL Worlds Grand Finals EZ Esports Discord watch party.'] },
          { when: 'Late Nov 2026', content: ['Details of the EZ Esports LoL Open Tournament for any student, alumni, or teacher are released.'] },
          { when: 'Nov 18, 2026', content: ['Officially marks the day the first EZ Esports match was played in 2021.'] },
          { when: 'Nov 20, 2026', content: ['Week 1 of EZ Esports Interschool Valorant: the season begins! All matches are played on the EZ Esports Discord server.'] },
          { when: 'Dec 18, 2026', content: ['LoL registration opens on ezesports.org.'] },
          { when: 'Dec 18, 2026 – early Jan 2027', content: ['Esports club leadership who registered their school’s interest for LoL receive an offer of participation by email to join EZ Esports, along with next steps to confirm their spot and officialize their LoL rosters. The acceptance and roster onboarding process follows a similar structure to Valorant, with game-specific instructions provided by email.'] },
          { when: 'Jan 15, 2027', content: ['Week 7 of EZ Esports Interschool Valorant: the season concludes!'] },
          { when: 'Late Jan – early Feb 2027', content: ['Valorant All-Star game (10 students across any school who are voted in for most outstanding performance receive the “EZ Esports All-Star Player Award” and play an exhibition match together) and Valorant championship playoff details are released.'] },
          { when: 'Jan 23, 2027', content: ['Via Instagram, first public reveal of confirmed schools playing in the EZ Esports LoL interschool league. Team managers receive an email on how to onboard their rosters. Each player is required to (1) submit parental or guardian consent and (2) verify their school enrollment, along with (3) other logistical information and agreements. Registration remains open.'] },
          { when: 'Early Jan – early Feb 2027', content: ['Esports club leaderships who are approved and submitted interest for LoL receive an email to facilitate “EZ Esports LoL Interschool Student Onboard” from our LoL, Software Engineering, and Operations Divisions staff, including the “LoL Handbook” covering logistics, guidelines, expectations, and code of conduct. The school manager portal process matches Valorant’s.'] },
          { when: 'Feb 12, 2027', content: ['LoL registration closes.'] },
          { when: 'Feb 19, 2027', content: ['LoL rosters are finalized by esports club leadership and no changes can be made.'] },
          { when: 'Feb 26, 2027', content: ['Week 1 of EZ Esports Interschool LoL: the season begins! All matches are played on the EZ Esports Discord server.'] },
          { when: 'Apr 9, 2027', content: ['Week 7 of EZ Esports Interschool LoL: the season concludes!'] },
          { when: 'Early – late Apr 2027', content: ['LoL All-Star game (same format as Valorant’s) and LoL championship playoff details are released.'] },
          { when: 'May 1, 2027', content: ['Details of the EZ Esports Valorant Open Tournament for any student, alumni, or teacher are released.'] },
        ],
      },
      {
        type: 'note',
        content: [
          'Dates and events may change as plans develop and due to unforeseen circumstances. We’ll keep this handbook updated and share any changes on our ',
          { text: 'Discord server', href: DISCORD },
          '. Thank you for your flexibility!',
        ],
      },
    ],
  },
  {
    id: 'number-one-rule',
    title: '5. Our #1 Rule: be courteous, kind, and respectful at all times',
    blocks: [
      {
        type: 'paragraph',
        content: [
          'Any form of toxicity by any person, as deemed by EZ Esports staff to be a violation of the rule above, will lead to a 1-week timeout (an admin will DM you the reason with evidence as your first and final warning). The following violation will result in a permanent ban. If you observe any toxic activity in EZ Esports, collect evidence and ',
          ...openTicket,
          '. GLHF!',
        ],
      },
    ],
  },
];
