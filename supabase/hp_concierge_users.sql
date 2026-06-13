-- HomePitch Analytics: Concierge CRM users.
-- Ruleaza acest SQL in proiectul Supabase al dashboardului hp-analytics.

CREATE TABLE IF NOT EXISTS public.hp_concierge_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  display_name text NOT NULL,
  email text,
  role text NOT NULL DEFAULT 'asistent',
  active boolean NOT NULL DEFAULT true,
  password_hash text NOT NULL,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hp_concierge_users_username_unique UNIQUE (username),
  CONSTRAINT hp_concierge_users_username_format CHECK (username ~ '^[a-z0-9._-]{3,80}$'),
  CONSTRAINT hp_concierge_users_role_check CHECK (role IN ('admin','asistent'))
);

ALTER TABLE public.hp_concierge_users
  ALTER COLUMN role SET DEFAULT 'asistent';

UPDATE public.hp_concierge_users
SET role = 'asistent'
WHERE role = 'agent';

ALTER TABLE public.hp_concierge_users
  DROP CONSTRAINT IF EXISTS hp_concierge_users_role_check;

ALTER TABLE public.hp_concierge_users
  ADD CONSTRAINT hp_concierge_users_role_check CHECK (role IN ('admin','asistent'));

CREATE INDEX IF NOT EXISTS hp_concierge_users_active_idx
  ON public.hp_concierge_users(active);
CREATE INDEX IF NOT EXISTS hp_concierge_users_role_idx
  ON public.hp_concierge_users(role);

CREATE OR REPLACE FUNCTION public.hp_concierge_users_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hp_concierge_users_updated_at ON public.hp_concierge_users;
CREATE TRIGGER hp_concierge_users_updated_at
  BEFORE UPDATE ON public.hp_concierge_users
  FOR EACH ROW
  EXECUTE FUNCTION public.hp_concierge_users_set_updated_at();

ALTER TABLE public.hp_concierge_users ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.hp_concierge_users
  TO service_role;

INSERT INTO public.hp_concierge_users (
  username,
  display_name,
  email,
  role,
  active,
  password_hash
) VALUES (
  'crmadmin',
  'CRM Admin',
  null,
  'admin',
  true,
  'scrypt:hpcrmadmin20260613:7ff85a48fbd6bf446b2e1f0b774f4f1f91d442128630e64b33cc457123dfb2ab7cc1e8e2d046ed5b91521a80204cd187d7a8a46377a714c854218afdf3e34fd4'
)
ON CONFLICT (username) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  role = EXCLUDED.role,
  active = EXCLUDED.active,
  password_hash = EXCLUDED.password_hash,
  updated_at = now();

COMMENT ON TABLE public.hp_concierge_users IS
  'Internal CRM users for HomePitch Concierge. Admin users can access the full analytics dashboard; asistent users are limited to Concierge CRM.';
