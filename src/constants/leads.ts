export const LEAD_STATUSES = [
  'APERTURA_ENVIADA',
  'CONTACTADO',
  'NO_CONTACTADO',
  'NO_RESPONDE',
  'RESPONDIO',
  'INTERES_DETECTADO',
  'INVITADO_AL_GRUPO',
  'INGRESO_AL_GRUPO',
  'ACTIVO_EN_GRUPO',
  'DIAGNOSTICO_INICIADO',
  'DIAGNOSTICO_PROFUNDO',
  'REUNION_PROPUESTA',
  'REUNION_AGENDADA',
  'SEGUIMIENTO_FUTURO',
  'NO_CALIFICA',
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const STATUS_LABELS: Record<LeadStatus, string> = {
  APERTURA_ENVIADA:    'Apertura Enviada',
  CONTACTADO:          'Contactado',
  NO_CONTACTADO:       'No Contactado',
  NO_RESPONDE:         'No Responde',
  RESPONDIO:           'Respondió',
  INTERES_DETECTADO:   'Interés Detectado',
  INVITADO_AL_GRUPO:   'Invitado al Grupo',
  INGRESO_AL_GRUPO:    'Ingresó al Grupo',
  ACTIVO_EN_GRUPO:     'Activo en Grupo',
  DIAGNOSTICO_INICIADO:'Diagnóstico Iniciado',
  DIAGNOSTICO_PROFUNDO:'Diagnóstico Profundo',
  REUNION_PROPUESTA:   'Reunión Propuesta',
  REUNION_AGENDADA:    'Reunión Agendada',
  SEGUIMIENTO_FUTURO:  'Seguimiento Futuro',
  NO_CALIFICA:         'No Califica',
};

export const STATUS_COLORS: Record<LeadStatus, string> = {
  APERTURA_ENVIADA:    'bg-blue-900/40 text-blue-300 border-blue-700/40',
  CONTACTADO:          'bg-cyan-900/40 text-cyan-300 border-cyan-700/40',
  NO_CONTACTADO:       'bg-zinc-800/60 text-zinc-400 border-zinc-700/40',
  NO_RESPONDE:         'bg-orange-900/40 text-orange-300 border-orange-700/40',
  RESPONDIO:           'bg-sky-900/40 text-sky-300 border-sky-700/40',
  INTERES_DETECTADO:   'bg-yellow-900/40 text-yellow-300 border-yellow-700/40',
  INVITADO_AL_GRUPO:   'bg-purple-900/40 text-purple-300 border-purple-700/40',
  INGRESO_AL_GRUPO:    'bg-violet-900/40 text-violet-300 border-violet-700/40',
  ACTIVO_EN_GRUPO:     'bg-teal-900/40 text-teal-300 border-teal-700/40',
  DIAGNOSTICO_INICIADO:'bg-lime-900/40 text-lime-300 border-lime-700/40',
  DIAGNOSTICO_PROFUNDO:'bg-green-900/40 text-green-300 border-green-700/40',
  REUNION_PROPUESTA:   'bg-emerald-900/40 text-emerald-300 border-emerald-700/40',
  REUNION_AGENDADA:    'bg-[rgba(212,175,55,0.15)] text-[#d4af37] border-[rgba(212,175,55,0.35)]',
  SEGUIMIENTO_FUTURO:  'bg-amber-900/40 text-amber-300 border-amber-700/40',
  NO_CALIFICA:         'bg-red-900/40 text-red-400 border-red-800/40',
};

export const ACTIVITY_TYPES = {
  STATUS_CHANGE: 'STATUS_CHANGE',
  NOTE_ADDED:    'NOTE_ADDED',
  FOLLOWUP:      'FOLLOWUP',
  CLOSED:        'CLOSED',
  OPENING_SET:   'OPENING_SET',
} as const;
