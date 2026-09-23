/**
 * E2E · Que ninguna planilla se pierda al cargarla
 * (docs/BRIEF_BACKEND_CARGA_PLANILLAS.md, sección 6).
 *
 * Prueba el circuito contra el backend REAL de staging con dos espacios
 * Secretaría y dos cuentas de prueba, bajo RLS (sesiones reales con la clave
 * publishable). Usa el mismo código que las rutas (`registrarLote`,
 * `reprocesarLote`), así que lo que pasa acá es lo que pasa en la app.
 *
 *   1. un lote con bloqueo de fecha sobrevive más de 30 min y se confirma;
 *   2. un lote vencido se reprocesa sin volver a subir el archivo;
 *   3. una fila sin fecha aparece en filasPendientes y no desaparece;
 *   4. "carga manual" importa las filas buenas y deja las otras en la bandeja;
 *   5. un usuario de otro espacio no ve el original, las filas ni la bandeja;
 *   6. la purga borra el original de un lote vencido fuera de retención.
 *
 * Se niega a correr contra producción. Borra todo lo que crea pase lo que
 * pase (espacios, cuentas, lotes, mediciones y archivos del bucket). Ojo: el
 * paso 6 corre la purga real, que también procesa cualquier otro archivo de
 * staging que ya esté fuera de retención (es lo mismo que hace el job diario).
 *
 *   npx tsx scripts/e2e-carga-planillas.mts
 */
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parsearEvaluacion } from "../lib/evaluaciones/importador/parsear";
import { BUCKET_LOTES, registrarLote, reprocesarLote, type RevisionLote } from "../lib/evaluaciones/originales";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ref = new URL(URL_SUPABASE).hostname.split(".")[0];
if (ref === "hjaeihdrrictmgilzaic") throw new Error("BLOQUEADO: este e2e nunca corre contra producción.");
if (process.env.APP_ENV !== "staging") throw new Error("Definí APP_ENV=staging para continuar.");

const sinSesion = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL_SUPABASE, process.env.SUPABASE_SECRET_KEY!, sinSesion);
const anonimo = createClient(URL_SUPABASE, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, sinSesion);

const sello = Date.now();
const clubes: string[] = [];
const usuarios: string[] = [];
let ok = 0;
let fallo = 0;
const assert = (cond: unknown, txt: string) => {
  console.log(`  ${cond ? "✅" : "❌"} ${txt}`);
  if (cond) ok++;
  else fallo++;
};
const codigo = (error: { message?: string } | null) => error?.message?.match(/TDS:([A-Z_]+)/u)?.[1] ?? error?.message ?? null;
const DIA = 24 * 60 * 60 * 1000;

async function espacio(letra: string) {
  const { data: club, error } = await admin.from("club").insert({
    nombre: `E2E Carga planillas ${letra} ${sello}`, localidad: "Salta", departamento: "Capital", tipo_organizacion: "secretaria",
  }).select("id").single();
  if (error || !club) throw new Error(`club ${letra}: ${error?.message}`);
  clubes.push(club.id);
  const email = `e2e-carga-${letra.toLowerCase()}-${sello}@prueba.local`;
  const clave = `Prueba-${sello}-${letra}-xyz`;
  const { data: u, error: errorU } = await admin.auth.admin.createUser({ email, password: clave, email_confirm: true });
  if (errorU || !u.user) throw new Error(`usuario ${letra}: ${errorU?.message}`);
  usuarios.push(u.user.id);
  const { data: membresia, error: errorM } = await admin.from("membresia").insert({
    club_id: club.id, auth_user_id: u.user.id, nombre: `E2E ${letra}`, email, rol: "admin_secretaria",
  }).select("id, club_id").single();
  if (errorM || !membresia) throw new Error(`membresía ${letra}: ${errorM?.message}`);
  const usuario = createClient(URL_SUPABASE, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, sinSesion);
  const { error: errorLogin } = await usuario.auth.signInWithPassword({ email, password: clave });
  if (errorLogin) throw new Error(`login ${letra}: ${errorLogin.message}`);
  return { usuario, membresia: membresia as { id: string; club_id: string } };
}

const contexto = (disciplina: string, grupo: string) => ({
  institucionOrigen: `E2E ${sello}`, disciplina, grupo, fechaDeclarada: "", evaluadoPor: "Equipo e2e",
});

