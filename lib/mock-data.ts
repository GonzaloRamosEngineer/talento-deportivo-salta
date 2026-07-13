// ============================================================
// DATOS MOCK — etapa de prototipo visual. Nada de esto viene de
// Supabase; el modelo imita el esquema de docs/01_ola1_mvp.sql
// (atributos con sentido/naturaleza, mediciones como serie
// temporal, sesiones con asistencia) para que la migración a
// datos reales no cambie la forma de los componentes.
//
// Estructura de categorías = club de fútbol formador salteño:
// escuelitas por año de nacimiento (los de 7 años en 2026 son
// "2019"), divisiones inferiores 9ª→3ª, Reserva y Primera.
// ============================================================

export type Sentido = "mayor_mejor" | "menor_mejor" | null;

export interface Atributo {
  id: string;
  nombre: string;
  abrev: string; // encabezado de la vista tabla
  ambito: "fisico" | "tecnico";
  naturaleza: "objetivo" | "subjetivo";
  unidad: string;
  sentido: Sentido;
  escalaMin: number;
  escalaMax: number;
  descripcion: string;
  entrenable: boolean; // aparece como área en el tablero de entrenamiento
}

export interface Medicion {
  fecha: string; // ISO
  valor: number;
  entrenador: string;
  nota?: string;
}

export interface Deportista {
  id: string;
  nombre: string;
  apellido: string;
  categoriaId: string;
  fechaNacimiento: string; // "" = sin dato (la fila real lo permite)
  sexo: "M" | "F" | "X" | null;
  lateralidad: "diestro" | "zurdo" | "ambidiestro" | null;
  docInterno?: string | null;
  consentimientoOk: boolean;
  mediciones: Record<string, Medicion[]>; // atributoId -> serie ordenada por fecha
  // Hitos de la trayectoria (cambios de categoría, ingreso al club):
  // se dibujan como líneas verticales en el gráfico de evolución.
  historial?: { fecha: string; evento: string }[];
}

export interface Categoria {
  id: string;
  nombre: string;
  tipo: "escuelita" | "inferior" | "reserva" | "primera" | null;
  anioNacimiento?: number;
}

export interface Lugar {
  id: string;
  nombre: string;
  direccion?: string;
}

// La rutina fija de la semana por categoría (estable por temporada).
// La agenda se arma desde acá; la sesión es la instancia de un día.
export interface Horario {
  /** solo en datos reales (uuid de horario_entrenamiento) */
  id?: string;
  categoriaId: string;
  diaSemana: number; // 1 = lunes … 7 = domingo
  hora: string; // "18:00"
  lugarId: string;
  entrenador: string;
}

export interface Sesion {
  id: string;
  fecha: string; // ISO con hora
  categoriaId: string;
  atributoFocoId: string | null;
  entrenador: string;
  lugarId: string;
  estado: "programada" | "realizada" | "cancelada";
  descripcion: string;
  asistencia: { deportistaId: string; presente: boolean }[];
}

// Partido: SOLO datos grupales (decisión 2026-07-09) — resultado del
// equipo y citados; nada de minutos/goles por chico. En categorías
// tipo "escuelita" NO se registra resultado (encuadre formativo).
export interface Partido {
  id: string;
  fecha: string; // ISO con hora
  categoriaId: string;
  torneo: string; // "Liga Salteña — Infantiles", "Amistoso"...
  rival: string;
  condicion: "local" | "visitante";
  lugarId?: string; // si es local, del catálogo del club
  lugarTexto?: string; // si es visitante, la cancha del rival
  citados: string[]; // deportistaIds
  resultado?: { favor: number; contra: number };
}

export interface ClubResumen {
  id: string;
  nombre: string;
  localidad: string;
  departamento: string; // nombre IGN del departamento (para el mapa)
  /** escudo (solo datos reales; el mock usa el placeholder) */
  escudoUrl?: string | null;
  esEsteClub: boolean;
  // métricas AGREGADAS: lo único que sale del club hacia el observatorio
  deportistas: number;
  medicionesMes: number;
  consentimientoPct: number;
  categoriasActivas: number;
}

export const CLUB = { nombre: "Club Atlético Antoniana", localidad: "Salta" };
// CLUBES se define al final del archivo: las métricas de Antoniana se
// calculan de los propios datos mock para que nunca queden desfasadas.

// ---------- CATEGORÍAS: la escalera completa del club ----------
export const CATEGORIAS: Categoria[] = [
  { id: "esc-2019", nombre: "Escuelita 2019", tipo: "escuelita", anioNacimiento: 2019 },
  { id: "esc-2018", nombre: "Escuelita 2018", tipo: "escuelita", anioNacimiento: 2018 },
  { id: "esc-2017", nombre: "Escuelita 2017", tipo: "escuelita", anioNacimiento: 2017 },
  { id: "esc-2016", nombre: "Escuelita 2016", tipo: "escuelita", anioNacimiento: 2016 },
  { id: "esc-2015", nombre: "Escuelita 2015", tipo: "escuelita", anioNacimiento: 2015 },
  { id: "esc-2014", nombre: "Escuelita 2014", tipo: "escuelita", anioNacimiento: 2014 },
  { id: "div-9", nombre: "9ª División", tipo: "inferior", anioNacimiento: 2013 },
  { id: "div-8", nombre: "8ª División", tipo: "inferior", anioNacimiento: 2012 },
  { id: "div-7", nombre: "7ª División", tipo: "inferior", anioNacimiento: 2011 },
  { id: "div-6", nombre: "6ª División", tipo: "inferior", anioNacimiento: 2010 },
  { id: "div-5", nombre: "5ª División", tipo: "inferior", anioNacimiento: 2009 },
  { id: "div-4", nombre: "4ª División", tipo: "inferior", anioNacimiento: 2008 },
  { id: "div-3", nombre: "3ª División", tipo: "inferior", anioNacimiento: 2007 },
  { id: "reserva", nombre: "Reserva (La Local)", tipo: "reserva" },
  { id: "primera", nombre: "Primera", tipo: "primera" },
];

// Ancla temporal de la demo: "hoy" es jueves 9 de julio de 2026.
// Toda la agenda mock gira alrededor de esta semana (lun 6 → dom 12).
export const HOY_DEMO = new Date("2026-07-09T12:00:00");

export const LUGARES: Lugar[] = [
  { id: "sede", nombre: "Cancha principal — Sede", direccion: "Av. Independencia 910, Salta" },
  { id: "predio", nombre: "Predio de inferiores", direccion: "B° El Tribuno, Salta" },
];

