export type EstadoJornadaSecretaria = "revisar" | "recibida" | "lista";

export interface GrupoSecretariaDemo {
  id: string;
  institucion: string;
  disciplina: string;
  grupo: string;
  archivo: string;
  estado: EstadoJornadaSecretaria;
  evaluados?: number;
  resultados?: number;
}

export const GRUPOS_SECRETARIA: GrupoSecretariaDemo[] = [
  {
    id: "sub13-liga",
    institucion: "Liga Salteña de Fútbol",
    disciplina: "Fútbol",
    grupo: "SUB13",
    archivo: "SUB13 Liga Salteña Fútbol.xlsx",
    estado: "revisar",
    evaluados: 21,
    resultados: 273,
  },
  {
    id: "rugby-u14",
    institucion: "Universitario Rugby",
    disciplina: "Rugby",
    grupo: "U14",
    archivo: "Uni Rugby U14.xlsx",
    estado: "recibida",
  },
  {
    id: "voley-central-general",
    institucion: "Central Norte",
    disciplina: "Vóley",
    grupo: "General",
    archivo: "Matriz Vóley Central Norte General.csv",
    estado: "recibida",
  },
  {
    id: "voley-central-primera",
    institucion: "Central Norte",
    disciplina: "Vóley",
    grupo: "Primera",
    archivo: "Matriz Vóley Central Norte Primera.csv",
    estado: "recibida",
  },
  {
    id: "atletismo-2026",
    institucion: "Programa provincial",
    disciplina: "Atletismo",
    grupo: "Matriz 2026",
    archivo: "Matriz Atletismo 2026.csv",
    estado: "recibida",
  },
  {
    id: "mma-general",
    institucion: "Programa provincial",
    disciplina: "MMA",
    grupo: "Grupo general",
    archivo: "Matriz MMA.csv",
    estado: "recibida",
  },
  {
    id: "gimnasia-ritmica",
    institucion: "Programa provincial",
    disciplina: "Gimnasia rítmica",
    grupo: "Grupo general",
    archivo: "Matriz Gimnasia Rítmica.xlsx",
    estado: "recibida",
  },
  {
    id: "levantamiento-iniciacion",
    institucion: "Programa provincial",
    disciplina: "Levantamiento",
    grupo: "Iniciación",
    archivo: "Matriz Levantamiento Iniciación.xlsx",
    estado: "recibida",
  },
  {
    id: "levantamiento-desarrollo",
    institucion: "Programa provincial",
    disciplina: "Levantamiento",
    grupo: "Desarrollo",
    archivo: "Matriz Levantamiento Desarrollo.xlsx",
    estado: "recibida",
  },
];

export const DISCIPLINAS_SECRETARIA = [
  { nombre: "Atletismo", grupos: 1, estado: "Por validar" },
  { nombre: "Fútbol", grupos: 1, estado: "Batería detectada" },
  { nombre: "Gimnasia rítmica", grupos: 1, estado: "Por validar" },
  { nombre: "Levantamiento", grupos: 2, estado: "Por validar" },
  { nombre: "MMA", grupos: 1, estado: "Por validar" },
  { nombre: "Rugby", grupos: 1, estado: "Por validar" },
  { nombre: "Vóley", grupos: 2, estado: "Por validar" },
];

export const ROLES_SECRETARIA = [
  {
    nombre: "Administrador/a de Secretaría",
    alcance: "Configura el espacio, equipo, grupos y todas las jornadas.",
  },
  {
    nombre: "Coordinador/a",
    alcance: "Organiza instituciones, disciplinas y asigna evaluadores.",
  },
  {
    nombre: "Evaluador/a",
    alcance: "Registra y corrige jornadas de sus grupos asignados.",
  },
  {
    nombre: "Analista",
    alcance: "Consulta fichas y reportes autorizados sin administrar accesos.",
  },
];