async function subir(usuario: SupabaseClient, membresia: { id: string; club_id: string }, nombre: string,
  lineas: string[], ctx: ReturnType<typeof contexto>, servicio: SupabaseClient = admin) {
  const bytes = new Uint8Array(Buffer.from(lineas.join("\n"), "utf8"));
  const normalizada = await parsearEvaluacion(new File([bytes], nombre), ctx);
  return { ...(await registrarLote({ usuario, servicio, membresia, nombreArchivo: nombre, bytes, contexto: ctx, normalizada })), normalizada };
}

interface FilaLote {
  ruta_storage: string | null;
  retener_hasta: string | null;
  purgado_en: string | null;
  original_requerido: boolean;
  vence_en: string;
}

async function lote(id: string) {
  const { data } = await admin.from("lote_importacion")
    .select("ruta_storage, retener_hasta, purgado_en, original_requerido, vence_en").eq("id", id).single();
  return data as FilaLote;
}

// Planilla de saltos SIN fecha (ni en el título ni en el contexto).
const SALTOS_SIN_FECHA = (extra: string) => [
  "TEST DE SALTOS E2E",
  "Nombre;Apellido;Edad;Test;BW;JH;PLF;PP;RSI;AsA;AsC;HG",
  `Ana;Prueba${extra};15;CMJ;50;30;2000;45;0.4;10 L;5 R;30`,
  `Bea;Prueba${extra};14;SJ;48;28;1900;44;0.5;–;–;28`,
];
// Gimnasia: una fila sin fecha y una con un valor ilegible.
const GIMNASIA = [
  "N°;Nombre;Fecha;Peso Corporal (kg);Altura de Salto (cm);Fuerza;Potencia;RSI;Asim A;Asim C",
  `1;Caro E2E${sello};2026-03-01;40;25;1500;40;0.3;;`,
  `2;Dani E2E${sello};;41;26;1600;41;0.31;;`,
  `3;Eli E2E${sello};2026-03-01;ausente;24;1400;39;0.29;;`,
  ";Estadísticas;;;;;;;;",
  ";Mín;;40;24;1400;39;0.29;;",
];