export const CRONOGRAMA: Horario[] = [
  // Escuelitas: 2 veces por semana
  { categoriaId: "esc-2019", diaSemana: 3, hora: "17:30", lugarId: "predio", entrenador: "Lucas Herrera" },
  { categoriaId: "esc-2019", diaSemana: 6, hora: "10:00", lugarId: "sede", entrenador: "Lucas Herrera" },
  { categoriaId: "esc-2018", diaSemana: 3, hora: "17:30", lugarId: "predio", entrenador: "Paula Guanca" },
  { categoriaId: "esc-2018", diaSemana: 6, hora: "10:00", lugarId: "sede", entrenador: "Paula Guanca" },
  { categoriaId: "esc-2017", diaSemana: 2, hora: "17:30", lugarId: "predio", entrenador: "Paula Guanca" },
  { categoriaId: "esc-2017", diaSemana: 4, hora: "17:30", lugarId: "predio", entrenador: "Paula Guanca" },
  { categoriaId: "esc-2016", diaSemana: 3, hora: "17:30", lugarId: "predio", entrenador: "Lucas Herrera" },
  { categoriaId: "esc-2016", diaSemana: 5, hora: "17:30", lugarId: "predio", entrenador: "Lucas Herrera" },
  { categoriaId: "esc-2015", diaSemana: 1, hora: "17:30", lugarId: "predio", entrenador: "Ramiro Ontiveros" },
  { categoriaId: "esc-2015", diaSemana: 5, hora: "17:30", lugarId: "predio", entrenador: "Ramiro Ontiveros" },
  { categoriaId: "esc-2014", diaSemana: 2, hora: "17:30", lugarId: "sede", entrenador: "Ramiro Ontiveros" },
  { categoriaId: "esc-2014", diaSemana: 4, hora: "17:30", lugarId: "sede", entrenador: "Ramiro Ontiveros" },
  // Inferiores: 2-3 veces por semana
  { categoriaId: "div-9", diaSemana: 2, hora: "18:00", lugarId: "predio", entrenador: "Marcela Díaz" },
  { categoriaId: "div-9", diaSemana: 4, hora: "18:00", lugarId: "predio", entrenador: "Marcela Díaz" },
  { categoriaId: "div-8", diaSemana: 2, hora: "19:30", lugarId: "predio", entrenador: "Facundo Lamas" },
  { categoriaId: "div-8", diaSemana: 4, hora: "19:30", lugarId: "predio", entrenador: "Facundo Lamas" },
  { categoriaId: "div-7", diaSemana: 1, hora: "19:30", lugarId: "predio", entrenador: "Facundo Lamas" },
  { categoriaId: "div-7", diaSemana: 3, hora: "19:30", lugarId: "predio", entrenador: "Facundo Lamas" },
  { categoriaId: "div-6", diaSemana: 2, hora: "20:00", lugarId: "sede", entrenador: "Vanesa Portal" },
  { categoriaId: "div-6", diaSemana: 4, hora: "20:00", lugarId: "sede", entrenador: "Vanesa Portal" },
  { categoriaId: "div-5", diaSemana: 1, hora: "20:00", lugarId: "sede", entrenador: "Vanesa Portal" },
  { categoriaId: "div-5", diaSemana: 5, hora: "20:00", lugarId: "sede", entrenador: "Vanesa Portal" },
  { categoriaId: "div-4", diaSemana: 1, hora: "19:00", lugarId: "sede", entrenador: "Jorge Paz" },
  { categoriaId: "div-4", diaSemana: 3, hora: "19:00", lugarId: "sede", entrenador: "Jorge Paz" },
  { categoriaId: "div-4", diaSemana: 5, hora: "19:00", lugarId: "sede", entrenador: "Jorge Paz" },
  { categoriaId: "div-3", diaSemana: 2, hora: "20:30", lugarId: "sede", entrenador: "Jorge Paz" },
  { categoriaId: "div-3", diaSemana: 4, hora: "20:30", lugarId: "sede", entrenador: "Jorge Paz" },
  // Reserva y Primera
  { categoriaId: "reserva", diaSemana: 1, hora: "11:00", lugarId: "sede", entrenador: "Nora Fidele" },
  { categoriaId: "reserva", diaSemana: 3, hora: "11:00", lugarId: "sede", entrenador: "Nora Fidele" },
  { categoriaId: "reserva", diaSemana: 5, hora: "11:00", lugarId: "sede", entrenador: "Nora Fidele" },
  // Primera entrena todos los días hábiles
  { categoriaId: "primera", diaSemana: 1, hora: "09:30", lugarId: "sede", entrenador: "Nora Fidele" },
  { categoriaId: "primera", diaSemana: 2, hora: "09:30", lugarId: "sede", entrenador: "Nora Fidele" },
  { categoriaId: "primera", diaSemana: 3, hora: "09:30", lugarId: "sede", entrenador: "Nora Fidele" },
  { categoriaId: "primera", diaSemana: 4, hora: "09:30", lugarId: "sede", entrenador: "Nora Fidele" },
  { categoriaId: "primera", diaSemana: 5, hora: "09:30", lugarId: "sede", entrenador: "Nora Fidele" },
];

// ---------- CATÁLOGO DE ATRIBUTOS (híbrido honesto) ----------
// Objetivas: medición con protocolo (comparables entre clubes).
// Subjetivas: apreciación 1-10 a criterio del entrenador — la UI las
// distingue siempre. "Experiencia" y "Estado físico" NO están: se
// derivarán de sesiones/asistencia, no se cargan a mano.
export const ATRIBUTOS: Atributo[] = [
  {
    id: "talla", nombre: "Talla", abrev: "Ta", ambito: "fisico",
    naturaleza: "objetivo", unidad: "cm", sentido: null,
    escalaMin: 100, escalaMax: 200, entrenable: false,
    descripcion: "Estatura descalzo, contra pared. Referencia de crecimiento: se registra, no se juzga.",
  },
  {
    id: "peso", nombre: "Peso", abrev: "Pe", ambito: "fisico",
    naturaleza: "objetivo", unidad: "kg", sentido: null,
    escalaMin: 20, escalaMax: 95, entrenable: false,
    descripcion: "Peso con ropa liviana. Referencia de crecimiento: se registra, no se juzga.",
  },
  {
    id: "velocidad30", nombre: "Velocidad 30m", abrev: "Ve", ambito: "fisico",
    naturaleza: "objetivo", unidad: "seg", sentido: "menor_mejor",
    escalaMin: 3.5, escalaMax: 8, entrenable: true,
    descripcion: "Tiempo en recorrer 30 metros con partida detenida. Menos segundos es mejor.",
  },
  {
    id: "resistencia", nombre: "Resistencia", abrev: "Res", ambito: "fisico",
    naturaleza: "objetivo", unidad: "m", sentido: "mayor_mejor",
    escalaMin: 800, escalaMax: 3400, entrenable: true,
    descripcion: "Distancia recorrida en 12 minutos (test de Cooper).",
  },
  {
    id: "salto", nombre: "Salto vertical", abrev: "Sal", ambito: "fisico",
    naturaleza: "objetivo", unidad: "cm", sentido: "mayor_mejor",
    escalaMin: 10, escalaMax: 75, entrenable: true,
    descripcion: "Salto vertical con contramovimiento, marca en pared.",
  },
  {
    id: "pases", nombre: "Pases", abrev: "Pa", ambito: "tecnico",
    naturaleza: "subjetivo", unidad: "1-10", sentido: "mayor_mejor",
    escalaMin: 1, escalaMax: 10, entrenable: true,
    descripcion: "Precisión y criterio en el pase corto para sostener la posesión.",
  },
  {
    id: "pases_largos", nombre: "Pases largos", abrev: "PL", ambito: "tecnico",
    naturaleza: "subjetivo", unidad: "1-10", sentido: "mayor_mejor",
    escalaMin: 1, escalaMax: 10, entrenable: true,
    descripcion: "Pase aéreo y centro al área: distancia y precisión.",
  },
  {
    id: "remates", nombre: "Remates", abrev: "Re", ambito: "tecnico",
    naturaleza: "subjetivo", unidad: "1-10", sentido: "mayor_mejor",
    escalaMin: 1, escalaMax: 10, entrenable: true,
    descripcion: "Precisión y potencia del remate al arco.",
  },
  {
    id: "cabezazos", nombre: "Cabezazos", abrev: "Ca", ambito: "tecnico",
    naturaleza: "subjetivo", unidad: "1-10", sentido: "mayor_mejor",
    escalaMin: 1, escalaMax: 10, entrenable: true,
    descripcion: "Juego aéreo: pase y definición de cabeza.",
  },
  {
    id: "control", nombre: "Control de balón", abrev: "Ctrl", ambito: "tecnico",
    naturaleza: "subjetivo", unidad: "1-10", sentido: "mayor_mejor",
    escalaMin: 1, escalaMax: 10, entrenable: true,
    descripcion: "Control al recibir y técnica de conducción. Importante para todas las posiciones.",
  },
  {
    id: "entradas", nombre: "Entradas", abrev: "En", ambito: "tecnico",
    naturaleza: "subjetivo", unidad: "1-10", sentido: "mayor_mejor",
    escalaMin: 1, escalaMax: 10, entrenable: true,
    descripcion: "Presión sobre el rival y quite en el 1 contra 1.",
  },
  {
    id: "atajando", nombre: "Atajando", abrev: "At", ambito: "tecnico",
    naturaleza: "subjetivo", unidad: "1-10", sentido: "mayor_mejor",
    escalaMin: 1, escalaMax: 10, entrenable: true,
    descripcion: "Para arqueros: atajadas, anticipo y decisiones bajo los tres palos.",
  },
  {
    id: "balon_parado", nombre: "Balón parado", abrev: "BP", ambito: "tecnico",
    naturaleza: "subjetivo", unidad: "1-10", sentido: "mayor_mejor",
    escalaMin: 1, escalaMax: 10, entrenable: true,
    descripcion: "Ejecución de córners, tiros libres y penales.",
  },
  {
    id: "vision_juego", nombre: "Visión de juego", abrev: "Vis", ambito: "tecnico",
    naturaleza: "subjetivo", unidad: "1-10", sentido: "mayor_mejor",
    escalaMin: 1, escalaMax: 10, entrenable: true,
    descripcion: "Lectura del juego: decisiones y pases posibles que detecta. (Apreciación táctica, no un juicio sobre la persona.)",
  },
];

