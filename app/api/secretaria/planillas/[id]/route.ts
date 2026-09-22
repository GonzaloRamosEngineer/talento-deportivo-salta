import { respuestaError, sesionSecretaria } from "@/lib/evaluaciones/backend";

interface ResultadoPlanilla {
  deportistaId: string | null;
  deportistaClave: string | null;
  nombre: string;
  apellido: string | null;
  fecha: string | null;
  protocoloCodigo: string | null;
  protocoloNombre: string | null;
  atributoCodigo: string;
  atributoNombre: string;
  unidad: string | null;
  valor: number;
  intento: number;
}

interface MedicionPreview {
  deportistaClave?: string;
  nombre?: string;
  apellido?: string | null;
  fecha?: string | null;
  protocoloCodigo?: string | null;
  atributoCodigo?: string;
  valor?: number;
  intento?: number;
}

function uno<T>(valor: T | T[] | null): T | null {
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

async function medicionesImportadas(
  supabase: Awaited<ReturnType<typeof sesionSecretaria>>["supabase"],
  loteId: string,
  clubId: string,
): Promise<ResultadoPlanilla[]> {
  const resultados: ResultadoPlanilla[] = [];
  const pagina = 1000;
  for (let desde = 0; ; desde += pagina) {
    const { data, error } = await supabase
      .from("medicion")
      .select("fecha, valor, intento, deportista:deportista_id(id, nombre, apellido), atributo:atributo_id(codigo, nombre, unidad), protocolo:protocolo_id(codigo, nombre)")
      .eq("lote_importacion_id", loteId)
      .eq("club_id", clubId)
      .order("deportista_id")
      .order("protocolo_id")
      .order("atributo_id")
      .order("intento")
      .range(desde, desde + pagina - 1);
    if (error) throw error;
    for (const medicion of data ?? []) {
      const deportista = uno(medicion.deportista);
      const atributo = uno(medicion.atributo);
      const protocolo = uno(medicion.protocolo);
      if (!deportista || !atributo) continue;
      resultados.push({
        deportistaId: deportista.id,
        deportistaClave: null,
        nombre: deportista.nombre,
        apellido: deportista.apellido,
        fecha: medicion.fecha,
        protocoloCodigo: protocolo?.codigo ?? null,
        protocoloNombre: protocolo?.nombre ?? null,
        atributoCodigo: atributo.codigo,
        atributoNombre: atributo.nombre,
        unidad: atributo.unidad,
        valor: Number(medicion.valor),
        intento: medicion.intento,
      });
    }
    if ((data?.length ?? 0) < pagina) break;
  }
  return resultados;
}

async function medicionesPrevisualizadas(
  supabase: Awaited<ReturnType<typeof sesionSecretaria>>["supabase"],
  loteId: string,
  clubId: string,
): Promise<ResultadoPlanilla[]> {
  const { data: lote, error } = await supabase
    .from("lote_importacion")
    .select("preview_json")
    .eq("id", loteId)
    .eq("club_id", clubId)
    .maybeSingle();
  if (error) throw error;
  const preview = lote?.preview_json as { mediciones?: MedicionPreview[] } | null;
  const mediciones = Array.isArray(preview?.mediciones) ? preview.mediciones : [];
  if (!mediciones.length) return [];

  const codigosAtributo = [...new Set(mediciones.map((fila) => fila.atributoCodigo).filter((codigo): codigo is string => Boolean(codigo)))];
  const codigosProtocolo = [...new Set(mediciones.map((fila) => fila.protocoloCodigo).filter((codigo): codigo is string => Boolean(codigo)))];
  const [atributos, protocolos] = await Promise.all([
    codigosAtributo.length
      ? supabase.from("atributo").select("codigo, nombre, unidad").in("codigo", codigosAtributo)
      : Promise.resolve({ data: [], error: null }),
    codigosProtocolo.length
      ? supabase.from("protocolo").select("codigo, nombre").in("codigo", codigosProtocolo)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (atributos.error) throw atributos.error;
  if (protocolos.error) throw protocolos.error;
  const atributoPorCodigo = new Map((atributos.data ?? []).map((atributo) => [atributo.codigo, atributo]));
  const protocoloPorCodigo = new Map((protocolos.data ?? []).map((protocolo) => [protocolo.codigo, protocolo]));

  return mediciones.flatMap((medicion) => {
    if (!medicion.atributoCodigo || typeof medicion.valor !== "number") return [];
    const atributo = atributoPorCodigo.get(medicion.atributoCodigo);
    const protocolo = medicion.protocoloCodigo ? protocoloPorCodigo.get(medicion.protocoloCodigo) : null;
    return [{
      deportistaId: null,
      deportistaClave: medicion.deportistaClave ?? null,
      nombre: medicion.nombre?.trim() || "Deportista sin identificar",
      apellido: medicion.apellido?.trim() || null,
      fecha: medicion.fecha ?? null,
      protocoloCodigo: medicion.protocoloCodigo ?? null,
      protocoloNombre: protocolo?.nombre ?? medicion.protocoloCodigo ?? null,
      atributoCodigo: medicion.atributoCodigo,
      atributoNombre: atributo?.nombre ?? medicion.atributoCodigo.replaceAll("_", " "),
      unidad: atributo?.unidad ?? null,
      valor: medicion.valor,
      intento: medicion.intento ?? 1,
    }];
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, membresia } = await sesionSecretaria();
    const { data, error } = await supabase.rpc("detalle_lote_importacion", {
      p_lote_id: id,
    });
    if (error) throw error;
    const detalle = (data ?? {}) as Record<string, unknown>;
    const metricas = Array.isArray(detalle.metricas) ? detalle.metricas : [];
    const codigos = metricas.filter((metrica): metrica is string => typeof metrica === "string");
    if (codigos.length > 0) {
      const { data: atributos, error: errorAtributos } = await supabase
        .from("atributo")
        .select("codigo, nombre, unidad")
        .in("codigo", codigos);
      if (errorAtributos) throw errorAtributos;
      const porCodigo = new Map((atributos ?? []).map((atributo) => [atributo.codigo, atributo]));
      detalle.metricas = metricas.map((metrica) => {
        if (typeof metrica !== "string") return metrica;
        const atributo = porCodigo.get(metrica);
        return {
          codigo: metrica,
          nombre: atributo?.nombre ?? metrica.replaceAll("_", " "),
          unidad: atributo?.unidad ?? null,
          cantidad: null,
        };
      });
    }
    detalle.resultados = detalle.estado === "importado"
      ? await medicionesImportadas(supabase, id, membresia.club_id)
      : await medicionesPrevisualizadas(supabase, id, membresia.club_id);
    return Response.json(detalle);
  } catch (error) {
    return respuestaError(error);
  }
}
