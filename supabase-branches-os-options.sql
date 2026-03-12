-- Category options, Branches, and OS options for dropdowns (DB-driven in ItemForm).
-- Run this in Supabase Dashboard → SQL Editor.
-- Tables: public.categories, public.branches, public.os_options (each: id uuid, name text).

-- 1) Category options
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read categories" ON public.categories;
DROP POLICY IF EXISTS "Allow read categories anon" ON public.categories;
DROP POLICY IF EXISTS "Allow insert categories" ON public.categories;
DROP POLICY IF EXISTS "Allow update categories" ON public.categories;
DROP POLICY IF EXISTS "Allow delete categories" ON public.categories;
CREATE POLICY "Allow read categories"
  ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read categories anon"
  ON public.categories FOR SELECT TO anon USING (true);
CREATE POLICY "Allow insert categories"
  ON public.categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update categories"
  ON public.categories FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete categories"
  ON public.categories FOR DELETE TO authenticated USING (true);

INSERT INTO public.categories (name) VALUES
  ('Laptop'),
  ('Desktop'),
  ('Monitor'),
  ('Keyboard'),
  ('Mouse'),
  ('Headset'),
  ('Peripheral')
ON CONFLICT (name) DO NOTHING;

-- 2) Branches
CREATE TABLE IF NOT EXISTS public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read branches" ON public.branches;
DROP POLICY IF EXISTS "Allow read branches anon" ON public.branches;
DROP POLICY IF EXISTS "Allow insert branches" ON public.branches;
DROP POLICY IF EXISTS "Allow update branches" ON public.branches;
DROP POLICY IF EXISTS "Allow delete branches" ON public.branches;
CREATE POLICY "Allow read branches"
  ON public.branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read branches anon"
  ON public.branches FOR SELECT TO anon USING (true);
CREATE POLICY "Allow insert branches"
  ON public.branches FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update branches"
  ON public.branches FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete branches"
  ON public.branches FOR DELETE TO authenticated USING (true);

INSERT INTO public.branches (name) VALUES
  ('Australia'),
  ('Makati'),
  ('Laoag')
ON CONFLICT (name) DO NOTHING;

-- 3) OS options
CREATE TABLE IF NOT EXISTS public.os_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

ALTER TABLE public.os_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read os_options" ON public.os_options;
DROP POLICY IF EXISTS "Allow read os_options anon" ON public.os_options;
DROP POLICY IF EXISTS "Allow insert os_options" ON public.os_options;
DROP POLICY IF EXISTS "Allow update os_options" ON public.os_options;
DROP POLICY IF EXISTS "Allow delete os_options" ON public.os_options;
CREATE POLICY "Allow read os_options"
  ON public.os_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read os_options anon"
  ON public.os_options FOR SELECT TO anon USING (true);
CREATE POLICY "Allow insert os_options"
  ON public.os_options FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update os_options"
  ON public.os_options FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete os_options"
  ON public.os_options FOR DELETE TO authenticated USING (true);

INSERT INTO public.os_options (name) VALUES
  ('Windows 7'),
  ('Windows 8'),
  ('Windows 8.1'),
  ('Windows 10'),
  ('Windows 10 Home'),
  ('Windows 10 Pro'),
  ('Windows 10 Enterprise'),
  ('Windows 10 Education'),
  ('Windows 11'),
  ('Windows 11 Home'),
  ('Windows 11 Pro'),
  ('Windows 11 Enterprise'),
  ('Windows 11 Education'),
  ('macOS'),
  ('Ubuntu'),
  ('Linux (Other)'),
  ('Chrome OS'),
  ('Other')
ON CONFLICT (name) DO NOTHING;
