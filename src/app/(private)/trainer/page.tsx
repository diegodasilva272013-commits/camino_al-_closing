'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, RotateCcw, ChevronLeft, Settings, X, Brain, Upload, FileText, Trash2, Save, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

type Msg = { role: 'user' | 'assistant'; content: string };
type BrainData = { base_prompt: string; rules: string; mode_fria: string; mode_tibia: string; mode_caliente: string };
type TrainerFile = { id: string; name: string; size_bytes: number | null; created_at: string };

// ── Escenarios ─────────────────────────────────────────────────────
const SCENARIOS = [
  { id: 'fria-1',     group: 'FRÍA',     emoji: '🧊', name: 'Desconocido Abierto',   diff: 1,  tag: 'BÁSICO',     desc: 'No te conoce pero responde sin hostilidad. El mejor punto de partida para practicar apertura.',                         tagColor: 'text-sky-400 bg-sky-400/10 border-sky-400/30',   groupColor: 'border-sky-500/25 hover:border-sky-400/50' },
  { id: 'fria-2',     group: 'FRÍA',     emoji: '🧊', name: 'Ocupado e Indiferente', diff: 3,  tag: 'INTERMEDIO', desc: 'No tiene tiempo ni interés aparente. Hay que generar valor en los primeros dos mensajes.',                               tagColor: 'text-sky-400 bg-sky-400/10 border-sky-400/30',   groupColor: 'border-sky-500/25 hover:border-sky-400/50' },
  { id: 'fria-3',     group: 'FRÍA',     emoji: '🧊', name: 'Escéptico Total',        diff: 6,  tag: 'AVANZADO',   desc: 'Desconfía de todo mensaje en frío. Detecta scripts. Requiere autenticidad total desde el principio.',                    tagColor: 'text-sky-400 bg-sky-400/10 border-sky-400/30',   groupColor: 'border-sky-500/25 hover:border-sky-400/50' },
  { id: 'fria-4',     group: 'FRÍA',     emoji: '🧊', name: 'Hostil desde el Inicio', diff: 9,  tag: 'ÉLITE',      desc: 'Responde mal desde el primer mensaje. Desactivar la agresividad es el único camino.',                                    tagColor: 'text-sky-400 bg-sky-400/10 border-sky-400/30',   groupColor: 'border-sky-500/25 hover:border-sky-400/50' },
  { id: 'tibia-1',    group: 'TIBIA',    emoji: '🌡️', name: 'Vio tu Contenido',      diff: 2,  tag: 'BÁSICO',     desc: 'Interactuó con redes o vio un video. Hay apertura pero también dudas lógicas.',                                         tagColor: 'text-amber-400 bg-amber-400/10 border-amber-400/30', groupColor: 'border-amber-500/25 hover:border-amber-400/50' },
  { id: 'tibia-2',    group: 'TIBIA',    emoji: '🌡️', name: 'Referido con Dudas',    diff: 4,  tag: 'INTERMEDIO', desc: 'Lo recomendó alguien de confianza, pero tiene sus propias reservas sobre el programa.',                                  tagColor: 'text-amber-400 bg-amber-400/10 border-amber-400/30', groupColor: 'border-amber-500/25 hover:border-amber-400/50' },
  { id: 'tibia-3',    group: 'TIBIA',    emoji: '🌡️', name: 'Quemado por Cursos',    diff: 7,  tag: 'AVANZADO',   desc: 'Invirtió antes en formación y le fue mal. Tiene el contexto pero también la cicatriz.',                                  tagColor: 'text-amber-400 bg-amber-400/10 border-amber-400/30', groupColor: 'border-amber-500/25 hover:border-amber-400/50' },
  { id: 'tibia-4',    group: 'TIBIA',    emoji: '🌡️', name: 'Analítico Extremo',     diff: 10, tag: 'ÉLITE',      desc: 'Pide datos, pruebas y lógica en cada paso. Nada de promesas — solo evidencia.',                                          tagColor: 'text-amber-400 bg-amber-400/10 border-amber-400/30', groupColor: 'border-amber-500/25 hover:border-amber-400/50' },
  { id: 'caliente-1', group: 'CALIENTE', emoji: '🔥', name: 'Listo para Cerrar',      diff: 2,  tag: 'BÁSICO',     desc: 'Ya quiere entrar. Falta confirmar detalles. Practicá el cierre limpio sin sobrevender.',                                 tagColor: 'text-red-400 bg-red-400/10 border-red-400/30',   groupColor: 'border-red-500/25 hover:border-red-400/50' },
  { id: 'caliente-2', group: 'CALIENTE', emoji: '🔥', name: 'Objeción de Precio',     diff: 5,  tag: 'INTERMEDIO', desc: 'Quiere entrar pero dice que es caro. Hay que manejar el valor sin bajar el precio.',                                     tagColor: 'text-red-400 bg-red-400/10 border-red-400/30',   groupColor: 'border-red-500/25 hover:border-red-400/50' },
  { id: 'caliente-3', group: 'CALIENTE', emoji: '🔥', name: 'Trampa del Interesado',  diff: 8,  tag: 'AVANZADO',   desc: 'Parece que va a cerrar pero busca que prometas resultados. Integridad bajo presión máxima.',                             tagColor: 'text-red-400 bg-red-400/10 border-red-400/30',   groupColor: 'border-red-500/25 hover:border-red-400/50' },
  { id: 'caliente-4', group: 'CALIENTE', emoji: '🔥', name: 'Campo Real Extremo',     diff: 10, tag: 'ÉLITE',      desc: 'Todo en simultáneo: precio, dudas, objeciones y una decisión que no puede esperar.',                                     tagColor: 'text-red-400 bg-red-400/10 border-red-400/30',   groupColor: 'border-red-500/25 hover:border-red-400/50' },
];

