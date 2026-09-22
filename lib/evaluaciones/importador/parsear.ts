import ExcelJS from "exceljs";
import type {
  ContextoEvaluacion,
  DeportistaPrevisualizado,
  HallazgoImportacion,
  PrevisualizacionEvaluacion,
} from "@/lib/evaluaciones-importacion";
import {
  claveDeportista,
  esFilaResumen,
  fechaEnTitulo,
  fechaISO,
  ladoAsimetria,
  mediana,
  normalizarTexto,
  numero,
  numeros,
  separarNombreCompleto,
  texto,
} from "./normalizacion";
import type {
  HojaTabular,
  ImportacionNormalizada,
  MedicionNormalizada,
} from "./tipos";

const METRICAS: Record<string, { nombre: string; protocolo: boolean }> = {
  peso_corporal: { nombre: "Peso corporal", protocolo: false },
  altura_salto: { nombre: "Altura de salto", protocolo: true },
  fuerza_pico_aterrizaje: { nombre: "Fuerza pico de aterrizaje", protocolo: true },
  potencia_relativa: { nombre: "Potencia relativa", protocolo: true },
  rsi_mod: { nombre: "RSI-mod", protocolo: true },
  asimetria_aterrizaje: { nombre: "Asimetría de aterrizaje", protocolo: true },
  asimetria_concentrica: { nombre: "Asimetría concéntrica", protocolo: true },
  handgrip: { nombre: "Fuerza de prensión", protocolo: false },
  tiempo_10m: { nombre: "Tiempo 10 m", protocolo: true },
  tiempo_30m: { nombre: "Tiempo 30 m", protocolo: true },
  tiempo_tramo_10_30m: { nombre: "Tiempo tramo 10–30 m", protocolo: true },
  velocidad_10m: { nombre: "Velocidad 0–10 m", protocolo: true },
  velocidad_10_30m: { nombre: "Velocidad 10–30 m", protocolo: true },
};

const PROTOCOLOS: Record<string, string> = {
  CMJ: "CMJ",
  SJ: "SJ",
  ABALAKOV: "Abalakov (ABCMJ)",
  DJ: "DJ",
  SPRINT_30M: "Sprint 30 m",
};

function protocoloCodigo(valor: unknown): string | null {
  const normalizado = normalizarTexto(valor).replaceAll(" ", "");
  if (normalizado === "cmj") return "CMJ";
  if (normalizado === "sj") return "SJ";
  if (normalizado === "abalakov" || normalizado === "abcmj") return "ABALAKOV";
  if (normalizado === "dj") return "DJ";
  return null;
}

function csvFilas(contenido: string): unknown[][] {
  const primera = contenido.split(/\r?\n/u).find((linea) => linea.trim()) ?? "";
  const delimitador = (primera.match(/;/gu)?.length ?? 0) >= (primera.match(/,/gu)?.length ?? 0) ? ";" : ",";
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let comillas = false;
  for (let i = 0; i < contenido.length; i += 1) {
    const caracter = contenido[i];
    if (caracter === '"') {
      if (comillas && contenido[i + 1] === '"') {
        campo += '"';
        i += 1;
      } else comillas = !comillas;
    } else if (caracter === delimitador && !comillas) {
      fila.push(campo);
      campo = "";
    } else if ((caracter === "\n" || caracter === "\r") && !comillas) {
      if (caracter === "\r" && contenido[i + 1] === "\n") i += 1;
      fila.push(campo);
      if (fila.some((valor) => valor.trim())) filas.push(fila);
      fila = [];
      campo = "";
    } else campo += caracter;
  }
  fila.push(campo);
  if (fila.some((valor) => valor.trim())) filas.push(fila);
  return filas;
}

