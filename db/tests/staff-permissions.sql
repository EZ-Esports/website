-- Run after migrations against a non-production database. Every fixture is
-- rolled back. The script exercises the same functions used by RLS policies.
BEGIN;

INSERT INTO public.roles (id, name, color, permissions, position, is_owner, is_system)
VALUES
  ('10000000-0000-0000-0000-000000000001', '__rls_test_league', '#000000', 4, 10, false, false),
  ('10000000-0000-0000-0000-000000000002', '__rls_test_admin', '#000000', 1, 20, false, false),
  ('10000000-0000-0000-0000-000000000003', '__rls_test_owner', '#000000', 0, 30, true, false),
  ('10000000-0000-0000-0000-000000000004', '__rls_test_role_manager', '#000000', 2, 15, false, false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.staff_members (user_id, email)
VALUES
  ('20000000-0000-0000-0000-000000000001', '__rls_zero@example.invalid'),
  ('20000000-0000-0000-0000-000000000002', '__rls_league@example.invalid'),
  ('20000000-0000-0000-0000-000000000003', '__rls_admin@example.invalid'),
  ('20000000-0000-0000-0000-000000000004', '__rls_owner@example.invalid'),
  ('20000000-0000-0000-0000-000000000005', '__rls_role_manager@example.invalid'),
  ('20000000-0000-0000-0000-000000000006', '__rls_recreated-alias@example.invalid')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role_id)
VALUES
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000003'),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000004'),
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000002')
ON CONFLICT DO NOTHING;

INSERT INTO public.staff_revocations (user_id, email, revoked_by, reason)
VALUES (
  '20000000-0000-0000-0000-000000000007',
  '__rls_revoked@example.invalid',
  '20000000-0000-0000-0000-000000000004',
  'RLS regression fixture'
)
ON CONFLICT (user_id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'roles',
        'user_roles',
        'staff_members',
        'staff_invites',
        'staff_invite_roles',
        'staff_revocations'
      )
      AND cmd <> 'SELECT'
  ) THEN
    RAISE EXCEPTION 'membership-domain authenticated mutation policy exists';
  END IF;
END $$;

SET LOCAL ROLE authenticated;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000001","email":"__rls_zero@example.invalid"}',
  true
);
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

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000002","email":"__rls_league@example.invalid"}',
  true
);
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

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000003","email":"__rls_admin@example.invalid"}',
  true
);
DO $$ BEGIN
  IF NOT public.has_permission(2048) THEN
    RAISE EXCEPTION 'ADMINISTRATOR override assertion failed';
  END IF;
END $$;
INSERT INTO public.news_posts (id, title, slug, content, category)
VALUES ('30000000-0000-0000-0000-000000000004', 'Admin', '__rls_admin_news', 'Allowed', 'Test');

-- A durable revocation overrides both a remaining membership row and an
-- ADMINISTRATOR role, preventing stale JWTs from retaining RLS access.
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000006","email":"__RLS_REVOKED@EXAMPLE.INVALID"}',
  true
);
DO $$ BEGIN
  IF public.is_staff() OR public.has_permission(2048) THEN
    RAISE EXCEPTION 'revocation tombstone did not override staff permissions';
  END IF;
END $$;
DO $$
DECLARE denied boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.news_posts (id, title, slug, content, category)
    VALUES ('30000000-0000-0000-0000-000000000006', 'Revoked', '__rls_revoked_news', 'Denied', 'Test');
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'revoked ADMINISTRATOR write was not denied'; END IF;
END $$;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000004","email":"__rls_owner@example.invalid"}',
  true
);
DO $$ BEGIN
  IF NOT public.has_permission(2048) THEN
    RAISE EXCEPTION 'Owner override assertion failed';
  END IF;
END $$;
INSERT INTO public.news_posts (id, title, slug, content, category)
VALUES ('30000000-0000-0000-0000-000000000005', 'Owner', '__rls_owner_news', 'Allowed', 'Test');

-- MANAGE_ROLES permits the membership-domain reads needed by the portal, but
-- never direct mutations. The trusted application database connection is the
-- only write path so its role hierarchy checks remain authoritative.
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000005","email":"__rls_role_manager@example.invalid"}',
  true
);
DO $$
BEGIN
  IF NOT public.has_permission(2) THEN
    RAISE EXCEPTION 'MANAGE_ROLES permission assertion failed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE user_id = '20000000-0000-0000-0000-000000000001'
  ) THEN
    RAISE EXCEPTION 'MANAGE_ROLES staff read was denied';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = '20000000-0000-0000-0000-000000000003'
      AND role_id = '10000000-0000-0000-0000-000000000002'
  ) THEN
    RAISE EXCEPTION 'MANAGE_ROLES assignment read was denied';
  END IF;
END $$;

DO $$
DECLARE
  denied boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.roles (id, name, color, permissions, position, is_owner, is_system)
    VALUES (
      '10000000-0000-0000-0000-000000000005',
      '__rls_escalated_admin',
      '#000000',
      1,
      999,
      false,
      false
    );
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'MANAGE_ROLES direct privileged role creation was not denied';
  END IF;
END $$;

DO $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.roles
  SET permissions = 1, is_owner = true
  WHERE id = '10000000-0000-0000-0000-000000000004';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN
    RAISE EXCEPTION 'MANAGE_ROLES direct role escalation was not denied';
  END IF;
END $$;

DO $$
DECLARE
  denied boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (
      '20000000-0000-0000-0000-000000000005',
      '10000000-0000-0000-0000-000000000002'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'MANAGE_ROLES direct self-assignment was not denied';
  END IF;
END $$;

DO $$
DECLARE
  affected integer;
BEGIN
  DELETE FROM public.staff_members
  WHERE user_id = '20000000-0000-0000-0000-000000000003';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN
    RAISE EXCEPTION 'MANAGE_ROLES direct staff revocation was not denied';
  END IF;
END $$;

RESET ROLE;
ROLLBACK;
