'use client';
import { useEffect, useState } from 'react';
import { X, Loader2, Wand2, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type Template = { id: string; title: string; category: string; body: string; tone: string };
type Lead = { id: string; first_name: string; last_name: string | null; phone: string; country: string | null; notes: string | null };

const CATEGORY_LABELS: Record<string, string> = {
  apertura: 'Apertura', seguimiento: 'Seguimiento', reactivacion: 'Reactivación', cierre: 'Cierre', general: 'General',
};
const TONE_COLORS: Record<string, string> = {
  directo: 'text-sky-400', humano: 'text-emerald-400', curioso: 'text-yellow-400', profesional: 'text-violet-400', calido: 'text-rose-400',
};

function substituteVars(tpl: string, lead: Lead, setterName: string): string {
  return tpl
    .replace(/\{nombre\}/gi, lead.first_name)
    .replace(/\{pais\}/gi, lead.country ?? '')
    .replace(/\{setter_nombre\}/gi, setterName)
    .replace(/\{interes\}/gi, lead.notes?.slice(0, 60) ?? '');
}

type Props = {
  lead: Lead;
  setterName: string;
  onClose: () => void;
  onSent: (leadId: string) => void;
};

export function ContactModal({ lead, setterName, onClose, onSent }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTpl, setSelectedTpl] = useState<Template | null>(null);
  const [message, setMessage] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [improving, setImproving] = useState(false);
  const [variants, setVariants] = useState<{ tono: string; mensaje: string }[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/message-templates').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setTemplates(d);
    });
  }, []);

  function applyTemplate(tpl: Template) {
    const rendered = substituteVars(tpl.body, lead, setterName);
    setMessage(rendered);
    setSelectedTpl(tpl);
    setShowTemplates(false);
    setVariants([]);
  }

  async function improveWithAI() {
    if (!message.trim()) { setError('Escribí un mensaje primero.'); return; }
    setImproving(true);
    setError('');
    try {
      const r = await fetch('/api/prospecting/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          lead_name: lead.first_name,
          lead_country: lead.country ?? '',
          lead_notes: lead.notes ?? '',
          setter_name: setterName,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? 'Error de IA'); return; }
      setVariants(d.variantes ?? []);
    } catch {
      setError('Error al conectar con la IA');
    } finally {
      setImproving(false);
    }
  }

  async function send() {
    if (!message.trim()) { setError('El mensaje no puede estar vacío.'); return; }
    setSending(true);
    setError('');
    try {
      const r = await fetch(`/api/prospecting/${lead.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_body: message.trim(),
          message_type: selectedTpl ? 'template' : 'manual',
          template_id: selectedTpl?.id ?? null,
        }),
      });
      if (!r.ok) {
        const d = await r.json();
        setError(d.error ?? 'Error al registrar');
        return;
      }
      // Open WhatsApp with the message
      const phone = String(lead.phone ?? '').replace(/\D/g, '');
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message.trim())}`, '_blank');
      onSent(lead.id);
    } catch {
      setError('Error de red');
    } finally {
      setSending(false);
    }
  }

  const grouped = templates.reduce<Record<string, Template[]>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 px-3 pb-3 sm:pb-0">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-[#0d0d0d] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-zinc-800 shrink-0">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-yellow-500/60">Contactar lead</p>
            <h2 className="text-base font-bold text-white mt-0.5">{lead.first_name} {lead.last_name ?? ''}</h2>
            <p className="text-xs text-zinc-500 font-mono">{lead.phone} {lead.country ? `· ${lead.country}` : ''}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500"><X className="h-4 w-4" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {/* Template selector */}
          <div>
            <button
              onClick={() => setShowTemplates(v => !v)}
              className="flex items-center gap-2 text-xs text-yellow-400 border border-yellow-500/25 bg-yellow-500/5 rounded-xl px-3 py-2 hover:bg-yellow-500/10 transition w-full"
            >
              <span className="flex-1 text-left">
                {selectedTpl ? `Plantilla: ${selectedTpl.title}` : 'Elegir plantilla (opcional)'}
              </span>
              {showTemplates ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {showTemplates && (
              <div className="mt-2 rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
                {Object.keys(grouped).length === 0 ? (
                  <p className="text-xs text-zinc-500 p-3 text-center">Sin plantillas. El admin puede crear plantillas en /admin/prospeccion.</p>
                ) : (
                  Object.entries(grouped).map(([cat, tpls]) => (
                    <div key={cat}>
                      <p className="text-[10px] uppercase tracking-widest text-zinc-600 px-3 pt-2 pb-1">{CATEGORY_LABELS[cat] ?? cat}</p>
                      {tpls.map(t => (
                        <button key={t.id} onClick={() => applyTemplate(t)}
                          className="w-full text-left px-3 py-2 hover:bg-zinc-800 transition border-t border-zinc-800/50 first:border-t-0">
                          <p className="text-xs font-semibold text-white">{t.title}</p>
                          <p className={cn('text-[10px]', TONE_COLORS[t.tone] ?? 'text-zinc-500')}>{t.tone}</p>
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Message textarea */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5 block">Tu mensaje</label>
            <textarea
              value={message}
              onChange={e => { setMessage(e.target.value); setVariants([]); }}
              rows={5}
              placeholder={`Hola ${lead.first_name}, escribí tu apertura acá...`}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-yellow-500/30 resize-none"
            />
            <p className="text-[10px] text-zinc-600 mt-1">Variables: {'{nombre}'} {'{pais}'} {'{setter_nombre}'}</p>
          </div>

          {/* AI improve button */}
          <button
            onClick={improveWithAI}
            disabled={improving || !message.trim()}
            className="flex items-center gap-2 w-full justify-center rounded-xl border border-violet-500/25 bg-violet-500/5 px-4 py-2.5 text-sm font-semibold text-violet-400 hover:bg-violet-500/10 transition disabled:opacity-40"
          >
            {improving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {improving ? 'Generando variantes...' : 'Mejorar con IA (3 variantes)'}
          </button>

          {/* Variants */}
          {variants.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-zinc-500">Variantes — hacé click para usar</p>
              {variants.map((v, i) => (
                <button key={i} onClick={() => { setMessage(v.mensaje); setVariants([]); }}
                  className="w-full text-left rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 hover:border-yellow-500/25 hover:bg-zinc-900 transition">
                  <p className="text-[10px] font-bold uppercase text-yellow-500/70 mb-1">{v.tono}</p>
                  <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{v.mensaje}</p>
                </button>
              ))}
            </div>
          )}

          {error && <p className="text-xs font-semibold text-red-400 bg-red-900/20 border border-red-700/30 rounded-xl px-3 py-2">{error}</p>}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 shrink-0">
          <button
            onClick={send}
            disabled={!message.trim() || sending}
            className="flex items-center gap-2 w-full justify-center rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3 text-sm font-bold text-white transition disabled:opacity-40"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
            {sending ? 'Registrando...' : 'Abrir WhatsApp + Registrar mensaje'}
          </button>
        </div>
      </div>
    </div>
  );
}
