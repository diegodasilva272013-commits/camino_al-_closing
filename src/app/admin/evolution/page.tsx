'use client';
import { useEffect, useState, useCallback } from 'react';
import { Plus, X, Loader2, Wifi, WifiOff, RefreshCw, QrCode, Trash2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Instance = {
  id: string; name: string; instance_key: string; api_url: string;
  status: string; phone_number: string | null; created_at: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Wifi }> = {
  connected:    { label: 'Conectado',     color: 'text-emerald-400', icon: Wifi },
  connecting:   { label: 'Conectando...',  color: 'text-yellow-400',  icon: RefreshCw },
  disconnected: { label: 'Desconectado',  color: 'text-zinc-500',    icon: WifiOff },
  banned:       { label: 'Bloqueado',     color: 'text-red-400',     icon: AlertTriangle },
  error:        { label: 'Error',         color: 'text-red-400',     icon: AlertTriangle },
};

const EMPTY_FORM = { name: '', instance_key: '', api_url: '', api_token: '' };

export default function EvolutionPage() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [qrModal, setQrModal] = useState<{ instanceId: string; data: any } | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/evolution/instances');
      const d = await r.json();
      if (Array.isArray(d)) setInstances(d);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    const { name, instance_key, api_url, api_token } = form;
    if (!name.trim() || !instance_key.trim() || !api_url.trim() || !api_token.trim()) {
      setError('Todos los campos son requeridos'); return;
    }
    setSaving(true); setError('');
    try {
      const r = await fetch('/api/admin/evolution/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? 'Error'); return; }
      setCreating(false); setForm(EMPTY_FORM);
      await load();
    } catch { setError('Error de red'); }
    setSaving(false);
  }

  async function checkStatus(inst: Instance) {
    try {
      const r = await fetch(`/api/admin/evolution/instances/${inst.id}`);
      const d = await r.json();
      if (d.id) setInstances(prev => prev.map(x => x.id === inst.id ? { ...x, status: d.status, phone_number: d.phone_number } : x));
    } catch {}
  }

  async function showQR(inst: Instance) {
    setQrModal({ instanceId: inst.id, data: null });
    setLoadingQr(true);
    try {
      const r = await fetch(`/api/admin/evolution/instances/${inst.id}/qr`);
      const d = await r.json();
      setQrModal({ instanceId: inst.id, data: d });
    } catch {
      setQrModal({ instanceId: inst.id, data: { error: 'No se pudo obtener el QR' } });
    }
    setLoadingQr(false);
  }

  async function del(id: string) {
    if (!confirm('¿Eliminar esta instancia? Se desconectará el número de WhatsApp.')) return;
    await fetch(`/api/admin/evolution/instances/${id}`, { method: 'DELETE' });
    setInstances(prev => prev.filter(x => x.id !== id));
  }

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8 max-w-4xl mx-auto">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-brand-gold/60">Admin · Sistema CAC</p>
          <h1 className="text-2xl font-bold text-brand-text mt-1">Evolution API</h1>
          <p className="text-sm text-brand-muted mt-0.5">Conectá números de WhatsApp para envíos automáticos. Cada instancia = un número.</p>
        </div>
        <button onClick={() => { setCreating(true); setError(''); setForm(EMPTY_FORM); }}
          className="flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-bold text-black hover:bg-brand-gold/90 transition shrink-0">
          <Plus className="h-4 w-4" /> Nueva instancia
        </button>
      </div>

      {/* Info box */}
      <div className="mb-6 rounded-xl border border-blue-700/25 bg-blue-900/10 px-4 py-3">
        <p className="text-xs text-blue-300 font-semibold mb-1">Cómo funciona</p>
        <ul className="text-xs text-zinc-400 space-y-0.5">
          <li>1. Instalá Evolution API en Railway o tu VPS (<span className="font-mono text-zinc-300">github.com/EvolutionAPI/evolution-api</span>)</li>
          <li>2. Creá una instancia acá con la URL y el token de tu servidor</li>
          <li>3. Escaneá el QR desde WhatsApp en tu celular</li>
          <li>4. Configurá el webhook en Evolution para que apunte a: <span className="font-mono text-zinc-300">https://tu-dominio.vercel.app/api/evolution/webhook</span></li>
          <li>5. Asigná la instancia a una campaña y activá envíos automáticos</li>
        </ul>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-brand-gold" /></div>
      ) : instances.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <WifiOff className="h-10 w-10 text-zinc-700" />
          <p className="text-zinc-500">Sin instancias configuradas.</p>
          <button onClick={() => setCreating(true)} className="flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-bold text-black">
            <Plus className="h-4 w-4" /> Conectar primer número
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {instances.map(inst => {
            const cfg = STATUS_CONFIG[inst.status] ?? STATUS_CONFIG['disconnected'];
            const Icon = cfg.icon;
            return (
              <div key={inst.id} className="rounded-2xl border border-zinc-800/60 bg-[#0d0d0d] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={cn('mt-0.5 rounded-xl p-2 bg-zinc-800/60', cfg.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-brand-text">{inst.name}</p>
                      <p className="text-[11px] text-zinc-500 font-mono">{inst.instance_key}</p>
                      {inst.phone_number && <p className="text-xs text-emerald-400 font-mono mt-0.5">+{inst.phone_number}</p>}
                      <span className={cn('text-[10px] font-semibold', cfg.color)}>{cfg.label}</span>
                    </div>
                  </div>

                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => checkStatus(inst)} title="Actualizar estado"
                      className="p-2 rounded-xl border border-zinc-700 text-zinc-400 hover:bg-zinc-800 transition">
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                    {inst.status !== 'connected' && (
                      <button onClick={() => showQR(inst)} title="Ver QR"
                        className="p-2 rounded-xl border border-brand-gold/30 text-brand-gold hover:bg-brand-gold/10 transition">
                        <QrCode className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button onClick={() => del(inst.id)} title="Eliminar"
                      className="p-2 rounded-xl border border-zinc-700 text-zinc-400 hover:border-red-700/30 hover:text-red-400 hover:bg-red-900/10 transition">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#0d0d0d] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-brand-text">Nueva instancia WhatsApp</h2>
              <button onClick={() => setCreating(false)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400"><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-3">
              {[
                { key: 'name', label: 'Nombre descriptivo *', placeholder: 'Ej: Setter Juan — número comercial' },
                { key: 'instance_key', label: 'Clave de instancia *', placeholder: 'Ej: setter-juan-01' },
                { key: 'api_url', label: 'URL del servidor Evolution *', placeholder: 'https://evolution.tu-servidor.com' },
                { key: 'api_token', label: 'API Token *', placeholder: 'tu-token-secreto' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-zinc-400 mb-1 block">{f.label}</label>
                  <input
                    value={(form as any)[f.key]}
                    onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    type={f.key === 'api_token' ? 'password' : 'text'}
                    className="w-full rounded-xl border border-zinc-800 bg-[#111] px-4 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-gold/30 font-mono"
                  />
                </div>
              ))}
            </div>

            {error && <p className="text-xs text-red-400 bg-red-900/20 border border-red-700/30 rounded-xl px-3 py-2">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button onClick={save} disabled={saving}
                className="flex-1 rounded-xl bg-brand-gold py-2.5 font-bold text-black text-sm disabled:opacity-40 flex items-center justify-center gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Crear y conectar
              </button>
              <button onClick={() => setCreating(false)} className="rounded-xl border border-zinc-800 px-4 py-2.5 text-sm text-zinc-400">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* QR modal */}
      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4" onClick={() => setQrModal(null)}>
          <div className="w-full max-w-xs rounded-2xl border border-zinc-800 bg-[#0d0d0d] p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-bold text-brand-text">Escanear QR con WhatsApp</p>
              <button onClick={() => setQrModal(null)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400"><X className="h-4 w-4" /></button>
            </div>

            {loadingQr ? (
              <div className="flex h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-brand-gold" /></div>
            ) : qrModal.data?.error ? (
              <p className="text-xs text-red-400 text-center py-8">{qrModal.data.error}</p>
            ) : qrModal.data?.base64 ? (
              <div className="text-center">
                <img src={`data:image/png;base64,${qrModal.data.base64}`} alt="QR" className="mx-auto rounded-xl" />
                <p className="text-xs text-zinc-500 mt-3">Abrí WhatsApp → Dispositivos vinculados → Vincular dispositivo</p>
              </div>
            ) : (
              <p className="text-xs text-zinc-500 text-center py-8">Ya está conectado o el QR expiró. Actualizá el estado.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
