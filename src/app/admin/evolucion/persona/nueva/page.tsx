import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { ArrowLeft } from 'lucide-react';
import { AgregarPersonaClient } from './_client';

export const dynamic = 'force-dynamic';

export default async function NuevaPersonaPage() {
  const admin = createSupabaseAdminClient() as any;

  // Usuarios de la plataforma (setters y admin)
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, email, created_at, role')
    .in('role', ['setter', 'admin', 'mentor'])
    .order('full_name');

  // Personas ya agregadas al sistema de evolución (para excluirlas)
  const { data: yaAgregadas } = await admin
    .from('personas')
    .select('email');

  const emailsYaAgregados = new Set((yaAgregadas ?? []).map((p: any) => p.email));

  const disponibles = (profiles ?? []).filter(
    (p: any) => p.email && !emailsYaAgregados.has(p.email)
  );

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
        title="Agregar persona al seguimiento"
        description="Seleccioná un usuario de la plataforma para hacer seguimiento de su evolución."
      />

      <AgregarPersonaClient usuarios={disponibles} />
    </div>
  );
}
