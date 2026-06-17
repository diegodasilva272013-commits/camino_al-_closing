import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { ArrowLeft } from 'lucide-react';
import { CatalogoClient } from './_client';
import type { CatalogoComportamiento, Capacidad } from '@/types/evolucion';

export const dynamic = 'force-dynamic';

export default async function CatalogoPage() {
  const admin = createSupabaseAdminClient() as any;

  const [{ data: capacidades }, { data: aprobados }, { data: candidatos }] = await Promise.all([
    admin.from('capacidades').select('*').eq('activo', true).order('orden'),
    admin
      .from('catalogo_comportamientos')
      .select('*, capacidad:capacidades(id, nombre, orden)')
      .eq('estado_revision', 'aprobado')
      .order('capacidad_id'),
    admin
      .from('catalogo_comportamientos')
      .select('*, capacidad:capacidades(id, nombre, orden)')
      .eq('estado_revision', 'candidato')
      .gte('veces_observado', 3)
      .order('veces_observado', { ascending: false }),
  ]);

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8">
      <Link
        href="/admin/evolucion"
        className="mb-4 inline-flex items-center gap-2 text-xs text-brand-muted hover:text-brand-text transition"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Volver al dashboard
      </Link>

      <PageHeader
        eyebrow="Admin · Evolución"
        title="Catálogo de comportamientos"
        description="Revisá, aprobá o descartá comportamientos observados frecuentemente."
      />

      <CatalogoClient
        capacidades={(capacidades ?? []) as Capacidad[]}
        aprobados={(aprobados ?? []) as CatalogoComportamiento[]}
        candidatos={(candidatos ?? []) as CatalogoComportamiento[]}
      />
    </div>
  );
}