export const ENTRENADORES = [
  "Marcela Díaz",
  "Jorge Paz",
  "Lucas Herrera",
  "Nora Fidele",
  "Paula Guanca",
  "Ramiro Ontiveros",
  "Facundo Lamas",
  "Vanesa Portal",
];

// El perfil "Profesor/a" del selector demo encarna a Marcela Díaz,
// asignada a estas categorías (ver docs/PERFILES.md). En producción
// esto sale de la tabla propuesta membresia_categoria.
export const PROFE_DEMO = {
  nombre: "Marcela Díaz",
  categorias: ["div-9", "esc-2016"],
};

// Serie determinística: base + progresión + oscilación fija.
// (fechas quincenales hacia atrás desde jun-2026)
const FECHAS = [
  "2026-01-17", "2026-02-07", "2026-02-28", "2026-03-21",
  "2026-04-11", "2026-05-02", "2026-05-23", "2026-06-13",
];

const DECIMALES: Record<string, number> = {
  velocidad30: 2, talla: 0, salto: 0, resistencia: 0, peso: 1,
};
const RUIDO: Record<string, number> = {
  velocidad30: 0.05, talla: 0.2, peso: 0.3, salto: 0.7, resistencia: 45,
};

function serie(
  atributoId: string,
  base: number,
  pendiente: number,
  puntos = FECHAS.length,
  quien = 0,
): Medicion[] {
  const decimales = DECIMALES[atributoId] ?? 1;
  const ruido = RUIDO[atributoId] ?? 0.2;
  return FECHAS.slice(FECHAS.length - puntos).map((fecha, i) => ({
    fecha,
    valor: Number(
      (base + pendiente * i + Math.sin(i * 2.1 + quien) * ruido).toFixed(decimales),
    ),
    entrenador: ENTRENADORES[(i + quien) % ENTRENADORES.length],
  }));
}

// Serie histórica literal (para el "jugador histórico" de la demo:
// varios AÑOS de datos). Antes de mar-2026 midió el profe anterior —
// el punto narrativo es que la historia sobrevive al recambio.
function serieHistorica(puntos: [string, number][]): Medicion[] {
  return puntos.map(([fecha, valor], i) => ({
    fecha,
    valor,
    entrenador: fecha < "2026-03" ? "Diego Aparicio" : ENTRENADORES[i % 3],
  }));
}

// Constructor compacto: perfil = { atributoId: [base, pendiente, puntos?] }
type PerfilSpec = Record<string, [number, number] | [number, number, number]>;

function jugador(
  id: string,
  nombre: string,
  apellido: string,
  categoriaId: string,
  fechaNacimiento: string,
  sexo: "M" | "F",
  lateralidad: Deportista["lateralidad"],
  consentimientoOk: boolean,
  perfil: PerfilSpec,
): Deportista {
  const quien = Number(id.replace(/\D/g, "")) || 0;
  const mediciones: Record<string, Medicion[]> = {};
  for (const [atributoId, spec] of Object.entries(perfil)) {
    const [base, pendiente, puntos] = spec;
    mediciones[atributoId] = serie(atributoId, base, pendiente, puntos, quien);
  }
  return {
    id, nombre, apellido, categoriaId, fechaNacimiento, sexo,
    lateralidad, consentimientoOk, mediciones,
  };
}

