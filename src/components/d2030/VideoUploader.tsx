'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Paso =
  | 'idle'
  | 'cargando_ffmpeg'
  | 'comprimiendo'
  | 'subiendo'
  | 'transcribiendo'
  | 'analizando'
  | 'completada'
  | 'error';

const PASO_MSG: Record<Paso, string> = {
  idle:            '',
  cargando_ffmpeg: 'Cargando compresor...',
  comprimiendo:    'Comprimiendo video...',
  subiendo:        'Subiendo...',
  transcribiendo:  'Transcribiendo audio con Whisper...',
  analizando:      'Analizando comportamientos...',
  completada:      '✓ Listo',
  error:           '',
};

const TIPOS = [
  { value: 'reunion',  label: 'Reunión' },
  { value: 'clase',    label: 'Clase' },
  { value: 'mentoria', label: 'Mentoría' },
  { value: 'otro',     label: 'Otro' },
];

export default function VideoUploader({ onClose }: { onClose?: () => void }) {
  const router = useRouter();
  const fileRef    = useRef<HTMLInputElement>(null);
  const [tipo,          setTipo]          = useState('clase');
  const [titulo,        setTitulo]        = useState('');
  const [fecha,         setFecha]         = useState('');
  const [participantes, setParticipantes] = useState('');
  const [archivo,       setArchivo]       = useState<File | null>(null);
  const [paso,          setPaso]          = useState<Paso>('idle');
  const [progreso,      setProgreso]      = useState(0);
  const [error,         setError]         = useState<string | null>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      setArchivo(f);
      setError(null);
      if (!titulo) setTitulo(f.name.replace(/\.[^.]+$/, ''));
    }
  }

  async function handleSubir() {
    if (!archivo) { setError('Seleccioná un archivo de video'); return; }
    setError(null);

    try {
      // 1. Crear registro en la base
      const createRes = await fetch('/api/d2030/grabacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          titulo:                  titulo || null,
          fecha:                   fecha || null,
          participantes:           participantes || null,
          archivo_original_nombre: archivo.name,
          archivo_original_tamano: archivo.size,
        }),
      });
      const { id: grabacionId, error: createErr } = await createRes.json();
      if (createErr) throw new Error(createErr);

      // 2. Comprimir video en el browser con ffmpeg.wasm
      setPaso('cargando_ffmpeg');
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { fetchFile, toBlobURL } = await import('@ffmpeg/util');

      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: await toBlobURL(
          'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
          'text/javascript'
        ),
        wasmURL: await toBlobURL(
          'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm',
          'application/wasm'
        ),
      });

      setPaso('comprimiendo');
      setProgreso(0);

      ffmpeg.on('progress', ({ progress }: { progress: number }) => {
        setProgreso(Math.round(progress * 100));
      });

      await ffmpeg.writeFile('input.mp4', await fetchFile(archivo));
      await ffmpeg.exec([
        '-i', 'input.mp4',
        '-vf', 'scale=-2:480',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '28',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        'output.mp4',
      ]);

      const outputData = await ffmpeg.readFile('output.mp4');
      const videoBlob  = new Blob([outputData as Uint8Array], { type: 'video/mp4' });
      await ffmpeg.deleteFile('input.mp4');
      await ffmpeg.deleteFile('output.mp4');

      // Actualizar tamaño comprimido
      await fetch(`/api/d2030/grabacion/${grabacionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archivo_comprimido_tamano: videoBlob.size }),
      });

      // 3. Pedir URL firmada para Supabase Storage
      setPaso('subiendo');
      setProgreso(0);

      const urlRes = await fetch(`/api/d2030/grabacion/${grabacionId}/upload-url`);
      const { uploadUrl, error: urlErr } = await urlRes.json();
      if (urlErr) throw new Error(urlErr);

      // 4. Subir video comprimido DIRECTO a Storage (no pasa por Vercel)
      const xhr = new XMLHttpRequest();
      await new Promise<void>((resolve, reject) => {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgreso(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload  = () => (xhr.status < 400 ? resolve() : reject(new Error(`Upload falló: ${xhr.status}`)));
        xhr.onerror = () => reject(new Error('Error de red al subir'));
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', 'video/mp4');
        xhr.send(videoBlob);
      });

      // 5. Decirle al backend que procese (transcripción + pipeline)
      setPaso('transcribiendo');
      const procRes = await fetch(`/api/d2030/grabacion/${grabacionId}/procesar`, { method: 'POST' });
      const procData = await procRes.json();
      if (!procRes.ok) throw new Error(procData.error ?? 'Error al procesar');

      setPaso('completada');
      setTimeout(() => {
        router.push(`/admin/evolucion/grabacion/${grabacionId}`);
      }, 800);

    } catch (err: any) {
      setPaso('error');
      setError(err.message ?? 'Error desconocido');
    }
  }

  const procesando = !['idle', 'completada', 'error'].includes(paso);

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-200">Subir grabación</h2>
        {onClose && !procesando && (
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">✕</button>
        )}
      </div>

      {/* Formulario */}
      {!procesando && paso !== 'completada' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Tipo *</label>
              <select
                value={tipo}
                onChange={e => setTipo(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
              >
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-500 mb-1">Título</label>
            <input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder={`Ej: Mentoría grupal — ${new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-500 mb-1">Participantes</label>
            <input
              value={participantes}
              onChange={e => setParticipantes(e.target.value)}
              placeholder="Ej: Diego, Lucas, 3 setters (opcional)"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          </div>

          {/* Selector de archivo */}
          <div
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              archivo ? 'border-emerald-600 bg-emerald-500/5' : 'border-zinc-700 hover:border-zinc-500'
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={onFileChange}
            />
            {archivo ? (
              <div>
                <p className="text-sm text-emerald-400 font-medium">{archivo.name}</p>
                <p className="text-xs text-zinc-500 mt-1">{(archivo.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-zinc-400">Click para elegir video</p>
                <p className="text-xs text-zinc-600 mt-1">MP4, MOV, WebM — cualquier resolución</p>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{error}</div>
          )}

          <button
            onClick={handleSubir}
            disabled={!archivo}
            className="w-full bg-white text-zinc-900 hover:bg-zinc-100 disabled:opacity-40 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          >
            Subir y analizar
          </button>
          <p className="text-xs text-zinc-600 text-center">
            El video se comprime en tu browser antes de subir. No cierres la pestaña.
          </p>
        </div>
      )}

      {/* Estado de procesamiento */}
      {procesando && (
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-zinc-600 border-t-white rounded-full animate-spin shrink-0" />
            <p className="text-sm text-zinc-300">{PASO_MSG[paso]}</p>
          </div>

          {(paso === 'comprimiendo' || paso === 'subiendo') && progreso > 0 && (
            <div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-200"
                  style={{ width: `${progreso}%` }}
                />
              </div>
              <p className="text-xs text-zinc-500 mt-1 text-right">{progreso}%</p>
            </div>
          )}

          <div className="space-y-1.5">
            {(['comprimiendo', 'subiendo', 'transcribiendo', 'analizando'] as Paso[]).map(p => {
              const pasos: Paso[] = ['cargando_ffmpeg', 'comprimiendo', 'subiendo', 'transcribiendo', 'analizando'];
              const idx     = pasos.indexOf(paso);
              const thisIdx = pasos.indexOf(p);
              const done    = thisIdx < idx;
              const active  = thisIdx === idx;
              return (
                <div key={p} className={`flex items-center gap-2 text-xs ${active ? 'text-zinc-200' : done ? 'text-emerald-500' : 'text-zinc-700'}`}>
                  <span>{done ? '✓' : active ? '→' : '·'}</span>
                  <span>{PASO_MSG[p]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {paso === 'completada' && (
        <div className="flex items-center gap-3 py-4">
          <span className="text-emerald-400 text-lg">✓</span>
          <p className="text-sm text-emerald-400">Listo. Redirigiendo...</p>
        </div>
      )}

      {paso === 'error' && (
        <div className="space-y-3">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{error}</div>
          <button
            onClick={() => { setPaso('idle'); setError(null); setProgreso(0); }}
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            ← Volver a intentar
          </button>
        </div>
      )}
    </div>
  );
}
