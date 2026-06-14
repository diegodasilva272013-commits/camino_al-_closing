'use client';

import { useEffect, useRef, useState } from 'react';
import { Brain, FileText, Upload, Trash2, Save, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

type Brain = {
  base_prompt: string;
  rules: string;
  mode_fria: string;
  mode_tibia: string;
  mode_caliente: string;
};

type TrainerFile = {
  id: string;
  name: string;
  size_bytes: number | null;
  created_at: string;
};

type Tab = 'brain' | 'files';

export default function TrainerAdminPage() {
  const [tab, setTab] = useState<Tab>('brain');
  const [brain, setBrain] = useState<Brain>({
    base_prompt: '',
    rules: '',
    mode_fria: '',
    mode_tibia: '',
    mode_caliente: '',
  });
  const [files, setFiles] = useState<TrainerFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [loading, setLoading] = useState(true);
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

  async function saveBrain() {
    setSaving(true);
    setStatus(null);
    const res = await fetch('/api/admin/trainer/brain', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(brain),
    });
    const data = await res.json();
    setSaving(false);
    setStatus(data.ok ? { type: 'ok', msg: 'Guardado correctamente' } : { type: 'err', msg: data.error });
    if (data.ok) setTimeout(() => setStatus(null), 3000);
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setStatus(null);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/admin/trainer/files', { method: 'POST', body: fd });
    const data = await res.json();
    setUploading(false);
    if (data.error) {
      setStatus({ type: 'err', msg: data.error });
    } else {
      setFiles(prev => [data, ...prev]);
      setStatus({ type: 'ok', msg: `"${file.name}" subido` });
      setTimeout(() => setStatus(null), 3000);
    }
  }

  async function deleteFile(id: string, name: string) {
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    await fetch(`/api/admin/trainer/files/${id}`, { method: 'DELETE' });
    setFiles(prev => prev.filter(f => f.id !== id));
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  const field = (label: string, key: keyof Brain, placeholder: string, rows = 6) => (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-brand-gold">{label}</label>
      <textarea
        rows={rows}
        value={brain[key]}
        onChange={e => setBrain(prev => ({ ...prev, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full resize-y rounded-lg border border-[rgba(212,175,55,0.2)] bg-[#111] p-3 text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-gold focus:outline-none"
      />
    </div>
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-gold" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-2 py-6">
      <div className="flex items-center gap-3">
        <Brain className="h-7 w-7 text-brand-gold" />
        <div>
          <h1 className="text-xl font-bold text-brand-text">Cerebro del Trainer</h1>
          <p className="text-sm text-brand-muted">Configurá las instrucciones y material que usa la IA</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-[rgba(212,175,55,0.15)] bg-[#0d0d0d] p-1">
        {([['brain', 'Instrucciones & Reglas'], ['files', 'Material subido']] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
              tab === t
                ? 'bg-brand-gold text-black'
                : 'text-brand-muted hover:text-brand-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Status banner */}
      {status && (
        <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
          status.type === 'ok'
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
            : 'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}>
          {status.type === 'ok' ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {status.msg}
        </div>
      )}

      {tab === 'brain' && (
        <div className="space-y-6">
          {field(
            'Prompt base — cómo actúa el prospecto',
            'base_prompt',
            'Ej: Sos un prospecto argentino de entre 25-40 años interesado en mejorar sus ingresos. Tenés dudas sobre la inversión en formación. Usás WhatsApp de forma informal...',
            8
          )}
          {field(
            'Reglas generales del entrenamiento',
            'rules',
            'Ej: Nunca aceptes el primer intento del setter. Siempre pedí más información antes de mostrar interés...',
            6
          )}

          <div className="border-t border-[rgba(212,175,55,0.1)] pt-4">
            <p className="mb-4 text-xs uppercase tracking-widest text-brand-muted">Instrucciones por modo</p>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🧊</span>
                  <span className="text-sm font-medium text-sky-400">PROSPECCIÓN FRÍA</span>
                </div>
                <textarea
                  rows={6}
                  value={brain.mode_fria}
                  onChange={e => setBrain(prev => ({ ...prev, mode_fria: e.target.value }))}
                  placeholder="Ej: El prospecto nunca escuchó de CAC. Es escéptico desde el principio. No facilites la conversación..."
                  className="w-full resize-y rounded-lg border border-sky-500/20 bg-[#0a0f15] p-3 text-sm text-brand-text placeholder:text-brand-muted focus:border-sky-400 focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🌡️</span>
                  <span className="text-sm font-medium text-amber-400">PROSPECCIÓN TIBIA</span>
                </div>
                <textarea
                  rows={6}
                  value={brain.mode_tibia}
                  onChange={e => setBrain(prev => ({ ...prev, mode_tibia: e.target.value }))}
                  placeholder="Ej: El prospecto vio algo de CAC en redes. Tiene curiosidad pero también dudas. Puede hacer preguntas técnicas..."
                  className="w-full resize-y rounded-lg border border-amber-500/20 bg-[#130f00] p-3 text-sm text-brand-text placeholder:text-brand-muted focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔥</span>
                  <span className="text-sm font-medium text-red-400">PROSPECCIÓN CALIENTE</span>
                </div>
                <textarea
                  rows={6}
                  value={brain.mode_caliente}
                  onChange={e => setBrain(prev => ({ ...prev, mode_caliente: e.target.value }))}
                  placeholder="Ej: El prospecto ya quiere entrar pero tiene objeciones de precio o tiempo. Está a un paso de cerrar..."
                  className="w-full resize-y rounded-lg border border-red-500/20 bg-[#150000] p-3 text-sm text-brand-text placeholder:text-brand-muted focus:border-red-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <button
            onClick={saveBrain}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-brand-gold px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-brand-gold/90 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Guardando...' : 'Guardar cerebro'}
          </button>
        </div>
      )}

      {tab === 'files' && (
        <div className="space-y-6">
          {/* Upload area */}
          <div
            onDrop={onDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[rgba(212,175,55,0.25)] bg-[#0d0d0d] p-10 text-center transition hover:border-brand-gold/50 hover:bg-[#111]"
          >
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-brand-gold" />
            ) : (
              <Upload className="h-8 w-8 text-brand-muted" />
            )}
            <div>
              <p className="text-sm font-medium text-brand-text">
                {uploading ? 'Procesando...' : 'Arrastrá un archivo o hacé clic'}
              </p>
              <p className="mt-1 text-xs text-brand-muted">PDF, TXT o MD — el texto se extrae automáticamente</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.md"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ''; }}
            />
          </div>

          {/* File list */}
          {files.length === 0 ? (
            <p className="text-center text-sm text-brand-muted">No hay archivos subidos todavía</p>
          ) : (
            <div className="space-y-2">
              {files.map(f => (
                <div
                  key={f.id}
                  className="flex items-center gap-3 rounded-lg border border-[rgba(212,175,55,0.12)] bg-[#0d0d0d] px-4 py-3"
                >
                  <FileText className="h-4 w-4 shrink-0 text-brand-gold" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-brand-text">{f.name}</p>
                    <p className="text-xs text-brand-muted">
                      {f.size_bytes ? `${Math.round(f.size_bytes / 1024)} KB` : ''} ·{' '}
                      {new Date(f.created_at).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteFile(f.id, f.name)}
                    className="rounded-md p-1.5 text-brand-muted hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