export const DEPORTISTAS: Deportista[] = [
  // ---------- Escuelita 2019 (7 años) ----------
  jugador("d04", "Zoe", "Mamaní", "esc-2019", "2019-02-14", "F", "diestro", false, {
    talla: [122, 0.8, 5], salto: [16, 0.7, 5], control: [4, 0.4, 5],
  }),
  jugador("d09", "Joaquín", "Tolaba", "esc-2019", "2019-10-02", "M", "diestro", true, {
    talla: [119, 0.7, 4], salto: [14, 0.6, 4], pases: [3.5, 0.3, 4],
  }),
  jugador("d12", "Renata", "Cruz", "esc-2019", "2019-04-29", "F", "diestro", true, {
    talla: [124, 0.8, 3], control: [4.5, 0.3, 2], // pocos datos → "faltan mediciones"
  }),
  jugador("d21", "Bruno", "Chauque", "esc-2019", "2019-07-15", "M", "zurdo", true, {
    talla: [121, 0.9, 5], control: [3.5, 0.45, 5], pases: [3, 0.4, 5],
  }),
  jugador("d22", "Isabella", "Gutiérrez", "esc-2019", "2019-01-30", "F", "diestro", false, {
    talla: [123, 0.7, 4], salto: [15, 0.8, 4],
  }),
  jugador("d23", "Ciro", "Vilte", "esc-2019", "2019-11-08", "M", "diestro", true, {
    talla: [118, 0.8, 5], control: [4, 0.35, 5], remates: [3, 0.3, 5],
  }),

  // ---------- Escuelita 2016 (10 años) ----------
  jugador("d06", "Alma", "Figueroa", "esc-2016", "2016-07-19", "F", "zurdo", true, {
    talla: [134, 0.9, 6], velocidad30: [6.4, -0.08, 6], control: [5, 0.35, 6],
  }),
  jugador("d24", "Dante", "Ríos", "esc-2016", "2016-03-22", "M", "diestro", true, {
    talla: [136, 0.8, 6], velocidad30: [6.2, -0.05, 6], pases: [5, 0.3, 6],
    remates: [4.5, 0.35, 6],
  }),
  jugador("d25", "Martina", "Colque", "esc-2016", "2016-09-05", "F", "diestro", true, {
    talla: [133, 1.0, 6], salto: [20, 0.9, 6], control: [5.5, 0.25, 6],
  }),
  jugador("d26", "Felipe", "Aguirre", "esc-2016", "2016-12-01", "M", "ambidiestro", true, {
    talla: [131, 0.9, 6], velocidad30: [6.5, -0.1, 6], vision_juego: [5, 0.3, 6],
  }),

  // ---------- 9ª División (2013) ----------
  // d01 = el "jugador histórico" de la demo: 3+ años de trayectoria,
  // ingresó a la escuelita en 2023 y pasó a 9ª en 2026. La curva
  // multi-año con sus hitos es LA imagen de la presentación.
  {
    id: "d01", nombre: "Thiago", apellido: "Guaymás", categoriaId: "div-9",
    fechaNacimiento: "2013-04-12", sexo: "M", lateralidad: "zurdo",
    consentimientoOk: true,
    historial: [
      { fecha: "2023-03-04", evento: "Ingresó al club" },
      { fecha: "2026-02-01", evento: "Pasó a 9ª División" },
    ],
    mediciones: {
      talla: serieHistorica([
        ["2023-03-04", 138], ["2023-08-12", 141], ["2024-02-10", 144],
        ["2024-07-20", 146], ["2024-12-14", 148], ["2025-05-17", 150],
        ["2025-10-11", 152], ["2026-01-17", 153], ["2026-02-28", 154],
        ["2026-04-11", 155], ["2026-06-13", 156],
      ]),
      peso: serieHistorica([
        ["2023-03-04", 33], ["2023-08-12", 34.5], ["2024-02-10", 36],
        ["2024-07-20", 37], ["2024-12-14", 38.5], ["2025-05-17", 39.5],
        ["2025-10-11", 41], ["2026-01-17", 41.8], ["2026-02-28", 42.3],
        ["2026-04-11", 42.7], ["2026-06-13", 43],
      ]),
      velocidad30: serieHistorica([
        ["2023-03-04", 6.85], ["2023-08-12", 6.7], ["2024-02-10", 6.5],
        ["2024-07-20", 6.42], ["2024-12-14", 6.3], ["2025-05-17", 6.12],
        ["2025-10-11", 6.0], ["2026-01-17", 5.9], ["2026-02-07", 5.85],
        ["2026-02-28", 5.75], ["2026-03-21", 5.68], ["2026-04-11", 5.6],
        ["2026-05-02", 5.42], ["2026-05-23", 5.36], ["2026-06-13", 5.27],
      ]),
      salto: serieHistorica([
        ["2023-03-04", 18], ["2023-08-12", 20], ["2024-02-10", 23],
        ["2024-07-20", 25], ["2024-12-14", 28], ["2025-05-17", 30],
        ["2025-10-11", 32], ["2026-01-17", 33], ["2026-02-28", 35],
        ["2026-04-11", 36], ["2026-06-13", 38],
      ]),
      resistencia: serie("resistencia", 1900, 55, 8, 1),
      pases: serie("pases", 5.5, 0.35, 8, 1),
      control: serie("control", 6, 0.3, 8, 1),
      vision_juego: serie("vision_juego", 5.5, 0.3, 8, 1),
    },
  },
  jugador("d02", "Milagros", "Chocobar", "div-9", "2013-09-03", "F", "diestro", true, {
    talla: [151, 0.9], velocidad30: [5.7, -0.05], salto: [31, 0.9],
    pases: [7, 0.15], pases_largos: [5.5, 0.25],
  }),
  jugador("d07", "Lautaro", "Copa", "div-9", "2013-01-25", "M", "diestro", true, {
    velocidad30: [6.1, -0.12], salto: [25, 1.1], pases: [5, 0.4],
    resistencia: [1750, 70], entradas: [4.5, 0.35],
  }),
  jugador("d10", "Valentina", "Arjona", "div-9", "2013-12-17", "F", "zurdo", false, {
    velocidad30: [5.8, -0.07, 6], pases: [6.5, 0.2, 6], control: [6, 0.25, 6],
    balon_parado: [5, 0.3, 6],
  }),
  jugador("d27", "Gael", "Burgos", "div-9", "2013-06-09", "M", "diestro", true, {
    talla: [150, 1.0], velocidad30: [5.95, -0.06], atajando: [6, 0.35],
    salto: [30, 1.0], pases_largos: [5, 0.2],
  }),
  jugador("d28", "Emma", "Villagra", "div-9", "2013-03-27", "F", "diestro", true, {
    velocidad30: [5.75, -0.04], resistencia: [1850, 40], entradas: [5.5, 0.3],
    vision_juego: [6, 0.2],
  }),
  jugador("d29", "Santino", "Núñez", "div-9", "2013-08-18", "M", "zurdo", true, {
    velocidad30: [6.0, 0.02], salto: [27, 0.3], remates: [6, 0.05],
    control: [5.5, 0.1], // amesetado
  }),
  jugador("d30", "Julieta", "Peralta", "div-9", "2013-05-02", "F", "diestro", true, {
    talla: [149, 0.9], cabezazos: [4.5, 0.3], pases: [5.5, 0.3],
    resistencia: [1800, 60],
  }),

  // ---------- 4ª División (2008, 18 años) ----------
  jugador("d03", "Benjamín", "Ruiz de los Llanos", "div-4", "2008-11-21", "M", "diestro", true, {
    talla: [172, 0.3], peso: [63, 0.4], velocidad30: [4.9, 0.01],
    salto: [45, 0.2], resistencia: [2550, 20], control: [7.5, 0.05],
    vision_juego: [7, 0.1],
  }),
  jugador("d05", "Bautista", "Yapura", "div-4", "2008-06-30", "M", "ambidiestro", true, {
    velocidad30: [4.8, 0.06], salto: [48, -0.6], resistencia: [2650, -35],
    pases: [8, -0.15], pases_largos: [7, -0.1], // en baja
  }),
  jugador("d08", "Emilia", "Saravia", "div-4", "2008-05-08", "F", "diestro", true, {
    talla: [165, 0.2], velocidad30: [5.1, -0.02], salto: [40, 0.5],
    control: [8, 0.1], balon_parado: [7, 0.2],
  }),
  jugador("d11", "Facundo", "Nievas", "div-4", "2008-03-11", "M", "diestro", true, {
    velocidad30: [4.85, -0.04], resistencia: [2600, 45], salto: [46, 0.8],
    remates: [7, 0.2], cabezazos: [6, 0.25],
  }),
  jugador("d31", "Luna", "Cardozo", "div-4", "2008-09-14", "F", "zurdo", true, {
    velocidad30: [5.0, -0.05], entradas: [7, 0.2], vision_juego: [7.5, 0.15],
    resistencia: [2500, 50],
  }),
  jugador("d32", "Ignacio", "Torres", "div-4", "2008-01-19", "M", "diestro", false, {
    atajando: [7.5, 0.2], salto: [50, 0.6], pases_largos: [6, 0.2],
    talla: [180, 0.2],
  }),

  // ---------- Primera (nombres de la maqueta del usuario) ----------
  jugador("p01", "Severo", "Prejun", "primera", "2004-05-11", "M", "zurdo", true, {
    velocidad30: [4.15, -0.01], resistencia: [2750, 10], vision_juego: [8, 0.05],
    pases: [5.5, 0.05], control: [7, 0.05], pases_largos: [8, 0.02],
    balon_parado: [4, 0.1],
  }),
  jugador("p02", "Valentin", "Cordeiro", "primera", "2004-08-23", "M", "diestro", true, {
    velocidad30: [4.5, 0.0], resistencia: [2700, 5], cabezazos: [9, 0.02],
    control: [6, 0.1], entradas: [6, 0.1], vision_juego: [6, 0.05],
  }),
  jugador("p03", "Leopoldo", "Nataniel", "primera", "2001-02-14", "M", "diestro", true, {
    velocidad30: [4.3, 0.01], resistencia: [2650, 0], entradas: [7, 0.05],
    pases_largos: [8, 0.0], vision_juego: [7, 0.02],
  }),
  jugador("p04", "Jairo", "Vargas", "primera", "1996-10-30", "M", "diestro", true, {
    velocidad30: [4.7, 0.03], resistencia: [2800, -15], pases: [6, 0.0],
    remates: [6, 0.02], cabezazos: [8, 0.0], control: [8, -0.05],
  }),
  jugador("p05", "Gaspar", "Curcio", "primera", "2007-03-08", "M", "diestro", true, {
    velocidad30: [4.4, -0.03], resistencia: [2600, 30], salto: [55, 0.4],
    balon_parado: [4, 0.2],
  }),
  jugador("p06", "Saverio", "Aimar", "primera", "2007-07-21", "M", "zurdo", true, {
    velocidad30: [4.35, -0.02], resistencia: [2850, 20], pases: [4, 0.2],
    control: [6, 0.15],
  }),
  jugador("p07", "Aristides", "Michael", "primera", "2007-01-12", "M", "diestro", true, {
    velocidad30: [4.45, -0.02], resistencia: [2400, 25], control: [6, 0.1],
    entradas: [5, 0.15], pases_largos: [3, 0.2],
  }),
  jugador("p08", "Tomás", "Hartz", "primera", "2007-09-04", "M", "diestro", true, {
    velocidad30: [4.25, -0.01], resistencia: [2550, 15], entradas: [6, 0.1],
    pases_largos: [6, 0.1],
  }),
  jugador("p09", "Ambrosio", "Osmundo", "primera", "2007-05-27", "M", "diestro", true, {
    velocidad30: [4.55, -0.02], resistencia: [2700, 10], control: [5, 0.1],
    pases_largos: [6, 0.05],
  }),
  jugador("p10", "Blas", "Todor", "primera", "2007-11-16", "M", "zurdo", true, {
    velocidad30: [4.5, 0.0], resistencia: [2450, 20], cabezazos: [1, 0.1],
    pases_largos: [7, 0.05],
  }),
  jugador("p11", "Lucas", "Nahia", "primera", "2007-04-02", "M", "diestro", true, {
    velocidad30: [4.9, 0.01], resistencia: [2900, 15], remates: [8, 0.05],
    cabezazos: [7, 0.05],
  }),
  jugador("p12", "Hermengildo", "Libertad", "primera", "2007-08-19", "M", "diestro", true, {
    velocidad30: [4.6, -0.01], resistencia: [2600, 10], entradas: [7, 0.05],
    pases_largos: [5, 0.1],
  }),
  jugador("p13", "Arsenio", "Nalo", "primera", "2007-02-25", "M", "diestro", true, {
    velocidad30: [4.55, 0.0], resistencia: [2650, 15], remates: [6, 0.05],
    cabezazos: [5, 0.1],
  }),
  jugador("p14", "Leon", "Efraim", "primera", "2007-06-13", "M", "zurdo", true, {
    velocidad30: [4.3, -0.02], resistencia: [2500, -10], pases: [6, 0.1],
    control: [5, 0.1], pases_largos: [6, 0.0],
  }),
  jugador("p15", "Jonathan", "Fiz", "primera", "2007-10-08", "M", "diestro", true, {
    velocidad30: [4.4, -0.01], resistencia: [2550, 15], pases: [6, 0.1],
    remates: [4, 0.15], entradas: [6, 0.05],
  }),
  jugador("p16", "Cleto", "Jon", "primera", "2007-12-22", "M", "diestro", true, {
    velocidad30: [4.4, -0.02], resistencia: [2950, 10], remates: [6, 0.1],
    cabezazos: [6, 0.05],
  }),
  jugador("p17", "Artemio", "Crescencio", "primera", "2007-03-31", "M", "diestro", true, {
    velocidad30: [4.3, -0.01], resistencia: [2600, 5], entradas: [5, 0.15],
    pases_largos: [3, 0.15],
  }),
  jugador("p18", "Mauricio", "Perico", "primera", "2007-07-07", "M", "zurdo", true, {
    velocidad30: [4.5, -0.01], resistencia: [2550, 10], control: [7, 0.05],
    entradas: [6, 0.05],
  }),
  jugador("p19", "Santo", "Escobar", "primera", "2007-01-29", "M", "diestro", true, {
    velocidad30: [4.15, -0.02], resistencia: [2700, 20], pases: [7, 0.05],
    control: [5, 0.1],
  }),

  // ---------- Escuelita 2018 (8 años) ----------
  jugador("d33", "Mateo", "Aramayo", "esc-2018", "2018-03-14", "M", "diestro", true, {
    talla: [126, 0.8, 6], control: [4, 0.35, 6], pases: [3.5, 0.3, 6],
  }),
  jugador("d34", "Olivia", "Zerpa", "esc-2018", "2018-08-02", "F", "zurdo", true, {
    talla: [124, 0.9, 6], control: [4.5, 0.3, 6],
  }),
  jugador("d35", "Bautino", "Maita", "esc-2018", "2018-11-27", "M", "diestro", true, {
    talla: [122, 0.7, 5], salto: [16, 0.6, 5], control: [3.5, 0.4, 5],
  }),
  jugador("d36", "Catalina", "Sulca", "esc-2018", "2018-05-19", "F", "diestro", false, {
    talla: [125, 0.8, 4], pases: [4, 0.3, 4],
  }),
  jugador("d37", "Benicio", "Alancay", "esc-2018", "2018-01-08", "M", "ambidiestro", true, {
    talla: [127, 0.8, 6], control: [4.5, 0.35, 6], remates: [3.5, 0.3, 6],
  }),

  // ---------- Escuelita 2017 (9 años) ----------
  jugador("d38", "Emma", "Quipildor", "esc-2017", "2017-04-23", "F", "diestro", true, {
    talla: [130, 0.9, 6], velocidad30: [6.7, -0.08, 6], control: [4.5, 0.35, 6],
  }),
  jugador("d39", "Salvador", "Casimiro", "esc-2017", "2017-09-11", "M", "diestro", true, {
    talla: [129, 0.8, 6], pases: [4.5, 0.3, 6], remates: [4, 0.35, 6],
  }),
  jugador("d40", "Josefina", "Liendro", "esc-2017", "2017-12-05", "F", "zurdo", true, {
    talla: [128, 0.9, 5], control: [5, 0.3, 5],
  }),
  jugador("d41", "Tomás", "Balderrama", "esc-2017", "2017-06-30", "M", "diestro", true, {
    talla: [131, 0.8, 6], velocidad30: [6.6, -0.06, 6], salto: [18, 0.7, 6],
  }),
  jugador("d42", "Francesca", "Velázquez", "esc-2017", "2017-02-17", "F", "diestro", true, {
    talla: [132, 0.9, 6], pases: [5, 0.25, 6], vision_juego: [4.5, 0.3, 6],
  }),

  // ---------- Escuelita 2015 (11 años) ----------
  jugador("d43", "Valentino", "Farfán", "esc-2015", "2015-07-21", "M", "diestro", true, {
    talla: [141, 1.0, 7], velocidad30: [6.2, -0.07, 7], control: [5.5, 0.3, 7],
  }),
  jugador("d44", "Guadalupe", "Soto", "esc-2015", "2015-03-09", "F", "diestro", true, {
    talla: [143, 0.9, 7], pases: [6, 0.25, 7], vision_juego: [5.5, 0.25, 7],
  }),
  jugador("d45", "Ciro", "Medina", "esc-2015", "2015-10-14", "M", "zurdo", false, {
    velocidad30: [6.3, -0.09, 6], remates: [5, 0.35, 6], salto: [22, 0.8, 6],
  }),
  jugador("d46", "Amparo", "Cala", "esc-2015", "2015-05-27", "F", "diestro", true, {
    talla: [142, 1.0, 7], control: [6, 0.25, 7], entradas: [4.5, 0.3, 7],
  }),
  jugador("d47", "Lorenzo", "Gerónimo", "esc-2015", "2015-12-01", "M", "diestro", true, {
    velocidad30: [6.25, -0.05, 7], atajando: [5.5, 0.35, 7], salto: [23, 0.7, 7],
  }),

  // ---------- Escuelita 2014 (12 años) ----------
  jugador("d48", "Camilo", "Portal", "esc-2014", "2014-02-11", "M", "diestro", true, {
    talla: [148, 1.1, 7], velocidad30: [6.0, -0.08, 7], pases: [6, 0.3, 7],
  }),
  jugador("d49", "Renzo", "Arias", "esc-2014", "2014-08-25", "M", "zurdo", true, {
    velocidad30: [6.1, -0.06, 7], control: [6.5, 0.25, 7], remates: [5.5, 0.3, 7],
  }),
  jugador("d50", "Malena", "Salvatierra", "esc-2014", "2014-05-06", "F", "diestro", true, {
    talla: [150, 1.0, 7], resistencia: [1700, 60, 7], vision_juego: [6, 0.25, 7],
  }),
  jugador("d51", "Felipe", "Choque", "esc-2014", "2014-11-18", "M", "diestro", true, {
    velocidad30: [6.05, -0.02, 7], salto: [26, 0.4, 7], entradas: [5, 0.2, 7],
  }),
  jugador("d52", "Paulina", "Romero", "esc-2014", "2014-07-03", "F", "ambidiestro", true, {
    talla: [149, 1.0, 7], pases: [6.5, 0.2, 7], balon_parado: [5, 0.3, 7],
  }),

  // ---------- 8ª División (2012, 14 años) ----------
  jugador("d53", "Joaquín", "Lamas", "div-8", "2012-04-15", "M", "diestro", true, {
    talla: [162, 0.8], peso: [52, 0.5], velocidad30: [5.5, -0.06],
    pases: [6, 0.25], entradas: [5.5, 0.25],
  }),
  jugador("d54", "Milo", "Flores", "div-8", "2012-09-28", "M", "zurdo", true, {
    velocidad30: [5.45, -0.07], salto: [34, 0.9], remates: [6, 0.25],
  }),
  jugador("d55", "Abril", "Guanca", "div-8", "2012-01-30", "F", "diestro", true, {
    talla: [159, 0.6], resistencia: [2100, 55], vision_juego: [6.5, 0.2],
  }),
  jugador("d56", "Thiago", "Vargas", "div-8", "2012-06-12", "M", "diestro", true, {
    velocidad30: [5.6, 0.01], control: [6, 0.05], pases_largos: [5.5, 0.1],
  }),
  jugador("d57", "Jazmín", "Torres", "div-8", "2012-12-08", "F", "diestro", true, {
    velocidad30: [5.55, -0.05], entradas: [6, 0.25], salto: [31, 0.7],
  }),
  jugador("d58", "Iker", "Paz", "div-8", "2012-03-22", "M", "diestro", true, {
    atajando: [6.5, 0.3], salto: [36, 0.8], pases_largos: [5, 0.2], talla: [168, 0.7],
  }),

  // ---------- 7ª División (2011, 15 años) ----------
  jugador("d59", "Bruno", "Ríos", "div-7", "2011-05-17", "M", "diestro", true, {
    velocidad30: [5.3, -0.05], resistencia: [2300, 45], pases: [6.5, 0.2],
  }),
  jugador("d60", "Agustina", "Herrera", "div-7", "2011-10-02", "F", "zurdo", true, {
    velocidad30: [5.35, -0.06], control: [7, 0.15], vision_juego: [6.5, 0.2],
  }),
  jugador("d61", "Dylan", "Cruz", "div-7", "2011-02-25", "M", "diestro", false, {
    velocidad30: [5.25, -0.03], remates: [6.5, 0.2], cabezazos: [5.5, 0.25],
  }),
  jugador("d62", "Luca", "Mamaní", "div-7", "2011-08-09", "M", "diestro", true, {
    talla: [169, 0.5], salto: [40, 0.6], entradas: [6.5, 0.15],
  }),
  jugador("d63", "Martina", "Díaz", "div-7", "2011-12-19", "F", "diestro", true, {
    resistencia: [2350, 40], pases_largos: [6, 0.2], balon_parado: [5.5, 0.25],
  }),
  jugador("d64", "Gino", "Villagrán", "div-7", "2011-04-04", "M", "ambidiestro", true, {
    velocidad30: [5.28, -0.04], control: [6.5, 0.2], pases: [6, 0.2],
  }),

  // ---------- 6ª División (2010, 16 años) ----------
  jugador("d65", "Lisandro", "Ontiveros", "div-6", "2010-06-08", "M", "diestro", true, {
    velocidad30: [5.1, -0.04], resistencia: [2450, 40], remates: [6.5, 0.15],
  }),
  jugador("d66", "Delfina", "Chauque", "div-6", "2010-01-14", "F", "diestro", true, {
    velocidad30: [5.2, -0.05], vision_juego: [7, 0.15], pases: [7, 0.1],
  }),
  jugador("d67", "Iñaki", "Burgos", "div-6", "2010-09-21", "M", "zurdo", true, {
    salto: [44, 0.5], cabezazos: [6.5, 0.2], entradas: [6.5, 0.15],
  }),
  jugador("d68", "Julián", "Colque", "div-6", "2010-04-30", "M", "diestro", true, {
    velocidad30: [5.05, 0.0], control: [7, 0.05], pases_largos: [6.5, 0.1],
  }),
  jugador("d69", "Ámbar", "Gutiérrez", "div-6", "2010-11-11", "F", "diestro", true, {
    resistencia: [2500, 35], balon_parado: [6, 0.2], pases: [6.5, 0.15],
  }),

  // ---------- 5ª División (2009, 17 años) ----------
  jugador("d70", "Máximo", "Yapura", "div-5", "2009-03-19", "M", "diestro", true, {
    velocidad30: [4.95, -0.03], resistencia: [2550, 35], remates: [7, 0.1],
  }),
  jugador("d71", "Bianca", "Copa", "div-5", "2009-08-27", "F", "zurdo", false, {
    velocidad30: [5.05, -0.04], control: [7.5, 0.1], vision_juego: [7, 0.1],
  }),
  jugador("d72", "Santino", "Arjona", "div-5", "2009-12-13", "M", "diestro", true, {
    salto: [47, 0.4], cabezazos: [7, 0.15], entradas: [7, 0.1],
  }),
  jugador("d73", "Andrés", "Nievas", "div-5", "2009-05-05", "M", "diestro", true, {
    atajando: [7.5, 0.15], salto: [50, 0.5], pases_largos: [6, 0.15], talla: [181, 0.3],
  }),
  jugador("d74", "Morena", "Saravia", "div-5", "2009-10-23", "F", "diestro", true, {
    resistencia: [2600, 30], pases: [7, 0.1], balon_parado: [6.5, 0.15],
  }),

  // ---------- 3ª División (2007, 19 años) ----------
  jugador("d75", "Ezequiel", "Figueroa", "div-3", "2007-04-08", "M", "diestro", true, {
    velocidad30: [4.6, -0.02], resistencia: [2700, 20], pases: [7, 0.05],
  }),
  jugador("d76", "Nahuel", "Tolaba", "div-3", "2007-09-16", "M", "zurdo", true, {
    velocidad30: [4.55, -0.01], remates: [7.5, 0.05], control: [7, 0.05],
  }),
  jugador("d77", "Rocío", "Cardozo", "div-3", "2007-01-29", "F", "diestro", true, {
    velocidad30: [4.75, -0.03], vision_juego: [7.5, 0.05], pases_largos: [7, 0.05],
  }),
  jugador("d78", "Facundo", "Guaymás", "div-3", "2007-07-12", "M", "diestro", true, {
    salto: [52, 0.3], cabezazos: [7.5, 0.05], entradas: [7, 0.05],
  }),
  jugador("d79", "Kevin", "Zalazar", "div-3", "2007-11-24", "M", "diestro", true, {
    atajando: [8, 0.05], salto: [54, 0.3], pases_largos: [6.5, 0.1],
  }),

  // ---------- Reserva "La Local" (2003-2006) ----------
  jugador("d80", "Marcos", "Aguirre", "reserva", "2005-02-18", "M", "diestro", true, {
    velocidad30: [4.5, 0.0], resistencia: [2750, 10], pases: [7, 0.02],
  }),
  jugador("d81", "Rodrigo", "Peralta", "reserva", "2004-06-24", "M", "zurdo", true, {
    velocidad30: [4.45, -0.01], remates: [7.5, 0.02], control: [7.5, 0.02],
  }),
  jugador("d82", "Gonzalo", "Núñez", "reserva", "2006-10-07", "M", "diestro", true, {
    velocidad30: [4.4, -0.02], resistencia: [2800, 15], vision_juego: [7, 0.05],
  }),
  jugador("d83", "Matías", "Villagra", "reserva", "2003-12-15", "M", "diestro", true, {
    salto: [55, 0.1], cabezazos: [8, 0.0], entradas: [7.5, 0.02],
  }),
  jugador("d84", "Leandro", "Ruiz", "reserva", "2005-08-30", "M", "diestro", true, {
    atajando: [8, 0.05], salto: [56, 0.2], pases_largos: [7, 0.05],
  }),
  jugador("d85", "Federico", "Ortiz", "reserva", "2004-03-11", "M", "ambidiestro", true, {
    velocidad30: [4.48, -0.01], pases: [7.5, 0.02], balon_parado: [7, 0.05],
  }),
];

