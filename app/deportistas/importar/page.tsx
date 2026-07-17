"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ClipboardPaste,
  FileSpreadsheet,
  Layers,
  Loader2,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { crearClienteBrowser } from "@/lib/supabase/client";
import { useClub } from "@/lib/use-club";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { EstadoVacio } from "@/components/estado-vacio";
import { Ayuda } from "@/components/ayuda";
import type { CategoriaDB } from "@/lib/tipos-db";
import { cn } from "@/lib/utils";

import { CargandoPelota } from "@/components/cargando-pelota";

// Import de plantel desde la planilla que el club YA tiene (el "día 1
// en el club"): se pega directo desde Excel (el portapapeles de Excel
// es texto separado por tabs) o se sube el CSV. Todo se procesa en el
// navegador; recién al confirmar se insertan deportistas + tutores por
// lotes vía RLS (el profe solo puede importar a SUS categorías).
// Regla del piloto: el consentimiento NUNCA se asume desde una
// planilla — todos quedan PENDIENTES, visibles en cada ficha.

const MAX_FILAS = 300;

type Campo =
  | "nombre"
  | "apellido"
  | "apellidoNombre"
  | "nacimiento"
  | "ingreso"
  | "categoria"
  | "doc"
  | "sexo"
  | "tutorNombre"
  | "tutorTelefono"
  | "tutorEmail"
  | "ignorar";

const CAMPO_LABEL: Record<Campo, string> = {
  nombre: "Nombre",
  apellido: "Apellido",
  apellidoNombre: "Apellido y nombre (junto)",
  nacimiento: "Fecha de nacimiento",
  ingreso: "Ingreso al club",
  categoria: "Categoría",
  doc: "Identificador interno",
  sexo: "Sexo",
  tutorNombre: "Tutor: nombre",
  tutorTelefono: "Tutor: teléfono",
  tutorEmail: "Tutor: email",
  ignorar: "No importar",
};

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// ¿Qué campo es este encabezado de la planilla? (null = ni idea)
function campoDeEncabezado(h: string): Campo | null {
  const n = normalizar(h);
  if (!n) return null;
  if (/(apellido.*nombre|nombre.*apellido|nombre completo|jugador|deportista|alumno)/.test(n))
    return "apellidoNombre";
  if (/^apellidos?$/.test(n)) return "apellido";
  if (/^nombres?$/.test(n)) return "nombre";
  if (/ingres|alta|antig|desde/.test(n)) return "ingreso";
  if (/nac|fecha/.test(n)) return "nacimiento";
  if (/categor|divisi|^cat\.?$/.test(n)) return "categoria";
  if (/tutor|responsable|madre|padre|familia/.test(n)) {
    if (/tel|cel|whats|contacto/.test(n)) return "tutorTelefono";
    if (/mail|correo/.test(n)) return "tutorEmail";
    return "tutorNombre";
  }
  if (/tel|cel|whats/.test(n)) return "tutorTelefono";
  if (/mail|correo/.test(n)) return "tutorEmail";
  if (/doc|carnet|legajo|socio|ficha/.test(n)) return "doc";
  if (/^sexo|genero/.test(n)) return "sexo";
  return null;
}

