import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const PHONES = [
  '50244990907','543855032838','5217752053669','5492616254454','541136552770',
  '51987590992','543764688412','573237335807','5493512478385','5492634367332',
  '543704782461','5492254586431','14073009227','542604021082','5491125222055',
  '5491133225452','541127387170','5492664773904','573016565588','5491150125729',
  '50767972259','5493794520437','12142644770','5491168897975','1573054167082',
  '593987115301','5493512957068','5493413929563','5713106533504','5492213043512',
  '573234369080','5493425971715','5493888688728','50766267303','5493883631111',
  '542617219951','543873622861','5491123994313','573232385918','5491156210974',
  '5491135994543','5492235930977','5215549664371','595983041910','5493855902147',
  '34654300547','542616405767','543425912267','5219642252796','56949911144',
  '50376358616','543416146714','524499900972','5492994623883','541133143194',
  '542478541605','5491133117479','541168296243','5493547319013','5492214590559',
  '5493813219054','573044422779','542617481452','56963995664','543772629008',
  '543534099602','595981571595','543735310238','543875997384','5491158211739',
  '5491164097580','5493364579667','543416828822','541163606414','34613866018',
  '5522996140917','541126666918','5491136599910','59178079428','543751404684',
  '543572686499','542634845737','5492323618610','34633551523','5493755237784',
  '542966750920','542617059042','5492916480905','541125792443','5492324691808',
  '573188105222','5493406437201','5492944712050','51928435077','5492964560371',
  '5493875818773','593987794335','573105005053','542224534740','5493512425633',
];

export async function GET(req: NextRequest) {
  // Auth check — solo admins
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Solo admins' }, { status: 403 });

  const admin  = createSupabaseAdminClient();
  const apply  = req.nextUrl.searchParams.get('fix') === 'true';

  // ── 1. Estado de los leads de Fede por teléfono ──────────────────────────
  const { data: byPhone } = await admin
    .from('leads')
    .select('id, first_name, last_name, phone, current_status, is_closed, assigned_to_user_id, batch_id')
    .in('phone', PHONES);

  const encontrados = byPhone?.length ?? 0;
  const noEncontrados = PHONES.length - encontrados;

  // Agrupar por estado
  const cerradosAccidental = (byPhone ?? []).filter(
    l => l.is_closed && l.current_status !== 'NO_CALIFICA'
  );
  const sinAsignar = (byPhone ?? []).filter(l => !l.assigned_to_user_id);

  // ── 2. Diagnóstico sistémico: leads cerrados con status no terminal ───────
  // Afecta a TODOS los setters, no solo Fede
  const { data: sistemicoData } = await admin.rpc('count_accidental_closed' as any).catch(() => ({ data: null }));

  // Fallback: query directa
  const { data: sistemicoRaw, count: sistemicoCount } = await admin
    .from('leads')
    .select('id, assigned_to_user_id, current_status', { count: 'exact' })
    .eq('is_closed', true)
    .not('current_status', 'in', '(NO_CALIFICA)')
    .not('assigned_to_user_id', 'is', null)
    .limit(5);

  // ── 3. Si fix=true, reabrir leads cerrados accidentalmente ───────────────
  let fixResult = null;
  if (apply) {
    // Reabrir los de la lista de Fede cerrados accidentalmente
    if (cerradosAccidental.length > 0) {
      const ids = cerradosAccidental.map(l => l.id);
      const { error } = await admin
        .from('leads')
        .update({ is_closed: false, updated_at: new Date().toISOString() })
        .in('id', ids);
      fixResult = error
        ? { error: error.message }
        : { reabiertos: ids.length, ids };
    } else {
      fixResult = { mensaje: 'No había leads cerrados accidentalmente en la lista de Fede' };
    }
  }

  return NextResponse.json({
    busqueda_fede: {
      telefonos_buscados: PHONES.length,
      encontrados,
      no_encontrados_en_db: noEncontrados,
      cerrados_accidental: cerradosAccidental.length,
      sin_asignar: sinAsignar.length,
      detalle: byPhone?.map(l => ({
        nombre: `${l.first_name} ${l.last_name ?? ''}`.trim(),
        phone: l.phone,
        status: l.current_status,
        is_closed: l.is_closed,
        asignado: l.assigned_to_user_id ? '✓' : '✗ SIN ASIGNAR',
        batch: l.batch_id,
      })),
    },
    sistemico: {
      leads_cerrados_accidental_total: sistemicoCount ?? '(no disponible)',
      muestra: sistemicoRaw?.map(l => ({ id: l.id, status: l.current_status })),
      nota: 'Leads con is_closed=true pero current_status != NO_CALIFICA — afecta a todos los setters',
    },
    fix: apply ? fixResult : {
      instruccion: 'Agregar ?fix=true a la URL para reabrir los leads cerrados accidentalmente',
    },
  });
}