// La semana demo (lun 6 → dom 12 de julio) sigue el CRONOGRAMA:
// las sesiones son instancias de la rutina, con estado.
export const SESIONES: Sesion[] = [
  // ---- ya realizadas esta semana ----
  {
    id: "s01", fecha: "2026-07-06T19:00:00", categoriaId: "div-4",
    atributoFocoId: "resistencia", entrenador: "Jorge Paz",
    lugarId: "sede", estado: "realizada",
    descripcion: "Test de Cooper + trabajo aeróbico por estaciones.",
    asistencia: [
      { deportistaId: "d03", presente: true },
      { deportistaId: "d05", presente: true },
      { deportistaId: "d08", presente: true },
      { deportistaId: "d11", presente: true },
      { deportistaId: "d31", presente: true },
      { deportistaId: "d32", presente: false },
    ],
  },
  {
    id: "s02", fecha: "2026-07-07T18:00:00", categoriaId: "div-9",
    atributoFocoId: "pases", entrenador: "Marcela Díaz",
    lugarId: "predio", estado: "realizada",
    descripcion: "Rondos y pase a distancia. Jornada de medición de pase.",
    asistencia: [
      { deportistaId: "d01", presente: true },
      { deportistaId: "d02", presente: true },
      { deportistaId: "d07", presente: true },
      { deportistaId: "d10", presente: false },
      { deportistaId: "d27", presente: true },
      { deportistaId: "d28", presente: true },
      { deportistaId: "d29", presente: true },
      { deportistaId: "d30", presente: false },
    ],
  },
  {
    id: "s03", fecha: "2026-07-08T17:30:00", categoriaId: "esc-2019",
    atributoFocoId: "control", entrenador: "Lucas Herrera",
    lugarId: "predio", estado: "realizada",
    descripcion: "Circuito de conducción y juegos con pelota.",
    asistencia: [
      { deportistaId: "d04", presente: true },
      { deportistaId: "d09", presente: false },
      { deportistaId: "d12", presente: true },
      { deportistaId: "d21", presente: true },
      { deportistaId: "d22", presente: true },
      { deportistaId: "d23", presente: true },
    ],
  },
  {
    id: "s04", fecha: "2026-07-08T19:00:00", categoriaId: "div-4",
    atributoFocoId: "salto", entrenador: "Jorge Paz",
    lugarId: "sede", estado: "cancelada",
    descripcion: "Suspendida por lluvia — se reprograma el trabajo de pliometría.",
    asistencia: [],
  },
  {
    id: "s05", fecha: "2026-07-09T09:30:00", categoriaId: "primera",
    atributoFocoId: "balon_parado", entrenador: "Nora Fidele",
    lugarId: "sede", estado: "realizada",
    descripcion: "Pelota parada ofensiva y defensiva. Definición por sectores.",
    asistencia: [
      { deportistaId: "p01", presente: true },
      { deportistaId: "p02", presente: true },
      { deportistaId: "p03", presente: true },
      { deportistaId: "p05", presente: true },
      { deportistaId: "p10", presente: false },
      { deportistaId: "p11", presente: true },
    ],
  },
  // ---- lo que viene ----
  {
    id: "s06", fecha: "2026-07-09T18:00:00", categoriaId: "div-9",
    atributoFocoId: "velocidad30", entrenador: "Marcela Díaz",
    lugarId: "predio", estado: "programada",
    descripcion: "Pasadas cortas y arranques. Cierre con fútbol reducido.",
    asistencia: [],
  },
  {
    id: "s07", fecha: "2026-07-10T09:30:00", categoriaId: "primera",
    atributoFocoId: null, entrenador: "Nora Fidele",
    lugarId: "sede", estado: "programada",
    descripcion: "Táctico previo al partido del domingo.",
    asistencia: [],
  },
  {
    id: "s08", fecha: "2026-07-10T17:30:00", categoriaId: "esc-2016",
    atributoFocoId: "control", entrenador: "Lucas Herrera",
    lugarId: "predio", estado: "programada",
    descripcion: "Conducción y juegos reducidos.",
    asistencia: [],
  },
  {
    id: "s09", fecha: "2026-07-10T19:00:00", categoriaId: "div-4",
    atributoFocoId: "salto", entrenador: "Jorge Paz",
    lugarId: "sede", estado: "programada",
    descripcion: "Pliometría (reprogramada tras la lluvia del miércoles).",
    asistencia: [],
  },
  {
    id: "s10", fecha: "2026-07-06T19:30:00", categoriaId: "div-7",
    atributoFocoId: "entradas", entrenador: "Facundo Lamas",
    lugarId: "predio", estado: "realizada",
    descripcion: "Duelos 1v1 y recuperación tras pérdida.",
    asistencia: [
      { deportistaId: "d59", presente: true },
      { deportistaId: "d60", presente: true },
      { deportistaId: "d61", presente: true },
      { deportistaId: "d62", presente: false },
      { deportistaId: "d63", presente: true },
      { deportistaId: "d64", presente: true },
    ],
  },
  {
    id: "s11", fecha: "2026-07-07T17:30:00", categoriaId: "esc-2014",
    atributoFocoId: "pases", entrenador: "Ramiro Ontiveros",
    lugarId: "sede", estado: "realizada",
    descripcion: "Rondos por estaciones y pase al espacio.",
    asistencia: [
      { deportistaId: "d48", presente: true },
      { deportistaId: "d49", presente: true },
      { deportistaId: "d50", presente: false },
      { deportistaId: "d51", presente: true },
      { deportistaId: "d52", presente: true },
    ],
  },
  {
    id: "s12", fecha: "2026-07-07T17:30:00", categoriaId: "esc-2017",
    atributoFocoId: "control", entrenador: "Paula Guanca",
    lugarId: "predio", estado: "realizada",
    descripcion: "Conducción con obstáculos y juegos con arqueros.",
    asistencia: [
      { deportistaId: "d38", presente: true },
      { deportistaId: "d39", presente: true },
      { deportistaId: "d40", presente: true },
      { deportistaId: "d41", presente: false },
      { deportistaId: "d42", presente: true },
    ],
  },
  {
    id: "s16", fecha: "2026-07-09T17:30:00", categoriaId: "esc-2017",
    atributoFocoId: "pases", entrenador: "Paula Guanca",
    lugarId: "predio", estado: "programada",
    descripcion: "Pases en parejas y juegos de posesión.",
    asistencia: [],
  },
  {
    id: "s13", fecha: "2026-07-09T19:30:00", categoriaId: "div-8",
    atributoFocoId: "pases_largos", entrenador: "Facundo Lamas",
    lugarId: "predio", estado: "programada",
    descripcion: "Cambio de frente y centros. Jornada de medición.",
    asistencia: [],
  },
  {
    id: "s14", fecha: "2026-07-10T11:00:00", categoriaId: "reserva",
    atributoFocoId: null, entrenador: "Nora Fidele",
    lugarId: "sede", estado: "programada",
    descripcion: "Fútbol táctico con la Primera, previa del domingo.",
    asistencia: [],
  },
  {
    id: "s15", fecha: "2026-07-10T20:00:00", categoriaId: "div-5",
    atributoFocoId: "resistencia", entrenador: "Vanesa Portal",
    lugarId: "sede", estado: "programada",
    descripcion: "Intermitente aeróbico + salida jugada.",
    asistencia: [],
  },
];

