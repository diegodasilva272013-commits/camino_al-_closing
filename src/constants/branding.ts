export const brand = {
  name: 'Camino al Closing',
  tagline: 'Comunidad Privada',
  full: 'Camino al Closing — Comunidad Privada',
  description:
    'Sala privada de entrenamiento para vendedores de alto rendimiento.',
  colors: {
    background: '#050505',
    surface: '#111111',
    surfaceSoft: '#181818',
    gold: '#D4AF37',
    goldSoft: '#B8892D',
    text: '#F5F5F5',
    muted: '#A3A3A3',
    border: 'rgba(212, 175, 55, 0.25)',
  },
} as const;

export type Brand = typeof brand;
