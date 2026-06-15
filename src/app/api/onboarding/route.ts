import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const admin = createSupabaseAdminClient();
    const formData = await req.formData();

    const content = String(formData.get('content') ?? '').trim();
    if (!content) return NextResponse.json({ error: 'El texto de presentación es obligatorio.' }, { status: 400 });

    let image_url: string | null = null;
    let media_url: string | null = null;
    let media_type: string | null = null;

    // Upload photo if provided
    const photo = formData.get('photo') as File | null;
    if (photo && photo.size > 0) {
      const ext = photo.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `onboarding/${user.id}-photo.${ext}`;
      const bytes = await photo.arrayBuffer();
      const { error: uploadError } = await admin.storage
        .from('community')
        .upload(path, Buffer.from(bytes), {
          contentType: photo.type,
          upsert: true,
        });
      if (!uploadError) {
        const { data: urlData } = admin.storage.from('community').getPublicUrl(path);
        image_url = urlData.publicUrl;
      }
    }

    // Upload audio if provided
    const audio = formData.get('audio') as File | null;
    if (audio && audio.size > 0) {
      const ext = audio.name.split('.').pop()?.toLowerCase() ?? 'webm';
      const path = `onboarding/${user.id}-audio.${ext}`;
      const bytes = await audio.arrayBuffer();
      const { error: uploadError } = await admin.storage
        .from('community')
        .upload(path, Buffer.from(bytes), {
          contentType: audio.type,
          upsert: true,
        });
      if (!uploadError) {
        const { data: urlData } = admin.storage.from('community').getPublicUrl(path);
        media_url = urlData.publicUrl;
        media_type = 'audio';
      }
    }

    // Create the intro post
    const { error: postError } = await admin
      .from('community_posts')
      .insert({
        user_id:    user.id,
        category:   'presentacion',
        content,
        image_url,
        media_url,
        media_type,
        is_pinned:  false,
        is_deleted: false,
      });

    if (postError) return NextResponse.json({ error: postError.message }, { status: 500 });

    // Mark onboarding done in profile
    await admin
      .from('profiles')
      .update({ onboarding_completed: ['intro_post'] })
      .eq('id', user.id);

    // Mark in auth metadata via admin client (más confiable en Route Handlers)
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: { onboarding_done: true },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