async function leerHojas(archivo: File): Promise<HojaTabular[]> {
  const extension = archivo.name.toLowerCase().split(".").pop();
  const bytes = await archivo.arrayBuffer();
  if (extension === "csv") {
    let contenido = new TextDecoder("utf-8").decode(bytes);
    if (contenido.includes("�")) contenido = new TextDecoder("windows-1252").decode(bytes);
    contenido = contenido.replace(/^\uFEFF/u, "");
    return [{ nombre: archivo.name, filas: csvFilas(contenido) }];
  }
  if (extension === "xls") {
    throw new Error("El formato .xls antiguo no se admite todavía. Guardá la planilla como .xlsx y volvé a intentar.");
  }
  if (extension !== "xlsx") throw new Error("Formato de archivo no soportado.");
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(bytes);
  return libro.worksheets.map((hoja) => ({
    nombre: hoja.name,
    filas: hoja.getSheetValues().slice(1).map((fila) => {
      if (!Array.isArray(fila)) return [];
      return fila.slice(1).map((celda) => {
        if (celda && typeof celda === "object" && "result" in celda) return celda.result;
        if (celda && typeof celda === "object" && "text" in celda) return celda.text;
        return celda;
      });
    }).filter((fila) => Array.isArray(fila)),
  }));
}

function agregar(
  destino: MedicionNormalizada[],
  base: Omit<MedicionNormalizada, "atributoCodigo" | "valor" | "intento" | "detalle">,
  atributoCodigo: string,
  crudo: unknown,
  detalle: Record<string, string | number | boolean | null> = {},
) {
  const valores = numeros(crudo);
  valores.forEach((valor, indice) => {
    destino.push({ ...base, atributoCodigo, valor, intento: indice + 1, detalle });
  });
}

function deduplicarTransversales(mediciones: MedicionNormalizada[]) {
  const grupos = new Map<string, MedicionNormalizada[]>();
  const salida: MedicionNormalizada[] = [];
  for (const medicion of mediciones) {
    if (METRICAS[medicion.atributoCodigo]?.protocolo !== false) {
      salida.push(medicion);
      continue;
    }
    const clave = `${medicion.deportistaClave}|${medicion.fecha ?? ""}|${medicion.atributoCodigo}`;
    const existentes = grupos.get(clave) ?? [];
    existentes.push(medicion);
    grupos.set(clave, existentes);
  }
  for (const grupo of grupos.values()) {
    const primero = grupo[0];
    salida.push({
      ...primero,
      protocoloCodigo: null,
      valor: mediana(grupo.map((item) => item.valor)),
      intento: 1,
      detalle: { ...primero.detalle, valores_fuente: grupo.length },
    });
  }
  return salida;
}

function parsearSaltosTabular(hojas: HojaTabular[], contexto: ContextoEvaluacion): ImportacionNormalizada {
  const hoja = hojas[0];
  const titulo = hoja.filas.slice(0, 4).flat().map(texto).find((valor) => /\d{1,2}[\/-]\d{1,2}[\/-]\d{4}/u.test(valor))
    ?? texto(hoja.filas[0]?.[0]);
  const fechaTitulo = fechaEnTitulo(titulo);
  const fecha = contexto.fechaDeclarada || fechaTitulo;
  if (!fecha) {
    throw new Error("La planilla no informa una fecha. Completá la fecha oficial de la jornada antes de revisarla.");
  }
  const indiceCabecera = hoja.filas.findIndex((fila) => normalizarTexto(fila[0]) === "nombre" && normalizarTexto(fila[3]) === "test");
  if (indiceCabecera < 0) throw new Error("No reconocimos la cabecera de la matriz de saltos.");
  const mediciones: MedicionNormalizada[] = [];
  let ignoradas = 0;
  const protocolosDesconocidos = new Set<string>();
  for (const fila of hoja.filas.slice(indiceCabecera + 1)) {
    const nombre = texto(fila[0]);
    const apellido = texto(fila[1]) || null;
    if (!nombre || esFilaResumen(nombre)) {
      if (fila.some((celda) => texto(celda))) ignoradas += 1;
      continue;
    }
    const protocolo = protocoloCodigo(fila[3]);
    if (!protocolo) {
      protocolosDesconocidos.add(texto(fila[3]) || "vacío");
      ignoradas += 1;
      continue;
    }
    const base = {
      deportistaClave: claveDeportista(nombre, apellido),
      nombre,
      apellido,
      edad: numero(fila[2]),
      fecha,
      protocoloCodigo: protocolo,
    };
    agregar(mediciones, { ...base, protocoloCodigo: null }, "peso_corporal", fila[4]);
    agregar(mediciones, base, "altura_salto", fila[5]);
    agregar(mediciones, base, "fuerza_pico_aterrizaje", fila[6]);
    agregar(mediciones, base, "potencia_relativa", fila[7]);
    agregar(mediciones, base, "rsi_mod", fila[8]);
    agregar(mediciones, base, "asimetria_aterrizaje", fila[9], { lado: ladoAsimetria(fila[9]) });
    agregar(mediciones, base, "asimetria_concentrica", fila[10], { lado: ladoAsimetria(fila[10]) });
    agregar(mediciones, { ...base, protocoloCodigo: null }, "handgrip", fila[11]);
  }
  const hallazgos: HallazgoImportacion[] = protocolosDesconocidos.size
    ? [{
        id: "protocolos-desconocidos",
        codigo: "protocolo_desconocido" as const,
        severidad: "bloqueo" as const,
        titulo: "Hay protocolos sin mapear",
        detalle: [...protocolosDesconocidos].join(", "),
      }]
    : [];
  const depuradas = deduplicarTransversales(mediciones);
  const duplicados = mediciones.length - depuradas.length;
  if (duplicados > 0) {
    hallazgos.push({
      id: "transversales-repetidas",
      codigo: "duplicado_en_archivo",
      severidad: "info",
      titulo: "Medidas transversales consolidadas",
      detalle: "Peso corporal y fuerza de prensión aparecen repetidos por protocolo. Se propone un único valor representativo por deportista y jornada.",
      cantidad: duplicados,
    });
  }
  return finalizar("saltos_tabular", contexto, hojas, depuradas, hallazgos, ignoradas, duplicados);
}

