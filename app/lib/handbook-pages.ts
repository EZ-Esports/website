/**
 * Bundled copy of the 2026-27 Student Handbook, used by /handbook when staff
 * have not uploaded a PDF (or the PDF cannot be loaded). Converted from the
 * leadership team's interactive pamphlet (last modified October 18, 2026): the
 * designed pages ship as images under public/handbook/, with the pamphlet's
 * link boxes (percent of page width/height) and extracted text for search.
 *
 * It is the fallback, not the source of truth: once staff upload a PDF the
 * viewer renders that instead.
 */
import type { HandbookLink } from './handbook-viewer-types';

export interface BundledHandbookPage {
  image: string;
  text: string;
  links: HandbookLink[];
}

export const HANDBOOK_EDITION = '2026-27 · 5th Year Anniversary';
export const HANDBOOK_LAST_MODIFIED = 'October 18, 2026';
export const HANDBOOK_GOOGLE_DOC_URL =
  'https://docs.google.com/document/d/1ACCrJu9b9_rNjE7yoT28Tb0EeK5z2QPvoMSnjqkPm8U/edit?usp=sharing';

/** Chapter list of the bundled pages (page numbers are zero-based indexes). */
export const BUNDLED_CHAPTERS = [
  { label: 'Cover & contents', page: 0 },
  { label: '0. Key Links', page: 1 },
  { label: '1. Who and what is EZ Esports?', page: 1 },
  { label: '2. What games are organized?', page: 1 },
  { label: '3. Three Communities of EZ Esports', page: 2 },
  { label: '4. Key Dates and Timeline', page: 4 },
  { label: '5. Our #1 Rule', page: 6 },
] as const;

/** Section headings as they appear in the pages' text, used to structure the "Read as text" view. */
export const BUNDLED_TEXT_HEADINGS = [
  '0. Key Links',
  '1. Who and what is EZ Esports?',
  '2. What games are organized?',
  '3. Three Communities of EZ Esports',
  '4. 2026–27 Key Dates and the Interschool League Timeline',
  '5. Our #1 Rule',
] as const;

