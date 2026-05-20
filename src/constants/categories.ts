export const COMMUNITY_CATEGORIES = [
  'Anuncios',
  'Dudas',
  'Tareas',
  'Roleplays',
  'Objeciones',
  'Resultados',
  'Feedback de llamadas',
  'Presentaciones',
] as const;

export type CommunityCategory = (typeof COMMUNITY_CATEGORIES)[number];

export const RESOURCE_CATEGORIES = [
  'PDFs',
  'Plantillas',
  'Guiones',
  'Ejercicios',
  'Grabaciones',
  'Bonos',
] as const;

export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];

export const EVENT_TYPES = {
  live_class: 'Clase en vivo',
  practice: 'Práctica',
  mentoring: 'Mentoría',
  review: 'Revisión',
  launch: 'Lanzamiento',
  roleplay: 'Roleplay',
} as const;

export type EventType = keyof typeof EVENT_TYPES;
