import { PageHeader } from '@/components/layout/page-header';
import { FileText, Brain, ShieldCheck, MessageCircle, Compass, Calendar, ExternalLink } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Resource = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

const RESOURCES: Resource[] = [
  {
    label: 'Brief oficial para setters',
    description: 'Documento base con el contexto y los lineamientos del rol.',
    href: 'https://drive.google.com/file/d/1jOJYD4AskRgtD8PKWdRGC_qqkgW5m2hh/view?usp=sharing',
    icon: FileText,
  },
  {
    label: 'GPT de Entrenamiento de CAC',
    description: 'Asistente de entrenamiento comercial para practicar y resolver dudas.',
    href: 'https://chatgpt.com/g/g-6a28ba784374819196ba814a1d9aa2f8-cac-trainer-el-sistema-de-entrenamiento-comercial',
    icon: Brain,
  },
  {
    label: 'Reglamento interno de CAC',
    description: 'Normas y reglas internas del programa.',
    href: 'https://gemini.google.com/share/2d3cbb9d9f97',
    icon: ShieldCheck,
  },
  {
    label: 'Grupo de Lanzamiento (WhatsApp)',
    description: 'Grupo oficial de WhatsApp para coordinación del lanzamiento.',
    href: 'https://chat.whatsapp.com/BouUahLfmvu4PKL8hJbhCP?mode=gi_t',
    icon: MessageCircle,
  },
  {
    label: 'Proceso de Prospección',
    description: 'Guía paso a paso del proceso de prospección de leads.',
    href: 'https://drive.google.com/file/d/1y0SBZiuKa6avM0A-sk24Q5gMbasIZQYY/view?usp=sharing',
    icon: Compass,
  },
  {
    label: 'Calendario de Diego',
    description: 'Agendar una reunión de 30 minutos.',
    href: 'https://calendly.com/diego_da_silva/30min',
    icon: Calendar,
  },
];

export default function SetterRecursosPage() {
  return (
    <div className="min-h-screen bg-[#080808] px-4 py-6 lg:px-8">
      <PageHeader
        eyebrow="Setter · Recursos"
        title="Recursos del Setter"
        description="Material oficial, entrenamiento y canales de contacto."
      />

      <div className="mt-6 grid max-w-3xl gap-3">
        {RESOURCES.map((r) => {
          const Icon = r.icon;
          return (
            <a
              key={r.href}
              href={r.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 rounded-xl border border-[rgba(212,175,55,0.12)] bg-[#0d0d0d] p-4 transition hover:border-[rgba(212,175,55,0.35)]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-gold/10 text-brand-gold">
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-brand-text">{r.label}</p>
                <p className="mt-0.5 text-xs text-brand-muted">{r.description}</p>
              </div>
              <ExternalLink className="h-4 w-4 shrink-0 text-brand-muted/50 transition group-hover:text-brand-gold" />
            </a>
          );
        })}
      </div>
    </div>
  );
}