export const PARTIDOS: Partido[] = [
  // ---- jugados (fin de semana pasado) ----
  {
    id: "pt01", fecha: "2026-07-04T10:00:00", categoriaId: "div-9",
    torneo: "Liga Salteña — Infantiles", rival: "Juventud Unida",
    condicion: "local", lugarId: "sede",
    citados: ["d01", "d02", "d07", "d10", "d27", "d28", "d29", "d30"],
    resultado: { favor: 3, contra: 1 },
  },
  {
    id: "pt02", fecha: "2026-07-05T15:00:00", categoriaId: "div-4",
    torneo: "Liga Salteña — Juveniles", rival: "Central Norte",
    condicion: "visitante", lugarTexto: "Cancha de Central Norte",
    citados: ["d03", "d05", "d08", "d11", "d31", "d32"],
    resultado: { favor: 1, contra: 2 },
  },
  // Encuentro de escuelita: SIN resultado (encuadre formativo)
  {
    id: "pt03", fecha: "2026-07-04T09:30:00", categoriaId: "esc-2016",
    torneo: "Encuentro de escuelitas", rival: "Escuela Municipal",
    condicion: "local", lugarId: "predio",
    citados: ["d06", "d24", "d25", "d26"],
  },
  {
    id: "pt06", fecha: "2026-07-04T11:30:00", categoriaId: "div-7",
    torneo: "Liga Salteña — Inferiores", rival: "Pellegrini",
    condicion: "local", lugarId: "predio",
    citados: ["d59", "d60", "d61", "d62", "d63", "d64"],
    resultado: { favor: 2, contra: 2 },
  },
  {
    id: "pt07", fecha: "2026-07-05T10:30:00", categoriaId: "div-6",
    torneo: "Liga Salteña — Inferiores", rival: "Atlas",
    condicion: "visitante", lugarTexto: "Cancha de Atlas",
    citados: ["d65", "d66", "d67", "d68", "d69"],
    resultado: { favor: 4, contra: 0 },
  },
  // ---- este fin de semana ----
  {
    id: "pt04", fecha: "2026-07-11T10:00:00", categoriaId: "div-9",
    torneo: "Liga Salteña — Infantiles", rival: "Gimnasia y Tiro",
    condicion: "visitante", lugarTexto: "Predio de Gimnasia y Tiro",
    citados: ["d01", "d02", "d07", "d27", "d28", "d29", "d30"],
  },
  {
    id: "pt08", fecha: "2026-07-11T09:30:00", categoriaId: "esc-2015",
    torneo: "Encuentro de escuelitas", rival: "Libertad",
    condicion: "local", lugarId: "predio",
    citados: ["d43", "d44", "d45", "d46", "d47"],
  },
  {
    id: "pt09", fecha: "2026-07-11T15:00:00", categoriaId: "div-4",
    torneo: "Liga Salteña — Juveniles", rival: "Villa San Antonio",
    condicion: "local", lugarId: "sede",
    citados: ["d03", "d05", "d08", "d11", "d31", "d32"],
  },
  {
    id: "pt10", fecha: "2026-07-12T10:00:00", categoriaId: "div-8",
    torneo: "Liga Salteña — Inferiores", rival: "Deportivo Cachorros",
    condicion: "visitante", lugarTexto: "Cancha de Cachorros",
    citados: ["d53", "d54", "d55", "d56", "d57", "d58"],
  },
  {
    id: "pt11", fecha: "2026-07-12T14:00:00", categoriaId: "reserva",
    torneo: "Liga Salteña — Reserva", rival: "San Antonio",
    condicion: "local", lugarId: "sede",
    citados: ["d80", "d81", "d82", "d83", "d84", "d85"],
  },
  {
    id: "pt05", fecha: "2026-07-12T16:00:00", categoriaId: "primera",
    torneo: "Liga Salteña — Primera A", rival: "San Antonio",
    condicion: "local", lugarId: "sede",
    citados: ["p01", "p02", "p03", "p04", "p05", "p06", "p07", "p08", "p09", "p10", "p11"],
  },
];

