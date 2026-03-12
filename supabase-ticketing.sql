-- Ticketing / incident / support system.
-- Run this in Supabase Dashboard → SQL Editor (same project as your app).
-- Requires: public.items and public.profiles (id, role) to exist.
-- Optional: Add full_name or email to profiles for assignee display; allow SELECT for authenticated (see bottom).

-- 1) Tickets table (device link optional: link when ticket is about a device, else null)
CREATE TABLE IF NOT EXISTS public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'Open',
  priority text NOT NULL DEFAULT 'Medium',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_item_id ON public.tickets(item_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON public.tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON public.tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_updated_at ON public.tickets(updated_at DESC);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read tickets" ON public.tickets;
DROP POLICY IF EXISTS "Allow authenticated insert tickets" ON public.tickets;
DROP POLICY IF EXISTS "Allow assignee or admin update tickets" ON public.tickets;
DROP POLICY IF EXISTS "Allow admin delete tickets" ON public.tickets;

CREATE POLICY "Allow authenticated read tickets"
  ON public.tickets FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert tickets"
  ON public.tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Allow assignee or admin update tickets"
  ON public.tickets FOR UPDATE TO authenticated
  USING (
    assigned_to = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    assigned_to = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "Allow admin delete tickets"
  ON public.tickets FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Trigger to keep updated_at in sync
CREATE OR REPLACE FUNCTION public.set_ticket_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tickets_updated_at ON public.tickets;
CREATE TRIGGER tickets_updated_at
  BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.set_ticket_updated_at();

-- 2) Ticket comments
CREATE TABLE IF NOT EXISTS public.ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON public.ticket_comments(ticket_id);

ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read ticket_comments for visible tickets" ON public.ticket_comments;
DROP POLICY IF EXISTS "Allow authenticated insert ticket_comments" ON public.ticket_comments;
DROP POLICY IF EXISTS "Allow assignee or admin delete ticket_comments" ON public.ticket_comments;

CREATE POLICY "Allow read ticket_comments for visible tickets"
  ON public.ticket_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_comments.ticket_id));

CREATE POLICY "Allow authenticated insert ticket_comments"
  ON public.ticket_comments FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_comments.ticket_id)
  );

CREATE POLICY "Allow assignee or admin delete ticket_comments"
  ON public.ticket_comments FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_comments.ticket_id
      AND (t.assigned_to = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
    )
  );

-- 3) Ticket attachments (metadata; files go in Storage bucket ticket-attachments)
CREATE TABLE IF NOT EXISTS public.ticket_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket_id ON public.ticket_attachments(ticket_id);

ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read ticket_attachments for visible tickets" ON public.ticket_attachments;
DROP POLICY IF EXISTS "Allow assignee or admin insert ticket_attachments" ON public.ticket_attachments;
DROP POLICY IF EXISTS "Allow assignee or admin delete ticket_attachments" ON public.ticket_attachments;

CREATE POLICY "Allow read ticket_attachments for visible tickets"
  ON public.ticket_attachments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_attachments.ticket_id));

CREATE POLICY "Allow assignee or admin insert ticket_attachments"
  ON public.ticket_attachments FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = uploaded_by
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_attachments.ticket_id
      AND (t.assigned_to = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
    )
  );

-- Uploader can delete their own; assignee or admin can delete any attachment on the ticket
CREATE POLICY "Allow assignee or admin delete ticket_attachments"
  ON public.ticket_attachments FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_attachments.ticket_id
      AND (t.assigned_to = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
    )
  );

-- 4) Storage bucket: create ticket-attachments (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ticket-attachments',
  'ticket-attachments',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: allow authenticated to read/insert/delete objects in ticket-attachments
-- Path format: {ticket_id}/{attachment_id}/{file_name} so we can check ticket access
DROP POLICY IF EXISTS "Allow read ticket attachments for visible tickets" ON storage.objects;
DROP POLICY IF EXISTS "Allow insert ticket attachments for assignee or admin" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete ticket attachments for assignee or admin" ON storage.objects;

CREATE POLICY "Allow read ticket attachments for visible tickets"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'ticket-attachments'
    AND EXISTS (
      SELECT 1 FROM public.ticket_attachments a
      WHERE a.storage_path = (storage.objects.name)
      AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = a.ticket_id)
    )
  );

CREATE POLICY "Allow insert ticket attachments for assignee or admin"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ticket-attachments'
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = (split_part(name, '/', 1))::uuid
      AND (t.assigned_to = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
    )
  );

-- Uploader can delete their own file; assignee or admin can delete any attachment on the ticket
CREATE POLICY "Allow delete ticket attachments for assignee or admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'ticket-attachments'
    AND EXISTS (
      SELECT 1 FROM public.ticket_attachments a
      WHERE a.storage_path = (storage.objects.name)
      AND (
        a.uploaded_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.tickets t
          WHERE t.id = a.ticket_id
          AND (t.assigned_to = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
        )
      )
    )
  );

-- 5) Profiles: allow authenticated to read (for assignee dropdown); add full_name if missing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;

DROP POLICY IF EXISTS "Allow authenticated read profiles for assignee" ON public.profiles;
CREATE POLICY "Allow authenticated read profiles for assignee"
  ON public.profiles FOR SELECT TO authenticated USING (true);

-- If you already ran an earlier version with item_id NOT NULL, run this once:
ALTER TABLE public.tickets ALTER COLUMN item_id DROP NOT NULL;
