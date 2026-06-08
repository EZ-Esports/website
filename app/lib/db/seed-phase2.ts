import { db } from './index';
import * as schema from './schema';

async function seedPhase2() {
  // Gallery images — descriptive captions for the 11 existing images
  const gallerySet1 = [
    { src: '/images/gallery/gallery-1.png', caption: 'Stuyvesant vs Bronx Science match — Spring 2022', schoolName: 'Stuyvesant High School', eventName: 'Spring 2022 Championship', setId: 1, displayOrder: 1 },
    { src: '/images/gallery/gallery-2.png', caption: 'League of Legends finals — players in action', schoolName: '', eventName: 'Spring 2022 Finals', setId: 1, displayOrder: 2 },
    { src: '/images/gallery/gallery-3.png', caption: 'Post-match celebration — team huddle', schoolName: '', eventName: 'Spring 2022', setId: 1, displayOrder: 3 },
    { src: '/images/gallery/gallery-4.png', caption: 'Midline Event at LIU — August 2022', schoolName: '', eventName: 'Midline Event LIU', setId: 1, displayOrder: 4 },
    { src: '/images/gallery/gallery-5.png', caption: 'On-site broadcast setup at tournament venue', schoolName: '', eventName: 'Midline Event LIU', setId: 1, displayOrder: 5 },
    { src: '/images/gallery/gallery-6.png', caption: 'Students competing in Valorant qualifier', schoolName: '', eventName: 'Fall 2022 Qualifier', setId: 1, displayOrder: 6 },
    { src: '/images/gallery/gallery-7.png', caption: 'Award ceremony — Spring 2022 season close', schoolName: '', eventName: 'Spring 2022 Awards', setId: 1, displayOrder: 7 },
    { src: '/images/gallery/gallery-8.png', caption: 'Coach briefing players before match day', schoolName: '', eventName: 'Fall 2022', setId: 1, displayOrder: 8 },
    { src: '/images/gallery/gallery-9.png', caption: 'Crowd watching live broadcast at venue', schoolName: '', eventName: 'Midline Event LIU', setId: 1, displayOrder: 9 },
  ];

  const gallerySet2 = [
    { src: '/images/gallery/gallery-10.png', caption: 'EZ Esports community meetup — student networking', schoolName: '', eventName: 'Community Meetup', setId: 2, displayOrder: 1 },
    { src: '/images/gallery/gallery-11.png', caption: 'Opening ceremony — Fall 2022 season kickoff', schoolName: '', eventName: 'Fall 2022 Kickoff', setId: 2, displayOrder: 2 },
  ];

  await db.insert(schema.galleryImages).values([...gallerySet1, ...gallerySet2]).onConflictDoNothing();

  // Sponsors
  await db.insert(schema.sponsors).values([
    { name: 'Nike', logoUrl: '', tier: 'platinum', websiteUrl: 'https://nike.com', displayOrder: 1 },
    { name: 'Roc Nation', logoUrl: '', tier: 'gold', websiteUrl: 'https://rocnation.com', displayOrder: 2 },
    { name: 'Gen.G', logoUrl: '', tier: 'gold', websiteUrl: 'https://geng.gg', displayOrder: 3 },
    { name: 'ByteDance', logoUrl: '', tier: 'community', websiteUrl: 'https://bytedance.com', displayOrder: 4 },
  ]).onConflictDoNothing();

  // Page content
  await db.insert(schema.pageContent).values([
    { key: 'about_mission', label: 'About — Mission Statement', content: 'EZ Esports was founded in November 2021 to provide NYC high school students competitive esports opportunities, building community and pathways to careers in gaming and technology.' },
    { key: 'apply_hero', label: 'Apply — Hero Subtitle', content: 'Join the NYC High School Esports League and give your students a competitive edge through organized play, live broadcasts, and community.' },
    { key: 'sponsors_intro', label: 'Sponsors — Intro Text', content: "Partner with NYC's premier high school esports league and connect your brand with the next generation of gamers, creators, and tech leaders." },
    { key: 'home_about_blurb', label: 'Homepage — About Blurb', content: 'EZ Esports brings together NYC high school students across League of Legends, Valorant, and Teamfight Tactics in an organized, professionally broadcast league.' },
  ]).onConflictDoNothing();

  console.log('Phase 2 seed complete.');
}

seedPhase2().catch(console.error);
