-- Bucket de Supabase Storage para videos grabados
-- El bucket es PRIVADO — solo acceso por admin con service role.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('grabaciones', 'grabaciones', false, 524288000, ARRAY['video/mp4', 'video/quicktime', 'video/webm'])
ON CONFLICT (id) DO NOTHING;

-- RLS: solo service role puede leer/escribir (el backend usa admin client)
CREATE POLICY "admin_service_role_only" ON storage.objects
  FOR ALL USING (bucket_id = 'grabaciones' AND auth.role() = 'service_role');