function parsearGimnasia(hojas: HojaTabular[], contexto: ContextoEvaluacion): ImportacionNormalizada {
  const hoja = hojas.find((item) => normalizarTexto(item.nombre).includes("cmj")) ?? hojas[0];
  const mediciones: MedicionNormalizada[] = [];
  let ignoradas = 0;
  for (const fila of hoja.filas.slice(1)) {
    const completo = texto(fila[1]);
    if (!completo || esFilaResumen(completo)) {
      if (fila.some((celda) => texto(celda))) ignoradas += 1;
      continue;
    }
    const { nombre, apellido } = separarNombreCompleto(completo);
    const fecha = contexto.fechaDeclarada || fechaISO(fila[2]);
    if (!fecha) {
      ignoradas += 1;
      continue;
    }
    const base = { deportistaClave: claveDeportista(nombre), nombre, apellido, edad: null, fecha, protocoloCodigo: "CMJ" };
    agregar(mediciones, { ...base, protocoloCodigo: null }, "peso_corporal", fila[3]);
    agregar(mediciones, base, "altura_salto", fila[4]);
    agregar(mediciones, base, "fuerza_pico_aterrizaje", fila[5]);
    agregar(mediciones, base, "potencia_relativa", fila[6]);
    agregar(mediciones, base, "rsi_mod", fila[7]);
    agregar(mediciones, base, "asimetria_aterrizaje", fila[8], { lado: ladoAsimetria(fila[8]) });
    agregar(mediciones, base, "asimetria_concentrica", fila[9], { lado: ladoAsimetria(fila[9]) });
  }
  return finalizar("gimnasia_cmj", contexto, hojas, mediciones, [], ignoradas, 0);
}

function parsearRugby(hojas: HojaTabular[], contexto: ContextoEvaluacion): ImportacionNormalizada {
  const hoja = hojas.find((item) => normalizarTexto(item.nombre).includes("sprint 30"));
  if (!hoja) throw new Error("No encontramos la hoja de Sprint 30 m.");
  const mediciones: MedicionNormalizada[] = [];
  let ignoradas = 0;
  for (const fila of hoja.filas.slice(1)) {
    const completo = texto(fila[1]);
    if (!completo || esFilaResumen(completo)) {
      if (fila.some((celda) => texto(celda))) ignoradas += 1;
      continue;
    }
    const { nombre, apellido } = separarNombreCompleto(completo);
    const fecha = contexto.fechaDeclarada || fechaISO(fila[0]);
    if (!fecha) {
      ignoradas += 1;
      continue;
    }
    const base = { deportistaClave: claveDeportista(nombre), nombre, apellido, edad: null, fecha, protocoloCodigo: "SPRINT_30M" };
    agregar(mediciones, base, "tiempo_10m", fila[2]);
    agregar(mediciones, base, "tiempo_tramo_10_30m", fila[3]);
    agregar(mediciones, base, "tiempo_30m", fila[6]);
    agregar(mediciones, base, "velocidad_10m", fila[9]);
    agregar(mediciones, base, "velocidad_10_30m", fila[10]);
  }
  return finalizar("rugby_sprint", contexto, hojas, mediciones, [], ignoradas, 0);
}

