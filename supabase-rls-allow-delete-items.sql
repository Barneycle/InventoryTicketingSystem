-- Fix: Deletes must work for all items (including CSV-imported).
-- Run this ENTIRE script in Supabase Dashboard → SQL Editor (same project as your app).
--
-- The app calls the function delete_items(ids) to delete. This function runs with
-- SECURITY DEFINER so it bypasses RLS and can always delete. You must run this
-- script once for delete to work.

-- 1) Function that bypasses RLS (required for the app)
CREATE OR REPLACE FUNCTION public.delete_items(ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.items WHERE id = ANY(ids);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_items(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.delete_items(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_items(uuid[]) TO anon;

-- 2) Optional: also fix RLS so direct access is consistent
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'items' AND (cmd = 'DELETE' OR cmd = '*')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', rec.policyname, rec.schemaname, rec.tablename);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Allow authenticated delete items" ON public.items;
CREATE POLICY "Allow authenticated delete items"
  ON public.items FOR DELETE TO authenticated USING (true);
