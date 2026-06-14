import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';

const questions = [
  'En tus palabras, ¿cuál es el problema real que esta propuesta busca resolver en las personas que quieren trabajar en ventas remotas?',
  '¿Por qué la propuesta insiste en que “tener ganas no alcanza”? Explícalo con un ejemplo concreto de un setter mal preparado.',
  '¿Cuál es la diferencia principal entre un curso común y esta inmersión laboral? No respondas con frases copiadas: explícalo como si se lo tuvieras que contar a un prospecto.',
  'Según la propuesta, ¿qué necesita hoy el mercado de un setter o closer para considerarlo preparado?',
  '¿Por qué “no enseñamos scripts” es un punto importante de la propuesta? ¿Qué riesgo tiene depender solo de frases memorizadas?',
  'Si un alumno te pregunta: “¿Y después de las clases qué pasa?”, ¿cómo le explicarías el proceso de entrenamiento, corrección, auditoría, simulación y salida al campo?',
  '¿Qué significa trabajar uno a uno dentro de esta propuesta y por qué eso aumenta el valor percibido del programa?',
  '¿Por qué la comunicación profesional no depende solamente de lo que se dice? Mencioná al menos tres elementos que influyen en la percepción del prospecto o de una empresa.',
  '¿Qué rol cumple la mentalidad comercial dentro de esta inmersión? Explícalo por qué la técnica sola no alcanza para sostener oportunidades reales.',
  'Si tuvieras que resumir esta propuesta en una sola idea poderosa para que un prospecto la entienda, ¿cuál sería y por qué?',
];

export default function SettersTaskFormPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Tareas del 9/6/2026"
        title="Formulario de lectura y respuestas"
        description="Revisa la propuesta, abre la carátula y responde con tus palabras las 10 preguntas clave sobre el entrenamiento."
      />

      <div className="grid gap-8 lg:grid-cols-[1.5fr_0.9fr]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-[rgba(212,175,55,0.18)] bg-[#0a0a0a] p-6 shadow-gold">
            <h2 className="text-xl font-semibold text-brand-text">Responde con claridad</h2>
            <p className="mt-3 text-sm leading-6 text-brand-muted">
              Usa este formulario para capturar tus respuestas sobre la propuesta. Cada pregunta está diseñada para que muestres entendimiento real del enfoque de la inmersión.
            </p>
          </div>

          <form className="space-y-6 rounded-3xl border border-[rgba(212,175,55,0.18)] bg-[#0a0a0a] p-6 shadow-gold">
            {questions.map((question, index) => (
              <label key={index} className="block text-xs">
                <span className="mb-2 block uppercase tracking-[0.2em] text-brand-muted">
                  Pregunta {index + 1}
                </span>
                <p className="mb-3 text-sm leading-6 text-brand-text">{question}</p>
                <textarea
                  name={`question_${index + 1}`}
                  rows={5}
                  placeholder="Escribe tu respuesta aquí..."
                  className="w-full rounded-3xl border border-[rgba(212,175,55,0.18)] bg-[#0d0d0d] px-4 py-3 text-sm text-brand-text placeholder:text-brand-muted focus:border-[rgba(212,175,55,0.45)] focus:outline-none"
                />
              </label>
            ))}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-brand-muted">
                Guarda tus respuestas localmente si no hay backend configurado. Puedes copiar y pegar desde aquí a tu entrega.
              </p>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-brand-gold px-6 py-3 text-sm font-semibold text-brand-black transition hover:opacity-90"
              >
                Enviar respuestas
              </button>
            </div>
          </form>
        </div>

        <aside className="space-y-6 rounded-3xl border border-[rgba(212,175,55,0.18)] bg-[#0a0a0a] p-6 shadow-gold">
          <div className="rounded-3xl bg-[radial-gradient(circle_at_top_left,_rgba(212,175,55,0.18),transparent_45%)] p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-brand-gold">Carátula de la propuesta</p>
            <h2 className="mt-4 text-2xl font-semibold text-brand-text">Propuesta de entrenamiento</h2>
            <p className="mt-3 text-sm leading-6 text-brand-muted">
              Abre la propuesta antes de responder. Si aún no has subido el PDF al proyecto, coloca el archivo en <code className="rounded bg-surface px-1 py-0.5 text-[11px]">/public/propuesta.pdf</code>.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Link
                href="/propuesta.pdf"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full bg-brand-gold px-5 py-3 text-sm font-semibold text-brand-black transition hover:opacity-90"
              >
                Ver propuesta
              </Link>
              <div className="rounded-3xl border border-[rgba(212,175,55,0.18)] bg-[#090909] p-4 text-sm text-brand-muted">
                <p className="font-semibold text-brand-text">Instrucciones</p>
                <ul className="mt-3 space-y-2 list-disc pl-5">
                  <li>Lee la propuesta completa.</li>
                  <li>Responde con tus propias palabras.</li>
                  <li>No copies textos literales; demuestra comprensión.</li>
                </ul>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