export const BUNDLED_HANDBOOK_PAGES: BundledHandbookPage[] = [
  {
    "image": "/handbook/page-1.jpg",
    "text": "1   EZ Esports (NYC High School Esports League): 2026-27 5th Year Anniversary Student Handbook Published by EZ Esports Leadership   Key Links 2 Who and what is EZ Esports? 3 What games are organized? 3 Three Communities of EZ Esports 3 Key Dates and Timeline 5 Our #1 Rule 6           Last Modified: October 18, 2026 This document is property of EZ Esports*",
    "links": [
      {
        "x": 46.37,
        "y": 20.49,
        "w": 17.77,
        "h": 1.58,
        "label": "EZ Esports Leadership",
        "uri": "https://www.ezesports.org/leadership/2026"
      },
      {
        "x": 11.03,
        "y": 60.33,
        "w": 81.62,
        "h": 1.6,
        "label": "Key Links​ 2",
        "page": 1
      },
      {
        "x": 11.03,
        "y": 62.3,
        "w": 81.62,
        "h": 1.6,
        "label": "Who and what is EZ Esports?​ 3",
        "page": 1
      },
      {
        "x": 11.03,
        "y": 64.28,
        "w": 81.62,
        "h": 1.6,
        "label": "What games are organized?​ 3",
        "page": 1
      },
      {
        "x": 16.42,
        "y": 66.25,
        "w": 76.23,
        "h": 1.6,
        "label": "Communities of EZ Esports​ 3",
        "page": 2
      },
      {
        "x": 11.03,
        "y": 68.23,
        "w": 81.62,
        "h": 1.6,
        "label": "Key Dates and Timeline​ 5",
        "page": 4
      },
      {
        "x": 11.03,
        "y": 70.21,
        "w": 81.62,
        "h": 1.6,
        "label": "Our #1 Rule ​ 6",
        "page": 6
      }
    ]
  },
  {
    "image": "/handbook/page-2.jpg",
    "text": "2  0. Key Links Discord (where majority of matches and community events are facilitated): discord.com/invite/RajSZqNyvu Website (rosters, schedules, stats, applications are always submitted and displayed here): ezesports.org Register your school’s interest: ezesports.org/apply Instagram (where we post all updates and announcements, and find prev. event pics!): instagram.com/e.z.esports Twitch Partnered (live-broadcasts): twitch.tv/ezesportsNYC Youtube (reviving!): www.youtube.com/@ezesportsnyc LinkedIn: linkedin.com/company/nyc-ez-esports Email: ezesportsleague@gmail.com All student inquiries or feedback: Open a Ticket (join our Discord → find “#open-a-ticket”)  1. Who and what is EZ Esports? In 2021, we were a group of high schoolers at different schools across NYC who wanted to compete against each other in video games. A high school senior led the initiative to bring our schools and video game club leaders together, and we built nonprofit EZ Esports: the New York City High School Esports League. Today, we organize over 300 interschool matches each year across dozens of schools. Our mission is to shape the leaders of tomorrow through their passion for esports today. You can read more here: SILive News Article (non-paywall version). 98% of EZ Esports staff are volunteer NYC Public School students, teachers, or alumni, and every year, about ⅓ of our student-staff get accepted to top-25 nationally ranked universities (view our legacy of staff on our Leadership pages). Based on a survey of over 1,000 students who played in an EZ Esports match, 85% say more infrastructure for interschool esports would better support their academic extracurricular interests and 77% say they had developed stronger teamwork and communication skills.  Here’s a pic of some of our leadership!  2. What games are organized? Each year, we choose which games to organize based on expressed interest from community members and school esports club leaders. Please express interest any time on our Discord! Some are organized in the form of periodic and large open community-based short tournaments, others in the form of our flagship annual interschool league! In the past, we’ve hosted… ❖ Rocket League ❖ Teamfight Tactics  Last Modified: October 18, 2026 This document is property of EZ Esports*",
    "links": [
      {
        "x": 64.89,
        "y": 11.75,
        "w": 23.08,
        "h": 1.42,
        "label": "discord.com/invite/RajSZqNyvu",
        "uri": "https://discord.com/invite/RajSZqNyvu"
      },
      {
        "x": 75.22,
        "y": 13.53,
        "w": 9.64,
        "h": 1.42,
        "label": "ezesports.org",
        "uri": "https://www.ezesports.org/"
      },
      {
        "x": 33.16,
        "y": 15.31,
        "w": 14.38,
        "h": 1.42,
        "label": "ezesports.org/apply",
        "uri": "https://www.ezesports.org/apply"
      },
      {
        "x": 72.94,
        "y": 17.08,
        "w": 18.97,
        "h": 1.42,
        "label": "instagram.com/e.z.esports",
        "uri": "https://instagram.com/e.z.esports"
      },
      {
        "x": 36.37,
        "y": 18.86,
        "w": 16.79,
        "h": 1.42,
        "label": "twitch.tv/ezesportsNYC",
        "uri": "https://www.twitch.tv/ezesportsNYC"
      },
      {
        "x": 25.24,
        "y": 20.63,
        "w": 24.61,
        "h": 1.42,
        "label": "www.youtube.com/@ezesportsnyc",
        "uri": "https://www.youtube.com/@ezesportsnyc"
      },
      {
        "x": 18.12,
        "y": 22.41,
        "w": 27.62,
        "h": 1.42,
        "label": "linkedin.com/company/nyc-ez-esports",
        "uri": "https://www.linkedin.com/company/nyc-ez-esports"
      },
      {
        "x": 15.74,
        "y": 24.18,
        "w": 20.54,
        "h": 1.42,
        "label": "ezesportsleague@gmail.com",
        "uri": "mailto:ezesportsleague@gmail.com"
      },
      {
        "x": 34.84,
        "y": 25.96,
        "w": 9.84,
        "h": 1.42,
        "label": "Open a Ticket",
        "uri": "https://discord.com/channels/1022187805742469212/1024423188777680896/1547425917926908006"
      },
      {
        "x": 51.46,
        "y": 25.96,
        "w": 5.4,
        "h": 1.42,
        "label": "Discord",
        "uri": "https://discord.com/invite/RajSZqNyvu"
      },
      {
        "x": 57.43,
        "y": 39.34,
        "w": 29.75,
        "h": 1.42,
        "label": "SILive News Article (non-paywall version)",
        "uri": "https://web.archive.org/web/20240826100640/https://www.silive.com/sports/2023/01/game-on-susan-wagner-student-spurred-a-city-wide-esports-league-which-is-now-home-to-hundreds-of-members.html"
      },
      {
        "x": 81.63,
        "y": 43.01,
        "w": 8.36,
        "h": 1.42,
        "label": "Leadership",
        "uri": "https://www.ezesports.org/leadership/2026"
      },
      {
        "x": 11.03,
        "y": 44.78,
        "w": 4.38,
        "h": 1.42,
        "label": "pages",
        "uri": "https://www.ezesports.org/leadership/2026"
      },
      {
        "x": 54.5,
        "y": 82.05,
        "w": 5.4,
        "h": 1.42,
        "label": "Discord",
        "uri": "https://discord.com/invite/RajSZqNyvu"
      }
    ]
  },
  {
    "image": "/handbook/page-3.jpg",
    "text": "3  ❖ osu! ❖ Tetr.io ❖ Minecraft ❖ Call of Duty ❖ Overwatch ❖ Valorant* (Nov 2026 – Jan 2027) ❖ League of Legends* (Feb 2027 – May 2027) ( * indicates games always organized in the form of our (1) flagship annual interschool league and (2) will have a highly-likely community-wide tournament)  3. Three Communities of EZ Esports ● EZ Esports “Flagship Interschool Esports League” Community: This is for highly competitive current NYC high school students with verified enrollment and parent/guardian approval. Esports clubs across NYC high schools organize their best teams and compete against other high schools in a traditional season format that unfolds into an in-person EZ Esports playoffs NYC championship. We live-broadcast select matches on our Twitch Partner channel @ezesportsnyc (awarded by Twitch to the top <1% of Twitch streamers); when individual school schedules are released on our website, we’ll let our community know how they may request specific matches they’d like us to live stream to the community. To participate in the interschool league, your school must have an official organized gaming or esports club with a confirmed faculty advisor and three student officers: a President, Vice President, and Third Officer. These officers share responsibility for communicating with EZ Esports, meeting deadlines, and supporting their club throughout the season. Other ogistical details are later on in this document! Pictures: TFT Top 5 Players 2024 (left picture), SI Tech HS LoL Champions 2023 (middle picture), Bayside Valorant B team after advancing to the playoffs semi-finals 2022 (right picture).  ● EZ Esports “Chill” Community: Casual student players, alumni, and teachers will have opportunities to join periodically organized (once every several months) big open tournaments and other community events (e.g. watch parties) designed for good vibes! We strive to be inclusive to all gamers, so there are opportunities for the wider NYC community to participate too! Follow Instagram @e.z.esports and join our Discord for announcements.    Last Modified: October 18, 2026 This document is property of EZ Esports*",
    "links": [
      {
        "x": 18.38,
        "y": 39.18,
        "w": 10.79,
        "h": 1.42,
        "label": "@ezesportsnyc",
        "uri": "https://www.twitch.tv/ezesportsNYC"
      },
      {
        "x": 45.08,
        "y": 85.76,
        "w": 16.96,
        "h": 1.42,
        "label": "Instagram @e.z.esports",
        "uri": "https://www.instagram.com/e.z.esports/"
      },
      {
        "x": 70.98,
        "y": 85.76,
        "w": 5.81,
        "h": 1.42,
        "label": "Discord",
        "uri": "https://discord.com/invite/RajSZqNyvu"
      }
    ]
  },
  {
    "image": "/handbook/page-4.jpg",
    "text": "4  ● EZ Esports “Careers + Academics” Community: 1) We host periodic academic workshops and career-oriented events where anyone in our community can meet peers and learn from speakers at leading universities and in a range of careers. Follow Instagram @e.z.esports and join our Discord for these announcements.  2) We recognize many of us are also passionate about building the scholastic esports community; if this is you or someone you know, we’d love to meet you and see if you’re a fit on our EZ Esports staff! Our student-staff get great exposure and experience building our various systems that’ll directly impact how we facilitate EZ Esports for our community with our network of alumni and legacy staff. Visit our website’s Career page to learn more. Experience is softly preferred, but not required. We care much more about passion, intellectual curiosity, and being self-motivated. Apply as soon as possible, as we do rolling consideration for all our part-time volunteer staff opportunities (10~15hrs/week) across our cross-functional Divisions: Productions Crew (live-broadcast shoutcasters, observers, or overlay designers/producers) Software Engineering Data Science Marketing (manages our public-facing channels, including Instagram, LinkedIn, and more. Our creatives typically lead each post from planning and production through publishing, then use engagement data to improve future content and shape broader marketing strategy) Operations (decide how EZ Esports programs are facilitated and oversee its logistics across schools and the community) Game Regulations (decide how EZ Esports programs are facilitated and oversee its logistics across schools and the community) Business Legal EZ Esports Student-Ambassador Program (2~4hrs/week): Reviving this from our 2021 inaugural year, we’re seeking 1-2 ambassadors from each school to meet weekly with EZ Esports staff to share and help shape ongoing initiatives. Note: this role’s application is facilitated through this form. If you have any questions about any staff application process, Open a Ticket (join our Discord → find “#open-a-ticket”)!  3) Don’t have an esports club at your school? You’ll need to be part of your school’s esports club to compete in our interschool league, but you’re welcome to join all our other events!  If you’re interested in starting a club or rebuilding one, we encourage you to give it a try! Many students have started clubs at their schools because they wanted to compete in EZ Esports. To help you get started, we invited presidents of successful esports clubs to share their advice: How to build an esports community at your school.  If you have any additional inquiries, Open a Ticket (join our Discord → find “#open-a-ticket”)!    Last Modified: October 18, 2026 This document is property of EZ Esports*",
    "links": [
      {
        "x": 18.38,
        "y": 14.42,
        "w": 16.96,
        "h": 1.42,
        "label": "Instagram @e.z.esports",
        "uri": "https://www.instagram.com/e.z.esports/"
      },
      {
        "x": 44.29,
        "y": 14.42,
        "w": 5.81,
        "h": 1.42,
        "label": "r Discord",
        "uri": "https://discord.com/invite/RajSZqNyvu"
      },
      {
        "x": 80.44,
        "y": 23.3,
        "w": 3.35,
        "h": 1.42,
        "label": "staff",
        "uri": "https://www.ezesports.org/leadership/2026"
      },
      {
        "x": 25.33,
        "y": 25.07,
        "w": 8.89,
        "h": 1.42,
        "label": "Career page",
        "uri": "https://www.ezesports.org/careers"
      },
      {
        "x": 66.09,
        "y": 38.35,
        "w": 7.57,
        "h": 1.7,
        "label": "Instagram",
        "uri": "https://instagram.com/e.z.esports"
      },
      {
        "x": 88.96,
        "y": 59.59,
        "w": 2.96,
        "h": 1.42,
        "label": "this",
        "uri": "https://forms.gle/2N9kNLmNLFmfJLJD6"
      },
      {
        "x": 24.26,
        "y": 61.36,
        "w": 3.4,
        "h": 1.42,
        "label": "form",
        "uri": "https://forms.gle/2N9kNLmNLFmfJLJD6"
      },
      {
        "x": 63.47,
        "y": 63.14,
        "w": 9.84,
        "h": 1.42,
        "label": "Open a Ticket",
        "uri": "https://discord.com/channels/1022187805742469212/1024423188777680896/1547425917926908006"
      },
      {
        "x": 80.1,
        "y": 63.14,
        "w": 5.4,
        "h": 1.42,
        "label": "Discord",
        "uri": "https://discord.com/invite/RajSZqNyvu"
      },
      {
        "x": 74.73,
        "y": 77.34,
        "w": 17.33,
        "h": 1.42,
        "label": "How to build an esports",
        "uri": "https://www.instagram.com/p/DePRZIAxE0v/"
      },
      {
        "x": 18.38,
        "y": 79.12,
        "w": 18.49,
        "h": 1.42,
        "label": "community at your school",
        "uri": "https://www.instagram.com/p/DePRZIAxE0v/"
      },
      {
        "x": 44.62,
        "y": 82.67,
        "w": 9.84,
        "h": 1.42,
        "label": "Open a Ticket",
        "uri": "https://discord.com/channels/1022187805742469212/1024423188777680896/1547425917926908006"
      },
      {
        "x": 61.24,
        "y": 82.67,
        "w": 5.4,
        "h": 1.42,
        "label": "Discord",
        "uri": "https://discord.com/invite/RajSZqNyvu"
      }
    ]
  },
  {
    "image": "/handbook/page-5.jpg",
    "text": "5  4. 2026–27 Key Dates and the Interschool League Timeline: Competing to be NYC Champions  ● Oct 16—Oct 24, 2026: Esports club leadership who registered their school’s interest for interschool Valorant receive an offer of participation by email to join EZ Esports with next steps on how to confirm their spot and officialize their school to compete. Club leadership must submit the Offer Acceptance Form within 72 hours of receiving the email (unless a different deadline is stated). This form also includes a Welcome Meeting with EZ Esports staff! Schools that miss their deadline will have their offers expire and move to the waitlist. ● Oct 23, 2026: Priority deadline for a school’s esports club leadership to register their school’s interest ● Oct 23~30, 2026: Via Instagram @e.z.esports, first public reveal of confirmed schools playing in the EZ Esports Valorant interschool league ● Oct 27—Nov 3, 2026: Between this time, esports club leaderships who are approved and submitted interest for Valorant will receive an email to facilitate “EZ Esports Valorant Interschool Student Onboard” from our (1) Valorant, (2) Software Engineering, and (3) Operations Divisions staff. Part of this email will include the “Valorant Handbook” that’ll review all specific logistics, guidelines, expectations, and code of conduct to play in EZ Esports Interschool Valorant. To share briefly more about the process, each school leadership will be provided a link to create an account for their school’s esports club on our website. From there, the school leadership can access our school manager portal, where they invite their students to onboard, review each student’s completed onboarding to confirm they belong on the team, and finalize their school’s roster. If any issues are found with a student’s onboarding, an EZ Esports staff will reach out to respective esports club leadership to flag it to help resolve it before registration closes. ● Nov 3—8, 2026: LoL Worlds Knockout Stage EZ Esports Discord watchparty ● Nov 6, 2026: All Valorant Registration closes. Valorant Rosters are finalized by esports club leadership and no changes can be made. EZ Esports staff will continue to communicate any additional logistical details via Discord and Instagram @e.z.esports ● Nov 13~19, 2026: Valorant schedules are released on www.ezesports.org ● Nov 14, 2026: LoL Worlds Grand Finals EZ Esports Discord watchparty ● late-Nov, 2026: Details of the EZ Esports LoL Open-Tournament for any student, alumni, or teacher is released… ● Nov 18, 2026: Officially marks the day the first EZ Esports match was played in 2021. ● Nov 20, 2026: Week 1 of EZ Esports Interschool Valorant: the season begins! All matches are played on the EZ Esports Discord server. ● Dec 18, 2026: LoL Registration opens on www.ezesports.org  Last Modified: October 18, 2026 This document is property of EZ Esports*",
    "links": [
      {
        "x": 77.31,
        "y": 46.73,
        "w": 11.41,
        "h": 1.42,
        "label": "school’s interest",
        "uri": "https://www.ezesports.org/apply"
      },
      {
        "x": 32.26,
        "y": 48.5,
        "w": 16.96,
        "h": 1.42,
        "label": "Instagram @e.z.esports",
        "uri": "https://instagram.com/e.z.esports"
      },
      {
        "x": 56.97,
        "y": 69.81,
        "w": 5.4,
        "h": 1.42,
        "label": "Discord",
        "uri": "http://discord.com/invite/RajSZqNyvu"
      },
      {
        "x": 19.51,
        "y": 75.13,
        "w": 5.4,
        "h": 1.42,
        "label": "Discord",
        "uri": "http://discord.com/invite/RajSZqNyvu"
      },
      {
        "x": 28.46,
        "y": 75.13,
        "w": 16.96,
        "h": 1.42,
        "label": "Instagram @e.z.esports",
        "uri": "https://instagram.com/e.z.esports"
      },
      {
        "x": 55.04,
        "y": 76.91,
        "w": 13.45,
        "h": 1.42,
        "label": "www.ezesports.org",
        "uri": "http://ezesports.org"
      },
      {
        "x": 53.17,
        "y": 78.69,
        "w": 5.4,
        "h": 1.42,
        "label": "Discord",
        "uri": "http://discord.com/invite/RajSZqNyvu"
      },
      {
        "x": 19.63,
        "y": 87.56,
        "w": 18.37,
        "h": 1.42,
        "label": "EZ Esports Discord server",
        "uri": "https://discord.com/invite/RajSZqNyvu"
      },
      {
        "x": 46.14,
        "y": 89.34,
        "w": 13.45,
        "h": 1.42,
        "label": "www.ezesports.org",
        "uri": "http://ezesports.org"
      }
    ]
  },
  {
    "image": "/handbook/page-6.jpg",
    "text": "6  ● Dec 18, 2026—early-Jan 2027: Esports club leadership who registered their school’s interest for LoL will receive an offer of participation by email to join EZ Esports, along with next steps to confirm their spot and officialize their LoL rosters to compete. The acceptance and roster onboarding process will follow a similar structure to VALORANT, with game-specific instructions provided by email. ● Jan 15, 2027: Week 7 of EZ Esports Interschool Valorant: the season concludes! ● late-Jan~early-Feb 2027: Valorant All-Star game (10 students across any school are voted in with most outstanding performance in EZ Esports will be awarded the “EZ Esports All-Star Player Award” and play an exhibition match together) and Valorant championship playoff details are released. (check out this clip of a clutch play from our in-person 2022 Valorant All-Star Match) ● Jan 23, 2027: Via Instagram @e.z.esports, first public reveal of confirmed schools playing in the EZ Esports LoL interschool league. Team manager(s) will receive an email regarding how to onboard their rosters. Each player will be required to (1) submit parental or guardian consent and (2) verify their school enrollment, along with (3) other logistical information and agreements. Registration remains open. ● early-Jan~early-Feb: Between this time, esports club leaderships who are approved and submitted interest for LoL will receive an email to facilitate “EZ Esports LoL Interschool Student Onboard” from our (1) LoL, (2) Software Engineering, and (3) Operations Divisions staff. Part of this email will include the “LoL Handbook” that’ll review all specific logistics, guidelines, expectations, and code of conduct to play in EZ Esports Interschool LoL. To share briefly more about the process, each school leadership will be provided a link to create an account for their school’s esports club on our website. From there, the school leadership can access our school manager portal, where they invite their students to onboard, review each student’s completed onboarding to confirm they belong on the team, and finalize their school’s roster. If any issues are found with a student’s onboarding, an EZ Esports staff will reach out to respective esports club leadership to flag it to help resolve it before registration closes. ● Feb 12, 2027: LoL Registration closes ● Feb 19, 2027: LoL Rosters are finalized by esports club leadership and no changes can be made. ● Feb 26, 2027: Week 1 of EZ Esports Interschool LoL: the season begins! All matches are played on the EZ Esports Discord server. ● April 9, 2027: Week 7 of EZ Esports Interschool LoL: the season concludes! ● early-April~late-April: LoL All-Star game (10 students across any school are voted in with most outstanding performance in EZ Esports will be awarded the “EZ Esports All-Star Player Award” and play an exhibition match together) and LoL championship playoff details are released. ● May 1: Details of the EZ Esports Valorant Open-Tournament for any student, alumni, or teacher is released…  Note: Dates and events may change as plans develop and due to unforeseen circumstances. We’ll keep this handbook updated and share any changes on our Discord server. Thank you for your flexibility!           Last Modified: October 18, 2026 This document is property of EZ Esports*",
    "links": [
      {
        "x": 89.7,
        "y": 21.52,
        "w": 2.9,
        "h": 1.42,
        "label": "clip",
        "uri": "https://www.twitch.tv/ezesportsnyc/clip/RudeObliqueButterTinyFace-yiQVL13OWKI_yKi7?range=all"
      },
      {
        "x": 16.91,
        "y": 23.3,
        "w": 10.93,
        "h": 1.42,
        "label": "of a clutch play",
        "uri": "https://www.twitch.tv/ezesportsnyc/clip/RudeObliqueButterTinyFace-yiQVL13OWKI_yKi7?range=all"
      },
      {
        "x": 29.77,
        "y": 25.07,
        "w": 16.96,
        "h": 1.42,
        "label": "Instagram @e.z.esports",
        "uri": "https://instagram.com/e.z.esports"
      },
      {
        "x": 89.41,
        "y": 53.48,
        "w": 2.28,
        "h": 1.42,
        "label": "EZ",
        "uri": "https://discord.com/invite/RajSZqNyvu"
      },
      {
        "x": 16.91,
        "y": 55.26,
        "w": 16.09,
        "h": 1.42,
        "label": "Esports Discord server",
        "uri": "https://discord.com/invite/RajSZqNyvu"
      }
    ]
  },
  {
    "image": "/handbook/page-7.jpg",
    "text": "7  5. Our #1 Rule: You must be courteous, kind, and respectful at all times! Any form of toxicity by any person deemed by EZ Esports staff as a violation to the rule above will lead to a 1-week timeout (an admin will DM you the reason with evidence as your first and final warning). The following violation will result in a permanent ban. If you observe any toxic activity in EZ Esports, collect evidence and open a Ticket (join our Discord → find “#open-a-ticket”). GLHF! One of EZ Esports’ Very First In-Person Events in 2022.  Last Modified: October 18, 2026 This document is property of EZ Esports*",
    "links": [
      {
        "x": 88.9,
        "y": 15.31,
        "w": 3.98,
        "h": 1.6,
        "label": "open",
        "uri": "https://discord.com/channels/1022187805742469212/1024423188777680896/1547425917926908006"
      },
      {
        "x": 11.03,
        "y": 17.3,
        "w": 5.61,
        "h": 1.42,
        "label": "a Ticket",
        "uri": "https://discord.com/channels/1022187805742469212/1024423188777680896/1547425917926908006"
      },
      {
        "x": 23.43,
        "y": 17.3,
        "w": 5.4,
        "h": 1.42,
        "label": "Discord",
        "uri": "https://discord.com/invite/RajSZqNyvu"
      }
    ]
  }
];
