/**
 * Siembra un dataset FICTICIO pero realista en el club Fundación
 * Evolución Antoniana, para mostrar el valor de la solución: planteles
 * completos + ~1 año de historia de mediciones + cuerpo técnico
 * multi-rol (DT, PF, arqueros, nutrición, psicología, asistente
 * social…). NO son menores reales: es la vidriera del pitch.
 *
 *   node scripts/sembrar-showcase.mjs            # limpia lo sembrado y re-siembra
 *   node scripts/sembrar-showcase.mjs --limpiar  # solo limpia y sale
 *   SOLO="9ª División" node scripts/sembrar-showcase.mjs   # una categoría (test)
 *
 * Idempotente. Distingue lo sembrado por:
 *   - deportistas: doc_interno con prefijo "SHW-"
 *   - staff: email en el dominio "@staff.demo.local"
 * El servicio corre con service role (bypassa RLS para carga masiva).
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

const SOLO = process.env.SOLO || null;
const SOLO_LIMPIAR = process.argv.includes("--limpiar");
const DOC_PREFIX = "SHW-";
const STAFF_DOMINIO = "staff.demo.local";

// ---------- utilidades deterministas por índice (sin Math.random global) ----------
let SEED = 12345;
const rnd = () => {
  // PRNG simple y reproducible
  SEED = (SEED * 1103515245 + 12345) & 0x7fffffff;
  return SEED / 0x7fffffff;
};
const entre = (min, max) => min + rnd() * (max - min);
const enteroEntre = (min, max) => Math.round(entre(min, max));
const elegir = (arr) => arr[Math.floor(rnd() * arr.length)];
const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

// ---------- pools de nombres (NOA / Salta) ----------
const NOMBRES_M = ["Thiago","Benjamín","Bautista","Mateo","Santino","Lautaro","Valentino","Joaquín","Máximo","Lorenzo","Dylan","Ciro","Gael","Bruno","Facundo","Tomás","Ignacio","Juan Cruz","Lisandro","Emiliano","Gonzalo","Agustín","Nicolás","Ramiro","Franco","Álvaro","Iván","Matías","Lucas","Julián"];
const NOMBRES_F = ["Zoe","Emma","Mía","Catalina","Renata","Victoria","Isabella","Alma","Julieta","Martina","Guadalupe","Delfina","Abril","Pilar","Josefina","Emilia"];
const APELLIDOS = ["Mamaní","Guaymás","Cardozo","Yapura","Quipildor","Cruz","Vilte","Choque","Sajama","Colque","Ríos","Sosa","Guzmán","Farfán","Cáceres","Ocampo","Villagrán","Herrera","Guanca","Ontiveros","Ledesma","Aparicio","Flores","Gutiérrez","Romano","Zerpa","Burgos","Aramayo","Tolaba","Nievas","Copa","Liquin","Figueroa","Arias","Toconás","Salva","Wayar","Balderrama","Chocobar","Subelza"];

// ---------- fechas de jornadas (date-only) ----------
const FECHAS = ["2025-08-16","2025-09-27","2025-11-08","2025-12-20","2026-02-14","2026-04-04","2026-05-23","2026-07-04"];
const IDX_FISICO = [0, 2, 4, 6, 7]; // 5 jornadas de físico
const IDX_TECNICO = [1, 2, 4, 5, 6, 7]; // 6 apreciaciones técnicas
// historia larga (para 3 jugadores "que sobreviven al cambio de profe")
const FECHAS_HIST = ["2024-03-10", "2024-08-18", "2025-01-25", ...FECHAS];

// ---------- generación de valores por atributo (según edad y talento) ----------
function valores(nombreAtr, edad, talento, fechas) {
  const ruido = (i) => Math.sin(i * 2.1 + talento * 6); // -1..1 reproducible
  let base, slope, dec, min, max;
  switch (nombreAtr) {
    case "Talla":
      base = 78 + edad * 6.2 + entre(-4, 4); slope = 0.6 + edad * 0.02; dec = 0; min = 70; max = 200; break;
    case "Peso":
      base = 8 + edad * 2.6 + entre(-3, 3); slope = 0.35; dec = 1; min = 12; max = 95; break;
    case "Velocidad 30m": // menor_mejor (segundos)
      base = Math.max(4.2, 8.6 - edad * 0.19 + entre(-0.2, 0.2)); slope = -(0.02 + talento * 0.03); dec = 2; min = 4.0; max = 8.5; break;
    case "Salto vertical":
      base = 10 + edad * 1.7 + talento * 7 + entre(-3, 3); slope = 0.6 + talento * 0.3; dec = 0; min = 8; max = 95; break;
    case "Resistencia":
      base = 550 + edad * 95 + talento * 250 + entre(-80, 80); slope = 25 + talento * 15; dec = 0; min = 400; max = 3800; break;
    default: // técnicas 1-10
      base = 3.2 + talento * 3.8 + entre(-0.7, 0.7); slope = 0.1 + talento * 0.12; dec = 1; min = 1; max = 10; break;
  }
  const amplitudRuido = dec === 0 ? Math.max(1, base * 0.015) : nombreAtr === "Velocidad 30m" ? 0.06 : dec === 1 && max === 10 ? 0.3 : 0.4;
  return fechas.map((fecha, i) => {
    let v = base + slope * i + ruido(i) * amplitudRuido;
    v = Math.min(max, Math.max(min, v));
    return { fecha, valor: Number(v.toFixed(dec)) };
  });
}

// qué atributos mide cada tipo de categoría
function atributosDe(tipo, esArquero) {
  const fisico = tipo === "escuelita"
    ? ["Talla", "Peso", "Velocidad 30m", "Salto vertical"]
    : ["Talla", "Peso", "Velocidad 30m", "Salto vertical", "Resistencia"];
  let tecnico;
  if (tipo === "escuelita") tecnico = ["Pases", "Control de balón", "Visión de juego", "Remates"];
  else if (esArquero) tecnico = ["Atajando", "Balón parado", "Pases", "Visión de juego"];
  else tecnico = ["Pases", "Pases largos", "Remates", "Cabezazos", "Control de balón", "Entradas", "Balón parado", "Visión de juego"];
  return { fisico, tecnico };
}

function edadDe(cat) {
  if (cat.anio_nacimiento) return 2026 - cat.anio_nacimiento;
  if (cat.tipo === "reserva") return enteroEntre(18, 21);
  return enteroEntre(20, 29); // primera
}
function nacimientoDe(cat) {
  const anio = cat.anio_nacimiento ?? (cat.tipo === "reserva" ? enteroEntre(2005, 2008) : enteroEntre(1997, 2006));
  const mes = String(enteroEntre(1, 12)).padStart(2, "0");
  const dia = String(enteroEntre(1, 28)).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}
function tamañoPlantel(tipo) {
  if (tipo === "escuelita") return enteroEntre(20, 24);
  if (tipo === "inferior") return enteroEntre(16, 20);
  return enteroEntre(22, 25); // reserva / primera
}

const ok = (c, m) => console.log(`${c ? "✓" : "✗"} ${m}`);

// ============================================================
async function main() {
  const { data: clubs } = await a.from("club").select("id, nombre").ilike("nombre", "%Fundación Evolución Antoniana%");
  const club = clubs?.[0];
  if (!club) throw new Error("no encontré el club Fundación Evolución Antoniana");
  const clubId = club.id;

  // ---------- LIMPIEZA de lo sembrado ----------
  const { data: viejos } = await a.from("deportista").select("id").eq("club_id", clubId).like("doc_interno", `${DOC_PREFIX}%`);
  if (viejos?.length) {
    for (const c of chunk(viejos.map((v) => v.id), 200)) {
      await a.from("deportista").delete().in("id", c); // cascada: medicion, tutor, consentimiento, asignacion
    }
    console.log(`  limpieza: ${viejos.length} deportistas SHW- borrados (cascada)`);
  }
  // staff sembrado
  const { data: authList } = await a.auth.admin.listUsers({ perPage: 1000 });
  const staffViejo = (authList?.users ?? []).filter((u) => u.email?.endsWith(`@${STAFF_DOMINIO}`));
  for (const u of staffViejo) await a.auth.admin.deleteUser(u.id); // cascada: membresia, membresia_categoria
  if (staffViejo.length) console.log(`  limpieza: ${staffViejo.length} staff sembrado borrado`);

  if (SOLO_LIMPIAR) {
    console.log("\n✅ limpieza completa (--limpiar).");
    return;
  }

  // ---------- categorías ----------
  const { data: cats } = await a.from("categoria").select("id, nombre, tipo, anio_nacimiento");
  const catPorNombre = new Map(cats.map((c) => [c.nombre, c]));
  const catsSembrar = SOLO ? cats.filter((c) => c.nombre === SOLO) : cats;
  if (!catsSembrar.length) throw new Error(`categoría no encontrada: ${SOLO}`);

  // ---------- atributos (id por nombre + sentido) ----------
  const { data: atrs } = await a.from("atributo").select("id, nombre, sentido").eq("activo", true);
  const atrPorNombre = new Map(atrs.map((x) => [x.nombre, x]));

  // ---------- STAFF con función ----------
  const nombresCat = (tipos) => cats.filter((c) => tipos.includes(c.tipo)).map((c) => c.nombre);
  const STAFF = [
    { nombre: "Diego Aparicio", funcion: "Coordinador de inferiores", rol: "entrenador", cats: nombresCat(["inferior"]) },
    { nombre: "Marcelo Ríos", funcion: "Director técnico", rol: "entrenador", cats: ["3ª División", "4ª División"] },
    { nombre: "Hernán Sosa", funcion: "Director técnico", rol: "entrenador", cats: ["5ª División", "6ª División"] },
    { nombre: "Pablo Guzmán", funcion: "Director técnico", rol: "entrenador", cats: ["7ª División", "8ª División", "9ª División"] },
    { nombre: "Nora Fidele", funcion: "Directora técnica", rol: "entrenador", cats: ["Reserva (La Local)", "Primera"] },
    { nombre: "Luciana Farfán", funcion: "Preparador físico", rol: "entrenador", cats: nombresCat(["inferior", "reserva", "primera"]) },
    { nombre: "Ramiro Cáceres", funcion: "Entrenador de arqueros", rol: "entrenador", cats: nombresCat(["inferior", "reserva", "primera"]) },
    { nombre: "Valeria Ocampo", funcion: "Nutricionista", rol: "entrenador", cats: nombresCat(["inferior", "reserva", "primera", "escuelita"]) },
    { nombre: "Sofía Villagrán", funcion: "Psicóloga deportiva", rol: "entrenador", cats: nombresCat(["inferior", "reserva", "primera", "escuelita"]) },
    { nombre: "Mónica Ledesma", funcion: "Asistente social", rol: "entrenador", cats: nombresCat(["escuelita"]) },
    { nombre: "Lucas Herrera", funcion: "Profe de escuelita", rol: "entrenador", cats: ["Escuelita 2019", "Escuelita 2018"] },
    { nombre: "Paula Guanca", funcion: "Profe de escuelita", rol: "entrenador", cats: ["Escuelita 2017", "Escuelita 2016"] },
    { nombre: "Ramiro Ontiveros", funcion: "Profe de escuelita", rol: "entrenador", cats: ["Escuelita 2015", "Escuelita 2014"] },
  ];

  const profesDeCat = new Map(); // catId -> [membresiaId]
  for (const s of STAFF) {
    const slug = s.nombre
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, ".");
    const email = `${slug}@${STAFF_DOMINIO}`;
    const { data: created, error: eC } = await a.auth.admin.createUser({
      email, password: `Show-${slug}-26`, email_confirm: true,
    });
    if (eC) { console.log(`  staff ${email}: ${eC.message}`); continue; }
    const { data: memb, error: eM } = await a.from("membresia").insert({
      club_id: clubId, auth_user_id: created.user.id, nombre: s.nombre, email, rol: s.rol, funcion: s.funcion,
    }).select("id").single();
    if (eM) { console.log(`  membresia ${s.nombre}: ${eM.message}`); continue; }
    const asignaciones = s.cats
      .filter((n) => catPorNombre.has(n))
      .map((n) => ({ membresia_id: memb.id, categoria_id: catPorNombre.get(n).id }));
    if (asignaciones.length) await a.from("membresia_categoria").insert(asignaciones);
    for (const asg of asignaciones) {
      const lista = profesDeCat.get(asg.categoria_id) ?? [];
      lista.push(memb.id);
      profesDeCat.set(asg.categoria_id, lista);
    }
  }
  console.log(`  staff: ${STAFF.length} profesionales creados`);

  // ---------- DEPORTISTAS + tutores + consentimientos + mediciones ----------
  let docSeq = 1;
  let histRestantes = SOLO ? 1 : 3; // jugadores con historia larga
  const totalTutores = [];
  const totalConsent = [];
  const totalMediciones = [];
  let totalDep = 0;

  for (const cat of catsSembrar) {
    const n = tamañoPlantel(cat.tipo);
    const arqueros = cat.tipo === "escuelita" ? 0 : enteroEntre(1, 2);
    const nuevos = [];
    for (let i = 0; i < n; i++) {
      const esArquero = i < arqueros;
      const sexo = rnd() < 0.12 ? "F" : "M";
      const nombre = sexo === "F" ? elegir(NOMBRES_F) : elegir(NOMBRES_M);
      nuevos.push({
        club_id: clubId,
        categoria_id: cat.id,
        nombre,
        apellido: elegir(APELLIDOS),
        fecha_nacimiento: nacimientoDe(cat),
        sexo,
        lateralidad: rnd() < 0.78 ? "diestro" : rnd() < 0.85 ? "zurdo" : "ambidiestro",
        doc_interno: `${DOC_PREFIX}${String(docSeq++).padStart(4, "0")}`,
        _esArquero: esArquero,
      });
    }
    // insertar deportistas y recuperar ids (en orden)
    const insertados = [];
    for (const c of chunk(nuevos, 100)) {
      const payload = c.map((d) => {
        const fila = { ...d };
        delete fila._esArquero;
        return fila;
      });
      const { data, error } = await a.from("deportista").insert(payload).select("id, categoria_id");
      if (error) throw new Error(`deportista (${cat.nombre}): ${error.message}`);
      insertados.push(...data);
    }
    totalDep += insertados.length;

    const profes = profesDeCat.get(cat.id) ?? [];
    const registrador = () => (profes.length ? elegir(profes) : null);

    for (let i = 0; i < insertados.length; i++) {
      const dep = insertados[i];
      const meta = nuevos[i];
      const edad = edadDe(cat);
      const talento = rnd(); // 0..1

      // tutor (85%) — nombre y contacto ficticios
      if (rnd() < 0.95) {
        totalTutores.push({
          deportista_id: dep.id,
          nombre: `${elegir(NOMBRES_M.concat(NOMBRES_F))} ${meta.apellido}`,
          relacion: elegir(["Madre", "Padre", "Tutor/a", "Abuela"]),
          telefono: `387${enteroEntre(4000000, 5999999)}`,
        });
      }
      // consentimiento (85% otorgado; el resto queda pendiente)
      const consentOk = rnd() < 0.85;
      if (consentOk) {
        totalConsent.push({ deportista_id: dep.id, otorgado: true, fecha_firma: "2025-08-01" });
      }

      // ~8% sin mediciones (recién ingresados → dispara alertas)
      if (rnd() < 0.08) continue;

      const conHistLarga = histRestantes > 0 && (cat.tipo === "primera" || cat.tipo === "reserva") && rnd() < 0.4;
      if (conHistLarga) histRestantes--;
      const fechasFisico = (conHistLarga ? FECHAS_HIST : FECHAS).filter((_, idx) =>
        conHistLarga ? true : IDX_FISICO.includes(idx),
      );
      const fechasTecnico = (conHistLarga ? FECHAS_HIST : FECHAS).filter((_, idx) =>
        conHistLarga ? true : IDX_TECNICO.includes(idx),
      );
      const { fisico, tecnico } = atributosDe(cat.tipo, meta._esArquero);

      for (const nombreAtr of fisico) {
        const at = atrPorNombre.get(nombreAtr);
        if (!at) continue;
        for (const p of valores(nombreAtr, edad, talento, fechasFisico)) {
          totalMediciones.push({ deportista_id: dep.id, atributo_id: at.id, valor: p.valor, fecha: p.fecha, registrado_por: registrador() });
        }
      }
      for (const nombreAtr of tecnico) {
        const at = atrPorNombre.get(nombreAtr);
        if (!at) continue;
        for (const p of valores(nombreAtr, edad, talento, fechasTecnico)) {
          totalMediciones.push({ deportista_id: dep.id, atributo_id: at.id, valor: p.valor, fecha: p.fecha, registrado_por: registrador() });
        }
      }
    }
    console.log(`  ${cat.nombre}: ${insertados.length} deportistas`);
  }

  // inserts masivos finales
  for (const c of chunk(totalTutores, 500)) {
    const { error } = await a.from("tutor").insert(c);
    if (error) throw new Error(`tutor: ${error.message}`);
  }
  for (const c of chunk(totalConsent, 500)) {
    const { error } = await a.from("consentimiento").insert(c);
    if (error) throw new Error(`consentimiento: ${error.message}`);
  }
  let medOk = 0;
  for (const c of chunk(totalMediciones, 1000)) {
    const { error } = await a.from("medicion").insert(c);
    if (error) throw new Error(`medicion: ${error.message}`);
    medOk += c.length;
    process.stdout.write(`\r  mediciones: ${medOk}/${totalMediciones.length}`);
  }
  console.log("");

  ok(true, `deportistas: ${totalDep}`);
  ok(true, `tutores: ${totalTutores.length} · consentimientos: ${totalConsent.length}`);
  ok(true, `mediciones: ${totalMediciones.length}`);
  console.log("\n✅ Showcase sembrado en Club Fundación Evolución Antoniana.");
}

main().catch((e) => {
  console.error(`\n✗ ERROR: ${e.message}`);
  process.exit(1);
});