try {
  const A = await espacio("A");
  const B = await espacio("B");

  // ---------------------------------------------------------------
  console.log("\n0) El original se guarda; si no se puede, el lote no queda usable");
  const l1 = await subir(A.usuario, A.membresia, "saltos-e2e.csv", SALTOS_SIN_FECHA("Uno"), contexto("Vóley", "E2E Uno"));
  const f1 = await lote(l1.loteId);
  assert(f1.ruta_storage === `${A.membresia.club_id}/${l1.loteId}.csv`, "el lote nuevo tiene su original en el bucket privado");
  const { data: objeto } = await admin.storage.from(BUCKET_LOTES).download(String(f1.ruta_storage));
  assert(objeto && (await objeto.text()).includes("TEST DE SALTOS E2E"), "el archivo guardado es el original, byte a byte");
  assert(f1.retener_hasta && f1.original_requerido === true, "nace con retención de 180 días y original obligatorio");

  let fallida: unknown = null;
  try {
    // Un cliente sin permisos de Storage simula que la subida falla.
    await subir(A.usuario, A.membresia, "falla-e2e.csv", SALTOS_SIN_FECHA("Falla"), contexto("Vóley", "E2E Falla"), anonimo);
  } catch (error) { fallida = error; }
  assert((fallida as { codigo?: string })?.codigo === "SUBIDA_FALLIDA", "si la subida falla, la previsualización se rechaza");
  const { data: fallidos } = await admin.from("lote_importacion").select("estado, ruta_storage, detalle_error")
    .eq("club_id", A.membresia.club_id).eq("nombre_archivo", "falla-e2e.csv");
  assert(fallidos?.length === 1 && fallidos[0].estado === "fallido" && !fallidos[0].ruta_storage,
    "…y el lote queda 'fallido', no como previsualizado usable");

  // ---------------------------------------------------------------
  console.log("\n1) Un lote con bloqueo de fecha sobrevive más de 30 min y se confirma");
  assert(l1.normalizada.hallazgos.some((h) => h.id === "fecha-ausente" && h.severidad === "bloqueo"), "la planilla sin fecha entra con el bloqueo de fecha");
  assert(new Date(f1.vence_en).getTime() - Date.now() > 6.9 * DIA, "con bloqueos, la revisión dura 7 días (antes: 30 minutos)");
  const rfCm = await A.usuario.rpc("guardar_resoluciones_lote", { p_lote_id: l1.loteId, p_resoluciones: { "fecha-ausente": "carga_manual" }, p_motivo: "Prueba e2e" });
  assert(codigo(rfCm.error) === "FECHA_NO_ADMITE_CARGA_MANUAL", "la fecha NO puede ir a carga manual");
  // Simula la respuesta del club días después: el lote tiene hoy 2 días de vida.
  await admin.from("lote_importacion").update({ vence_en: new Date(Date.now() + 2 * DIA).toISOString() }).eq("id", l1.loteId);
  const rf = await A.usuario.rpc("guardar_resoluciones_lote", { p_lote_id: l1.loteId, p_resoluciones: { "fecha-ausente": "2026-03-01" }, p_motivo: "El club confirmó la fecha" });
  assert(!rf.error && new Date(rf.data.venceEn).getTime() - Date.now() > 6.9 * DIA, "guardar una decisión renueva la revisión a 7 días");
  const c1 = await A.usuario.rpc("confirmar_lote_revisado", { p_lote_id: l1.loteId, p_motivo: "Fecha confirmada por el club" });
  assert(!c1.error && c1.data?.medicionesGuardadas > 0, `se confirma con la fecha que dio el club (${c1.data?.medicionesGuardadas ?? 0} mediciones)`);

  // ---------------------------------------------------------------
  console.log("\n2) Un lote vencido se reprocesa sin volver a subir el archivo");
  const l2 = await subir(A.usuario, A.membresia, "gimnasia-e2e.csv", GIMNASIA, contexto("Gimnasia rítmica", "E2E Dos"));
  await admin.from("lote_importacion").update({ vence_en: new Date(Date.now() - 60_000).toISOString() }).eq("id", l2.loteId);
  const rv = await A.usuario.rpc("guardar_resoluciones_lote", { p_lote_id: l2.loteId, p_resoluciones: { "filas-pendientes": "carga_manual" }, p_motivo: "Prueba e2e" });
  assert(codigo(rv.error) === "PREVIEW_EXPIRADO", "vencido, no admite decisiones");
  const { data: rev2 } = await A.usuario.rpc("bloqueos_lote", { p_lote_id: l2.loteId });
  assert(rev2?.archivoGuardado === true && rev2.reprocesoPideArchivo === false, "la revisión dice que el original está guardado y no hace falta subirlo");
  const rep = await reprocesarLote({ usuario: A.usuario, servicio: admin, clubId: A.membresia.club_id, revision: rev2 as RevisionLote, archivoSubido: null });
  assert(rep.usoOriginalGuardado, "se reprocesó leyendo el original del bucket, sin archivo nuevo");
  const { data: rev2b } = await A.usuario.rpc("bloqueos_lote", { p_lote_id: l2.loteId });
  assert(rev2b?.vencido === false && rev2b.editable === true, "el lote quedó reabierto y editable");

  // ---------------------------------------------------------------
  console.log("\n3) Una fila sin fecha aparece en filasPendientes y no desaparece");
  const pendientes2 = (rev2b?.filasPendientes ?? []) as Array<{ motivo: string; nombre: string; valores: Record<string, string> }>;
  const sinFecha = pendientes2.find((f) => f.motivo === "sin_fecha");
  assert(sinFecha?.nombre === `Dani E2E${sello}` && sinFecha.valores.altura_salto === "26", "la fila sin fecha está, con su nombre y sus valores");
  assert(pendientes2.some((f) => f.motivo === "valor_ilegible"), "la fila con un valor ilegible también");
  assert(rev2b?.conteoFilas?.resumen === 2 && rev2b.conteoFilas.pendientes === 2, "el pie de estadísticas se cuenta como resumen, no como pendiente");
  assert(rev2b?.bloqueos?.some((b: { id: string }) => b.id === "filas-pendientes"), "y hay un bloqueo que exige decidir qué hacer con ellas");

  // ---------------------------------------------------------------
  console.log("\n4) Carga manual: entran las filas buenas y el resto va a la bandeja");
  const sinDecidir = await A.usuario.rpc("confirmar_lote_revisado", { p_lote_id: l2.loteId, p_motivo: "Prueba e2e" });
  assert(codigo(sinDecidir.error) === "BLOQUEOS_PENDIENTES", "sin decisión no se confirma: nada se excluye solo");
  await A.usuario.rpc("guardar_resoluciones_lote", { p_lote_id: l2.loteId, p_resoluciones: { "filas-pendientes": "carga_manual" }, p_motivo: "Se cargan a mano con la planilla en papel" });
  const atajo = await A.usuario.rpc("confirmar_lote_evaluacion", { p_lote_id: l2.loteId, p_resoluciones: { "filas-pendientes": "carga_manual" } });
  assert(codigo(atajo.error) === "REQUIERE_REVISION", "la confirmación rápida (sin motivo) no puede dejar filas para carga manual");
  const c2 = await A.usuario.rpc("confirmar_lote_revisado", { p_lote_id: l2.loteId, p_motivo: "Se importa lo reconocido" });
  assert(!c2.error && c2.data?.filasCargaManual === 2, `se confirma y 2 filas quedan para carga manual (${c2.error?.message ?? "ok"})`);
  const { data: meds } = await admin.from("medicion").select("deportista:deportista_id(nombre)").eq("lote_importacion_id", l2.loteId);
  type ConDeportista = { deportista: { nombre: string } | { nombre: string }[] | null };
  const nombres = new Set(((meds ?? []) as ConDeportista[]).map((m) => (Array.isArray(m.deportista) ? m.deportista[0] : m.deportista)?.nombre));
  assert(nombres.has(`Caro E2E${sello}`) && nombres.has(`Eli E2E${sello}`), "las filas buenas (y lo legible de la ilegible) se importaron");
  assert(!nombres.has(`Dani E2E${sello}`), "la fila sin fecha no se importó con una fecha inventada");
  const { data: filasA } = await A.usuario.from("lote_fila_pendiente").select("id, motivo, estado, datos").eq("lote_id", l2.loteId).order("orden");
  assert(filasA?.length === 2 && filasA.every((f) => f.estado === "pendiente"), "las 2 filas están en lote_fila_pendiente, pendientes");
  const { data: bandejaA } = await A.usuario.rpc("pendientes_de_carga");
  const itemA = (bandejaA ?? []).find((p: { loteId: string }) => p.loteId === l2.loteId);
  assert(itemA?.tipo === "filas" && itemA.filasPendientes === 2, "la bandeja única muestra el lote con 2 filas por cargar");

  // ---------------------------------------------------------------
  console.log("\n5) Otro espacio no ve el original, las filas ni la bandeja (RLS)");
  const { data: filasB } = await B.usuario.from("lote_fila_pendiente").select("id").eq("lote_id", l2.loteId);
  assert((filasB ?? []).length === 0, "B no ve las filas pendientes de A");
  const { data: bandejaB } = await B.usuario.rpc("pendientes_de_carga");
  assert(!(bandejaB ?? []).some((p: { loteId: string }) => p.loteId === l2.loteId), "B no ve el lote de A en su bandeja");
  const ruta2 = `${A.membresia.club_id}/${l2.loteId}.csv`;
  const descargaB = await B.usuario.storage.from(BUCKET_LOTES).download(ruta2);
  assert(Boolean(descargaB.error) && !descargaB.data, "B no puede descargar el original de A");
  const firmaB = await B.usuario.storage.from(BUCKET_LOTES).createSignedUrl(ruta2, 60);
  assert(Boolean(firmaB.error) && !firmaB.data?.signedUrl, "B no puede firmar una URL al original de A");
  const descargaA = await A.usuario.storage.from(BUCKET_LOTES).download(ruta2);
  assert(!descargaA.error && Boolean(descargaA.data), "(control) A sí puede leer su propio original");
  const revB = await B.usuario.rpc("bloqueos_lote", { p_lote_id: l2.loteId });
  assert(codigo(revB.error) === "SIN_ALCANCE", "B no puede abrir la revisión del lote de A");
  const resB = await B.usuario.rpc("resolver_fila_pendiente", { p_id: filasA?.[0]?.id, p_resolucion: { tipo: "descartada", motivo: "intrusión" } });
  assert(codigo(resB.error) === "SIN_ALCANCE", "B no puede cerrar una fila de A");
  const { data: filasAnon } = await anonimo.from("lote_fila_pendiente").select("id").eq("lote_id", l2.loteId);
  assert((filasAnon ?? []).length === 0, "sin sesión no se ve ninguna fila");
  const reescribir = await A.usuario.from("lote_importacion").update({ ruta_storage: `${B.membresia.club_id}/x.csv` }).eq("id", l2.loteId);
  assert(Boolean(reescribir.error), "nadie puede reescribir la ruta del original desde el cliente (ni el dueño)");
  const escribirFila = await A.usuario.from("lote_fila_pendiente").insert({ lote_id: l2.loteId, orden: 99, fila: 1, motivo: "sin_fecha", datos: {} });
  assert(Boolean(escribirFila.error), "las filas pendientes no se escriben directo: solo por las RPC");

  // Cerrar las filas: una cargada a mano en una jornada, otra descartada con motivo.
  const sinMotivo = await A.usuario.rpc("resolver_fila_pendiente", { p_id: filasA?.[0]?.id, p_resolucion: { tipo: "descartada" } });
  assert(codigo(sinMotivo.error) === "MOTIVO_REQUERIDO", "descartar una fila exige motivo");
  const cargada = await A.usuario.rpc("resolver_fila_pendiente", { p_id: filasA?.[0]?.id, p_resolucion: { tipo: "cargada", jornada_id: c2.data?.jornadaId } });
  assert(!cargada.error && cargada.data?.restantesEnLote === 1, "una fila se cierra como cargada en la jornada");
  const descartada = await A.usuario.rpc("resolver_fila_pendiente", { p_id: filasA?.[1]?.id, p_resolucion: { tipo: "descartada", motivo: "Valor no recuperable" } });
  assert(!descartada.error && descartada.data?.restantesEnLote === 0, "la otra se descarta con motivo");
  const { data: bandejaA2 } = await A.usuario.rpc("pendientes_de_carga");
  assert(!(bandejaA2 ?? []).some((p: { loteId: string }) => p.loteId === l2.loteId), "sin filas abiertas, el lote sale de la bandeja");

  // ---------------------------------------------------------------
  console.log("\n6) La purga borra el original de un lote vencido fuera de retención");
  const l3 = await subir(A.usuario, A.membresia, "purga-e2e.csv", SALTOS_SIN_FECHA("Tres"), contexto("Vóley", "E2E Tres"));
  const ruta3 = `${A.membresia.club_id}/${l3.loteId}.csv`;
  await admin.from("lote_importacion").update({
    vence_en: new Date(Date.now() - DIA).toISOString(),
    retener_hasta: new Date(Date.now() - DIA).toISOString().slice(0, 10),
  }).eq("id", l3.loteId);
  const purga = await admin.rpc("purgar_planillas_recepcion");
  assert(!purga.error && purga.data?.purgadas >= 1, `la purga corrió (${JSON.stringify(purga.data ?? purga.error?.message)})`);
  const f3 = await lote(l3.loteId);
  assert(f3.purgado_en && !f3.ruta_storage, "el lote quedó marcado como purgado y sin ruta");
  const despues = await admin.storage.from(BUCKET_LOTES).download(ruta3);
  assert(Boolean(despues.error), "el archivo ya no está en el bucket");
  const { data: rev3 } = await A.usuario.rpc("bloqueos_lote", { p_lote_id: l3.loteId });
  assert(rev3?.archivoGuardado === false && rev3.reprocesoPideArchivo === true, "purgado, reprocesar vuelve a pedir el archivo");
  const f1b = await lote(l1.loteId);
  assert(f1b.ruta_storage && !f1b.purgado_en, "un lote dentro de su retención no se toca");
} catch (e) {
  console.error("\n💥", e instanceof Error ? e.message : e);
  fallo++;
} finally {
  // Orden: primero lo que tiene FK RESTRICT hacia lo demás.
  for (const club of clubes) {
    const { data: objetos } = await admin.storage.from(BUCKET_LOTES).list(club, { limit: 1000 });
    if (objetos?.length) await admin.storage.from(BUCKET_LOTES).remove(objetos.map((o) => `${club}/${o.name}`));
  }
  if (clubes.length) {
    for (const tabla of ["medicion", "jornada_evaluacion", "correccion_auditoria", "lote_importacion",
      "deportista", "categoria", "institucion_origen", "membresia", "club"]) {
      const { error } = await admin.from(tabla).delete().in(tabla === "club" ? "id" : "club_id", clubes);
      if (error) console.error(`  ⚠️  limpieza ${tabla}: ${error.message}`);
    }
  }
  for (const id of usuarios) await admin.auth.admin.deleteUser(id).catch(() => {});
  console.log(`\n🧹 ${clubes.length} espacios y ${usuarios.length} cuentas de prueba borrados`);
  console.log(`\n${fallo === 0 ? "✅" : "❌"} ${ok} OK · ${fallo} fallos`);
  process.exit(fallo === 0 ? 0 : 1);
}
