/**
 * E2E · Que las solicitudes de disciplina lleguen a alguien
 * (docs/BRIEF_BACKEND_SOLICITUDES_DISCIPLINA.md, sección 5).
 *
 * Contra el backend REAL de staging, con sesiones reales (clave publishable,
 * bajo RLS) y el MISMO código que usan la app y las server actions:
 * `lib/plataforma/solicitudes.ts` (bandeja y resolución, con su gate) y
 * `lib/secretaria/solicitudes.ts` (lo que devuelve /api/secretaria/configuracion).
 *
 *   1. una coordinadora pide una disciplina y un protocolo: quedan pendientes
 *      y los ve en `configuracion`;
 *   2. la plataforma los lista; una cuenta demo y un usuario común no pueden;
 *   3. aprobar una disciplina nueva con 2 protocolos: aparece en el catálogo
 *      de Medir con esos 2;
 *   4. aprobar un protocolo para una disciplina existente: se suma sin duplicar;
 *   5. rechazar sin resolución falla; con resolución, quien pidió la ve;
 *   6. resolver dos veces la misma solicitud falla;
 *   7. otro espacio de Secretaría no ve las solicitudes ajenas (RLS).
 *
 * Se niega a correr contra producción. Borra todo lo que crea pase lo que
 * pase y deja el catálogo global (Vóley) como estaba.
 *
 *   npx tsx scripts/e2e-solicitudes-disciplina.mts
 */
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { listarSolicitudesDisciplina, resolverSolicitudDisciplina } from "../lib/plataforma/solicitudes";
import { solicitudesDelEspacio } from "../lib/secretaria/solicitudes";

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

const sello = Date.now();
const clubes: string[] = [];
const usuarios: string[] = [];
const disciplinasCreadas: string[] = [];
let ok = 0;
let fallo = 0;
const assert = (cond: unknown, txt: string) => {
  console.log(`  ${cond ? "✅" : "❌"} ${txt}`);
  if (cond) ok++;
  else fallo++;
};
const codigo = (error: { message?: string } | null) => error?.message?.match(/TDS:([A-Z_]+)/u)?.[1] ?? error?.message ?? null;

async function cuenta(etiqueta: string, appMetadata: Record<string, unknown> = {}) {
  const email = `e2e-solic-${etiqueta}-${sello}@prueba.local`;
  const clave = `Prueba-${sello}-${etiqueta}-xyz`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: clave, email_confirm: true, app_metadata: appMetadata });
  if (error || !data.user) throw new Error(`usuario ${etiqueta}: ${error?.message}`);
  usuarios.push(data.user.id);
  const cliente = createClient(URL_SUPABASE, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, sinSesion);
  const { data: sesion, error: errorLogin } = await cliente.auth.signInWithPassword({ email, password: clave });
  if (errorLogin || !sesion.user) throw new Error(`login ${etiqueta}: ${errorLogin?.message}`);
  return { cliente, user: sesion.user as User, email };
}

async function espacio(letra: string) {
  const { data: club, error } = await admin.from("club").insert({
    nombre: `E2E Solicitudes ${letra} ${sello}`, localidad: "Salta", departamento: "Capital", tipo_organizacion: "secretaria",
  }).select("id").single();
  if (error || !club) throw new Error(`club ${letra}: ${error?.message}`);
  clubes.push(club.id);
  const c = await cuenta(`coord-${letra.toLowerCase()}`);
  const { error: errorM } = await admin.from("membresia").insert({
    club_id: club.id, auth_user_id: c.user.id, nombre: `Coordinadora E2E ${letra}`, email: c.email,
    rol: "coordinador_secretaria", funcion: "Coordinación",
  });
  if (errorM) throw new Error(`membresía ${letra}: ${errorM.message}`);
  return { cliente: c.cliente, clubId: club.id as string };
}