// ---------- helpers ----------

export function getDeportista(id: string) {
  return DEPORTISTAS.find((d) => d.id === id);
}

export function getAtributo(id: string) {
  return ATRIBUTOS.find((a) => a.id === id);
}

export function getCategoria(id: string) {
  return CATEGORIAS.find((c) => c.id === id);
}

export function nivelActual(d: Deportista, atributoId: string): number | null {
  const serie = d.mediciones[atributoId];
  return serie?.length ? serie[serie.length - 1].valor : null;
}

export function plantelDe(categoriaId: string): Deportista[] {
  return DEPORTISTAS.filter((d) => d.categoriaId === categoriaId);
}

export function categoriasConPlantel(): Categoria[] {
  return CATEGORIAS.filter((c) => plantelDe(c.id).length > 0);
}

export function edad(fechaNacimiento: string | null): number | null {
  if (!fechaNacimiento) return null;
  const hoy = new Date();
  const nac = new Date(fechaNacimiento);
  if (Number.isNaN(nac.getTime())) return null;
  let e = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) e--;
  return e;
}

/** "12 años" o "edad s/d" para encabezados y listas */
export function edadLabel(fechaNacimiento: string | null): string {
  const e = edad(fechaNacimiento);
  return e === null ? "edad s/d" : `${e} años`;
}

