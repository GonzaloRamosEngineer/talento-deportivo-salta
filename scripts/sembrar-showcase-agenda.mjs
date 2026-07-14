/**
 * Fase 2 del showcase: llena la AGENDA del club Fundación Evolución
 * Antoniana sobre el plantel/staff ya sembrado (scripts/sembrar-showcase.mjs).
 *   - cronograma semanal por categoría (horario_entrenamiento)
 *   - sesiones pasadas 'realizada' con asistencia POR EXCEPCIÓN + foco
 *   - tablero: asignaciones de jugadores a estaciones (sesion_asignacion)
 *   - partidos con citaciones y resultados (sin marcador en escuelitas)
 *
 *   node scripts/sembrar-showcase-agenda.mjs            # limpia agenda del club y re-siembra
 *   node scripts/sembrar-showcase-agenda.mjs --limpiar  # solo limpia
 *
 * Idempotente: borra TODA la agenda del club (0 real hoy — es la vitrina)
 * y la reconstruye. Service role. Requiere haber corrido antes el seed
 * de plantel (usa los deportistas SHW- y el staff @staff.demo.local).
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const a = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SOLO_LIMPIAR = process.argv.includes("--limpiar");

let SEED = 98765;
const rnd = () => {
  SEED = (SEED * 1103515245 + 12345) & 0x7fffffff;
  return SEED / 0x7fffffff;
};
const enteroEntre = (min, max) => Math.round(min + rnd() * (max - min));
const elegir = (arr) => arr[Math.floor(rnd() * arr.length)];
const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

const RIVALES = ["Central Norte", "Gimnasia y Tiro", "San Martín", "Pellegrini", "Mitre", "Sportivo del Milagro", "Atlético Valle de Lerma", "Juventud Unida"];
const NOTAS = ["Rondos y posesión.", "Trabajo de definición por estaciones.", "Circuito físico + fútbol reducido.", "Pelota parada y transiciones.", "Fundamentos técnicos + partido formativo."];

// fecha (Date) del día `diaSemana` (1=lun) hace `semanasAtras` semanas
function fechaDia(diaSemana, semanasAtras) {
  const hoy = new Date();
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7) - semanasAtras * 7);
  lunes.setHours(0, 0, 0, 0);
  const d = new Date(lunes);
  d.setDate(lunes.getDate() + (diaSemana - 1));
  return d;
}
function ts(fecha, hora) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return new Date(`${y}-${m}-${d}T${hora}:00-03:00`).toISOString();
}

// cronograma por tipo: [{dia, hora, lugar:'predio'|'sede'}]
function cronoDe(cat, idx) {
  if (cat.tipo === "escuelita") {
    const h = ["17:00", "17:30", "18:00"][idx % 3];
    return [{ dia: 3, hora: h, lugar: "predio" }, { dia: 6, hora: "10:00", lugar: "predio" }];
  }
  if (cat.tipo === "inferior") {
    const h = ["18:00", "18:30", "19:00", "19:30", "20:00"][idx % 5];
    return [{ dia: 2, hora: h, lugar: "predio" }, { dia: 4, hora: h, lugar: "predio" }];
  }
  if (cat.tipo === "reserva") {
    return [{ dia: 1, hora: "11:00", lugar: "sede" }, { dia: 3, hora: "11:00", lugar: "sede" }, { dia: 5, hora: "11:00", lugar: "sede" }];
  }
  // primera: lun a vie
  return [1, 2, 3, 4, 5].map((dia) => ({ dia, hora: "09:30", lugar: "sede" }));
}

const ok = (c, m) => console.log(`${c ? "✓" : "✗"} ${m}`);

async function main() {
  const { data: clubs } = await a.from("club").select("id").ilike("nombre", "%Fundación Evolución Antoniana%");
  const clubId = clubs?.[0]?.id;
  if (!clubId) throw new Error("no encontré el club");

  // ---------- LIMPIEZA de la agenda del club ----------
  await a.from("partido").delete().eq("club_id", clubId); // cascada: citacion
  await a.from("sesion_entrenamiento").delete().eq("club_id", clubId); // cascada: asistencia, asignacion
  await a.from("horario_entrenamiento").delete().eq("club_id", clubId);
  console.log("  limpieza: agenda del club vaciada");
  if (SOLO_LIMPIAR) {
    console.log("\n✅ limpieza completa (--limpiar).");
    return;
  }

  // ---------- referencias ----------
  const { data: lugares } = await a.from("lugar").select("id, nombre").eq("club_id", clubId);
  const predio = lugares.find((l) => /predio/i.test(l.nombre))?.id ?? lugares[0].id;
  const sede = lugares.find((l) => /sede|principal/i.test(l.nombre))?.id ?? lugares[0].id;
  const lugId = { predio, sede };

  const { data: cats } = await a.from("categoria").select("id, nombre, tipo, anio_nacimiento");

  const { data: atrs } = await a.from("atributo").select("id, nombre, ambito").eq("activo", true);
  const estaciones = atrs.filter((x) => x.ambito === "tecnico"); // áreas del tablero
  const focos = estaciones;

  // staff sembrado por categoría (para responsable/registrador)
  const { data: mc } = await a
    .from("membresia_categoria")
    .select("categoria_id, membresia:membresia_id(id, email)");
  const profesDe = new Map();
  for (const f of mc ?? []) {
    const m = Array.isArray(f.membresia) ? f.membresia[0] : f.membresia;
    if (!m?.email?.endsWith("@staff.demo.local")) continue;
    const lista = profesDe.get(f.categoria_id) ?? [];
    lista.push(m.id);
    profesDe.set(f.categoria_id, lista);
  }

  // plantel SHW por categoría
  const { data: deps } = await a
    .from("deportista")
    .select("id, categoria_id")
    .eq("club_id", clubId)
    .like("doc_interno", "SHW-%");
  const plantelDe = new Map();
  for (const d of deps ?? []) {
    const lista = plantelDe.get(d.categoria_id) ?? [];
    lista.push(d.id);
    plantelDe.set(d.categoria_id, lista);
  }

  // ---------- cronograma ----------
  const horarios = [];
  cats.forEach((cat, idx) => {
    for (const s of cronoDe(cat, idx)) {
      horarios.push({ club_id: clubId, categoria_id: cat.id, dia_semana: s.dia, hora: `${s.hora}:00`, lugar_id: lugId[s.lugar] });
    }
  });
  await a.from("horario_entrenamiento").insert(horarios);
  ok(true, `cronograma: ${horarios.length} horarios`);

  // ---------- sesiones pasadas (realizada) + asistencia + tablero ----------
  let nSes = 0, nAsist = 0, nAsign = 0;
  for (let ci = 0; ci < cats.length; ci++) {
    const cat = cats[ci];
    const plantel = plantelDe.get(cat.id) ?? [];
    if (plantel.length === 0) continue;
    const profes = profesDe.get(cat.id) ?? [];
    const slots = cronoDe(cat, ci);
    // 3 sesiones pasadas: semanas 1 y 2 atrás, primer slot; + 1 del segundo slot
    const ocurrencias = [
      { slot: slots[0], sem: 2 },
      { slot: slots[0], sem: 1 },
      { slot: slots[1] ?? slots[0], sem: 1 },
    ];
    for (let oi = 0; oi < ocurrencias.length; oi++) {
      const { slot, sem } = ocurrencias[oi];
      const fecha = fechaDia(slot.dia, sem);
      const conTablero = oi >= 1; // las 2 más recientes con tablero
      const { data: ses, error: eS } = await a
        .from("sesion_entrenamiento")
        .insert({
          club_id: clubId,
          categoria_id: cat.id,
          responsable_id: profes.length ? elegir(profes) : null,
          atributo_foco: conTablero ? elegir(focos).id : null,
          fecha: ts(fecha, slot.hora),
          lugar_id: lugId[slot.lugar],
          estado: "realizada",
          descripcion: elegir(NOTAS),
        })
        .select("id")
        .single();
      if (eS) throw new Error(`sesion (${cat.nombre}): ${eS.message}`);
      nSes++;
      // asistencia POR EXCEPCIÓN: ~10-20% ausentes
      const ausentes = plantel.filter(() => rnd() < enteroEntre(10, 20) / 100);
      if (ausentes.length) {
        await a.from("sesion_asistencia").insert(ausentes.map((deportista_id) => ({ sesion_id: ses.id, deportista_id, presente: false })));
        nAsist += ausentes.length;
      }
      // tablero: ~65% del plantel a una estación
      if (conTablero && estaciones.length) {
        const asign = plantel
          .filter(() => rnd() < 0.65)
          .map((deportista_id) => ({ sesion_id: ses.id, deportista_id, atributo_id: elegir(estaciones).id }));
        if (asign.length) {
          for (const c of chunk(asign, 500)) await a.from("sesion_asignacion").insert(c);
          nAsign += asign.length;
        }
      }
    }
  }
  ok(true, `sesiones realizadas: ${nSes} · ausencias: ${nAsist} · asignaciones de tablero: ${nAsign}`);

  // ---------- partidos (inferior/reserva/primera; escuelitas sin marcador) ----------
  let nPar = 0, nCit = 0;
  for (let ci = 0; ci < cats.length; ci++) {
    const cat = cats[ci];
    const plantel = plantelDe.get(cat.id) ?? [];
    if (plantel.length === 0) continue;
    const esFormativa = cat.tipo === "escuelita";
    const cuantos = esFormativa ? 1 : enteroEntre(1, 2);
    for (let p = 0; p < cuantos; p++) {
      const local = rnd() < 0.5;
      const fecha = fechaDia(6, p + 1); // sábados pasados
      const { data: par, error: eP } = await a
        .from("partido")
        .insert({
          club_id: clubId,
          categoria_id: cat.id,
          fecha: ts(fecha, "16:00"),
          torneo: esFormativa ? "Encuentro formativo" : elegir(["Liga Salteña — Inferiores", "Torneo Apertura", "Amistoso"]),
          rival: elegir(RIVALES),
          condicion: local ? "local" : "visitante",
          lugar_id: local ? lugId.sede : null,
          lugar_texto: local ? null : "Cancha del rival",
          goles_favor: esFormativa ? null : enteroEntre(0, 4),
          goles_contra: esFormativa ? null : enteroEntre(0, 3),
        })
        .select("id")
        .single();
      if (eP) throw new Error(`partido (${cat.nombre}): ${eP.message}`);
      nPar++;
      // citación: ~80% del plantel
      const citados = plantel.filter(() => rnd() < 0.8).map((deportista_id) => ({ partido_id: par.id, deportista_id }));
      if (citados.length) {
        for (const c of chunk(citados, 500)) await a.from("partido_citacion").insert(c);
        nCit += citados.length;
      }
    }
  }
  ok(true, `partidos: ${nPar} · citaciones: ${nCit}`);

  console.log("\n✅ Agenda del showcase sembrada (cronograma + sesiones + tablero + partidos).");
}

main().catch((e) => {
  console.error(`\n✗ ERROR: ${e.message}`);
  process.exit(1);
});
