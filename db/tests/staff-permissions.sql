-- Run after migrations against a non-production database. Every fixture is
-- rolled back. The script exercises the same functions used by RLS policies.
BEGIN;

INSERT INTO public.roles (id, name, color, permissions, position, is_owner, is_system)
VALUES
  ('10000000-0000-0000-0000-000000000001', '__rls_test_league', '#000000', 4, 10, false, false),
  ('10000000-0000-0000-0000-000000000002', '__rls_test_admin', '#000000', 1, 20, false, false),
  ('10000000-0000-0000-0000-000000000003', '__rls_test_owner', '#000000', 0, 30, true, false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.staff_members (user_id, email)
VALUES
  ('20000000-0000-0000-0000-000000000001', '__rls_zero@example.invalid'),
  ('20000000-0000-0000-0000-000000000002', '__rls_league@example.invalid'),
  ('20000000-0000-0000-0000-000000000003', '__rls_admin@example.invalid'),
  ('20000000-0000-0000-0000-000000000004', '__rls_owner@example.invalid')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role_id)
VALUES
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;

SELECT set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
DO $$ BEGIN
  IF NOT public.is_staff() OR public.has_permission(4) THEN
    RAISE EXCEPTION 'zero-permission membership assertion failed';
  END IF;
END $$;
DO $$
DECLARE denied boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.games (id, slug, display_name, short_name)
    VALUES ('30000000-0000-0000-0000-000000000001', '__rls_zero_game', 'Denied', 'Denied');
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'zero-permission write was not denied'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
DO $$ BEGIN
  IF NOT public.has_permission(4) OR public.has_permission(32) THEN
    RAISE EXCEPTION 'single-permission assertion failed';
  END IF;
END $$;
INSERT INTO public.games (id, slug, display_name, short_name)
VALUES ('30000000-0000-0000-0000-000000000002', '__rls_league_game', 'Allowed', 'Allowed');
DO $$
DECLARE denied boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.news_posts (id, title, slug, content, category)
    VALUES ('30000000-0000-0000-0000-000000000003', 'Denied', '__rls_league_news', 'Denied', 'Test');
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'cross-permission write was not denied'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000003', true);
DO $$ BEGIN
  IF NOT public.has_permission(2048) THEN
    RAISE EXCEPTION 'ADMINISTRATOR override assertion failed';
  END IF;
END $$;
INSERT INTO public.news_posts (id, title, slug, content, category)
VALUES ('30000000-0000-0000-0000-000000000004', 'Admin', '__rls_admin_news', 'Allowed', 'Test');

SELECT set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000004', true);
DO $$ BEGIN
  IF NOT public.has_permission(2048) THEN
    RAISE EXCEPTION 'Owner override assertion failed';
  END IF;
END $$;
INSERT INTO public.news_posts (id, title, slug, content, category)
VALUES ('30000000-0000-0000-0000-000000000005', 'Owner', '__rls_owner_news', 'Allowed', 'Test');

RESET ROLE;
ROLLBACK;
