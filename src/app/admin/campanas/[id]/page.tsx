'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ArrowLeft, Play, Pause, Plus, Send, Users, CheckCheck, XCircle, MessageSquare, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

type CampaignLead = {
  id: string; status: string; sent_at: string | null; replied_at: string | null; failed_at: string | null; error_message: string | null; message_body: string | null;
  leads: { id: string; first_name: string; last_name: string | null; phone: string; country: string | null };
  profiles: { id: string; full_name: string } | null;
};

type Campaign = {
  id: string; name: string; description: string | null; channel: string; status: string;
  total_leads: number; sent_count: number; replied_count: number; failed_count: number;
  send_rules: Record<string, any>; target_segment: Record<string, any>;
  message_templates: { id: string; title: string; body: string } | null;
  evolution_instances: { id: string; name: string; status: string; phone_number: string | null } | null;
  status_counts: Record<string, number>;
};

const LEAD_STATUS: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Pendiente',   color: 'text-zinc-400' },
  sending:   { label: 'Enviando...',  color: 'text-yellow-400' },
  sent:      { label: 'Enviado',     color: 'text-sky-400' },
  delivered: { label: 'Entregado',   color: 'text-sky-300' },
  read:      { label: 'Leído',       color: 'text-emerald-400' },
  failed:    { label: 'Fallido',     color: 'text-red-400' },
  replied:   { label: 'Respondió',   color: 'text-emerald-300' },
  skipped:   { label: 'Omitido',     color: 'text-zinc-500' },
};

