import { notFound } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import type { CatalogoComportamiento, Capacidad } from '@/types/evolucion';
import { EtiquetadoClient } from './_client';

export const dynamic = 'force-dynamic';

export default async function EtiquetarPage({ params }: { params: { id: string } }) {
  const admin = createSupabaseAdminClient() as any;
  const { id: evidencia_id } = params;

  const [{ data: evidencia }, { data: capacidades }, { data: catalogo }] = await Promise.all([
    admin.from('evidencias').select('*, persona:personas(id, nombre)').eq('id', evidencia_id).single(),
    admin.from('capacidades').select('*').eq('activo', true).order('orden'),
    admin
      .from('catalogo_comportamientos')
      .select('*, capacidad:capacidades(id, nombre, orden)')
      .eq('estado_revision', 'aprobado')
      .order('capacidad_id'),
  ]);

  if (!evidencia) notFound();

  return (
    <EtiquetadoClient
      evidencia={evidencia}
      capacidades={(capacidades ?? []) as Capacidad[]}
      catalogo={(catalogo ?? []) as CatalogoComportamiento[]}
    />
  );
}
