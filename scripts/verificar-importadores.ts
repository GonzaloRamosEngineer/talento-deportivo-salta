import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { parsearEvaluacion } from "../lib/evaluaciones/importador/parsear";

const CARPETA = process.env.SECRETARIA_ARCHIVOS_DIR
  ?? "/Users/gramos/Documents/dev/proyecto secretaria";

const casos: Record<string, { disciplina: string; grupo: string; fecha?: string; adaptador: string }> = {
  "MATRIZ ATLETISMO 2026.csv": { disciplina: "Atletismo", grupo: "General", fecha: "2026-01-01", adaptador: "saltos_tabular" },
  "MATRIZ FINAL LEVANTAMIENTO DESARROLLO.xlsx": { disciplina: "Levantamiento", grupo: "Desarrollo", adaptador: "saltos_tabular" },
  "MATRIZ FINAL LEVANTAMIENTO INICIACION.xlsx": { disciplina: "Levantamiento", grupo: "Iniciación", adaptador: "saltos_tabular" },
  "MATRIZ MMA.csv": { disciplina: "MMA", grupo: "General", fecha: "2026-01-01", adaptador: "saltos_tabular" },
  "MATRIZ VOLEY CENTRAL NORTE GENERAL.csv": { disciplina: "Vóley", grupo: "General", adaptador: "saltos_tabular" },
  "MATRIZ VOLEY CENTRAL NORTE PRIMERA.csv": { disciplina: "Vóley", grupo: "Primera", adaptador: "saltos_tabular" },
  "Matriz_Gim_Rit-0518_08_2025.xlsx": { disciplina: "Gimnasia rítmica", grupo: "General", adaptador: "gimnasia_cmj" },
  "SUB13 LIGA SALTEÑA FUTBOL.xlsx": { disciplina: "Fútbol", grupo: "SUB13", adaptador: "sub13_bloques" },
  "Uni Rugby U14.xlsx": { disciplina: "Rugby", grupo: "U14", adaptador: "rugby_sprint" },
};

async function main() {
  const archivos = await readdir(CARPETA);
  for (const [nombre, caso] of Object.entries(casos)) {
    assert(archivos.includes(nombre), `Falta ${nombre}`);
    const buffer = await readFile(path.join(CARPETA, nombre));
    const archivo = new File([buffer], nombre);
    const resultado = await parsearEvaluacion(archivo, {
      institucionOrigen: "Validación local",
      disciplina: caso.disciplina,
      grupo: caso.grupo,
      fechaDeclarada: caso.fecha ?? "",
      evaluadoPor: "Equipo de evaluación",
    });
    assert.equal(resultado.adaptador, caso.adaptador);
    assert(resultado.mediciones.length > 0, `${nombre} quedó sin mediciones`);
    const deportistas = new Set(resultado.mediciones.map((item) => item.deportistaClave)).size;
    console.log(JSON.stringify({
      archivo: nombre,
      adaptador: resultado.adaptador,
      deportistas,
      mediciones: resultado.mediciones.length,
      ignoradas: resultado.filasIgnoradas,
      duplicados: resultado.duplicados,
      protocolos: resultado.protocolos,
    }));
    if (resultado.adaptador === "sub13_bloques") {
      assert.equal(deportistas, 21);
      assert.equal(resultado.mediciones.length, 273);
      assert.equal(resultado.duplicados, 21);
      assert(resultado.hallazgos.some((item) => item.id === "fecha-sub13" && item.severidad === "bloqueo"));
      assert(resultado.mediciones.every((item) => item.fecha === null && item.fechaResolucionId === "fecha-sub13"));
    }
  }
}

void main();