const LEAD_STATUSES = ['NO_CONTACTADO','APERTURA_ENVIADA','CONTACTADO','NO_RESPONDE','RESPONDIO','INTERES_DETECTADO','INVITADO_AL_GRUPO','INGRESO_AL_GRUPO','ACTIVO_EN_GRUPO','DIAGNOSTICO_INICIADO','DIAGNOSTICO_PROFUNDO','REUNION_PROPUESTA','REUNION_AGENDADA','SEGUIMIENTO_FUTURO','NO_CALIFICA'];

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [leads, setLeads] = useState<CampaignLead[]>([]);
  const [loadingCampaign, setLoadingCampaign] = useState(true);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [leadFilter, setLeadFilter] = useState('');
  const [sendingBatch, setSendingBatch] = useState(false);
  const [batchResult, setBatchResult] = useState<{ sent: number; failed: number } | null>(null);
  const [showAddLeads, setShowAddLeads] = useState(false);
  const [segmentStatus, setSegmentStatus] = useState('');
  const [addingLeads, setAddingLeads] = useState(false);
  const [addResult, setAddResult] = useState<{ added: number; skipped: number } | null>(null);

  const loadCampaign = useCallback(async () => {
    setLoadingCampaign(true);
    try {
      const r = await fetch(`/api/admin/campaigns/${id}`);
      const d = await r.json();
      if (d.id) setCampaign(d);
    } catch {}
    setLoadingCampaign(false);
  }, [id]);

  const loadLeads = useCallback(async () => {
    setLoadingLeads(true);
    try {
      const params = new URLSearchParams();
      if (leadFilter) params.set('status', leadFilter);
      const r = await fetch(`/api/admin/campaigns/${id}/leads?${params}`);
      const d = await r.json();
      if (Array.isArray(d)) setLeads(d);
    } catch {}
    setLoadingLeads(false);
  }, [id, leadFilter]);

  useEffect(() => { loadCampaign(); }, [loadCampaign]);
  useEffect(() => { loadLeads(); }, [loadLeads]);

  async function toggleStatus() {
    if (!campaign) return;
    const newStatus = campaign.status === 'active' ? 'paused' : campaign.status === 'paused' ? 'active' : campaign.status === 'draft' ? 'active' : null;
    if (!newStatus) return;
    await fetch(`/api/admin/campaigns/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
    setCampaign(prev => prev ? { ...prev, status: newStatus } : prev);
  }

  async function sendBatch() {
    setSendingBatch(true); setBatchResult(null);
    try {
      const r = await fetch(`/api/admin/campaigns/${id}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ batch_size: 20 }) });
      const d = await r.json();
      setBatchResult({ sent: d.sent ?? 0, failed: d.failed ?? 0 });
      await loadCampaign();
      await loadLeads();
    } catch {}
    setSendingBatch(false);
  }

  async function addLeads() {
    setAddingLeads(true); setAddResult(null);
    try {
      const r = await fetch(`/api/admin/campaigns/${id}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment: segmentStatus ? { status: segmentStatus } : {} }),
      });
      const d = await r.json();
      setAddResult({ added: d.added ?? 0, skipped: d.skipped ?? 0 });
      await loadCampaign();
      await loadLeads();
    } catch {}
    setAddingLeads(false);
  }

  if (loadingCampaign) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-brand-gold" /></div>;
  if (!campaign) return <div className="p-8 text-zinc-500">Campaña no encontrada.</div>;

  const replyRate = campaign.sent_count > 0 ? Math.round((campaign.replied_count / campaign.sent_count) * 100) : null;
  const canSend = campaign.status === 'active' && campaign.channel === 'evolution' && campaign.evolution_instances?.status === 'connected';

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/admin/campanas" className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition mb-4">
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a campañas
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-brand-gold/60 mb-1">{campaign.channel.toUpperCase()}</p>
            <h1 className="text-2xl font-bold text-brand-text">{campaign.name}</h1>
            {campaign.description && <p className="text-sm text-zinc-500 mt-0.5">{campaign.description}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {campaign.channel === 'evolution' && campaign.status === 'active' && (
              <button onClick={sendBatch} disabled={!canSend || sendingBatch}
                className="flex items-center gap-1.5 rounded-xl bg-brand-gold px-4 py-2 text-sm font-bold text-black disabled:opacity-40 hover:bg-brand-gold/90 transition">
                {sendingBatch ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar lote
              </button>
            )}
            {['draft','active','paused'].includes(campaign.status) && (
              <button onClick={toggleStatus}
                className={cn('flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition',
                  campaign.status === 'active' ? 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10' : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10')}>
                {campaign.status === 'active' ? <><Pause className="h-4 w-4" /> Pausar</> : <><Play className="h-4 w-4" /> Activar</>}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total leads', value: campaign.total_leads, icon: Users, color: 'text-brand-text' },
          { label: 'Enviados', value: campaign.sent_count, icon: MessageSquare, color: 'text-sky-400' },
          { label: 'Respondieron', value: campaign.replied_count, icon: CheckCheck, color: 'text-emerald-400' },
          { label: 'Tasa de respuesta', value: replyRate !== null ? `${replyRate}%` : '—', icon: RefreshCw, color: replyRate && replyRate >= 20 ? 'text-emerald-400' : 'text-yellow-400' },
        ].map(s => (
          <div key={s.label} className="card-premium">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className="h-3.5 w-3.5 text-brand-gold/60" />
              <p className="text-[10px] uppercase tracking-widest text-zinc-500">{s.label}</p>
            </div>
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {batchResult && (
        <div className="mb-4 rounded-xl border border-emerald-700/30 bg-emerald-900/10 px-4 py-3 text-sm text-emerald-300">
          Lote completado: {batchResult.sent} enviados · {batchResult.failed} fallidos
        </div>
      )}

      {/* Evolution instance warning */}
      {campaign.channel === 'evolution' && (
        <div className={cn('mb-4 rounded-xl border px-4 py-3 text-sm',
          campaign.evolution_instances?.status === 'connected'
            ? 'border-emerald-700/30 bg-emerald-900/10 text-emerald-300'
            : 'border-yellow-700/30 bg-yellow-900/10 text-yellow-300')}>
          {campaign.evolution_instances
            ? `WhatsApp: ${campaign.evolution_instances.name} — ${campaign.evolution_instances.status === 'connected' ? `Conectado ${campaign.evolution_instances.phone_number ? `(${campaign.evolution_instances.phone_number})` : ''}` : 'Desconectado — conectá la instancia en /admin/evolution'}`
            : 'Sin instancia Evolution configurada — editá la campaña para asignar una.'}
        </div>
      )}

      {/* Add leads section */}
      <div className="mb-5 rounded-2xl border border-zinc-800/60 bg-[#0d0d0d] p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-brand-text">Agregar leads</h2>
          <button onClick={() => setShowAddLeads(v => !v)} className="text-xs text-brand-gold hover:underline">
            {showAddLeads ? 'Ocultar' : 'Mostrar filtros'}
          </button>
        </div>

        {showAddLeads && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Filtrar por estado del lead</label>
              <select value={segmentStatus} onChange={e => setSegmentStatus(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-brand-text focus:outline-none">
                <option value="">Todos los estados</option>
                {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {addResult && (
              <p className="text-xs text-emerald-400">{addResult.added} leads agregados · {addResult.skipped} ya estaban en la campaña</p>
            )}

            <button onClick={addLeads} disabled={addingLeads}
              className="flex items-center gap-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition disabled:opacity-40">
              {addingLeads ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {addingLeads ? 'Agregando...' : 'Agregar leads del segmento'}
            </button>
          </div>
        )}
      </div>

      {/* Leads table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-brand-text">Leads en campaña ({campaign.total_leads})</h2>
          <select value={leadFilter} onChange={e => setLeadFilter(e.target.value)}
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 focus:outline-none">
            <option value="">Todos</option>
            {Object.entries(LEAD_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        {loadingLeads ? (
          <div className="flex h-24 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-brand-gold" /></div>
        ) : leads.length === 0 ? (
          <p className="text-zinc-500 text-sm text-center py-8">Sin leads{leadFilter ? ` con estado "${LEAD_STATUS[leadFilter]?.label}"` : ''}.</p>
        ) : (
          <div className="space-y-1.5">
            {leads.map(cl => {
              const ls = LEAD_STATUS[cl.status] ?? { label: cl.status, color: 'text-zinc-400' };
              return (
                <div key={cl.id} className="rounded-xl border border-zinc-800/50 bg-[#0d0d0d] px-4 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-brand-text">{cl.leads.first_name} {cl.leads.last_name ?? ''}</p>
                    <p className="text-[11px] text-zinc-500 font-mono">{cl.leads.phone} {cl.leads.country ? `· ${cl.leads.country}` : ''}</p>
                    {cl.profiles && <p className="text-[10px] text-zinc-600">Setter: {cl.profiles.full_name}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <span className={cn('text-xs font-semibold', ls.color)}>{ls.label}</span>
                    {cl.sent_at && <p className="text-[10px] text-zinc-600">{new Date(cl.sent_at).toLocaleDateString('es-AR')}</p>}
                    {cl.error_message && <p className="text-[10px] text-red-400 max-w-[120px] truncate">{cl.error_message}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
