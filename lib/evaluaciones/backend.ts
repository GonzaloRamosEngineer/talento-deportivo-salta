import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { crearClienteServer } from "@/lib/supabase/server";

const REF_PRODUCCION = "hjaeihdrrictmgilzaic";
const ROLES_OPERATIVOS = new Set([
  "admin_secretaria",
  "coordinador_secretaria",
  "evaluador",
]);

export class ErrorImportacion extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly codigo: string,
  ) {
    super(message);
  }
}

function projectRef(): string | null {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

export function exigirEntornoImportacion() {
  const ref = projectRef();
  if (ref === REF_PRODUCCION) {
    throw new ErrorImportacion(
      "La carga de evaluaciones está bloqueada en la base productiva. Configurá el proyecto de staging.",
      503,
      "ENTORNO_PRODUCTIVO_BLOQUEADO",
    );
  }
  if (process.env.IMPORT_BACKEND_ENABLED !== "true") {
    throw new ErrorImportacion(
      "El backend de importación no está habilitado en este entorno.",
      503,
      "IMPORTADOR_DESHABILITADO",
    );
  }
  if (process.env.APP_ENV !== "staging") {
    throw new ErrorImportacion(
      "La importación real solo se habilita con APP_ENV=staging.",
      503,
      "ENTORNO_NO_AUTORIZADO",
    );
  }
}

export async function sesionOperativaSecretaria() {
  const supabase = await crearClienteServer();
  const { data: { user }, error: errorUsuario } = await supabase.auth.getUser();
  if (errorUsuario || !user) {
    throw new ErrorImportacion("Iniciá sesión para cargar evaluaciones.", 401, "SESION_REQUERIDA");
  }

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
  const supabase = await crearClienteServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ErrorImportacion("Iniciá sesión.", 401, "SESION_REQUERIDA");
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

export function verificarPreview(token: string, usuarioId: string): PayloadToken {
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
  if (payload.exp < Date.now()) {
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
