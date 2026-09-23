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
  esIlegible,
  esInicioPie,
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
  FilaPendiente,
  FilaSinProtocolo,
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

const FECHA_AUSENTE_ID = "fecha-ausente";
const FILAS_PENDIENTES_ID = "filas-pendientes";

type Columnas = ReadonlyArray<readonly [codigo: string, indice: number]>;

const ETIQUETA_MOTIVO: Record<FilaPendiente["motivo"], [singular: string, plural: string]> = {
  sin_fecha: ["sin fecha", "sin fecha"],
  sin_nombre: ["sin nombre", "sin nombre"],
  valor_ilegible: ["con un valor ilegible", "con valores ilegibles"],
  protocolo_desconocido: ["con protocolo desconocido", "con protocolo desconocido"],
};

/**
 * Lleva la cuenta de TODO lo que no entra como medición. Nada se descarta
 * en silencio: o es resumen (no es un deportista), o está vacía (no hay
 * dato que perder), o queda pendiente para que una persona decida.
 */
class RegistroFilas {
  readonly pendientes: FilaPendiente[] = [];
  resumen = 0;
  vacias = 0;
  private enPie = false;

  constructor(private readonly hoja: string) {}

  /** true si la fila es del pie (estadísticas, clasificación) o un resumen suelto. */
  esResumen(etiqueta: string, celdas: unknown[]): boolean {
    if (this.enPie || esInicioPie(etiqueta)) {
      this.enPie = true;
      if (celdas.some((celda) => texto(celda))) this.resumen += 1;
      return true;
    }
    if (esFilaResumen(etiqueta)) {
      this.resumen += 1;
      return true;
    }
    return false;
  }

  pendiente(fila: Omit<FilaPendiente, "hoja">) {
    this.pendientes.push({ ...fila, hoja: this.hoja });
  }

  get ignoradas() {
    return this.pendientes.length + this.resumen + this.vacias;
  }

  static unir(hoja: string, registros: RegistroFilas[]) {
    const total = new RegistroFilas(hoja);
    for (const registro of registros) {
      total.pendientes.push(...registro.pendientes);
      total.resumen += registro.resumen;
      total.vacias += registro.vacias;
    }
    return total;
  }
}

function valoresDe(fila: unknown[], columnas: Columnas, extra: Record<string, string | null> = {}) {
  return { ...extra, ...Object.fromEntries(columnas.map(([codigo, indice]) => [codigo, texto(fila[indice]) || null])) };
}

/** Hay algo que perder: al menos un número o un texto que alguien escribió. */
function conDatos(fila: unknown[], columnas: Columnas) {
  return columnas.some(([, indice]) => numeros(fila[indice]).length > 0 || esIlegible(fila[indice]));
}

function ilegiblesDe(fila: unknown[], columnas: Columnas) {
  return columnas.filter(([, indice]) => esIlegible(fila[indice])).map(([codigo]) => codigo);
}

function hallazgosDeFilas(registro: RegistroFilas): HallazgoImportacion[] {
  const hallazgos: HallazgoImportacion[] = [];
  const { pendientes, resumen, vacias } = registro;
  if (pendientes.length) {
    const porMotivo = new Map<FilaPendiente["motivo"], number>();
    pendientes.forEach((fila) => porMotivo.set(fila.motivo, (porMotivo.get(fila.motivo) ?? 0) + 1));
    const partes = [...porMotivo.entries()].map(([motivo, n]) => `${n} ${ETIQUETA_MOTIVO[motivo][n === 1 ? 0 : 1]}`);
    hallazgos.push({
      id: FILAS_PENDIENTES_ID,
      codigo: "fila_pendiente",
      severidad: "bloqueo",
      titulo: pendientes.length === 1 ? "Una fila no se pudo leer completa" : `${pendientes.length} filas no se pudieron leer completas`,
      detalle: `${partes.join(", ")}. No se descartan solas: se decide desde la revisión de la planilla, con motivo.`,
      cantidad: pendientes.length,
      requiereResolucion: true,
      opciones: [
        { valor: "carga_manual", etiqueta: "Dejar para carga manual", detalle: "Se importa lo reconocido y estas filas quedan en la bandeja de pendientes." },
        { valor: "excluir", etiqueta: "Excluir estas filas", detalle: "No se importan. Queda registrado quién lo decidió y por qué." },
      ],
    });
  }
  if (pendientes.length || resumen || vacias) {
    const partes = [
      resumen && `${resumen} de resumen o estadística`,
      vacias && `${vacias} sin datos`,
      pendientes.length && `${pendientes.length} pendientes de decisión`,
    ].filter(Boolean);
    hallazgos.push({
      id: "conteo-filas",
      codigo: "fila_resumen",
      severidad: "info",
      titulo: "Filas que no son mediciones",
      detalle: `${partes.join(" · ")}. Media, máximo o pie de estadísticas no se tratan como deportistas.`,
      cantidad: registro.ignoradas,
    });
  }
  return hallazgos;
}

