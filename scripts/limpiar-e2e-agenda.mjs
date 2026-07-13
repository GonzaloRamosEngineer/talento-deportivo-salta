/**
 * Verifica y limpia lo que crea la prueba e2e de agenda
 * (scratchpad/e2e-agenda.mjs): lugar "Cancha E2E", el horario fijo que
 * lo usa, las sesiones registradas en ese lugar (con su asistencia por
 * cascada) y el partido "Rival E2E" (con sus citaciones). Idempotente.
 *
 *   node scripts/limpiar-e2e-agenda.mjs [--verificar]
 *
 * --verificar además chequea EN LA BASE el contrato de asistencia por
 * excepción: la sesión e2e debe tener UNA sola fila en
 * sesion_asistencia (la falta, presente=false) aunque la UI muestre
 * 2/3 presentes; y el partido, 2 citaciones y resultado 2-1.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const verificar = process.argv.includes("--verificar");
let fallos = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "✓" : "✗ FALLO:"} ${msg}`);
  if (!cond) fallos++;
};

const { data: lugar } = await admin
  .from("lugar")
  .select("id")
  .eq("nombre", "Cancha E2E")
  .maybeSingle();

if (verificar) {
  if (!lugar) {
    ok(false, "no existe el lugar Cancha E2E (¿corrió el e2e?)");
  } else {
    const { data: sesiones } = await admin
      .from("sesion_entrenamiento")
      .select("id, estado, sesion_asistencia(deportista_id, presente)")
      .eq("lugar_id", lugar.id);
    ok(sesiones?.length === 1, `1 sesión registrada en Cancha E2E (hay ${sesiones?.length ?? 0})`);
    const s = sesiones?.[0];
    ok(s?.estado === "realizada", `la sesión quedó realizada (${s?.estado})`);
    ok(
      s?.sesion_asistencia.length === 1 && s.sesion_asistencia[0].presente === false,
      `asistencia POR EXCEPCIÓN: solo 1 fila y es la falta (filas=${s?.sesion_asistencia.length}, presente=${s?.sesion_asistencia[0]?.presente})`,
    );
  }
  const { data: partido } = await admin
    .from("partido")
    .select("id, goles_favor, goles_contra, partido_citacion(deportista_id)")
    .eq("rival", "Rival E2E")
    .maybeSingle();
  ok(!!partido, "existe el partido Rival E2E");
  ok(
    partido?.goles_favor === 2 && partido?.goles_contra === 1,
    `resultado 2-1 en la base (${partido?.goles_favor}-${partido?.goles_contra})`,
  );
  ok(
    partido?.partido_citacion.length === 2,
    `2 citados (destildado uno de 3) — hay ${partido?.partido_citacion.length}`,
  );
}

// ---------- limpieza (idempotente) ----------
await admin.from("partido").delete().eq("rival", "Rival E2E");
if (lugar) {
  await admin.from("sesion_entrenamiento").delete().eq("lugar_id", lugar.id);
  await admin.from("horario_entrenamiento").delete().eq("lugar_id", lugar.id);
  await admin.from("lugar").delete().eq("id", lugar.id);
}
console.log("Limpieza e2e de agenda: listo.");
if (verificar && fallos > 0) process.exit(1);
