import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { crearClienteServer } from "@/lib/supabase/server";
import { esCuentaDemo } from "@/lib/demo";
import { ErrorImportacion } from "./errores";

const ROLES_OPERATIVOS = new Set([
  "admin_secretaria",
  "coordinador_secretaria",
  "evaluador",
]);

export { ErrorImportacion };

/**
 * Compuerta del módulo de Evaluaciones.
 *
 * ANTES esto era un bloqueo POR ENTORNO: ref de producción hardcodeado +
 * `APP_ENV === "staging"`. Servía mientras Evaluaciones no existía en
 * producción, pero es una compuerta que no distingue QUIÉN pide: dice
 * "acá no", no "vos no". Al habilitar producción hay que reemplazarla por
 * una que sí lo distinga, no simplemente quitarla.
 *
 * Lo que queda son tres capas, de la más débil a la más fuerte:
 *
 *   1. `EVALUACIONES_HABILITADAS` — interruptor por ambiente, apagado por
 *      defecto. Su única función es permitir apagar el módulo sin
 *      redeploy. NO es una medida de seguridad.
 *   2. `sesionOperativaSecretaria()` / `sesionSecretaria()` — sesión real,
 *      membresía en una organización `secretaria` y rol operativo. Acá se
 *      rechazan las cuentas demo.
 *   3. RLS — cada tabla filtra por `club_id` con `es_miembro_de` /
 *      `es_admin_de`. Es la que de verdad aísla, y la única que sigue
 *      valiendo si alguien se saltea el server.
 *
 * El interruptor no reemplaza a 2 y 3: se suma. Encenderlo en producción
 * no le da acceso a nadie que no lo tuviera ya por membresía.
 */
export function exigirEvaluacionesHabilitadas() {
  if (process.env.EVALUACIONES_HABILITADAS !== "true") {
    throw new ErrorImportacion(
      "El módulo de Evaluaciones no está habilitado en este entorno.",
      503,
      "EVALUACIONES_DESHABILITADAS",
    );
  }
}

/**
 * Compatibilidad: las rutas viejas siguen llamando a este nombre.
 * @deprecated usar `exigirEvaluacionesHabilitadas`.
 */
export const exigirEntornoImportacion = exigirEvaluacionesHabilitadas;


/**
 * Las cuentas de la vitrina pública NUNCA entran a Evaluaciones.
 *
 * Hoy esto es redundante: las demo son miembros de un club, no de la
 * Secretaría, así que el RLS ya las deja afuera. Es a propósito. Lo que
 * protege es el día que alguien, por comodidad, le dé una membresía de
 * Secretaría a una cuenta demo para "mostrar el módulo". Ese día el RLS
 * la dejaría pasar y esto no. La misma regla está además en la base
 * (trigger `membresia_sin_demo_en_secretaria`), porque una guarda que
 * vive solo en el server se saltea con la service key.
 */
function rechazarCuentaDemo(user: { email?: string | null; app_metadata?: Record<string, unknown> }) {
  if (esCuentaDemo(user as never)) {
    throw new ErrorImportacion(
      "Las cuentas de la demo no acceden a Evaluaciones.",
      403,
      "CUENTA_DEMO",
    );
  }
}

export async function sesionOperativaSecretaria() {
  exigirEvaluacionesHabilitadas();
  const supabase = await crearClienteServer();
  const { data: { user }, error: errorUsuario } = await supabase.auth.getUser();
  if (errorUsuario || !user) {
    throw new ErrorImportacion("Iniciá sesión para cargar evaluaciones.", 401, "SESION_REQUERIDA");
  }
  rechazarCuentaDemo(user);

  const { data, error } = await supabase
    .from("membresia")
    .select("id, club_id, rol, club:club_id(id, nombre, tipo_organizacion)")
    .eq("auth_user_id", user.id);
  if (error) throw new ErrorImportacion("No pudimos validar tu espacio de trabajo.", 403, "SIN_ALCANCE");

  const elegibles = (data ?? []).filter((fila) => {
    const club = Array.isArray(fila.club) ? fila.club[0] : fila.club;
    return club?.tipo_organizacion === "secretaria" && ROLES_OPERATIVOS.has(fila.rol);
  });
  if (elegibles.length !== 1) {
    throw new ErrorImportacion(
      elegibles.length > 1
        ? "Elegí el Espacio Secretaría activo antes de importar."
        : "Tu cuenta no tiene un rol operativo en el Espacio Secretaría.",
      403,
      "SIN_ALCANCE",
    );
  }
  return { supabase, user, membresia: elegibles[0] };
}

