import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { UploadLeadsExcel } from './_components/UploadLeadsExcel';
import { ReasignarSinSetter } from './_components/ReasignarSinSetter';
import { LimpiarDuplicados } from './_components/LimpiarDuplicados';

export const dynamic = 'force-dynamic';

export default function ImportarLeadsPage() {
  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8">
      <PageHeader
        eyebrow="Admin · Leads"
        title="Importar Leads desde Excel"
        description="Subí un .xlsx con una hoja por setter (o una base completa) para cargar y asignar leads automáticamente."
      />

      <Link
        href="/admin/leads"
        className="mt-4 inline-flex items-center gap-2 text-xs text-brand-muted hover:text-brand-gold transition"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver a Gestión de Leads
      </Link>

      <div className="mt-6 max-w-2xl">
        <LimpiarDuplicados />
        <div className="mt-6">
          <UploadLeadsExcel />
        </div>
        <ReasignarSinSetter />
      </div>
    </div>
  );
}