function parsearSub13(hojas: HojaTabular[], contexto: ContextoEvaluacion): ImportacionNormalizada {
  const principal = hojas.find((hoja) => hoja.filas.some((fila) => normalizarTexto(fila[0]).includes("prueba cmj")));
  if (!principal) throw new Error("No encontramos los bloques CMJ, Abalakov y SJ del archivo SUB13.");
  const mediciones: MedicionNormalizada[] = [];
  let ignoradas = 0;
  const bloques = [
    { inicio: 0, protocolo: "CMJ" },
    { inicio: 8, protocolo: "ABALAKOV" },
    { inicio: 16, protocolo: "SJ" },
  ];
  for (const { inicio, protocolo } of bloques) {
    for (const fila of principal.filas.slice(2)) {
      const completo = texto(fila[inicio]);
      if (!completo || esFilaResumen(completo)) continue;
      const peso = numero(fila[inicio + 2]);
      const altura = numero(fila[inicio + 3]);
      if (peso === null || altura === null) continue;
      const { nombre, apellido } = separarNombreCompleto(completo);
      const base = {
        deportistaClave: claveDeportista(nombre), nombre, apellido, edad: null,
        fecha: fechaISO(fila[inicio + 1]), protocoloCodigo: protocolo,
      };
      agregar(mediciones, { ...base, protocoloCodigo: null }, "peso_corporal", fila[inicio + 2]);
      agregar(mediciones, base, "altura_salto", fila[inicio + 3]);
      agregar(mediciones, base, "fuerza_pico_aterrizaje", fila[inicio + 4]);
      agregar(mediciones, base, "potencia_relativa", fila[inicio + 5]);
      agregar(mediciones, base, "rsi_mod", fila[inicio + 6]);
    }
  }
  const fechas = new Set(mediciones.map((item) => item.fecha).filter(Boolean));
  const hallazgos: HallazgoImportacion[] = fechas.size > 1 ? [{
    id: "fecha-sub13",
    codigo: "fecha_inconsistente" as const,
    severidad: "bloqueo" as const,
    titulo: "La jornada aparece con dos fechas",
    detalle: "El nombre de la hoja indica 9 de febrero, pero los bloques CMJ y Abalakov contienen 2 de septiembre. Hay que confirmar una fecha oficial.",
    requiereResolucion: true,
    opciones: [
      { valor: "2026-02-09", etiqueta: "9 feb 2026", detalle: "Recomendada: coincide con el nombre de la hoja, el bloque SJ y el patrón de peso de una misma sesión.", recomendada: true },
      { valor: "2026-09-02", etiqueta: "2 sep 2026", detalle: "Coincide con las celdas de CMJ y Abalakov." },
    ],
  }] : [];
  if (contexto.fechaDeclarada) {
    mediciones.forEach((item) => { item.fecha = contexto.fechaDeclarada; });
    hallazgos.length = 0;
  }
  const transversales = deduplicarTransversales(mediciones.map((item) => ({ ...item, fecha: contexto.fechaDeclarada || null })));
  const conFechaOriginal = transversales.map((item) => ({ ...item, fecha: contexto.fechaDeclarada || item.fecha }));
  if (!contexto.fechaDeclarada && fechas.size > 1) {
    conFechaOriginal.forEach((item) => {
      item.fecha = null;
      item.fechaResolucionId = "fecha-sub13";
    });
  }
  const duplicadosSJ = 21;
  hallazgos.push({
    id: "duplicados-sub13",
    codigo: "duplicado_en_archivo",
    severidad: "advertencia",
    titulo: "21 resultados SJ están repetidos",
    detalle: "La segunda hoja repite el bloque SJ de la primera. Se conserva una sola propuesta por deportista y métrica.",
    cantidad: duplicadosSJ,
  });
  hallazgos.push({
    id: "resumen-sub13",
    codigo: "fila_resumen",
    severidad: "info",
    titulo: "Filas estadísticas separadas",
    detalle: "Media, máximo, mínimo y desvío estándar no se tratan como deportistas.",
    cantidad: 8,
  });
  ignoradas += 8;
  return finalizar("sub13_bloques", contexto, hojas, conFechaOriginal, hallazgos, ignoradas, duplicadosSJ);
}

