import { notFound } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { IntervencionClient } from './_client';

export const dynamic = 'force-dynamic';

export default async function NuevaIntervencionPage({
  searchParams,
}: {
  searchParams: { patron_id?: string; persona_id?: string };
}) {
  const admin = createSupabaseAdminClient() as any;
  const { patron_id, persona_id } = searchParams;

  if (!patron_id || !persona_id) notFound();

  const [{ data: patron }, { data: persona }] = await Promise.all([
    admin.from('patrones').select('*, capacidad:capacidades(id, nombre)').eq('id', patron_id).single(),
    admin.from('personas').select('id, nombre').eq('id', persona_id).single(),
  ]);

  if (!patron || !persona) notFound();

  return <IntervencionClient patron={patron} persona={persona} />;
}
