'use client';

import { useRef, useState } from 'react';

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB

type State = 'idle' | 'signing' | 'uploading' | 'done' | 'error';

export function ResourceUploadField({
  label = 'Archivo (opcional)',
  name  = 'file_url',
}: {
  label?: string;
  name?:  string;
}) {
  const [state,    setState]    = useState<State>('idle');
  const [progress, setProgress] = useState(0);
  const [filename, setFilename] = useState('');
  const [error,    setError]    = useState('');
  const [url,      setUrl]      = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError('');
    setFilename(file.name);
    setProgress(0);
    setUrl('');

    if (file.size > MAX_BYTES) {
      setError('El archivo supera 100 MB.');
      setState('error');
      return;
    }

    // 1. Pedir URL firmada al servidor
    setState('signing');
    let signedUrl = '', publicUrl = '', token = '', path = '';
    try {
      const res  = await fetch('/api/admin/resources/upload-url', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ filename: file.name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error obteniendo URL');
      signedUrl = json.signedUrl;
      publicUrl = json.publicUrl;
      token     = json.token;
      path      = json.path;
    } catch (e: any) {
      setError(e.message ?? 'Error de red al preparar la subida');
      setState('error');
      return;
    }

    // 2. Subir directo a Supabase con progreso via XHR
    setState('uploading');
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Error HTTP ${xhr.status}: ${xhr.responseText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Error de red al subir el archivo'));

      // Supabase signed upload URL acepta PUT con el archivo como body
      xhr.open('PUT', signedUrl);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.send(file);
    }).catch((e: any) => {
      setError(e.message ?? 'Error subiendo el archivo');
      setState('error');
    });

    if (state === 'error') return; // catch ya ejecutó setState

    // 3. Guardar publicUrl en el hidden input
    setUrl(publicUrl);
    if (hiddenRef.current) hiddenRef.current.value = publicUrl;
    setState('done');
    setProgress(100);
  }

  return (
    <div className="space-y-2">
      <span className="block text-xs uppercase tracking-widest text-brand-muted">{label}</span>

      {/* Hidden input que va al Server Action */}
      <input ref={hiddenRef} type="hidden" name={name} value={url} />

      {/* File selector */}
      {state !== 'done' && (
        <label className={`flex cursor-pointer items-center gap-3 rounded border px-3 py-2.5 text-xs transition ${
          state === 'error'
            ? 'border-rose-700/60 bg-rose-950/20 text-rose-300'
            : 'border-[rgba(212,175,55,0.18)] bg-[#0d0d0d] text-brand-muted hover:border-[rgba(212,175,55,0.4)]'
        }`}>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
          />
          <span className="rounded border border-[rgba(212,175,55,0.3)] bg-[#1a1408] px-2.5 py-1 text-[11px] font-medium text-brand-gold">
            {state === 'idle' ? 'Elegir archivo' : state === 'signing' ? 'Preparando…' : 'Subiendo…'}
          </span>
          <span className="truncate">{filename || 'Sin archivo seleccionado'}</span>
        </label>
      )}

      {/* Barra de progreso */}
      {(state === 'uploading' || state === 'signing') && (
        <div className="space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-brand-gold transition-all duration-200"
              style={{ width: `${state === 'signing' ? 5 : progress}%` }}
            />
          </div>
          <p className="text-[10px] text-brand-muted">
            {state === 'signing' ? 'Preparando subida…' : `Subiendo… ${progress}%`}
          </p>
        </div>
      )}

      {/* Éxito */}
      {state === 'done' && (
        <div className="flex items-center justify-between rounded border border-emerald-800/50 bg-emerald-950/20 px-3 py-2">
          <div>
            <p className="text-[11px] font-medium text-emerald-300">✓ Archivo listo</p>
            <p className="truncate text-[10px] text-brand-muted">{filename}</p>
          </div>
          <button
            type="button"
            onClick={() => { setState('idle'); setUrl(''); setFilename(''); if (hiddenRef.current) hiddenRef.current.value = ''; }}
            className="text-[10px] text-brand-muted hover:text-brand-text"
          >
            Cambiar
          </button>
        </div>
      )}

      {/* Error */}
      {state === 'error' && (
        <p className="rounded border border-rose-900 bg-rose-950/40 px-3 py-2 text-xs text-rose-300">
          ✗ {filename}: {error}
        </p>
      )}
    </div>
  );
}