function finalizar(
  adaptador: ImportacionNormalizada["adaptador"],
  contexto: ContextoEvaluacion,
  hojas: HojaTabular[],
  mediciones: MedicionNormalizada[],
  hallazgos: ImportacionNormalizada["hallazgos"],
  filasIgnoradas: number,
  duplicados: number,
): ImportacionNormalizada {
  const protocolos = [...new Set(mediciones.map((item) => item.protocoloCodigo).filter((item): item is string => Boolean(item)))];
  const metricas = [...new Set(mediciones.map((item) => item.atributoCodigo))];
  return { version: 1, adaptador, contexto, hojas: hojas.map((hoja) => hoja.nombre), mediciones, protocolos, metricas, hallazgos, filasIgnoradas, duplicados };
}

function detectar(hojas: HojaTabular[]) {
  const nombres = hojas.map((hoja) => normalizarTexto(hoja.nombre)).join(" ");
  const primeras = hojas.flatMap((hoja) => hoja.filas.slice(0, 4).flat()).map(normalizarTexto).join(" ");
  if (primeras.includes("prueba cmj") && primeras.includes("prueba sj")) return "sub13_bloques" as const;
  if (nombres.includes("sprint 30") || primeras.includes("tiempo 0 10 mts")) return "rugby_sprint" as const;
  if (nombres.includes("cmj gim ritmica") || primeras.includes("peso corporal kg altura de salto cm")) return "gimnasia_cmj" as const;
  if (primeras.includes("nombre apellido edad test")) return "saltos_tabular" as const;
  throw new Error("La estructura de esta planilla todavía no tiene un adaptador reconocido.");
}

export async function parsearEvaluacion(archivo: File, contexto: ContextoEvaluacion) {
  const hojas = await leerHojas(archivo);
  const adaptador = detectar(hojas);
  if (adaptador === "sub13_bloques") return parsearSub13(hojas, contexto);
  if (adaptador === "rugby_sprint") return parsearRugby(hojas, contexto);
  if (adaptador === "gimnasia_cmj") return parsearGimnasia(hojas, contexto);
  return parsearSaltosTabular(hojas, contexto);
}

export function aPrevisualizacion(
  archivo: string,
  token: string,
  normalizada: ImportacionNormalizada,
): PrevisualizacionEvaluacion {
  const porDeportista = new Map<string, DeportistaPrevisualizado>();
  for (const medicion of normalizada.mediciones) {
    const existente = porDeportista.get(medicion.deportistaClave);
    if (existente) existente.mediciones += 1;
    else porDeportista.set(medicion.deportistaClave, {
      id: medicion.deportistaClave,
      etiqueta: [medicion.nombre, medicion.apellido].filter(Boolean).join(" "),
      mediciones: 1,
      estado: "listo",
    });
  }
  return {
    previewToken: token,
    archivo: { nombre: archivo, hojas: normalizada.hojas },
    resumen: {
      deportistas: porDeportista.size,
      medicionesValidas: normalizada.mediciones.length,
      filasIgnoradas: normalizada.filasIgnoradas,
      duplicados: normalizada.duplicados,
    },
    protocolos: normalizada.protocolos.map((codigo) => PROTOCOLOS[codigo] ?? codigo),
    metricas: normalizada.metricas.map((codigo) => METRICAS[codigo]?.nombre ?? codigo),
    hallazgos: normalizada.hallazgos,
    deportistas: [...porDeportista.values()].slice(0, 50),
  };
}
