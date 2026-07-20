WITH gallery_defaults(src, caption, school_name, event_name, set_id, display_order) AS (
  VALUES
    ('/images/gallery/gallery-1.png', 'Stuyvesant vs Bronx Science match - Spring 2022', 'Stuyvesant High School', 'Spring 2022 Championship', 1, 1),
    ('/images/gallery/gallery-2.png', 'League of Legends finals - players in action', '', 'Spring 2022 Finals', 1, 2),
    ('/images/gallery/gallery-3.png', 'Post-match celebration - team huddle', '', 'Spring 2022', 1, 3),
    ('/images/gallery/gallery-4.png', 'Midline Event at LIU - August 2022', '', 'Midline Event LIU', 1, 4),
    ('/images/gallery/gallery-5.png', 'On-site broadcast setup at tournament venue', '', 'Midline Event LIU', 1, 5),
    ('/images/gallery/gallery-6.png', 'Students competing in Valorant qualifier', '', 'Fall 2022 Qualifier', 1, 6),
    ('/images/gallery/gallery-7.png', 'Award ceremony - Spring 2022 season close', '', 'Spring 2022 Awards', 1, 7),
    ('/images/gallery/gallery-8.png', 'Coach briefing players before match day', '', 'Fall 2022', 1, 8),
    ('/images/gallery/gallery-9.png', 'Crowd watching live broadcast at venue', '', 'Midline Event LIU', 1, 9),
    ('/images/gallery/gallery-10.png', 'EZ Esports community meetup - student networking', '', 'Community Meetup', 1, 1),
    ('/images/gallery/gallery-11.png', 'Opening ceremony - Fall 2022 season kickoff', '', 'Fall 2022 Kickoff', 1, 2)
)
INSERT INTO "gallery_images" ("src", "caption", "school_name", "event_name", "set_id", "display_order")
SELECT gallery_defaults.src, gallery_defaults.caption, gallery_defaults.school_name, gallery_defaults.event_name, gallery_defaults.set_id, gallery_defaults.display_order
FROM gallery_defaults
WHERE NOT EXISTS (
  SELECT 1 FROM "gallery_images" existing WHERE existing."src" = gallery_defaults.src
);
--> statement-breakpoint

INSERT INTO "page_content" ("key", "label", "content")
VALUES
  ('hero.title', 'Homepage - Hero Title', 'New York City High School Esports League'),
  ('hero.subtitle', 'Homepage - Hero Subtitle', 'Shaping the leaders of tomorrow through their passion for esports today.'),
  ('hero.cta', 'Homepage - Hero CTA', 'Join Discord'),
  ('home_about_blurb', 'Homepage - Our Story', 'EZ Esports brings together NYC high school students across League of Legends, Valorant, and Teamfight Tactics in an organized, professionally broadcast league.')
ON CONFLICT ("key") DO NOTHING;
