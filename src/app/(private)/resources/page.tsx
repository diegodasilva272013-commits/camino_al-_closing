import Link from 'next/link';
import { Download, ExternalLink, FileText } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { RESOURCE_CATEGORIES } from '@/constants/categories';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: { cat?: string };
}) {
  const supabase = createSupabaseServerClient();
  const activeCat = searchParams.cat ?? null;

  let query = supabase
    .from('resources')
    .select('id, title, description, file_url, external_url, category, created_at')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(200);

  if (activeCat && (RESOURCE_CATEGORIES as readonly string[]).includes(activeCat)) {
    query = query.eq('category', activeCat);
  }

  const { data } = await query;
  const items = (data ?? []) as any[];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Recursos"
        title="Biblioteca de materiales"
        description="PDFs, plantillas, guiones, ejercicios, grabaciones y bonos."
      />

      <nav className="mb-6 -mx-1 overflow-x-auto">
        <ul className="flex min-w-max items-center gap-2 px-1">
          <li>
            <Link
              href="/resources"
              className={
                'inline-flex items-center rounded-full border px-3.5 py-1.5 text-xs font-medium transition ' +
                (!activeCat
                  ? 'border-brand-gold bg-[#1a1408] text-brand-gold'
                  : 'border-[rgba(212,175,55,0.18)] text-brand-muted hover:border-[rgba(212,175,55,0.4)] hover:text-brand-text')
              }
            >
              Todas
            </Link>
          </li>
          {RESOURCE_CATEGORIES.map((c) => {
            const active = activeCat === c;
            return (
              <li key={c}>
                <Link
                  href={`/resources?cat=${encodeURIComponent(c)}`}
                  className={
                    'inline-flex items-center rounded-full border px-3.5 py-1.5 text-xs font-medium transition ' +
                    (active
                      ? 'border-brand-gold bg-[#1a1408] text-brand-gold'
                      : 'border-[rgba(212,175,55,0.18)] text-brand-muted hover:border-[rgba(212,175,55,0.4)] hover:text-brand-text')
                  }
                >
                  {c}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {items.length === 0 ? (
        <div className="card-premium text-center">
          <p className="text-sm text-brand-text">No hay recursos publicados aún.</p>
          <p className="mt-1 text-xs text-brand-muted">
            El admin puede subir recursos desde el panel.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((r) => {
            const url = r.file_url || r.external_url;
            return (
              <div key={r.id} className="card-premium flex flex-col">
                <p className="text-[11px] uppercase tracking-[0.18em] text-brand-gold">
                  {r.category}
                </p>
                <h3 className="mt-2 flex items-center gap-2 text-base font-semibold text-brand-text">
                  <FileText className="h-4 w-4 text-brand-gold" />
                  {r.title}
                </h3>
                {r.description && (
                  <p className="mt-2 line-clamp-3 text-sm text-brand-muted">{r.description}</p>
                )}
                {url && (
                  <Link
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex w-fit items-center gap-2 text-sm text-brand-gold hover:underline"
                  >
                    {r.file_url ? (
                      <>
                        <Download className="h-3.5 w-3.5" /> Descargar
                      </>
                    ) : (
                      <>
                        <ExternalLink className="h-3.5 w-3.5" /> Abrir enlace
                      </>
                    )}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