// "05/03/2014", "5-3-14", "2014-03-05" → ISO local; null = no es fecha
function parseFecha(texto: string): string | null {
  const t = texto.trim();
  if (!t) return null;
  let anio: number, mes: number, dia: number;
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const arg = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (iso) {
    [anio, mes, dia] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (arg) {
    [dia, mes, anio] = [Number(arg[1]), Number(arg[2]), Number(arg[3])];
    if (anio < 100) {
      // "14" → 2014; los años de nacimiento de un plantel nunca son futuros
      const sigloActual = Math.floor(new Date().getFullYear() / 100) * 100;
      anio += anio + sigloActual > new Date().getFullYear() ? sigloActual - 100 : sigloActual;
    }
    // Planilla en formato yanqui (3/25/2014): se nota porque el "mes" no da
    if (mes > 12 && dia <= 12) [dia, mes] = [mes, dia];
  } else {
    return null;
  }
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  if (anio < 1940 || anio > new Date().getFullYear()) return null;
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function parseSexo(texto: string): "M" | "F" | "X" | null {
  const n = normalizar(texto);
  if (!n) return null;
  if (/^(m|masc|masculino|varon|v|h|hombre)/.test(n)) return "M";
  if (/^(f|fem|femenino|mujer|nena)/.test(n)) return "F";
  if (n === "x") return "X";
  return null;
}

// Texto pegado o CSV → matriz de celdas. Detecta el separador en la
// primera línea (tab = pegado desde Excel; ; = CSV argentino; , = CSV)
// y respeta comillas dobles del CSV.
function parsearTabla(texto: string): string[][] {
  const primeraLinea = texto.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const candidatos: [string, number][] = [
    ["\t", (primeraLinea.match(/\t/g) ?? []).length],
    [";", (primeraLinea.match(/;/g) ?? []).length],
    [",", (primeraLinea.match(/,/g) ?? []).length],
  ];
  const sep = (candidatos.find(([, n]) => n > 0) ?? [","])[0] as string;

  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let entreComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"' && texto[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (c === '"') {
        entreComillas = false;
      } else {
        celda += c;
      }
    } else if (c === '"' && celda === "") {
      entreComillas = true;
    } else if (c === sep) {
      fila.push(celda);
      celda = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(celda);
      celda = "";
      if (fila.some((x) => x.trim())) filas.push(fila);
      fila = [];
    } else {
      celda += c;
    }
  }
  fila.push(celda);
  if (fila.some((x) => x.trim())) filas.push(fila);
  return filas.map((f) => f.map((x) => x.trim()));
}

interface FilaPreview {
  indice: number;
  nombre: string;
  apellido: string;
  fechaNacimiento: string | null;
  fechaIngreso: string | null;
  sexo: "M" | "F" | "X" | null;
  doc: string;
  categoria: CategoriaDB | null;
  tutorNombre: string;
  tutorTelefono: string;
  tutorEmail: string;
  /** motivo por el que NO se puede importar (null = importable) */
  problema: string | null;
  /** ya hay un deportista activo con ese nombre en el club */
  duplicado: boolean;
}

const inputClase =
  "h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

