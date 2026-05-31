import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getLevel } from '@/lib/levels';
import {
  LevelProgressCard,
  PointsLegend,
} from '@/components/community/level-badge';
import { AvatarUploader } from './_components/avatar-uploader';
import { AiAvatarStudio } from './_components/ai-avatar-studio';
import { ClientErrorBoundary } from './_components/error-boundary';
import { PushOptIn } from './_components/push-opt-in';
import { ProfileForm } from './_components/profile-form';
import { PasswordForm } from './_components/password-form';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'full_name, email, avatar_url, bio, role, points, phone, city, country, website, instagram, is_public, current_streak, longest_streak, ai_avatar_credits, ai_avatar_style, ai_avatar_url'
    )
    .eq('id', user.id)
    .maybeSingle();

  const p = (profile ?? {}) as {
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
    bio: string | null;
    role: string | null;
    points: number | null;
    phone: string | null;
    city: string | null;
    country: string | null;
    website: string | null;
    instagram: string | null;
    is_public: boolean | null;
    current_streak: number | null;
    longest_streak: number | null;
    ai_avatar_credits: number | null;
    ai_avatar_style: 'pixar' | 'cartoon' | 'marvel' | null;
    ai_avatar_url: string | null;
  };

  const [{ count: postsCount }, { count: commentsCount }] = await Promise.all([
    supabase
      .from('community_posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_deleted', false),
    supabase
      .from('community_comments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
  ]);

  const { data: likeRows } = await supabase
    .from('post_likes')
    .select('post_id, community_posts!inner(user_id)')
    .eq('community_posts.user_id', user.id);
  const likesReceived = likeRows?.length ?? 0;

  // Badges, certificados, lecciones completadas
  const [badgesRes, certsRes, lessonsDoneRes] = await Promise.all([
    supabase
      .from('user_badges')
      .select('badge_code, earned_at, badges(title, description, icon)')
      .eq('user_id', user.id)
      .order('earned_at', { ascending: false }),
    supabase
      .from('certificates')
      .select('id, code, issued_at, courses(title)')
      .eq('user_id', user.id)
      .order('issued_at', { ascending: false }),
    supabase
      .from('lesson_progress')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('completed', true),
  ]);
  const badges = (badgesRes.data ?? []) as any[];
  const certs = (certsRes.data ?? []) as any[];
  const lessonsDone = lessonsDoneRes.count ?? 0;

  const initial = (p.full_name?.trim()?.charAt(0) ?? user.email?.charAt(0) ?? '?').toUpperCase();
  const displayName = p.full_name?.trim() || user.email?.split('@')[0] || 'Tu perfil';

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Perfil"
        title={`Hola, ${displayName}`}
        description="Editá tu información, tu foto y mirá cómo subís de nivel en la comunidad."
      />

      <div className="mb-5 flex items-center justify-end">
        <Link
          href={`/u/${user.id}`}
          className="text-xs text-brand-muted underline-offset-4 hover:text-brand-gold hover:underline"
        >
          Ver mi perfil público →
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <aside className="space-y-5 lg:col-span-1">
          <div className="card-premium flex flex-col items-center gap-4">
            <AvatarUploader currentUrl={p.avatar_url} fallbackInitial={initial} />
            <div className="text-center">
              <h2 className="text-lg font-semibold text-brand-text">{displayName}</h2>
              <p className="text-xs text-brand-muted">{user.email}</p>
              {p.role && (
                <span className="mt-2 inline-block rounded-full border border-brand-gold/30 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-brand-gold">
                  {p.role}
                </span>
              )}
            </div>
          </div>

          <LevelProgressCard points={p.points ?? 0} />

          <div className="card-premium">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-brand-muted">Racha</p>
                <p className="mt-1 text-2xl font-bold text-brand-gold">
                  🔥 {p.current_streak ?? 0}
                  <span className="ml-1 text-xs font-normal text-brand-muted">días seguidos</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-brand-muted">Máximo</p>
                <p className="text-sm font-semibold text-white">{p.longest_streak ?? 0} días</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Posts" value={postsCount ?? 0} />
            <Stat label="Coment." value={commentsCount ?? 0} />
            <Stat label="Likes" value={likesReceived} />
            <Stat label="Clases" value={lessonsDone} />
          </div>

          <PointsLegend />
        </aside>

        <div className="space-y-5 lg:col-span-2">
          <ClientErrorBoundary label="Avatar IA Studio">
            <AiAvatarStudio
              credits={p.ai_avatar_credits ?? 0}
              currentLevel={getLevel(p.points ?? 0).level}
              currentStyle={p.ai_avatar_style ?? null}
              currentAiAvatar={p.ai_avatar_url ?? null}
            />
          </ClientErrorBoundary>

          <PushOptIn />

          <section className="card-premium">
            <h3 className="mb-3 text-base font-semibold text-brand-text">
              🏅 Logros
            </h3>
            {badges.length === 0 ? (
              <p className="text-sm text-brand-muted">
                Aún no desbloqueaste ninguno. Participá en la comunidad, completá clases y mantén tu racha activa.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {badges.map((b: any) => (
                  <div
                    key={b.badge_code}
                    className="rounded-xl border border-brand-gold/30 bg-gradient-to-br from-brand-gold/15 to-transparent p-3"
                    title={b.badges?.description ?? ''}
                  >
                    <p className="text-sm font-semibold text-brand-gold">
                      {b.badges?.title ?? b.badge_code}
                    </p>
                    {b.badges?.description ? (
                      <p className="mt-0.5 text-[11px] text-brand-muted">
                        {b.badges.description}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[10px] text-brand-muted">
                      {new Date(b.earned_at).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {certs.length > 0 ? (
            <section className="card-premium">
              <h3 className="mb-3 text-base font-semibold text-brand-text">
                🎓 Certificados
              </h3>
              <ul className="divide-y divide-white/5">
                {certs.map((c: any) => (
                  <li key={c.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {c.courses?.title ?? 'Curso'}
                      </p>
                      <p className="text-[11px] text-brand-muted">
                        Código: {c.code} · {new Date(c.issued_at).toLocaleDateString('es-AR')}
                      </p>
                    </div>
                    <a
                      href={`/api/certificates/${c.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost-gold"
                    >
                      Descargar
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="card-premium">
            <h3 className="mb-1 text-base font-semibold text-brand-text">
              Información del perfil
            </h3>
            <p className="mb-5 text-xs text-brand-muted">
              Estos datos los verán otros miembros si tu perfil es público.
            </p>
            <ProfileForm
              profile={{
                full_name: p.full_name,
                bio: p.bio,
                phone: p.phone,
                city: p.city,
                country: p.country,
                website: p.website,
                instagram: p.instagram,
                is_public: p.is_public ?? true,
              }}
            />
          </section>

          <section className="card-premium">
            <h3 className="mb-1 text-base font-semibold text-brand-text">
              Seguridad
            </h3>
            <p className="mb-4 text-xs text-brand-muted">
              Cambiá la contraseña con la que ingresás a la plataforma.
            </p>
            <PasswordForm />
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[rgba(212,175,55,0.18)] bg-[#0c0c0c] p-3 text-center">
      <p className="text-lg font-bold text-brand-gold">
        {value.toLocaleString('es-ES')}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-brand-muted">{label}</p>
    </div>
  );
}
