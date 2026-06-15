'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, ImagePlus, Check, ChevronRight, Square, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Step = 'welcome' | 'post';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('welcome');
  const [content, setContent] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const photoRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function handlePhoto(file: File) {
    setPhoto(file);
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], 'nota-audio.webm', { type: 'audio/webm' });
        setAudioFile(file);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      setError('No se pudo acceder al micrófono. Subí un archivo de audio en su lugar.');
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  async function submit() {
    if (!content.trim()) { setError('Escribí tu presentación.'); return; }
    setError('');
    setSubmitting(true);

    const fd = new FormData();
    fd.append('content', content);
    if (photo) fd.append('photo', photo);
    if (audioFile) fd.append('audio', audioFile);

    try {
      const res = await fetch('/api/onboarding', { method: 'POST', body: fd });
      if (res.ok) {
        router.push('/dashboard');
        router.refresh();
      } else {
        let msg = 'Error al guardar. Intentá de nuevo.';
        try { const d = await res.json(); msg = d.error ?? msg; } catch {}
        setError(msg);
        setSubmitting(false);
      }
    } catch {
      setError('Error de red. Revisá tu conexión e intentá de nuevo.');
      setSubmitting(false);
    }
  }

  const fmtTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress dots */}
        <div className="mb-8 flex justify-center gap-2">
          {(['welcome', 'post'] as Step[]).map((s, i) => (
            <div key={s} className={cn(
              'h-2 w-2 rounded-full transition-all',
              step === s
                ? 'w-6 bg-brand-gold'
                : i < (['welcome', 'post'] as Step[]).indexOf(step)
                  ? 'bg-brand-gold/60'
                  : 'bg-zinc-700'
            )} />
          ))}
        </div>

        {step === 'welcome' && (
          <div className="rounded-2xl border border-[rgba(212,175,55,0.2)] bg-[#0d0d0d] p-8">
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)]">
                <span className="text-3xl">🏆</span>
              </div>
              <h1 className="text-2xl font-bold text-brand-text">
                Bienvenido a Camino al Closing
              </h1>
              <p className="mt-3 text-sm text-brand-muted leading-relaxed">
                Estás entrando a la sala privada de closers de alto rendimiento.
                Antes de empezar, necesitamos que te presentes a la comunidad.
              </p>
            </div>

            <div className="mt-8 space-y-4">
              {[
                { icon: '💬', title: 'Comunidad activa', desc: 'Conectá con otros setters en entrenamiento.' },
                { icon: '🎯', title: 'Gestión de leads', desc: 'Administrá tus leads asignados y seguí tu progreso.' },
                { icon: '📊', title: 'Reportes diarios', desc: 'Cerrá cada jornada con métricas claras.' },
                { icon: '🤖', title: 'Entrenamiento con IA', desc: 'Practicá prospectos reales con el CAC Trainer.' },
              ].map((item) => (
                <div key={item.icon} className="flex items-start gap-3 rounded-lg border border-[rgba(212,175,55,0.08)] bg-[#111] p-3">
                  <span className="text-xl">{item.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-brand-text">{item.title}</p>
                    <p className="text-xs text-brand-muted">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep('post')}
              className="mt-8 w-full flex items-center justify-center gap-2 rounded-xl bg-brand-gold/20 border border-brand-gold/30 py-3 text-sm font-semibold text-brand-gold hover:bg-brand-gold/30 transition"
            >
              Continuar — Presentarme
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {step === 'post' && (
          <div className="rounded-2xl border border-[rgba(212,175,55,0.2)] bg-[#0d0d0d] p-8">
            <h2 className="text-xl font-bold text-brand-text mb-1">Tu presentación</h2>
            <p className="text-sm text-brand-muted mb-6">
              Presentate a la comunidad. Este post aparecerá en la sección de comunidad.
              Es <strong className="text-brand-text">obligatorio</strong> para activar tu cuenta.
            </p>

            {/* Photo */}
            <div className="mb-5">
              <label className="mb-2 block text-xs uppercase tracking-widest text-brand-muted">
                Foto de presentación (recomendado)
              </label>
              {photoPreview ? (
                <div className="relative">
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="h-32 w-32 rounded-xl object-cover border border-[rgba(212,175,55,0.2)]"
                  />
                  <button
                    onClick={() => { setPhoto(null); setPhotoPreview(null); }}
                    className="absolute -top-2 -right-2 rounded-full bg-zinc-800 border border-zinc-700 p-1 text-brand-muted hover:text-red-400"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => photoRef.current?.click()}
                  className="flex items-center gap-2 rounded-xl border border-dashed border-[rgba(212,175,55,0.2)] bg-[#111] px-4 py-3 text-sm text-brand-muted hover:border-brand-gold/30 hover:text-brand-gold transition"
                >
                  <ImagePlus className="h-4 w-4" />
                  Subir foto
                </button>
              )}
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhoto(f); }}
              />
            </div>

            {/* Text */}
            <div className="mb-5">
              <label className="mb-2 block text-xs uppercase tracking-widest text-brand-muted">
                Presentación * <span className="text-brand-muted/50">(obligatorio)</span>
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                placeholder="Hola! Soy [nombre], de [ciudad/país]. Me uno a Camino al Closing porque... Mi experiencia en ventas es... Mi objetivo es..."
                className="w-full rounded-xl border border-[rgba(212,175,55,0.15)] bg-[#111] px-4 py-3 text-sm text-brand-text placeholder:text-brand-muted/40 focus:outline-none focus:border-brand-gold/40 resize-none"
              />
            </div>

            {/* Audio */}
            <div className="mb-6">
              <label className="mb-2 block text-xs uppercase tracking-widest text-brand-muted">
                Nota de audio (opcional)
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {!audioFile ? (
                  <>
                    {!recording ? (
                      <button
                        onClick={startRecording}
                        className="flex items-center gap-2 rounded-xl border border-[rgba(212,175,55,0.2)] bg-[#111] px-4 py-2 text-sm text-brand-muted hover:text-brand-gold hover:border-brand-gold/30 transition"
                      >
                        <Mic className="h-4 w-4" />
                        Grabar audio
                      </button>
                    ) : (
                      <button
                        onClick={stopRecording}
                        className="flex items-center gap-2 rounded-xl border border-red-700/50 bg-red-900/20 px-4 py-2 text-sm text-red-300 hover:bg-red-900/30 transition"
                      >
                        <Square className="h-4 w-4" />
                        Detener ({fmtTime(recordingTime)})
                      </button>
                    )}
                    <span className="text-brand-muted/50 text-xs">o</span>
                    <button
                      onClick={() => audioRef.current?.click()}
                      className="flex items-center gap-2 rounded-xl border border-dashed border-zinc-700 bg-[#111] px-4 py-2 text-sm text-brand-muted hover:text-brand-text transition"
                    >
                      Subir archivo
                    </button>
                    <input
                      ref={audioRef}
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) setAudioFile(f); }}
                    />
                  </>
                ) : (
                  <div className="flex items-center gap-3 rounded-xl border border-green-700/40 bg-green-900/20 px-4 py-2">
                    <Mic className="h-4 w-4 text-green-400" />
                    <span className="text-xs text-green-300">{audioFile.name} ({Math.round(audioFile.size / 1024)} KB)</span>
                    <button
                      onClick={() => setAudioFile(null)}
                      className="text-brand-muted/60 hover:text-red-400 ml-2"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {error}
              </p>
            )}

            <button
              onClick={submit}
              disabled={submitting || !content.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-gold/20 border border-brand-gold/30 py-3 text-sm font-semibold text-brand-gold hover:bg-brand-gold/30 transition disabled:opacity-40"
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Publicando...</>
              ) : (
                <><Check className="h-4 w-4" /> Publicar y entrar a la plataforma</>
              )}
            </button>

            <p className="mt-3 text-center text-xs text-brand-muted/50">
              Este post será visible para todos los miembros de la comunidad.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