export default function ImportarPlantelPage() {
  const sesion = useClub();
  const [categorias, setCategorias] = useState<CategoriaDB[] | null>(null);
  const [existentes, setExistentes] = useState<Set<string>>(new Set());
  const [texto, setTexto] = useState("");
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  // Mapeo columna → campo. Se autocompleta al pegar; el usuario corrige.
  const [mapeo, setMapeo] = useState<Campo[]>([]);
  const [categoriaDefecto, setCategoriaDefecto] = useState("");
  // Overrides manuales de inclusión (los duplicados arrancan excluidos)
  const [inclusion, setInclusion] = useState<Record<number, boolean>>({});
  const [importando, setImportando] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<{ cargados: number; conTutor: number } | null>(
    null,
  );

  const clubId = sesion.membresia?.clubId ?? null;
  const puedeOperar =
    sesion.membresia?.rol === "admin_club" || sesion.membresia?.rol === "entrenador";

  useEffect(() => {
    if (!clubId) return;
    let cancelado = false;
    const supabase = crearClienteBrowser();
    async function cargar() {
      const [rCat, rDep] = await Promise.all([
        supabase
          .from("categoria")
          .select("id, nombre, tipo, anio_nacimiento, disciplina_id")
          .eq("club_id", clubId!),
        supabase.from("deportista").select("nombre, apellido").eq("activo", true),
      ]);
      if (cancelado) return;
      if (rCat.error || rDep.error) {
        setError(
          `No pudimos cargar los datos del club: ${(rCat.error ?? rDep.error)!.message}`,
        );
        setCategorias([]);
        return;
      }
      setCategorias((rCat.data as CategoriaDB[]) ?? []);
      setExistentes(
        new Set(
          (rDep.data ?? []).map((d) => normalizar(`${d.nombre} ${d.apellido ?? ""}`)),
        ),
      );
    }
    void cargar();
    return () => {
      cancelado = true;
    };
  }, [clubId]);

  // El profe solo importa a sus categorías asignadas
  const opciones = useMemo(() => {
    const visibles = sesion.categoriasAsignadas
      ? (categorias ?? []).filter((c) => sesion.categoriasAsignadas!.includes(c.id))
      : (categorias ?? []);
    return [...visibles].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [categorias, sesion.categoriasAsignadas]);

  const categoriasPorNombre = useMemo(() => {
    const m = new Map<string, CategoriaDB>();
    for (const c of opciones) m.set(normalizar(c.nombre), c);
    return m;
  }, [opciones]);

  const tabla = useMemo(() => (texto.trim() ? parsearTabla(texto) : []), [texto]);

  // ¿La primera fila son encabezados? (mapea a algún campo y no trae fechas)
  const tieneEncabezado = useMemo(() => {
    const primera = tabla[0];
    if (!primera) return false;
    return (
      primera.some((c) => campoDeEncabezado(c) !== null) &&
      !primera.some((c) => parseFecha(c) !== null)
    );
  }, [tabla]);

  const filasDatos = useMemo(
    () => (tieneEncabezado ? tabla.slice(1) : tabla),
    [tabla, tieneEncabezado],
  );
  const columnas = tabla[0]?.length ?? 0;

  const resolverCategoria = (celda: string): CategoriaDB | null => {
    const n = normalizar(celda);
    if (!n) return null;
    const porNombre = categoriasPorNombre.get(n);
    if (porNombre) return porNombre;
    const anio = n.match(/(19|20)\d{2}/)?.[0];
    if (anio) return opciones.find((c) => c.anio_nacimiento === Number(anio)) ?? null;
    return null;
  };

  // Al cambiar la planilla, proponer un mapeo: por encabezados si los
  // hay; si no, adivinar por el contenido (fechas, categorías, nombres).
  const alCargarTexto = (nuevo: string, archivo: string | null) => {
    setTexto(nuevo);
    setNombreArchivo(archivo);
    setInclusion({});
    setError("");
    const t = nuevo.trim() ? parsearTabla(nuevo) : [];
    if (!t.length) {
      setMapeo([]);
      return;
    }
    const nCols = t[0].length;
    const encabezado =
      t[0].some((c) => campoDeEncabezado(c) !== null) &&
      !t[0].some((c) => parseFecha(c) !== null);
    const datos = encabezado ? t.slice(1) : t;
    const propuesta: Campo[] = Array.from({ length: nCols }, () => "ignorar");

    if (encabezado) {
      const usados = new Set<Campo>();
      t[0].forEach((h, i) => {
        const campo = campoDeEncabezado(h);
        if (campo && !usados.has(campo)) {
          propuesta[i] = campo;
          usados.add(campo);
        }
      });
    } else {
      // Sin encabezado: fechas → nacimiento; categorías conocidas →
      // categoría; la primera columna de texto → nombre (o "apellido y
      // nombre" si viene con coma) y la siguiente → apellido.
      const muestra = datos.slice(0, 20);
      const mayoria = (i: number, pred: (c: string) => boolean) => {
        const llenas = muestra.map((f) => f[i] ?? "").filter((c) => c.trim());
        return llenas.length > 0 && llenas.filter(pred).length / llenas.length >= 0.6;
      };
      let nombreListo = false;
      let apellidoListo = false;
      for (let i = 0; i < nCols; i++) {
        if (mayoria(i, (c) => parseFecha(c) !== null)) propuesta[i] = "nacimiento";
        else if (mayoria(i, (c) => resolverCategoria(c) !== null)) propuesta[i] = "categoria";
        else if (mayoria(i, (c) => parseSexo(c) !== null && c.trim().length <= 10))
          propuesta[i] = "sexo";
        else if (!nombreListo && mayoria(i, (c) => /[a-záéíóúñ]/i.test(c))) {
          propuesta[i] = mayoria(i, (c) => c.includes(",")) ? "apellidoNombre" : "nombre";
          nombreListo = true;
          if (propuesta[i] === "apellidoNombre") apellidoListo = true;
        } else if (
          nombreListo &&
          !apellidoListo &&
          mayoria(i, (c) => /[a-záéíóúñ]/i.test(c))
        ) {
          propuesta[i] = "apellido";
          apellidoListo = true;
        }
      }
      // Solo nacimiento/categoría detectados y una sola columna de texto:
      // que al menos haya nombre para que la preview muestre el problema.
    }
    setMapeo(propuesta);
  };

  const leerArchivo = (archivo: File) => {
    const lector = new FileReader();
    lector.onload = () => {
      const buffer = lector.result as ArrayBuffer;
      // Los CSV que exporta el Excel argentino suelen venir en
      // windows-1252: si el UTF-8 estricto falla, caemos ahí (ñ/á sanas).
      let contenido: string;
      try {
        contenido = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      } catch {
        contenido = new TextDecoder("windows-1252").decode(buffer);
      }
      alCargarTexto(contenido, archivo.name);
    };
    lector.readAsArrayBuffer(archivo);
  };

  const idx = (campo: Campo) => mapeo.indexOf(campo);
  const celdaDe = (fila: string[], campo: Campo) => {
    const i = idx(campo);
    return i >= 0 ? (fila[i] ?? "").trim() : "";
  };

  const preview: FilaPreview[] = useMemo(() => {
    if (!filasDatos.length || !mapeo.length) return [];
    const defecto = opciones.find((c) => c.id === categoriaDefecto) ?? null;
    return filasDatos.slice(0, MAX_FILAS).map((fila, indice) => {
      let nombre = celdaDe(fila, "nombre");
      let apellido = celdaDe(fila, "apellido");
      const junto = celdaDe(fila, "apellidoNombre");
      if (junto && !nombre) {
        if (junto.includes(",")) {
          const [ap, nom] = junto.split(",");
          apellido = ap.trim();
          nombre = nom?.trim() ?? "";
        } else {
          // Sin coma no se adivina qué parte es el apellido: va todo a
          // nombre y se corrige después desde la ficha si hace falta.
          nombre = junto;
        }
      }
      const celdaFecha = celdaDe(fila, "nacimiento");
      const fechaNacimiento = parseFecha(celdaFecha);
      const celdaCategoria = celdaDe(fila, "categoria");
      const porCohorte = fechaNacimiento
        ? (opciones.find(
            (c) => c.anio_nacimiento === Number(fechaNacimiento.slice(0, 4)),
          ) ?? null)
        : null;
      const categoria = celdaCategoria
        ? resolverCategoria(celdaCategoria)
        : (porCohorte ?? defecto);

      const problema = !nombre
        ? "Sin nombre"
        : !categoria
          ? celdaCategoria
            ? `No hay una categoría "${celdaCategoria}"`
            : "Sin categoría (elegí una por defecto abajo)"
          : celdaFecha && !fechaNacimiento
            ? `No se entiende la fecha "${celdaFecha}"`
            : null;

      return {
        indice,
        nombre,
        apellido,
        fechaNacimiento,
        fechaIngreso: parseFecha(celdaDe(fila, "ingreso")),
        sexo: parseSexo(celdaDe(fila, "sexo")),
        doc: celdaDe(fila, "doc"),
        categoria,
        tutorNombre: celdaDe(fila, "tutorNombre"),
        tutorTelefono: celdaDe(fila, "tutorTelefono"),
        tutorEmail: celdaDe(fila, "tutorEmail"),
        problema,
        duplicado: existentes.has(normalizar(`${nombre} ${apellido}`)),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filasDatos, mapeo, categoriaDefecto, opciones, existentes, categoriasPorNombre]);

  const incluida = (f: FilaPreview) =>
    !f.problema && (inclusion[f.indice] ?? !f.duplicado);
  const aImportar = preview.filter(incluida);
  const conProblema = preview.filter((f) => f.problema).length;
  const recortadas = filasDatos.length - preview.length;

  const importar = async () => {
    if (!clubId || !aImportar.length) return;
    setImportando(true);
    setError("");
    const supabase = crearClienteBrowser();
    let cargados = 0;
    let conTutor = 0;

    // Lotes chicos: si algo falla a mitad de camino, se informa cuántos
    // entraron y los ya cargados quedan marcados como duplicados para
    // que un reintento no los duplique.
    const LOTE = 50;
    for (let desde = 0; desde < aImportar.length; desde += LOTE) {
      const lote = aImportar.slice(desde, desde + LOTE);
      const { data: deps, error: eDep } = await supabase
        .from("deportista")
        .insert(
          lote.map((f) => ({
            club_id: clubId,
            categoria_id: f.categoria!.id,
            nombre: f.nombre,
            apellido: f.apellido || null,
            fecha_nacimiento: f.fechaNacimiento,
            sexo: f.sexo,
            doc_interno: f.doc || null,
          })),
        )
        .select("id");
      if (eDep || !deps) {
        setError(
          `Se cargaron ${cargados} de ${aImportar.length} y ahí falló: ${eDep?.message ?? "error desconocido"}. Los que entraron ya figuran en Deportistas; si reintentás, van a aparecer como duplicados.`,
        );
        break;
      }
      const tutores = lote.flatMap((f, i) =>
        f.tutorNombre || f.tutorTelefono || f.tutorEmail
          ? [
              {
                deportista_id: deps[i].id as string,
                nombre: f.tutorNombre || "Tutor/a (completar)",
                telefono: f.tutorTelefono || null,
                email: f.tutorEmail || null,
              },
            ]
          : [],
      );
      if (tutores.length) {
        const { error: eTut } = await supabase.from("tutor").insert(tutores);
        if (!eTut) conTutor += tutores.length;
        // Si el tutor falla, el deportista igual quedó: se completa
        // desde la ficha. No frena la importación.
      }
      // Trayectoria: hito de ingreso SOLO para filas que traen la
      // fecha en la planilla — si no viene, no se inventa (se puede
      // cargar después desde la ficha). Falla no frena el import.
      const ingresos = lote.flatMap((f, i) =>
        f.fechaIngreso
          ? [
              {
                deportista_id: deps[i].id as string,
                tipo: "ingreso",
                fecha: f.fechaIngreso,
                registrado_por: sesion.membresia?.id ?? null,
              },
            ]
          : [],
      );
      if (ingresos.length) {
        await supabase.from("deportista_hito").insert(ingresos);
      }
      cargados += lote.length;
      setExistentes((prev) => {
        const s = new Set(prev);
        for (const f of lote) s.add(normalizar(`${f.nombre} ${f.apellido}`));
        return s;
      });
    }

    setImportando(false);
    if (cargados > 0) setResultado({ cargados, conTutor });
  };

  /* ---------- gates (mismos que /deportistas/nuevo) ---------- */

  if (sesion.cargando || (puedeOperar && categorias === null)) {
    return (
      <CargandoPelota />
    );
  }

  if (!sesion.usuario || !puedeOperar) {
    return (
      <AvisoAcceso
        titulo="Solo para el staff que opera"
        detalle="Importar el plantel es tarea del profe (en sus categorías) o del admin del club."
        accionHref={sesion.usuario ? "/deportistas" : "/login"}
        accionLabel={sesion.usuario ? "Volver a deportistas" : "Ingresar"}
      />
    );
  }

  if (opciones.length === 0) {
    const esAdmin = sesion.membresia?.rol === "admin_club";
    return (
      <div className="space-y-6">
        <Encabezado />
        {esAdmin ? (
          <EstadoVacio
            icono={Layers}
            titulo="Primero armá las categorías del club"
            detalle="Cada fila de la planilla se importa dentro de una categoría (su cohorte de nacimiento). Hay una estructura estándar lista para generar en un toque."
            accion={{ href: "/club/categorias", label: "Crear categorías" }}
          />
        ) : (
          <EstadoVacio
            icono={Layers}
            titulo="Todavía no tenés categorías asignadas"
            detalle="El admin del club te asigna tus categorías desde la pantalla de Staff. Cuando lo haga, vas a poder importar tu plantel desde acá."
            nota="Si ya debería estar, avisale al admin del club."
          />
        )}
      </div>
    );
  }

  if (resultado) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <CheckCircle2 className="size-14 text-success" aria-hidden />
        <div>
          <h1 className="text-xl font-extrabold">
            {resultado.cargados} deportista{resultado.cargados === 1 ? "" : "s"} dados de
            alta
          </h1>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Ya aparecen en el plantel, cada uno en su categoría
            {resultado.conTutor > 0 &&
              `, ${resultado.conTutor} con los datos del tutor cargados`}
            .
          </p>
        </div>
        <div className="mx-auto flex max-w-sm items-start gap-2.5 rounded-xl bg-warning-soft p-3.5 text-left text-sm text-warning">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="font-semibold">
            Todos quedaron con el consentimiento del tutor PENDIENTE.{" "}
            <span className="font-normal">
              Cuando tengas cada formulario firmado, registralo desde la ficha del
              deportista.
            </span>
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              setResultado(null);
              alCargarTexto("", null);
            }}
            className="h-11 rounded-xl border border-border bg-card px-5 text-sm font-bold"
          >
            Importar otra planilla
          </button>
          <Link
            href="/deportistas"
            className="flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground"
          >
            Ver el plantel
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Encabezado />

      <Ayuda
        bullets={[
          "Abrí la planilla del club en Excel o Google Sheets, seleccioná las columnas del plantel (con los títulos) y pegalas acá tal cual: no hace falta ordenarla antes.",
          "Abajo vas a ver cómo quedó entendida cada columna y cada fila ANTES de confirmar: nada se guarda hasta que toques Importar.",
          "El consentimiento del tutor nunca se importa de una planilla: queda pendiente y se registra desde cada ficha con el papel firmado.",
        ]}
      />

      {/* Paso 1: traer la planilla */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
          1 · La planilla
        </p>
        <div className="mt-3 space-y-3">
          <label
            htmlFor="imp-texto"
            className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground"
          >
            <ClipboardPaste className="size-3.5" aria-hidden />
            Pegá las celdas copiadas desde Excel / Google Sheets
          </label>
          <textarea
            id="imp-texto"
            value={texto}
            onChange={(e) => alCargarTexto(e.target.value, null)}
            rows={5}
            placeholder={
              "Apellido\tNombre\tNacimiento\nGuaymás\tThiago\t05/03/2014\nCardozo\tBenicio\t22/08/2014"
            }
            className="w-full rounded-xl border border-input bg-background p-3 font-mono text-xs outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>o si tenés el archivo:</span>
            <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-bold text-foreground transition-colors hover:border-primary/40">
              <Upload className="size-3.5" aria-hidden />
              Subir CSV
              <input
                type="file"
                accept=".csv,.tsv,.txt"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) leerArchivo(f);
                  e.target.value = "";
                }}
              />
            </label>
            {nombreArchivo && (
              <span className="font-semibold text-foreground">{nombreArchivo}</span>
            )}
            <span className="basis-full text-[11px]">
              ¿La tenés en .xlsx? Abrila y copiá/pegá las celdas, o guardala como CSV.
            </span>
          </div>
        </div>
      </section>

      {/* Paso 2: qué es cada columna */}
      {tabla.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
            2 · Qué es cada columna
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {tieneEncabezado
              ? "Detectamos los títulos de la planilla. Corregí lo que haya quedado mal."
              : "La planilla vino sin títulos: revisá que cada columna esté bien asignada."}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: columnas }, (_, i) => {
              const ejemplo = filasDatos.find((f) => (f[i] ?? "").trim())?.[i] ?? "—";
              return (
                <div key={i} className="rounded-xl border border-border p-2.5">
                  <p className="truncate text-[11px] font-semibold text-muted-foreground">
                    {tieneEncabezado ? tabla[0][i] || `Columna ${i + 1}` : `Columna ${i + 1}`}
                    <span className="font-normal"> · ej: {ejemplo}</span>
                  </p>
                  <select
                    aria-label={`Campo de la columna ${i + 1}`}
                    value={mapeo[i] ?? "ignorar"}
                    onChange={(e) =>
                      setMapeo((m) => {
                        const nuevo = [...m];
                        // Un campo vive en UNA sola columna: si ya estaba
                        // asignado en otra, aquella pasa a "no importar".
                        const campo = e.target.value as Campo;
                        if (campo !== "ignorar") {
                          const previo = nuevo.indexOf(campo);
                          if (previo >= 0) nuevo[previo] = "ignorar";
                        }
                        nuevo[i] = campo;
                        return nuevo;
                      })
                    }
                    className="mt-1.5 h-9 w-full rounded-lg border border-input bg-background px-2 text-xs font-semibold outline-none"
                  >
                    {(Object.keys(CAMPO_LABEL) as Campo[]).map((c) => (
                      <option key={c} value={c}>
                        {CAMPO_LABEL[c]}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
          {idx("categoria") < 0 && (
            <div className="mt-3">
              <label
                htmlFor="imp-cat-defecto"
                className="mb-1.5 block text-xs font-bold text-muted-foreground"
              >
                Categoría para las filas que no la traen
                <span className="font-normal">
                  {" "}
                  (si hay fecha de nacimiento, primero se intenta por cohorte)
                </span>
              </label>
              <select
                id="imp-cat-defecto"
                value={categoriaDefecto}
                onChange={(e) => setCategoriaDefecto(e.target.value)}
                className={cn(inputClase, "sm:max-w-xs")}
              >
                <option value="">Sin categoría por defecto</option>
                {opciones.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>
      )}

      {/* Paso 3: revisar y confirmar */}
      {preview.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
              3 · Revisar antes de importar
            </p>
            <span className="text-xs font-bold text-primary tabular-nums">
              {aImportar.length} de {preview.length} filas
            </span>
          </div>
          {recortadas > 0 && (
            <p className="mt-1 text-xs font-semibold text-warning">
              La planilla trae {filasDatos.length} filas; por seguridad se importan de a{" "}
              {MAX_FILAS}. Importá y volvé a pegar el resto.
            </p>
          )}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-2" aria-label="Incluir" />
                  <th className="py-2 pr-2">Deportista</th>
                  <th className="py-2 pr-2">Nacimiento</th>
                  <th className="py-2 pr-2">Categoría</th>
                  <th className="py-2 pr-2">Tutor</th>
                  <th className="py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((f) => (
                  <tr
                    key={f.indice}
                    className={cn(
                      "border-b border-border last:border-0",
                      (f.problema || !incluida(f)) && "opacity-55",
                    )}
                  >
                    <td className="py-2 pr-2">
                      <input
                        type="checkbox"
                        aria-label={`Incluir a ${f.nombre} ${f.apellido}`}
                        checked={incluida(f)}
                        disabled={!!f.problema}
                        onChange={(e) =>
                          setInclusion((prev) => ({ ...prev, [f.indice]: e.target.checked }))
                        }
                        className="size-4 accent-[var(--primary)]"
                      />
                    </td>
                    <td className="py-2 pr-2 font-semibold">
                      {f.apellido ? `${f.apellido}, ${f.nombre}` : f.nombre || "—"}
                      {f.doc && (
                        <span className="block text-[11px] font-normal text-muted-foreground">
                          {f.doc}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-2 text-muted-foreground tabular-nums">
                      {f.fechaNacimiento ?? "—"}
                    </td>
                    <td className="py-2 pr-2">{f.categoria?.nombre ?? "—"}</td>
                    <td className="py-2 pr-2 text-muted-foreground">
                      {[f.tutorNombre, f.tutorTelefono].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="py-2 text-xs font-semibold">
                      {f.problema ? (
                        <span className="text-danger">{f.problema}</span>
                      ) : f.duplicado ? (
                        <span className="text-warning">Ya está en el plantel</span>
                      ) : (
                        <span className="text-success">Listo</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {conProblema > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Las filas con problemas no se importan: corregilas en la planilla y volvé a
              pegar, o cargalas después una a una desde{" "}
              <Link href="/deportistas/nuevo" className="font-bold text-primary">
                Nuevo deportista
              </Link>
              .
            </p>
          )}
        </section>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <p className="text-sm font-semibold text-destructive">{error}</p>
        </div>
      )}

      {preview.length > 0 && (
        <div className="sticky bottom-20 z-20 md:bottom-4">
          <button
            disabled={!aImportar.length || importando}
            onClick={() => void importar()}
            className={cn(
              "flex h-13 w-full items-center justify-center gap-2 rounded-2xl text-base font-extrabold shadow-lg transition-all",
              aImportar.length && !importando
                ? "bg-primary text-primary-foreground active:scale-[0.99]"
                : "cursor-not-allowed bg-muted text-muted-foreground shadow-none",
            )}
          >
            {importando && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {importando
              ? "Importando…"
              : aImportar.length
                ? `Importar ${aImportar.length} deportista${aImportar.length === 1 ? "" : "s"}`
                : "No hay filas listas para importar"}
          </button>
        </div>
      )}
    </div>
  );
}

function Encabezado() {
  return (
    <div>
      <Link
        href="/deportistas"
        className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3" aria-hidden /> Deportistas
      </Link>
      <h1 className="mt-2 flex items-center gap-2 text-2xl font-extrabold tracking-tight">
        <FileSpreadsheet className="size-6 text-primary" aria-hidden />
        Importar plantel
      </h1>
      <p className="text-sm text-muted-foreground">
        La lista que el club ya tiene en Excel, adentro en minutos: pegar, revisar,
        importar
      </p>
    </div>
  );
}