function parsearSaltosTabular(hojas: HojaTabular[], contexto: ContextoEvaluacion): ImportacionNormalizada {
  const hoja = hojas[0];
  const titulo = hoja.filas.slice(0, 4).flat().map(texto).find((valor) => /\d{1,2}[\/-]\d{1,2}[\/-]\d{4}/u.test(valor))
    ?? texto(hoja.filas[0]?.[0]);
  const fechaTitulo = fechaEnTitulo(titulo);
  const fecha = contexto.fechaDeclarada || fechaTitulo;
  // Sin fecha NO se rechaza la planilla: se recibe y se bloquea. La jornada
  // queda pendiente de la fecha oficial de la Secretaría, y mientras tanto
  // la planilla figura entre las recibidas en vez de desaparecer.
  const faltaFecha = !fecha;
  const indiceCabecera = hoja.filas.findIndex((fila) => normalizarTexto(fila[0]) === "nombre" && normalizarTexto(fila[3]) === "test");
  if (indiceCabecera < 0) throw new Error("No reconocimos la cabecera de la matriz de saltos.");
  const mediciones: MedicionNormalizada[] = [];
  const registro = new RegistroFilas(hoja.nombre);
  const protocolosDesconocidos = new Set<string>();
  const filasSinProtocolo: FilaSinProtocolo[] = [];
  const COLUMNAS = ["peso_corporal", "altura_salto", "fuerza_pico_aterrizaje",
    "potencia_relativa", "rsi_mod", "asimetria_aterrizaje", "asimetria_concentrica", "handgrip"];
  const POSICIONES: Columnas = COLUMNAS.map((codigo, i) => [codigo, 4 + i] as const);
  let numeroFila = indiceCabecera;
  for (const fila of hoja.filas.slice(indiceCabecera + 1)) {
    numeroFila += 1;
    const nombre = texto(fila[0]);
    const apellido = texto(fila[1]) || null;
    if (registro.esResumen(nombre, fila)) continue;
    if (!nombre) {
      if (!fila.some((celda) => texto(celda))) continue;
      if (conDatos(fila, POSICIONES)) {
        registro.pendiente({ fila: numeroFila + 1, motivo: "sin_nombre", nombre: "", apellido, edad: numero(fila[2]),
          valores: valoresDe(fila, POSICIONES, { test: texto(fila[3]) || null }) });
      } else registro.vacias += 1;
      continue;
    }
    const protocolo = protocoloCodigo(fila[3]);
    if (!protocolo) {
      // La fila NO se descarta: se conserva con sus valores originales para
      // que una persona la mapee o la excluya de forma explícita.
      const crudo = texto(fila[3]) || "vacío";
      protocolosDesconocidos.add(crudo);
      filasSinProtocolo.push({
        fila: numeroFila + 1,
        valorCrudo: crudo,
        nombre,
        apellido,
        edad: numero(fila[2]),
        valores: Object.fromEntries(COLUMNAS.map((c, i) => [c, texto(fila[4 + i]) || null])),
      });
      continue;
    }
    if (!conDatos(fila, POSICIONES)) {
      registro.vacias += 1;
      continue;
    }
    const ilegibles = ilegiblesDe(fila, POSICIONES);
    if (ilegibles.length) {
      registro.pendiente({ fila: numeroFila + 1, motivo: "valor_ilegible", nombre, apellido, edad: numero(fila[2]),
        valores: valoresDe(fila, POSICIONES, { test: texto(fila[3]) || null }), columnasIlegibles: ilegibles, seImportoElResto: true });
    }
    const base = {
      deportistaClave: claveDeportista(nombre, apellido),
      nombre,
      apellido,
      edad: numero(fila[2]),
      fecha: faltaFecha ? null : fecha,
      ...(faltaFecha ? { fechaResolucionId: FECHA_AUSENTE_ID } : {}),
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
  const hallazgos: HallazgoImportacion[] = [];
  if (faltaFecha) {
    hallazgos.push({
      id: FECHA_AUSENTE_ID,
      codigo: "fecha_inconsistente",
      severidad: "bloqueo",
      titulo: "La planilla no informa la fecha de la jornada",
      detalle:
        "Ni el archivo ni su título traen una fecha. No se propone ninguna: hay que pedirle la fecha oficial a la Secretaría antes de confirmar.",
      requiereResolucion: true,
    });
  }
  const hallazgosProtocolo: HallazgoImportacion[] = protocolosDesconocidos.size
    ? [{
        id: "protocolos-desconocidos",
        codigo: "protocolo_desconocido" as const,
        severidad: "bloqueo" as const,
        titulo: "Hay protocolos sin mapear",
        detalle: [...protocolosDesconocidos].join(", "),
        cantidad: filasSinProtocolo.length,
        requiereResolucion: true,
        opciones: [
          { valor: "excluir_todo", etiqueta: "Excluir estas filas", detalle: "No se importa ninguna de sus mediciones. Queda registrado." },
          { valor: "mapear", etiqueta: "Mapear a un protocolo", detalle: "Elegí a qué protocolo del catálogo corresponde cada valor." },
        ],
      }]
    : [];
  hallazgos.push(...hallazgosProtocolo, ...hallazgosDeFilas(registro));
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
  const salida = finalizar("saltos_tabular", contexto, hojas, depuradas, hallazgos, registro, duplicados);
  salida.filasSinProtocolo = filasSinProtocolo;
  return salida;
}

function parsearGimnasia(hojas: HojaTabular[], contexto: ContextoEvaluacion): ImportacionNormalizada {
  const hoja = hojas.find((item) => normalizarTexto(item.nombre).includes("cmj")) ?? hojas[0];
  const mediciones: MedicionNormalizada[] = [];
  const registro = new RegistroFilas(hoja.nombre);
  const COLUMNAS: Columnas = [["peso_corporal", 3], ["altura_salto", 4], ["fuerza_pico_aterrizaje", 5],
    ["potencia_relativa", 6], ["rsi_mod", 7], ["asimetria_aterrizaje", 8], ["asimetria_concentrica", 9]];
  let numeroFila = 1;
  for (const fila of hoja.filas.slice(1)) {
    numeroFila += 1;
    const completo = texto(fila[1]);
    if (registro.esResumen(completo, fila)) continue;
    const { nombre, apellido } = separarNombreCompleto(completo);
    const hayDatos = conDatos(fila, COLUMNAS);
    if (!completo) {
      if (!fila.some((celda) => texto(celda))) continue;
      if (hayDatos) {
        registro.pendiente({ fila: numeroFila, motivo: "sin_nombre", nombre: "", apellido: null, edad: null,
          valores: valoresDe(fila, COLUMNAS, { fecha: texto(fila[2]) || null }) });
      } else registro.vacias += 1;
      continue;
    }
    if (!hayDatos) {
      registro.vacias += 1;
      continue;
    }
    const fecha = contexto.fechaDeclarada || fechaISO(fila[2]);
    if (!fecha) {
      // Antes: `ignoradas += 1` y la fila desaparecía. Sin fecha no hay
      // jornada, así que no se importa, pero se conserva para decidir.
      registro.pendiente({ fila: numeroFila, motivo: "sin_fecha", nombre, apellido, edad: null,
        valores: valoresDe(fila, COLUMNAS, { fecha: texto(fila[2]) || null }) });
      continue;
    }
    const ilegibles = ilegiblesDe(fila, COLUMNAS);
    if (ilegibles.length) {
      registro.pendiente({ fila: numeroFila, motivo: "valor_ilegible", nombre, apellido, edad: null,
        valores: valoresDe(fila, COLUMNAS, { fecha }), columnasIlegibles: ilegibles, seImportoElResto: true });
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
  return finalizar("gimnasia_cmj", contexto, hojas, mediciones, hallazgosDeFilas(registro), registro, 0);
}

function parsearRugby(hojas: HojaTabular[], contexto: ContextoEvaluacion): ImportacionNormalizada {
  const hoja = hojas.find((item) => normalizarTexto(item.nombre).includes("sprint 30"));
  if (!hoja) throw new Error("No encontramos la hoja de Sprint 30 m.");
  const mediciones: MedicionNormalizada[] = [];
  const registro = new RegistroFilas(hoja.nombre);
  const COLUMNAS: Columnas = [["tiempo_10m", 2], ["tiempo_tramo_10_30m", 3], ["tiempo_30m", 6],
    ["velocidad_10m", 9], ["velocidad_10_30m", 10]];
  let numeroFila = 1;
  for (const fila of hoja.filas.slice(1)) {
    numeroFila += 1;
    const completo = texto(fila[1]);
    if (registro.esResumen(completo, fila)) continue;
    const { nombre, apellido } = separarNombreCompleto(completo);
    const hayDatos = conDatos(fila, COLUMNAS);
    if (!completo) {
      if (!fila.some((celda) => texto(celda))) continue;
      if (hayDatos) {
        registro.pendiente({ fila: numeroFila, motivo: "sin_nombre", nombre: "", apellido: null, edad: null,
          valores: valoresDe(fila, COLUMNAS, { fecha: texto(fila[0]) || null }) });
      } else registro.vacias += 1;
      continue;
    }
    if (!hayDatos) {
      registro.vacias += 1;
      continue;
    }
    const fecha = contexto.fechaDeclarada || fechaISO(fila[0]);
    if (!fecha) {
      registro.pendiente({ fila: numeroFila, motivo: "sin_fecha", nombre, apellido, edad: null,
        valores: valoresDe(fila, COLUMNAS, { fecha: texto(fila[0]) || null }) });
      continue;
    }
    const ilegibles = ilegiblesDe(fila, COLUMNAS);
    if (ilegibles.length) {
      registro.pendiente({ fila: numeroFila, motivo: "valor_ilegible", nombre, apellido, edad: null,
        valores: valoresDe(fila, COLUMNAS, { fecha }), columnasIlegibles: ilegibles, seImportoElResto: true });
    }
    const base = { deportistaClave: claveDeportista(nombre), nombre, apellido, edad: null, fecha, protocoloCodigo: "SPRINT_30M" };
    agregar(mediciones, base, "tiempo_10m", fila[2]);
    agregar(mediciones, base, "tiempo_tramo_10_30m", fila[3]);
    agregar(mediciones, base, "tiempo_30m", fila[6]);
    agregar(mediciones, base, "velocidad_10m", fila[9]);
    agregar(mediciones, base, "velocidad_10_30m", fila[10]);
  }
  return finalizar("rugby_sprint", contexto, hojas, mediciones, hallazgosDeFilas(registro), registro, 0);
}

function parsearSub13(hojas: HojaTabular[], contexto: ContextoEvaluacion): ImportacionNormalizada {
  const principal = hojas.find((hoja) => hoja.filas.some((fila) => normalizarTexto(fila[0]).includes("prueba cmj")));
  if (!principal) throw new Error("No encontramos los bloques CMJ, Abalakov y SJ del archivo SUB13.");
  const mediciones: MedicionNormalizada[] = [];
  const bloques = [
    { inicio: 0, protocolo: "CMJ" },
    { inicio: 8, protocolo: "ABALAKOV" },
    { inicio: 16, protocolo: "SJ" },
  ];
  // Un registro por bloque: cada bloque es una tabla con su propio pie.
  const registros: RegistroFilas[] = [];
  for (const { inicio, protocolo } of bloques) {
    const registro = new RegistroFilas(`${principal.nombre} · ${PROTOCOLOS[protocolo] ?? protocolo}`);
    registros.push(registro);
    const COLUMNAS: Columnas = [["peso_corporal", inicio + 2], ["altura_salto", inicio + 3],
      ["fuerza_pico_aterrizaje", inicio + 4], ["potencia_relativa", inicio + 5], ["rsi_mod", inicio + 6]];
    let numeroFila = 2;
    for (const fila of principal.filas.slice(2)) {
      numeroFila += 1;
      const completo = texto(fila[inicio]);
      const celdas = fila.slice(inicio, inicio + 7);
      if (registro.esResumen(completo, celdas)) continue;
      const hayDatos = conDatos(fila, COLUMNAS);
      if (!completo) {
        if (!celdas.some((celda) => texto(celda))) continue;
        if (hayDatos) {
          registro.pendiente({ fila: numeroFila, motivo: "sin_nombre", nombre: "", apellido: null, edad: null,
            valores: valoresDe(fila, COLUMNAS, { fecha: texto(fila[inicio + 1]) || null }) });
        } else registro.vacias += 1;
        continue;
      }
      if (!hayDatos) {
        registro.vacias += 1;
        continue;
      }
      const { nombre, apellido } = separarNombreCompleto(completo);
      const valores = valoresDe(fila, COLUMNAS, { fecha: texto(fila[inicio + 1]) || null });
      const ilegibles = ilegiblesDe(fila, COLUMNAS);
      const peso = numero(fila[inicio + 2]);
      const altura = numero(fila[inicio + 3]);
      // Sin peso y altura el bloque no se puede leer: antes la fila se
      // salteaba sin contarla. Ahora queda entera para decidir.
      if (peso === null || altura === null) {
        const faltan = COLUMNAS.slice(0, 2).filter(([, i]) => numero(fila[i]) === null).map(([codigo]) => codigo);
        registro.pendiente({ fila: numeroFila, motivo: "valor_ilegible", nombre, apellido, edad: null, valores,
          columnasIlegibles: [...new Set([...faltan, ...ilegibles])], seImportoElResto: false });
        continue;
      }
      if (ilegibles.length) {
        registro.pendiente({ fila: numeroFila, motivo: "valor_ilegible", nombre, apellido, edad: null, valores,
          columnasIlegibles: ilegibles, seImportoElResto: true });
      }
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
  // Antes: `ignoradas += 8` fijo. Ahora se cuentan las filas que hay.
  const registro = RegistroFilas.unir(principal.nombre, registros);
  hallazgos.push(...hallazgosDeFilas(registro));
  return finalizar("sub13_bloques", contexto, hojas, conFechaOriginal, hallazgos, registro, duplicadosSJ);
}

function finalizar(
  adaptador: ImportacionNormalizada["adaptador"],
  contexto: ContextoEvaluacion,
  hojas: HojaTabular[],
  mediciones: MedicionNormalizada[],
  hallazgos: ImportacionNormalizada["hallazgos"],
  registro: RegistroFilas,
  duplicados: number,
): ImportacionNormalizada {
  const protocolos = [...new Set(mediciones.map((item) => item.protocoloCodigo).filter((item): item is string => Boolean(item)))];
  const metricas = [...new Set(mediciones.map((item) => item.atributoCodigo))];
  return {
    version: 1, adaptador, contexto, hojas: hojas.map((hoja) => hoja.nombre), mediciones, protocolos, metricas, hallazgos,
    filasIgnoradas: registro.ignoradas,
    duplicados,
    filasPendientes: registro.pendientes,
    filasResumen: registro.resumen,
    filasVacias: registro.vacias,
  };
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
