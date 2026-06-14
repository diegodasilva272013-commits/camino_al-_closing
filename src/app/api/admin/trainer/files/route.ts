import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/current-user';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await requireAdmin();
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('trainer_files')
      .select('id, name, size_bytes, created_at')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const name = file.name;
    const ext = name.split('.').pop()?.toLowerCase() ?? '';

    let content_text = '';

    if (ext === 'txt' || ext === 'md') {
      content_text = buffer.toString('utf-8');
    } else if (ext === 'pdf') {
      const pdfParse = require('pdf-parse');
      const parsed = await pdfParse(buffer);
      content_text = parsed.text;
    } else {
      return NextResponse.json({ error: 'Formato no soportado. Usá .txt, .md o .pdf' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('trainer_files')
      .insert({ name, content_text, size_bytes: file.size })
      .select('id, name, size_bytes, created_at')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
