'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, CheckCircle, Loader2, Clock, FileText } from 'lucide-react';

type FormRow = {
  id: string;
  title: string;
  description: string | null;
  topic: string | null;
  question_count: number;
  submitted: boolean;
};

export default function FormulariosPage() {
  const router = useRouter();
  const [forms, setForms] = useState<FormRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/forms').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setForms(d);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-brand-gold" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <p className="text-[10px] uppercase tracking-widest text-brand-gold/60">Entrenamiento</p>
        <h1 className="text-2xl font-bold text-brand-text mt-1">Formularios de refuerzo</h1>
        <p className="text-sm text-brand-muted mt-0.5">Respondé cada formulario con honestidad. El Motor CAC analiza tu comprensión real.</p>
      </div>

      {!forms.length ? (
        <div className="flex flex-col items-center py-20 text-center gap-4">
          <ClipboardList className="h-12 w-12 text-brand-gold/20" />
          <p className="text-brand-text font-semibold">No hay formularios disponibles</p>
          <p className="text-sm text-brand-muted">Cuando tu admin active un formulario vas a verlo acá.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {forms.map(f => (
            <button key={f.id} onClick={() => router.push(`/formularios/${f.id}`)}
              className="w-full rounded-xl border border-[rgba(212,175,55,0.1)] bg-[#0d0d0d] p-4 text-left hover:bg-[#111] hover:border-brand-gold/20 transition group">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full
                  ${f.submitted ? 'bg-emerald-900/30 border border-emerald-500/30' : 'bg-[rgba(212,175,55,0.1)] border border-brand-gold/20'}`}>
                  {f.submitted
                    ? <CheckCircle className="h-4 w-4 text-emerald-400" />
                    : <FileText className="h-4 w-4 text-brand-gold" />}
                </div>
                <div className="flex-1 min-w-0">
                  {f.topic && <p className="text-[10px] uppercase tracking-wider text-brand-gold/50 mb-0.5">{f.topic}</p>}
                  <p className="text-sm font-semibold text-brand-text leading-snug">{f.title}</p>
                  {f.description && <p className="text-xs text-brand-muted mt-0.5 line-clamp-2">{f.description}</p>}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[11px] text-brand-muted">{f.question_count} preguntas</span>
                    {f.submitted
                      ? <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium"><CheckCircle className="h-3 w-3" />Respondido</span>
                      : <span className="flex items-center gap-1 text-[11px] text-amber-400"><Clock className="h-3 w-3" />Pendiente</span>}
                  </div>
                </div>
                <span className="text-brand-gold/40 group-hover:text-brand-gold transition text-lg shrink-0">›</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
