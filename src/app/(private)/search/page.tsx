import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { FileText, GraduationCap, MessageSquare, Calendar as CalIcon } from 'lucide-react';

export const dynamic = 'force-dynamic';

type Section = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  results: Array<{ id: string; title: string; subtitle?: string | null; href: string }>;
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = (searchParams.q ?? '').trim();
  const supabase = createSupabaseServerClient();
  const sections: Section[] = [];

  if (q.length >= 2) {
    // Intentamos primero búsqueda full-text con ranking (RPC global_search)
    const { data: rpcData, error: rpcErr } = await (supabase as any).rpc(
      'global_search',
      { p_query: q, p_limit: 40 }
    );

    if (!rpcErr && Array.isArray(rpcData) && rpcData.length > 0) {
      const groups: Record<string, Section> = {
        post: { key: 'community', label: 'Comunidad', icon: MessageSquare, results: [] },
        lesson: { key: 'classes', label: 'Clases', icon: GraduationCap, results: [] },
        resource: { key: 'resources', label: 'Recursos', icon: FileText, results: [] },
        event: { key: 'events', label: 'Eventos', icon: CalIcon, results: [] },
      };
      for (const row of rpcData as Array<{
        kind: 'post' | 'lesson' | 'resource' | 'event';
        id: string;
        title: string;
        snippet: string;
        link: string;
      }>) {
        const g = groups[row.kind];
        if (g) g.results.push({ id: row.id, title: row.title, subtitle: row.snippet, href: row.link });
      }
      sections.push(groups.post, groups.lesson, groups.resource, groups.event);
    } else {
      // Fallback ILIKE si el RPC no existe aún (migración no aplicada)
      const like = `%${q.replace(/[%_]/g, '\\$&')}%`;

      const [posts, lessons, resources, events] = await Promise.all([
        supabase
          .from('community_posts')
          .select('id, title, content, created_at')
          .eq('is_deleted', false)
          .or(`title.ilike.${like},content.ilike.${like}`)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('lessons')
          .select('id, title, description, is_published')
          .eq('is_published', true)
          .or(`title.ilike.${like},description.ilike.${like}`)
          .limit(10),
        supabase
          .from('resources')
          .select('id, title, description, is_published')
          .eq('is_published', true)
          .or(`title.ilike.${like},description.ilike.${like}`)
          .limit(10),
        supabase
          .from('events')
          .select('id, title, description, start_time')
          .or(`title.ilike.${like},description.ilike.${like}`)
          .order('start_time', { ascending: true })
          .limit(10),
      ]);

      sections.push({
        key: 'community',
        label: 'Comunidad',
        icon: MessageSquare,
        results: (posts.data ?? []).map((p: any) => ({
          id: p.id,
          title: p.title || (p.content?.slice(0, 80) ?? 'Publicación'),
          subtitle: p.title ? p.content?.slice(0, 120) : null,
          href: '/community',
        })),
      });
      sections.push({
        key: 'classes',
        label: 'Clases',
        icon: GraduationCap,
        results: (lessons.data ?? []).map((l: any) => ({
          id: l.id,
          title: l.title,
          subtitle: l.description,
          href: `/classes/${l.id}`,
        })),
      });
      sections.push({
        key: 'resources',
        label: 'Recursos',
        icon: FileText,
        results: (resources.data ?? []).map((r: any) => ({
          id: r.id,
          title: r.title,
          subtitle: r.description,
          href: '/resources',
        })),
      });
      sections.push({
        key: 'events',
        label: 'Eventos',
        icon: CalIcon,
        results: (events.data ?? []).map((e: any) => ({
          id: e.id,
          title: e.title,
          subtitle: e.description,
          href: '/calendar',
        })),
      });
    }
  }

  const total = sections.reduce((acc, s) => acc + s.results.length, 0);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Búsqueda global"
        title={q ? `Resultados para "${q}"` : 'Buscar en la plataforma'}
        description={
          q
            ? `${total} resultado${total === 1 ? '' : 's'} encontrado${total === 1 ? '' : 's'}.`
            : 'Escribe en la barra superior para buscar clases, recursos, publicaciones y eventos.'
        }
      />

      {!q ? (
        <p className="text-sm text-brand-muted">Ingresa al menos 2 caracteres.</p>
      ) : total === 0 ? (
        <p className="card-premium text-center text-sm text-brand-muted">
          Sin resultados. Probá con otras palabras clave.
        </p>
      ) : (
        <div className="space-y-6">
          {sections
            .filter((s) => s.results.length > 0)
            .map((section) => {
              const Icon = section.icon;
              return (
                <section key={section.key}>
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-brand-gold">
                    <Icon className="h-4 w-4" /> {section.label}
                  </h2>
                  <ul className="space-y-2">
                    {section.results.map((r) => (
                      <li key={r.id}>
                        <Link
                          href={r.href}
                          className="block rounded-md border border-[rgba(212,175,55,0.15)] bg-[#0d0d0d] p-3 transition hover:border-[rgba(212,175,55,0.4)]"
                        >
                          <p className="text-sm font-medium text-brand-text">{r.title}</p>
                          {r.subtitle && (
                            <p className="mt-1 line-clamp-2 text-xs text-brand-muted">
                              {r.subtitle}
                            </p>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
        </div>
      )}
    </div>
  );
}