const DIFF_COLORS = ['','bg-emerald-500','bg-sky-400','bg-sky-500','bg-amber-400','bg-amber-500','bg-orange-400','bg-orange-500','bg-red-400','bg-red-500','bg-purple-500'];
const GROUPS = ['FRÍA','TIBIA','CALIENTE'] as const;
const GROUP_META = {
  FRÍA:     { emoji:'🧊', color:'text-sky-400',   border:'border-sky-500/20',   label:'Prospección Fría' },
  TIBIA:    { emoji:'🌡️', color:'text-amber-400', border:'border-amber-500/20', label:'Prospección Tibia' },
  CALIENTE: { emoji:'🔥', color:'text-red-400',   border:'border-red-500/20',   label:'Prospección Caliente' },
};

function randomId() { return Math.random().toString(36).slice(2); }

// ── Panel Cerebro (drawer) ─────────────────────────────────────────
function BrainPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'instrucciones'|'archivos'>('instrucciones');
  const [brain, setBrain] = useState<BrainData>({ base_prompt:'', rules:'', mode_fria:'', mode_tibia:'', mode_caliente:'' });
  const [files, setFiles] = useState<TrainerFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{type:'ok'|'err'; msg:string}|null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/trainer/brain').then(r => r.json()),
      fetch('/api/admin/trainer/files').then(r => r.json()),
    ]).then(([b, f]) => {
      if (b && !b.error) setBrain(b);
      if (Array.isArray(f)) setFiles(f);
      setLoading(false);
    });
  }, []);

  async function save() {
    setSaving(true); setStatus(null);
    const res = await fetch('/api/admin/trainer/brain', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(brain) });
    const d = await res.json();
    setSaving(false);
    setStatus(d.ok ? {type:'ok', msg:'Guardado'} : {type:'err', msg: d.error});
    if (d.ok) setTimeout(() => setStatus(null), 2500);
  }

  async function upload(file: File) {
    setUploading(true); setStatus(null);
    const fd = new FormData(); fd.append('file', file);
    const res = await fetch('/api/admin/trainer/files', { method:'POST', body: fd });
    const d = await res.json();
    setUploading(false);
    if (d.error) { setStatus({type:'err', msg: d.error}); }
    else { setFiles(p => [d, ...p]); setStatus({type:'ok', msg:`"${file.name}" subido`}); setTimeout(()=>setStatus(null),2500); }
  }

  async function deleteFile(id: string, name: string) {
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    await fetch(`/api/admin/trainer/files/${id}`, { method:'DELETE' });
    setFiles(p => p.filter(f => f.id !== id));
  }

  const field = (label: string, key: keyof BrainData, placeholder: string, accent='border-[rgba(212,175,55,0.2)] focus:border-brand-gold', bg='bg-[#111]', rows=5) => (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-brand-gold">{label}</label>
      <textarea rows={rows} value={brain[key]} onChange={e => setBrain(p=>({...p,[key]:e.target.value}))} placeholder={placeholder}
        className={`w-full resize-y rounded-lg border ${accent} ${bg} p-3 text-sm text-brand-text placeholder:text-brand-muted/60 focus:outline-none`} />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative flex h-full w-full max-w-xl flex-col border-l border-[rgba(212,175,55,0.15)] bg-[#090909] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[rgba(212,175,55,0.12)] px-5 py-4">
          <Brain className="h-5 w-5 text-brand-gold shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-brand-text">Cerebro del Trainer</p>
            <p className="text-xs text-brand-muted">Instrucciones y material que usa la IA</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-brand-muted hover:bg-[#1a1a1a] hover:text-brand-text">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[rgba(212,175,55,0.1)] px-5 pt-3">
          {(['instrucciones','archivos'] as const).map(t => (
            <button key={t} onClick={()=>setTab(t)}
              className={`pb-2.5 mr-4 text-sm font-medium border-b-2 transition ${tab===t ? 'border-brand-gold text-brand-gold' : 'border-transparent text-brand-muted hover:text-brand-text'}`}>
              {t === 'instrucciones' ? 'Instrucciones' : 'Material subido'}
            </button>
          ))}
        </div>

        {/* Status */}
        {status && (
          <div className={`mx-5 mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${status.type==='ok' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
            {status.type==='ok' ? <CheckCircle className="h-3.5 w-3.5 shrink-0"/> : <AlertCircle className="h-3.5 w-3.5 shrink-0"/>}
            {status.msg}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading ? (
            <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-brand-gold"/></div>
          ) : tab === 'instrucciones' ? (
            <>
              {field('Instrucciones base — cómo actúa el prospecto', 'base_prompt',
                'Ej: Sos un prospecto argentino de 25-40 años. Tenés dudas sobre invertir en formación. Respondés por WhatsApp de forma informal...', undefined, undefined, 6)}
              {field('Reglas generales del entrenamiento', 'rules',
                'Ej: Nunca aceptes el primer intento del setter. Siempre pedí más información antes de mostrar interés real...')}
              <p className="text-[10px] uppercase tracking-widest text-brand-muted pt-1">Por modo</p>
              {field('🧊 Prospección Fría', 'mode_fria',
                'Ej: El prospecto nunca escuchó de CAC. Es escéptico desde el inicio...', 'border-sky-500/20 focus:border-sky-400', 'bg-[#0a0f15]')}
              {field('🌡️ Prospección Tibia', 'mode_tibia',
                'Ej: Vio algo de CAC en redes. Tiene curiosidad pero también dudas...', 'border-amber-500/20 focus:border-amber-400', 'bg-[#130f00]')}
              {field('🔥 Prospección Caliente', 'mode_caliente',
                'Ej: Ya quiere entrar pero tiene objeciones de precio o tiempo...', 'border-red-500/20 focus:border-red-400', 'bg-[#150000]')}
              <button onClick={save} disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-gold py-2.5 text-sm font-semibold text-black hover:bg-brand-gold/90 disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>}
                {saving ? 'Guardando...' : 'Guardar cerebro'}
              </button>
            </>
          ) : (
            <>
              <div onDrop={e=>{e.preventDefault(); const f=e.dataTransfer.files[0]; if(f) upload(f);}} onDragOver={e=>e.preventDefault()}
                onClick={()=>fileRef.current?.click()}
                className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-[rgba(212,175,55,0.2)] bg-[#0d0d0d] p-8 text-center hover:border-brand-gold/40 hover:bg-[#111] transition">
                {uploading ? <Loader2 className="h-7 w-7 animate-spin text-brand-gold"/> : <Upload className="h-7 w-7 text-brand-muted"/>}
                <div>
                  <p className="text-sm font-medium text-brand-text">{uploading ? 'Procesando...' : 'Arrastrá o hacé clic'}</p>
                  <p className="text-xs text-brand-muted mt-0.5">PDF, TXT o MD — el texto se extrae automáticamente</p>
                </div>
                <input ref={fileRef} type="file" accept=".pdf,.txt,.md" className="hidden"
                  onChange={e=>{const f=e.target.files?.[0]; if(f) upload(f); e.target.value='';}} />
              </div>
              {files.length === 0 ? (
                <p className="text-center text-sm text-brand-muted py-4">No hay archivos subidos todavía</p>
              ) : (
                <div className="space-y-2">
                  {files.map(f => (
                    <div key={f.id} className="flex items-center gap-3 rounded-lg border border-[rgba(212,175,55,0.1)] bg-[#0d0d0d] px-4 py-3">
                      <FileText className="h-4 w-4 shrink-0 text-brand-gold"/>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm text-brand-text">{f.name}</p>
                        <p className="text-xs text-brand-muted">{f.size_bytes ? `${Math.round(f.size_bytes/1024)} KB` : ''} · {new Date(f.created_at).toLocaleDateString('es-AR')}</p>
                      </div>
                      <button onClick={()=>deleteFile(f.id, f.name)} className="rounded-md p-1.5 text-brand-muted hover:bg-red-500/10 hover:text-red-400">
                        <Trash2 className="h-4 w-4"/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────
export default function TrainerPage() {
  const [view, setView] = useState<'selector'|'chat'>('selector');
  const [scenario, setScenario] = useState<typeof SCENARIOS[0]|null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [brainOpen, setBrainOpen] = useState(false);
  const [sessionId] = useState(() => randomId());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages, loading]);

  async function startScenario(s: typeof SCENARIOS[0]) {
    setScenario(s); setMessages([]); setView('chat'); setLoading(true);
    await fetch('/api/trainer/chat', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({sessionId}) });
    const mode = s.group==='FRÍA'?'fria':s.group==='TIBIA'?'tibia':'caliente';
    const res = await fetch('/api/trainer/chat', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ sessionId, message:`INICIO SIMULACIÓN — Escenario: ${s.name}. ${s.desc}`, mode, scenarioName: s.name }) });
    const data = await res.json();
    setLoading(false);
    if (data.response) setMessages([{role:'assistant', content:data.response}]);
    setTimeout(()=>inputRef.current?.focus(), 100);
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading || !scenario) return;
    setInput('');
    setMessages(prev=>[...prev,{role:'user',content:text}]);
    setLoading(true);
    const mode = scenario.group==='FRÍA'?'fria':scenario.group==='TIBIA'?'tibia':'caliente';
    const res = await fetch('/api/trainer/chat', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ sessionId, message:text, mode, scenarioName:scenario.name }) });
    const data = await res.json();
    setLoading(false);
    if (data.response) setMessages(prev=>[...prev,{role:'assistant',content:data.response}]);
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  // ── Selector ──────────────────────────────────────────────────────
  if (view === 'selector') {
    return (
      <>
        {brainOpen && <BrainPanel onClose={()=>setBrainOpen(false)}/>}
        <div className="mx-auto max-w-5xl space-y-8 px-2 py-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-brand-gold">CAC TRAINER</h1>
              <p className="text-sm text-brand-muted mt-1">Elegí el escenario y practicá como en campo real</p>
            </div>
            <button onClick={()=>setBrainOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-[rgba(212,175,55,0.3)] bg-[#111] px-3 py-2 text-xs text-brand-gold hover:bg-[#1a1a1a] transition shrink-0">
              <Settings className="h-3.5 w-3.5"/> Configurar cerebro
            </button>
          </div>

          {GROUPS.map(g => {
            const meta = GROUP_META[g];
            return (
              <div key={g} className="space-y-3">
                <div className={`flex items-center gap-2 border-b pb-2 ${meta.border}`}>
                  <span className="text-xl">{meta.emoji}</span>
                  <span className={`text-xs font-bold uppercase tracking-widest ${meta.color}`}>{meta.label}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {SCENARIOS.filter(s=>s.group===g).map(s=>(
                    <button key={s.id} onClick={()=>startScenario(s)}
                      className={`group flex flex-col gap-3 rounded-xl border bg-[#0d0d0d] p-4 text-left transition-all hover:bg-[#131313] ${s.groupColor}`}>
                      <div className="flex gap-[3px]">
                        {Array.from({length:10}).map((_,i)=>(
                          <span key={i} className={`h-1 flex-1 rounded-full ${i<s.diff ? DIFF_COLORS[s.diff] : 'bg-[#2a2a2a]'}`}/>
                        ))}
                      </div>
                      <div className="space-y-1">
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider ${s.tagColor}`}>{s.tag}</span>
                        <p className="text-sm font-semibold leading-tight text-brand-text">{s.name}</p>
                        <p className="text-[11px] leading-relaxed text-brand-muted">{s.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="rounded-lg border border-[rgba(212,175,55,0.1)] bg-[#0d0d0d] px-4 py-3 text-xs text-brand-muted flex gap-6 justify-center">
            <span><span className="text-brand-gold font-semibold">evaluame</span> → feedback instantáneo</span>
            <span><span className="text-brand-gold font-semibold">EVOLUCIÓN</span> → subir dificultad</span>
          </div>
        </div>
      </>
    );
  }

  // ── Chat ──────────────────────────────────────────────────────────
  const groupColor = scenario?.group==='FRÍA'?'text-sky-400':scenario?.group==='TIBIA'?'text-amber-400':'text-red-400';

  return (
    <>
      {brainOpen && <BrainPanel onClose={()=>setBrainOpen(false)}/>}
      <div className="flex h-[calc(100vh-4rem)] flex-col">
        <div className="flex items-center gap-3 border-b border-[rgba(212,175,55,0.12)] bg-[#0a0a0a] px-4 py-3">
          <button onClick={()=>setView('selector')} className="rounded-md p-1.5 text-brand-muted hover:bg-[#1a1a1a] hover:text-brand-text">
            <ChevronLeft className="h-5 w-5"/>
          </button>
          <span className="text-xl">{scenario?.emoji}</span>
          <div>
            <p className={`text-xs font-bold tracking-wider ${groupColor}`}>{scenario?.group} · {scenario?.tag}</p>
            <p className="text-sm font-semibold text-brand-text">{scenario?.name}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={()=>setBrainOpen(true)} className="rounded-md p-1.5 text-brand-muted hover:bg-[#1a1a1a] hover:text-brand-gold" title="Configurar cerebro">
              <Settings className="h-4 w-4"/>
            </button>
            <button onClick={()=>scenario&&startScenario(scenario)}
              className="flex items-center gap-1.5 rounded-md border border-[rgba(212,175,55,0.2)] px-3 py-1.5 text-xs text-brand-muted hover:border-brand-gold/40 hover:text-brand-text">
              <RotateCcw className="h-3.5 w-3.5"/> Reiniciar
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 px-4 py-4" style={{background:'#080808'}}>
          {messages.map((msg,i)=>(
            <div key={i} className={`flex ${msg.role==='user'?'justify-end':'justify-start'}`}>
              <div className={`max-w-[78%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.role==='user'?'rounded-br-sm bg-brand-gold text-black':'rounded-bl-sm border border-[rgba(212,175,55,0.08)] bg-[#1a1a1a] text-brand-text'}`}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm border border-[rgba(212,175,55,0.08)] bg-[#1a1a1a] px-4 py-3">
                <div className="flex gap-1">
                  {[0,1,2].map(i=><span key={i} className="h-2 w-2 rounded-full bg-brand-muted" style={{animation:`bounce 1.2s ease-in-out ${i*0.2}s infinite`}}/>)}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        <div className="border-t border-[rgba(212,175,55,0.12)] bg-[#0a0a0a] px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={onKey} rows={1} placeholder="Escribí tu mensaje..." disabled={loading}
              className="flex-1 resize-none rounded-xl border border-[rgba(212,175,55,0.2)] bg-[#111] px-4 py-2.5 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-gold focus:outline-none disabled:opacity-50"
              style={{maxHeight:'120px'}} onInput={e=>{const t=e.currentTarget;t.style.height='auto';t.style.height=Math.min(t.scrollHeight,120)+'px';}}/>
            <button onClick={sendMessage} disabled={loading||!input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gold text-black hover:bg-brand-gold/90 disabled:opacity-40">
              <Send className="h-4 w-4"/>
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}`}</style>
    </>
  );
}