/** Las mismas dos consultas de catálogo que hace GET /api/secretaria/medir. */
async function catalogoMedir(cliente: SupabaseClient) {
  const [disciplinas, enlaces] = await Promise.all([
    cliente.from("disciplina").select("id, nombre").eq("activo", true).order("nombre"),
    cliente.from("disciplina_protocolo")
      .select("disciplina_id, orden, protocolo:protocolo_id(id, codigo, nombre, descripcion, protocolo_atributo(requerido, unidad, minimo, maximo, atributo:atributo_id(id, codigo, nombre)))")
      .eq("activo", true).order("orden"),
  ]);
  return { disciplinas: disciplinas.data ?? [], enlaces: (enlaces.data ?? []) as unknown as Array<{ disciplina_id: string; protocolo: { codigo: string } | null }> };
}

// Vóley en staging no tiene SPRINT_30M: se lo sumamos y al final se restaura.
const { data: voley } = await admin.from("disciplina").select("id").eq("nombre", "Vóley").single();
const { data: sprint } = await admin.from("protocolo").select("id").eq("codigo", "SPRINT_30M").single();
const { data: previo } = await admin.from("disciplina_protocolo").select("activo, orden")
  .eq("disciplina_id", voley!.id).eq("protocolo_id", sprint!.id).maybeSingle();