export async function sesionSecretaria() {
  exigirEvaluacionesHabilitadas();
  const supabase = await crearClienteServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ErrorImportacion("Iniciá sesión.", 401, "SESION_REQUERIDA");
  rechazarCuentaDemo(user);
  const { data, error } = await supabase
    .from("membresia")
    .select("id, club_id, rol, club:club_id(id, nombre, tipo_organizacion)")
    .eq("auth_user_id", user.id);
  if (error) throw new ErrorImportacion("No pudimos validar tu espacio.", 403, "SIN_ALCANCE");
  const membresia = (data ?? []).find((fila) => {
    const club = Array.isArray(fila.club) ? fila.club[0] : fila.club;
    return club?.tipo_organizacion === "secretaria";
  });
  if (!membresia) throw new ErrorImportacion("No tenés acceso al Espacio Secretaría.", 403, "SIN_ALCANCE");
  return { supabase, user, membresia };
}

function secretoToken() {
  const secreto = process.env.IMPORT_PREVIEW_SECRET;
  if (!secreto || secreto.length < 32) {
    throw new ErrorImportacion(
      "Falta configurar IMPORT_PREVIEW_SECRET con al menos 32 caracteres.",
      503,
      "CONFIGURACION_INCOMPLETA",
    );
  }
  return secreto;
}

interface PayloadToken {
  loteId: string;
  usuarioId: string;
  organizacionId: string;
  exp: number;
}

export function firmarPreview(payload: PayloadToken) {
  const cuerpo = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const firma = createHmac("sha256", secretoToken()).update(cuerpo).digest("base64url");
  return `${cuerpo}.${firma}`;
}

/**
 * Clave de servicio: solo para Storage (buckets privados, sin policies de
 * escritura). Nunca para leer o escribir tablas: eso va por RLS/RPC.
 */
export function clienteServicio() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * `vencimiento: "lo-decide-el-lote"` ignora el `exp` del token: el token
 * prueba QUIÉN subió QUÉ lote, pero si el lote sigue abierto lo dice
 * `lote_importacion.vence_en`, que la revisión extiende. Un token emitido
 * al subir no puede cortar una revisión que sigue viva.
 */
export function verificarPreview(
  token: string,
  usuarioId: string,
  { vencimiento = "token" }: { vencimiento?: "token" | "lo-decide-el-lote" } = {},
): PayloadToken {
  const [cuerpo, firma] = token.split(".");
  if (!cuerpo || !firma) throw new ErrorImportacion("La previsualización no es válida.", 400, "TOKEN_INVALIDO");
  const esperada = createHmac("sha256", secretoToken()).update(cuerpo).digest();
  let recibida: Buffer;
  try {
    recibida = Buffer.from(firma, "base64url");
  } catch {
    throw new ErrorImportacion("La previsualización no es válida.", 400, "TOKEN_INVALIDO");
  }
  if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) {
    throw new ErrorImportacion("La previsualización no es válida.", 400, "TOKEN_INVALIDO");
  }
  let payload: PayloadToken;
  try {
    payload = JSON.parse(Buffer.from(cuerpo, "base64url").toString("utf8")) as PayloadToken;
  } catch {
    throw new ErrorImportacion("La previsualización no es válida.", 400, "TOKEN_INVALIDO");
  }
  if (payload.usuarioId !== usuarioId) {
    throw new ErrorImportacion("Esta previsualización pertenece a otra sesión.", 403, "SIN_ALCANCE");
  }
  if (vencimiento === "token" && payload.exp < Date.now()) {
    throw new ErrorImportacion("La previsualización venció. Volvé a analizar el archivo.", 410, "PREVIEW_EXPIRADO");
  }
  return payload;
}

export async function hashArchivo(archivo: File) {
  return createHash("sha256").update(Buffer.from(await archivo.arrayBuffer())).digest("hex");
}

export function respuestaError(error: unknown) {
  if (error instanceof ErrorImportacion) {
    return Response.json({ error: error.message, codigo: error.codigo }, { status: error.status });
  }
  const mensaje = error instanceof Error ? error.message : "Ocurrió un error inesperado.";
  console.error("[evaluaciones]", error);
  return Response.json({ error: mensaje, codigo: "ERROR_INTERNO" }, { status: 500 });
}
