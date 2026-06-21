import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (p?.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    // Total messages sent
    const { count: totalMessages } = await (admin as any)
      .from('prospecting_messages')
      .select('id', { count: 'exact', head: true });

    // Distinct leads contacted
    const { data: contactedData } = await (admin as any)
      .from('prospecting_messages')
      .select('lead_id')
      .limit(50000);
    const leadsContacted = new Set((contactedData ?? []).map((r: any) => r.lead_id)).size;

    // Conversations with at least one inbound message (responded)
    const { data: respondedConvs } = await (admin as any)
      .from('prospecting_conversation_messages')
      .select('setter_id, conversation_id')
      .eq('direction', 'inbound')
      .limit(50000);
    const respondedConvIds = new Set((respondedConvs ?? []).map((r: any) => r.conversation_id));
    const responsesReceived = respondedConvIds.size;

    // AI evaluations
    const { data: evals } = await (admin as any)
      .from('ai_prospecting_evaluations')
      .select('setter_id, score_total, score_opening, score_connection, score_defense_handling, score_rapport, score_commercial_criteria')
      .limit(10000);
    const evalList: any[] = evals ?? [];
    const avgScore = evalList.length > 0
      ? Math.round(evalList.reduce((s: number, e: any) => s + (e.score_total ?? 0), 0) / evalList.length * 10) / 10
      : null;

    // Per-setter breakdown
    const { data: allMessages } = await (admin as any)
      .from('prospecting_messages')
      .select('setter_id, lead_id')
      .limit(50000);
    const msgs: any[] = allMessages ?? [];

    const { data: allSetterIds } = await admin
      .from('profiles')
      .select('id, full_name, email, role')
      .in('role', ['setter', 'admin']);

    const profileMap = new Map((allSetterIds ?? []).map((p: any) => [p.id, p]));

    const setterMsgMap = new Map<string, Set<string>>();
    for (const m of msgs) {
      if (!setterMsgMap.has(m.setter_id)) setterMsgMap.set(m.setter_id, new Set());
      setterMsgMap.get(m.setter_id)!.add(m.lead_id);
    }

    const setterResponseMap = new Map<string, number>();
    for (const m of respondedConvs ?? []) {
      setterResponseMap.set(m.setter_id, (setterResponseMap.get(m.setter_id) ?? 0) + 1);
    }

    const setterScoreMap = new Map<string, number[]>();
    for (const e of evalList) {
      if (!setterScoreMap.has(e.setter_id)) setterScoreMap.set(e.setter_id, []);
      setterScoreMap.get(e.setter_id)!.push(e.score_total ?? 0);
    }

    const ranking = [...setterMsgMap.entries()].map(([sid, leads]) => {
      const profile = profileMap.get(sid);
      const contacted = leads.size;
      const responses = setterResponseMap.get(sid) ?? 0;
      const scores = setterScoreMap.get(sid) ?? [];
      const avgAI = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10 : null;
      const responseRate = contacted > 0 ? Math.round((responses / contacted) * 100) : 0;
      return {
        setter_id: sid,
        name: profile?.full_name ?? profile?.email ?? sid.slice(0, 8),
        leads_contacted: contacted,
        messages_sent: msgs.filter(m => m.setter_id === sid).length,
        responses_received: responses,
        response_rate: responseRate,
        avg_ai_score: avgAI,
        evals_count: scores.length,
      };
    }).sort((a, b) => b.leads_contacted - a.leads_contacted);

    // Templates count
    const { count: templatesCount } = await (admin as any)
      .from('message_templates')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    return NextResponse.json({
      global: {
        total_messages: totalMessages ?? 0,
        leads_contacted: leadsContacted,
        responses_received: responsesReceived,
        response_rate: leadsContacted > 0 ? Math.round((responsesReceived / leadsContacted) * 100) : 0,
        evaluations_count: evalList.length,
        avg_ai_score: avgScore,
        templates_count: templatesCount ?? 0,
        setters_active: setterMsgMap.size,
      },
      ranking,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