try {
  const A = await espacio("A");
  const B = await espacio("B");
  const plataforma = await cuenta("plataforma", { plataforma: true });
  const demo = await cuenta("demo", { plataforma: true, demo: true });
  const comun = await cuenta("comun");
  const nombreNueva = `E2E Disciplina ${sello}`;

  // ---------------------------------------------------------------
  console.log("\n1) La coordinadora pide una disciplina y un protocolo");
  const pd = await A.cliente.rpc("solicitar_disciplina_secretaria", { p_nombre: nombreNueva, p_descripcion: "Pedido del e2e", p_contexto: "Club de prueba" });
  assert(pd.data?.estado === "SOLICITADA", `pide una disciplina nueva (${pd.error?.message ?? pd.data?.estado})`);
  const pp = await A.cliente.rpc("solicitar_protocolo_secretaria", { p_disciplina_id: voley!.id, p_texto: "Sprint 30 m para Vóley", p_contexto: "Pretemporada" });
  assert(pp.data?.estado === "SOLICITADA", `pide un protocolo para una disciplina existente (${pp.error?.message ?? pp.data?.estado})`);
  const repetida = await A.cliente.rpc("solicitar_protocolo_secretaria", { p_disciplina_id: voley!.id, p_texto: "sprint 30 m para vóley" });
  assert(repetida.data?.estado === "SOLICITUD_YA_PENDIENTE", "el mismo pedido otra vez no se duplica");
  const otroPedido = await A.cliente.rpc("solicitar_protocolo_secretaria", { p_disciplina_id: voley!.id, p_texto: "Drop Jump con plataforma" });
  assert(otroPedido.data?.estado === "SOLICITADA", "otro pedido para la misma disciplina no es duplicado");
  const yaExiste = await A.cliente.rpc("solicitar_disciplina_secretaria", { p_nombre: "voley" });
  assert(yaExiste.data?.estado === "DISCIPLINA_YA_EXISTE", "pedir una disciplina que ya existe no crea solicitud");
  const rechazo = await A.cliente.rpc("solicitar_disciplina_secretaria", { p_nombre: `E2E Rechazo ${sello}` });
  const vinculo = await A.cliente.rpc("solicitar_disciplina_secretaria", { p_nombre: `Voleibol E2E ${sello}` });
  const directa = await A.cliente.from("disciplina_solicitud").insert({ club_id: A.clubId, nombre: "directa", nombre_clave: "directa", solicitado_por: A.clubId });
  assert(Boolean(directa.error), "no se puede escribir la tabla directo: solo por las funciones");
  const vistasA = await solicitudesDelEspacio(A.cliente, A.clubId);
  const protoA = vistasA.find((s) => s.id === pp.data?.id);
  assert(vistasA.some((s) => s.id === pd.data?.id && s.estado === "pendiente" && s.tipo === "disciplina"), "configuracion devuelve la disciplina pedida, pendiente");
  assert(protoA?.estado === "pendiente" && protoA.tipo === "protocolo" && protoA.disciplinaObjetivo === "Vóley", "…y el protocolo pedido, con su disciplina objetivo");

  // ---------------------------------------------------------------
  console.log("\n2) Solo la plataforma lista y resuelve");
  const lista = await listarSolicitudesDisciplina(admin, plataforma.user);
  const filaProto = lista.ok ? lista.data.find((s) => s.id === pp.data?.id) : undefined;
  assert(lista.ok && lista.data.some((s) => s.id === pd.data?.id), "la plataforma ve las solicitudes");
  assert(filaProto?.club.startsWith("E2E Solicitudes A") && filaProto.autor === "Coordinadora E2E A" && filaProto.funcion === "Coordinación"
    && filaProto.disciplinaObjetivo?.nombre === "Vóley" && filaProto.contexto === "Pretemporada", "…con club, quién pidió, su función, la disciplina objetivo y el contexto");
  if (lista.ok) {
    const primeraResuelta = lista.data.findIndex((s) => s.estado !== "pendiente");
    const ultimaPendiente = lista.data.map((s) => s.estado).lastIndexOf("pendiente");
    assert(primeraResuelta === -1 || ultimaPendiente < primeraResuelta, "pendientes primero");
  }
  const listaDemo = await listarSolicitudesDisciplina(admin, demo.user);
  const listaComun = await listarSolicitudesDisciplina(admin, comun.user);
  assert(!listaDemo.ok && !listaComun.ok, "una cuenta demo (aunque tenga el flag) y un usuario común no pueden listar");
  const resDemo = await resolverSolicitudDisciplina(admin, demo.user, { id: rechazo.data?.id, accion: "rechazar", resolucion: "intento demo" });
  const resComun = await resolverSolicitudDisciplina(admin, comun.user, { id: rechazo.data?.id, accion: "rechazar", resolucion: "intento común" });
  assert(!resDemo.ok && !resComun.ok, "…ni resolver");
  const rpcDirecta = await A.cliente.rpc("aprobar_solicitud_disciplina", { p_id: pd.data?.id, p_usuario: plataforma.user.id, p_protocolos: ["CMJ"] });
  assert(Boolean(rpcDirecta.error), "la aprobación no la ejecuta ninguna sesión: solo service_role");
  const suplantada = await admin.rpc("aprobar_solicitud_disciplina", { p_id: pd.data?.id, p_usuario: comun.user.id, p_protocolos: ["CMJ"] });
  assert(codigo(suplantada.error) === "USUARIO_NO_PLATAFORMA", "ni con service_role se aprueba a nombre de alguien que no es plataforma");

  // ---------------------------------------------------------------
  console.log("\n3) Aprobar una disciplina nueva con 2 protocolos");
  const inventado = await resolverSolicitudDisciplina(admin, plataforma.user, { id: pd.data?.id, accion: "aprobar", protocolos: ["CMJ", "INVENTADO"] });
  const { data: tras } = await admin.from("disciplina").select("id").eq("nombre", nombreNueva);
  assert(!inventado.ok && inventado.error.includes("INVENTADO") && (tras ?? []).length === 0, "un protocolo que no está en el catálogo falla y no deja nada a medias");
  const sinProtocolos = await resolverSolicitudDisciplina(admin, plataforma.user, { id: pd.data?.id, accion: "aprobar", protocolos: [] });
  assert(!sinProtocolos.ok, "aprobar sin elegir protocolos falla");
  const aprobada = await resolverSolicitudDisciplina(admin, plataforma.user, { id: pd.data?.id, accion: "aprobar", protocolos: ["CMJ", "sj"], resolucion: "Alta aprobada" });
  if (aprobada.ok && aprobada.data.disciplinaId) disciplinasCreadas.push(aprobada.data.disciplinaId);
  assert(aprobada.ok && aprobada.data.estado === "aprobada", `se aprueba (${aprobada.ok ? "ok" : aprobada.error})`);
  const catalogo = await catalogoMedir(A.cliente);
  const nueva = catalogo.disciplinas.find((d) => d.nombre === nombreNueva);
  const protocolosNueva = catalogo.enlaces.filter((e) => e.disciplina_id === nueva?.id).map((e) => e.protocolo?.codigo).sort();
  assert(Boolean(nueva), "la disciplina aparece en el catálogo que usa Medir");
  assert(JSON.stringify(protocolosNueva) === JSON.stringify(["CMJ", "SJ"]), `…con exactamente esos 2 protocolos (${protocolosNueva.join(", ")})`);
  const { data: filaAprobada } = await admin.from("disciplina_solicitud").select("resuelto_por_usuario, resuelto_en, protocolos_habilitados, disciplina_id").eq("id", pd.data?.id).single();
  assert(filaAprobada?.resuelto_por_usuario === plataforma.user.id && filaAprobada.resuelto_en && filaAprobada.disciplina_id === nueva?.id
    && JSON.stringify([...(filaAprobada.protocolos_habilitados ?? [])].sort()) === JSON.stringify(["CMJ", "SJ"]),
  "queda quién aprobó, cuándo, la disciplina y los protocolos habilitados");

  // ---------------------------------------------------------------
  console.log("\n4) Aprobar un protocolo para una disciplina existente");
  const antes = await catalogoMedir(A.cliente);
  const cmjAntes = antes.enlaces.filter((e) => e.disciplina_id === voley!.id && e.protocolo?.codigo === "CMJ").length;
  const sumado = await resolverSolicitudDisciplina(admin, plataforma.user, { id: pp.data?.id, accion: "aprobar", protocolos: ["SPRINT_30M", "CMJ"] });
  assert(sumado.ok && sumado.data.protocolosNuevos === (previo?.activo ? 0 : 1), `se suma solo lo que faltaba (${sumado.ok ? sumado.data.protocolosNuevos : sumado.error} nuevo)`);
  const despues = await catalogoMedir(A.cliente);
  const voleyDespues = despues.enlaces.filter((e) => e.disciplina_id === voley!.id).map((e) => e.protocolo?.codigo);
  assert(voleyDespues.includes("SPRINT_30M"), "Vóley ahora tiene Sprint 30 m en Medir");
  assert(voleyDespues.filter((c) => c === "CMJ").length === cmjAntes && cmjAntes === 1, "CMJ, que ya estaba, no se duplicó");
  const vincularProto = await resolverSolicitudDisciplina(admin, plataforma.user, { id: otroPedido.data?.id, accion: "vincular", disciplinaId: voley!.id });
  assert(!vincularProto.ok, "un pedido de protocolo no se 'vincula'");
  const vinculada = await resolverSolicitudDisciplina(admin, plataforma.user, { id: vinculo.data?.id, accion: "vincular", disciplinaId: voley!.id });
  assert(vinculada.ok && vinculada.data.disciplinaId === voley!.id, "un pedido de disciplina que ya existía se vincula a la existente");

  // ---------------------------------------------------------------
  console.log("\n5) Rechazar exige resolución, y quien pidió la ve");
  const sinResolucion = await resolverSolicitudDisciplina(admin, plataforma.user, { id: rechazo.data?.id, accion: "rechazar", resolucion: "  " });
  assert(!sinResolucion.ok, "rechazar sin resolución falla");
  const rechazada = await resolverSolicitudDisciplina(admin, plataforma.user, { id: rechazo.data?.id, accion: "rechazar", resolucion: "No es una disciplina deportiva del programa." });
  assert(rechazada.ok, "con resolución se rechaza");
  const vistasA2 = await solicitudesDelEspacio(A.cliente, A.clubId);
  const vistaRechazo = vistasA2.find((s) => s.id === rechazo.data?.id);
  assert(vistaRechazo?.estado === "rechazada" && vistaRechazo.resolucion === "No es una disciplina deportiva del programa." && vistaRechazo.resueltoEn,
    "la coordinadora ve el rechazo con su motivo");
  assert(vistasA2.find((s) => s.id === vinculo.data?.id)?.resolucion?.includes("Vóley"), "…y la vinculación le dice con qué disciplina");

  // ---------------------------------------------------------------
  console.log("\n6) Nada se resuelve dos veces");
  const dosVecesAprobar = await resolverSolicitudDisciplina(admin, plataforma.user, { id: pd.data?.id, accion: "aprobar", protocolos: ["DJ"] });
  const dosVecesRechazar = await resolverSolicitudDisciplina(admin, plataforma.user, { id: pd.data?.id, accion: "rechazar", resolucion: "cambio de idea" });
  const dosVecesVincular = await resolverSolicitudDisciplina(admin, plataforma.user, { id: rechazo.data?.id, accion: "vincular", disciplinaId: voley!.id });
  assert(!dosVecesAprobar.ok && !dosVecesRechazar.ok && !dosVecesVincular.ok, "una solicitud resuelta no admite otra resolución");
  const intacta = (await catalogoMedir(A.cliente)).enlaces.filter((e) => e.disciplina_id === nueva?.id).map((e) => e.protocolo?.codigo);
  assert(!intacta.includes("DJ"), "…y el intento no tocó el catálogo");

  // ---------------------------------------------------------------
  console.log("\n7) Otro espacio no ve las solicitudes ajenas (RLS)");
  const { data: directasB } = await B.cliente.from("disciplina_solicitud").select("id").eq("club_id", A.clubId);
  assert((directasB ?? []).length === 0, "B no lee las filas de A");
  const vistasB = await solicitudesDelEspacio(B.cliente, B.clubId);
  assert(vistasB.length === 0, "la configuracion de B no trae solicitudes de A");
  const sinSesionCliente = createClient(URL_SUPABASE, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, sinSesion);
  const { data: anon } = await sinSesionCliente.from("disciplina_solicitud").select("id").limit(1);
  assert((anon ?? []).length === 0, "sin sesión no se ve nada");
} catch (e) {
  console.error("\n💥", e instanceof Error ? e.message : e);
  fallo++;
} finally {
  if (clubes.length) {
    const { error } = await admin.from("disciplina_solicitud").delete().in("club_id", clubes);
    if (error) console.error(`  ⚠️  limpieza solicitudes: ${error.message}`);
  }
  // Catálogo global: la disciplina creada se va, y Vóley vuelve a como estaba.
  const { data: porNombre } = await admin.from("disciplina").select("id").eq("nombre", `E2E Disciplina ${sello}`);
  for (const id of new Set([...disciplinasCreadas, ...(porNombre ?? []).map((d) => d.id as string)])) {
    await admin.from("disciplina_protocolo").delete().eq("disciplina_id", id);
    const { error } = await admin.from("disciplina").delete().eq("id", id);
    if (error) console.error(`  ⚠️  limpieza disciplina: ${error.message}`);
  }
  if (voley && sprint) {
    if (!previo) await admin.from("disciplina_protocolo").delete().eq("disciplina_id", voley.id).eq("protocolo_id", sprint.id);
    else await admin.from("disciplina_protocolo").update({ activo: previo.activo, orden: previo.orden }).eq("disciplina_id", voley.id).eq("protocolo_id", sprint.id);
  }
  if (clubes.length) {
    await admin.from("membresia").delete().in("club_id", clubes);
    await admin.from("club").delete().in("id", clubes);
  }
  for (const id of usuarios) await admin.auth.admin.deleteUser(id).catch(() => {});
  console.log(`\n🧹 ${clubes.length} espacios, ${usuarios.length} cuentas y el catálogo de prueba restaurado`);
  console.log(`\n${fallo === 0 ? "✅" : "❌"} ${ok} OK · ${fallo} fallos`);
  process.exit(fallo === 0 ? 0 : 1);
}