export function formatFecha(iso: string): string {
  return new Date(iso + (iso.includes("T") ? "" : "T12:00:00")).toLocaleDateString(
    "es-AR",
    { day: "numeric", month: "short" },
  );
}

export function sesionesDe(deportistaId: string): Sesion[] {
  return SESIONES.filter((s) =>
    s.asistencia.some((a) => a.deportistaId === deportistaId),
  );
}

// ---------- agenda ----------

export function getLugar(id?: string) {
  return id ? LUGARES.find((l) => l.id === id) : undefined;
}

export function getPartido(id: string) {
  return PARTIDOS.find((p) => p.id === id);
}

export function lugarDePartido(p: Partido): string {
  return p.condicion === "local"
    ? (getLugar(p.lugarId)?.nombre ?? "Sede")
    : (p.lugarTexto ?? "Cancha del rival");
}

export type Evento =
  | { tipo: "sesion"; fecha: string; sesion: Sesion }
  | { tipo: "partido"; fecha: string; partido: Partido };

/** Sesiones + partidos del alcance, ordenados por fecha. */
export function eventosDe(categorias: string[] | null): Evento[] {
  const enAlcance = (c: string) => !categorias || categorias.includes(c);
  const eventos: Evento[] = [
    ...SESIONES.filter((s) => enAlcance(s.categoriaId)).map(
      (sesion): Evento => ({ tipo: "sesion", fecha: sesion.fecha, sesion }),
    ),
    ...PARTIDOS.filter((p) => enAlcance(p.categoriaId)).map(
      (partido): Evento => ({ tipo: "partido", fecha: partido.fecha, partido }),
    ),
  ];
  return eventos.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export const DIAS = [
  "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo",
];

export function cronogramaDe(categorias: string[] | null): Horario[] {
  return CRONOGRAMA.filter(
    (h) => !categorias || categorias.includes(h.categoriaId),
  );
}

// ---------- clubes del observatorio (solo agregados) ----------
// Las métricas de Antoniana salen de los datos mock reales; los otros
// clubes son ficticios y solo existen como totales.
const medicionesUltimoMes = DEPORTISTAS.reduce(
  (acc, d) =>
    acc +
    Object.values(d.mediciones)
      .flat()
      .filter((m) => m.fecha.startsWith("2026-06")).length,
  0,
);

export const CLUBES: ClubResumen[] = [
  {
    id: "cja", nombre: "Club Atlético Antoniana", localidad: "Salta Capital",
    departamento: "Capital", esEsteClub: true,
    deportistas: DEPORTISTAS.length,
    medicionesMes: medicionesUltimoMes,
    consentimientoPct: Math.round(
      (DEPORTISTAS.filter((d) => d.consentimientoOk).length /
        DEPORTISTAS.length) *
        100,
    ),
    categoriasActivas: categoriasConPlantel().length,
  },
  {
    id: "smi", nombre: "Sportivo del Milagro", localidad: "Salta Capital",
    departamento: "Capital", esEsteClub: false, deportistas: 88,
    medicionesMes: 121, consentimientoPct: 93, categoriasActivas: 9,
  },
  {
    id: "avl", nombre: "Atlético Valle de Lerma", localidad: "Cerrillos",
    departamento: "Cerrillos", esEsteClub: false, deportistas: 34,
    medicionesMes: 52, consentimientoPct: 100, categoriasActivas: 4,
  },
];
