import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { parsearEvaluacion } from "../lib/evaluaciones/importador/parsear";

const CARPETA = process.env.SECRETARIA_ARCHIVOS_DIR
  ?? "/Users/gramos/Documents/dev/proyecto secretaria";

// `mediciones` y `resumen` fijan lo que cada planilla real produce hoy: si
// un cambio del lector los mueve, tiene que ser a propósito. Ninguna de
// estas planillas tiene filas pendientes; si aparecen, es un falso positivo.
const casos: Record<string, { disciplina: string; grupo: string; fecha?: string; adaptador: string; mediciones: number; resumen: number }> = {
  "MATRIZ ATLETISMO 2026.csv": { disciplina: "Atletismo", grupo: "General", fecha: "2026-01-01", adaptador: "saltos_tabular", mediciones: 287, resumen: 0 },
  "MATRIZ FINAL LEVANTAMIENTO DESARROLLO.xlsx": { disciplina: "Levantamiento", grupo: "Desarrollo", adaptador: "saltos_tabular", mediciones: 102, resumen: 0 },
  "MATRIZ FINAL LEVANTAMIENTO INICIACION.xlsx": { disciplina: "Levantamiento", grupo: "Iniciación", adaptador: "saltos_tabular", mediciones: 144, resumen: 0 },
  "MATRIZ MMA.csv": { disciplina: "MMA", grupo: "General", fecha: "2026-01-01", adaptador: "saltos_tabular", mediciones: 153, resumen: 3 },
  "MATRIZ VOLEY CENTRAL NORTE GENERAL.csv": { disciplina: "Vóley", grupo: "General", adaptador: "saltos_tabular", mediciones: 612, resumen: 0 },
  "MATRIZ VOLEY CENTRAL NORTE PRIMERA.csv": { disciplina: "Vóley", grupo: "Primera", adaptador: "saltos_tabular", mediciones: 170, resumen: 0 },
  "Matriz_Gim_Rit-0518_08_2025.xlsx": { disciplina: "Gimnasia rítmica", grupo: "General", adaptador: "gimnasia_cmj", mediciones: 182, resumen: 5 },
  // 18 = 6 filas de estadística por bloque × 3 bloques (antes: 8 fijo).
  "SUB13 LIGA SALTEÑA FUTBOL.xlsx": { disciplina: "Fútbol", grupo: "SUB13", adaptador: "sub13_bloques", mediciones: 273, resumen: 18 },
  // 12 = pie de estadísticas + tabla de clasificación. Antes caían como
  // "sin fecha": ahora son resumen, no deportistas pendientes.
  "Uni Rugby U14.xlsx": { disciplina: "Rugby", grupo: "U14", adaptador: "rugby_sprint", mediciones: 170, resumen: 12 },
};

const CONTEXTO = { institucionOrigen: "Validación local", disciplina: "x", grupo: "x", fechaDeclarada: "", evaluadoPor: "Equipo" };

/** Filas que antes desaparecían en silencio: ahora quedan pendientes con motivo. */
async function casosSinteticos() {
  const csv = (nombre: string, lineas: string[]) => new File([lineas.join("\n")], nombre);

  const gim = await parsearEvaluacion(csv("gim.csv", [
    "N°;Nombre;Fecha;Peso Corporal (kg);Altura de Salto (cm);Fuerza;Potencia;RSI;Asim A;Asim C",
    "1;Ana Pérez;2026-03-01;40;25;1500;40;0.3;;",
    "2;Bea Gómez;;41;26;1600;41;0.31;;",
    "3;Caro Díaz;2026-03-01;ausente;24;1400;39;0.29;;",
    ";Estadísticas;;;;;;;;",
    ";Mín;;40;24;1400;39;0.29;;",
    ";Máx;;41;26;1600;41;0.31;;",
  ]), CONTEXTO);
  assert.equal(gim.adaptador, "gimnasia_cmj");
  const sinFecha = gim.filasPendientes?.find((fila) => fila.motivo === "sin_fecha");
  assert(sinFecha && sinFecha.nombre === "Bea Gómez" && sinFecha.fila === 3, "la fila sin fecha queda pendiente, no desaparece");
  assert.equal(sinFecha.valores.altura_salto, "26", "la fila pendiente conserva sus valores originales");
  const ilegible = gim.filasPendientes?.find((fila) => fila.motivo === "valor_ilegible");
  assert(ilegible?.columnasIlegibles?.includes("peso_corporal") && ilegible.seImportoElResto, "un valor ilegible queda pendiente y el resto de la fila entra");
  assert(gim.mediciones.some((m) => m.nombre === "Caro Díaz" && m.atributoCodigo === "altura_salto"), "lo legible de esa fila se importa");
  assert(!gim.mediciones.some((m) => m.nombre === "Bea Gómez"), "sin fecha no se inventa una jornada");
  assert.equal(gim.filasResumen, 3, "el pie de estadísticas se cuenta como resumen");
  assert.equal(gim.filasIgnoradas, (gim.filasPendientes?.length ?? 0) + (gim.filasResumen ?? 0) + (gim.filasVacias ?? 0));
  const bloqueo = gim.hallazgos.find((h) => h.id === "filas-pendientes");
  assert(bloqueo?.severidad === "bloqueo" && bloqueo.requiereResolucion, "las filas pendientes exigen una decisión explícita");
  assert.deepEqual(bloqueo.opciones?.map((o) => o.valor), ["carga_manual", "excluir"]);
  assert(gim.hallazgos.some((h) => h.id === "conteo-filas" && h.severidad === "info"));

  const saltos = await parsearEvaluacion(csv("saltos.csv", [
    "TEST DE SALTOS 01/03/2026",
    "Nombre;Apellido;Edad;Test;BW;JH;PLF;PP;RSI;AsA;AsC;HG",
    "Ana;Pérez;15;CMJ;50;30;2000;45;0.4;10 L;5 R;30",
    ";;;CMJ;51;31;2100;46;0.41;;;",
    "Bea;Gómez;15;SJ;;;;;;–;–;",
  ]), CONTEXTO);
  assert.equal(saltos.adaptador, "saltos_tabular");
  assert(saltos.filasPendientes?.some((fila) => fila.motivo === "sin_nombre" && fila.valores.altura_salto === "31"), "una fila con datos y sin nombre queda pendiente");
  assert.equal(saltos.filasVacias, 1, "una fila solo con guiones es vacía, no ilegible");
  console.log(JSON.stringify({ sinteticos: "ok", gimnasia: gim.filasPendientes?.length, saltos: saltos.filasPendientes?.length }));
}

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
    assert.equal(resultado.mediciones.length, caso.mediciones, `${nombre}: cambió la cantidad de mediciones`);
    assert.equal(resultado.filasResumen, caso.resumen, `${nombre}: cambió el conteo de filas de resumen`);
    assert.equal(resultado.filasPendientes?.length, 0, `${nombre}: aparecieron filas pendientes en una planilla conocida`);
    assert.equal(resultado.filasIgnoradas, (resultado.filasResumen ?? 0) + (resultado.filasVacias ?? 0));
    const deportistas = new Set(resultado.mediciones.map((item) => item.deportistaClave)).size;
    console.log(JSON.stringify({
      archivo: nombre,
      adaptador: resultado.adaptador,
      deportistas,
      mediciones: resultado.mediciones.length,
      ignoradas: resultado.filasIgnoradas,
      resumen: resultado.filasResumen,
      vacias: resultado.filasVacias,
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
  await casosSinteticos();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
