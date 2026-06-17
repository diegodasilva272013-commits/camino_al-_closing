'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/supabase-server';

const db = () => createSupabaseAdminClient() as any;

// ── Personas ──────────────────────────────────────────────────────────────────

export async function createPersonaAction(_prev: unknown, formData: FormData) {
  const nombre         = (formData.get('nombre') as string)?.trim();
  const email          = (formData.get('email') as string)?.trim();
  const fecha_ingreso  = formData.get('fecha_ingreso') as string;
  const rol_actual     = (formData.get('rol_actual') as string)?.trim() || null;
  const objetivo_actual = (formData.get('objetivo_actual') as string)?.trim() || null;

  if (!nombre || !email || !fecha_ingreso)
    return { error: 'Nombre, email y fecha de ingreso son requeridos.' };

  const { error } = await db()
    .from('personas')
    .insert({ nombre, email, fecha_ingreso, rol_actual, objetivo_actual });

  if (error) return { error: error.message };
  revalidatePath('/admin/evolucion');
  redirect('/admin/evolucion');
}

// ── Evidencias ────────────────────────────────────────────────────────────────

export async function createEvidenciaAction(_prev: unknown, formData: FormData) {
  const persona_id        = formData.get('persona_id') as string;
  const tipo              = formData.get('tipo') as string;
  const fecha             = formData.get('fecha') as string;
  const contenido_resumen = (formData.get('contenido_resumen') as string)?.trim() || null;
  const contexto_adicional = (formData.get('contexto_adicional') as string)?.trim() || null;

  if (!persona_id || !tipo || !fecha)
    return { error: 'Persona, tipo y fecha son requeridos.' };

  const { data, error } = await db()
    .from('evidencias')
    .insert({ persona_id, tipo, fecha, contenido_resumen, contexto_adicional })
    .select('id')
    .single();

  if (error) return { error: error.message };
  revalidatePath(`/admin/evolucion/persona/${persona_id}`);
  redirect(`/admin/evolucion/evidencia/${data.id}/etiquetar`);
}

// ── Comportamientos ───────────────────────────────────────────────────────────

export async function createComportamientosAction(_prev: unknown, formData: FormData) {
  const evidencia_id  = formData.get('evidencia_id') as string;
  const persona_id    = formData.get('persona_id') as string;
  const rawItems      = formData.get('items') as string;

  if (!evidencia_id || !persona_id || !rawItems)
    return { error: 'Datos incompletos.' };

  type Item = {
    catalogo_id: string;
    capacidad_id: string;
    etiqueta: string;
    tipo: string;
    momento_descripcion?: string;
  };

  let items: Item[];
  try {
    items = JSON.parse(rawItems);
  } catch {
    return { error: 'Formato de comportamientos inválido.' };
  }

  if (!items.length) return { error: 'Seleccioná al menos un comportamiento.' };

  const rows = items.map((item) => ({
    evidencia_id,
    persona_id,
    capacidad_id:        item.capacidad_id,
    catalogo_id:         item.catalogo_id,
    etiqueta:            item.etiqueta,
    tipo:                item.tipo,
    momento_descripcion: item.momento_descripcion || null,
    registrado_por:      'lider',
  }));

  const { error } = await db().from('comportamientos').insert(rows);
  if (error) return { error: error.message };

  // Actualizar contadores en catálogo
  for (const item of items) {
    await db().rpc('increment_veces_observado', { p_catalogo_id: item.catalogo_id }).maybeSingle();
  }

  // Recalcular patrones
  await db().rpc('calcular_patrones').maybeSingle();

  revalidatePath(`/admin/evolucion/persona/${persona_id}`);
  redirect(`/admin/evolucion/persona/${persona_id}`);
}

// ── Intervenciones ────────────────────────────────────────────────────────────

export async function createIntervencionAction(_prev: unknown, formData: FormData) {
  const persona_id         = formData.get('persona_id') as string;
  const patron_id          = formData.get('patron_id') as string;
  const capacidad_id       = formData.get('capacidad_id') as string;
  const tipo               = formData.get('tipo') as string;
  const fecha              = formData.get('fecha') as string;
  const resultado_observado = (formData.get('resultado_observado') as string)?.trim() || null;

  if (!persona_id || !patron_id || !tipo || !fecha)
    return { error: 'Todos los campos requeridos deben completarse.' };

  const { error } = await db().from('intervenciones').insert({
    persona_id,
    patron_id,
    capacidad_id: capacidad_id || null,
    tipo,
    fecha,
    resultado_observado,
  });

  if (error) return { error: error.message };
  revalidatePath(`/admin/evolucion/persona/${persona_id}`);
  redirect(`/admin/evolucion/persona/${persona_id}`);
}

// ── Catálogo ──────────────────────────────────────────────────────────────────

export async function aprobarCandidatoAction(id: string) {
  await db()
    .from('catalogo_comportamientos')
    .update({ estado_revision: 'aprobado' })
    .eq('id', id);
  revalidatePath('/admin/evolucion/catalogo');
}

export async function descartarCandidatoAction(id: string) {
  await db()
    .from('catalogo_comportamientos')
    .update({ estado_revision: 'descartado' })
    .eq('id', id);
  revalidatePath('/admin/evolucion/catalogo');
}
