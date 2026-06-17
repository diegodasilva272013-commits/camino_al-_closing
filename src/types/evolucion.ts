export type TipoEvidencia = 'conversacion' | 'reporte' | 'simulacion' | 'reunion' | 'evaluacion';
export type TipoComportamiento = 'positivo' | 'negativo';
export type RegistradoPor = 'lider' | 'ia' | 'auto';
export type TendenciaPatron = 'aumentando' | 'estable' | 'disminuyendo';
export type TipoIntervencion = 'roleplay' | 'simulacion_ia' | 'correccion' | 'clase' | 'mentoria';
export type EstadoRevision = 'aprobado' | 'candidato' | 'descartado';

export interface Persona {
  id: string;
  nombre: string;
  email: string;
  fecha_ingreso: string;
  rol_actual?: string | null;
  objetivo_actual?: string | null;
  activo: boolean;
  created_at: string;
}

export interface Capacidad {
  id: string;
  nombre: string;
  descripcion?: string | null;
  orden: number;
  activo: boolean;
}

export interface CatalogoComportamiento {
  id: string;
  capacidad_id: string;
  etiqueta: string;
  descripcion?: string | null;
  tipo: TipoComportamiento;
  estado_revision: EstadoRevision;
  veces_observado: number;
  created_at: string;
  capacidad?: Capacidad;
}

export interface Evidencia {
  id: string;
  persona_id: string;
  tipo: TipoEvidencia;
  fecha: string;
  contenido_raw?: string | null;
  contenido_resumen?: string | null;
  contexto_adicional?: string | null;
  fuente_externa_id?: string | null;
  created_at: string;
  persona?: Persona;
}

export interface Comportamiento {
  id: string;
  evidencia_id: string;
  persona_id: string;
  capacidad_id: string;
  catalogo_id: string;
  etiqueta: string;
  tipo: TipoComportamiento;
  momento_descripcion?: string | null;
  registrado_por: RegistradoPor;
  created_at: string;
  capacidad?: Capacidad;
  catalogo?: CatalogoComportamiento;
}

export interface Patron {
  id: string;
  persona_id: string;
  capacidad_id: string;
  catalogo_id: string;
  etiqueta: string;
  frecuencia: number;
  primera_vez: string;
  ultima_vez: string;
  tendencia: TendenciaPatron;
  updated_at: string;
  capacidad?: Capacidad;
  persona?: Persona;
}

export interface Intervencion {
  id: string;
  persona_id: string;
  patron_id: string;
  capacidad_id: string;
  tipo: TipoIntervencion;
  fecha: string;
  resultado_observado?: string | null;
  created_at: string;
  patron?: Patron;
}
