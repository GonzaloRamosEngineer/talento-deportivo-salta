"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  ClipboardPlus,
  FileSignature,
  Info,
  Loader2,
  Pencil,
  Printer,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  MoveRight,
} from "lucide-react";
import type { Deportista } from "@/lib/mock-data";
import {
  edadLabel,
  formatFecha,
  getDeportista,
  nivelActual,
  sesionesDe,
} from "@/lib/mock-data";
import { useDatos, type Datos } from "@/lib/use-datos";
import { useAgenda } from "@/lib/use-agenda";
import { crearClienteBrowser } from "@/lib/supabase/client";
import { tendencia, type Estado } from "@/lib/tendencia";
import { crecimiento, zonasAceleracion } from "@/lib/crecimiento";
import { Estiron } from "@/components/estiron";
import { EstadoBadge } from "@/components/estado-badge";
import { AvatarIniciales } from "@/components/avatar-iniciales";
import { EvolutionChart } from "@/components/evolution-chart";
import { NivelBar } from "@/components/nivel-bar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePerfil } from "@/components/perfil-context";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { CompartirInforme } from "@/components/compartir-informe";
import { EstadoVacio } from "@/components/estado-vacio";
import { cn } from "@/lib/utils";

// Flecha chica de tendencia para las filas de habilidades
// (forma + título, nunca color solo).
function TrendIcon({ estado }: { estado: Estado }) {
  if (estado === "creciendo")
    return <TrendingUp className="size-4 text-success" aria-label="Creciendo" />;
  if (estado === "en_baja")
    return <TrendingDown className="size-4 text-danger" aria-label="En baja" />;
  if (estado === "amesetado")
    return <MoveRight className="size-4 text-warning" aria-label="Amesetado" />;
  return null;
}

// Carga la ficha desde la fuente que corresponda: el mock (visitante
// demo) o Supabase vía useDatos() (sesión real, ids = UUID). Si el id
// no aparece, puede ser inexistente O fuera del alcance del rol: el
// RLS no distingue y la UI tampoco debe.
export function FichaCliente({
  id,
  atributoInicial,
}: {
  id: string;
  atributoInicial?: string;
}) {
  const datos = useDatos();

  if (datos.cargando) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm font-semibold text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Cargando ficha…
      </div>
    );
  }
  if (datos.error) {
    return (
      <AvisoAcceso
        titulo="No pudimos cargar la ficha"
        detalle={datos.error}
        accionHref="/deportistas"
        accionLabel="Volver a deportistas"
      />
    );
  }

  const deportista = datos.real
    ? datos.deportistas.find((d) => d.id === id)
    : getDeportista(id);
  if (!deportista) {
    return (
      <AvisoAcceso
        titulo="Ficha no encontrada"
        detalle="Este deportista no existe o está fuera de tus categorías asignadas."
        accionHref="/deportistas"
        accionLabel="Ver tus deportistas"
      />
    );
  }
  return (
    <FichaDeportista
      deportista={deportista}
      atributoInicial={atributoInicial}
      datos={datos}
    />
  );
}

export function FichaDeportista({
  deportista,
  atributoInicial,
  datos,
}: {
  deportista: Deportista;
  atributoInicial?: string;
  datos: Datos;
}) {
  const { permisos } = usePerfil();
  // Demo: cambia estado local. Real: además insertó en `consentimiento`.
  const [consentimientoDemo, setConsentimientoDemo] = useState(false);
  const [firmando, setFirmando] = useState(false);
  const [errorFirma, setErrorFirma] = useState<string | null>(null);
  const consentimientoOk = deportista.consentimientoOk || consentimientoDemo;
  const medidos = datos.atributos.filter((a) => deportista.mediciones[a.id]?.length);
  const [atributoId, setAtributoId] = useState(
    atributoInicial && deportista.mediciones[atributoInicial]
      ? atributoInicial
      : (medidos[0]?.id ?? ""),
  );
  const [tab, setTab] = useState(
    atributoInicial && deportista.mediciones[atributoInicial]
      ? "evolucion"
      : "habilidades",
  );
  const [infoAbierta, setInfoAbierta] = useState<string | null>(null);

  const atributo = datos.atributos.find((a) => a.id === atributoId);
  const serie = atributo ? (deportista.mediciones[atributo.id] ?? []) : [];
  const t = atributo ? tendencia(serie, atributo) : null;
  // Módulo D: en la talla se marca la zona de crecimiento acelerado
  // sobre la curva y se muestra la card "El estirón".
  const esTalla = atributo?.nombre === "Talla";
  const zonasEstiron = esTalla
    ? zonasAceleracion(crecimiento(serie).tramos).map((z) => ({
        ...z,
        etiqueta: "Crecimiento acelerado (registro)",
      }))
    : undefined;
  const categoria = datos.categorias.find((c) => c.id === deportista.categoriaId);
  // Sesiones en las que aparece: reales (asistencia por excepción ya
  // materializada por useAgenda) o las del mock para la demo.
  const agenda = useAgenda(datos);
  const sesiones = datos.real
    ? agenda.sesiones
        .filter(
          (s) =>
            s.estado === "realizada" &&
            s.asistencia.some((a) => a.deportistaId === deportista.id),
        )
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
    : sesionesDe(deportista.id);

  const fisicas = medidos.filter((a) => a.ambito === "fisico");
  const tecnicas = medidos.filter((a) => a.ambito === "tecnico");

  const irAEvolucion = (id: string) => {
    setAtributoId(id);
    setTab("evolucion");
  };

  async function registrarFirma() {
    if (!datos.real) {
      setConsentimientoDemo(true);
      return;
    }
    setFirmando(true);
    setErrorFirma(null);
    const { error } = await crearClienteBrowser().from("consentimiento").insert({
      deportista_id: deportista.id,
      otorgado: true,
      observacion: "Registrado desde la ficha",
    });
    setFirmando(false);
    if (error) {
      setErrorFirma(`No se pudo registrar la firma (${error.message}).`);
      return;
    }
    setConsentimientoDemo(true);
    datos.recargar();
  }

  // Espejo del RLS: la plataforma no ve fichas; el profesor solo las
  // de sus categorías asignadas. (Con sesión real el gate de
  // categorías ya lo aplicó el RLS: un id ajeno ni siquiera llega acá.)
  if (!permisos.veClub) {
    return (
      <AvisoAcceso
        titulo="La plataforma no accede a fichas"
        detalle="Los datos individuales de los deportistas nunca salen de su club. El perfil de plataforma solo ve el observatorio con agregados."
        accionHref="/observatorio"
        accionLabel="Ir al observatorio"
      />
    );
  }
  if (
    !datos.real &&
    permisos.categorias &&
    !permisos.categorias.includes(deportista.categoriaId)
  ) {
    const asignadas = datos.categorias.map((c) => c.nombre).join(" y ");
    return (
      <AvisoAcceso
        titulo="Fuera de tus categorías"
        detalle={`${deportista.nombre} ${deportista.apellido} pertenece a ${categoria?.nombre ?? "otra categoría"}. Tu perfil accede solo a ${asignadas}.`}
        accionHref="/deportistas"
        accionLabel="Ver tus deportistas"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Encabezado de la ficha */}
      <div className="flex items-center gap-4">
        <AvatarIniciales
          nombre={deportista.nombre}
          apellido={deportista.apellido}
          className="size-14 text-lg"
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold tracking-tight">
            {deportista.nombre} {deportista.apellido}
          </h1>
          <p className="text-sm text-muted-foreground">
            {[
              categoria?.nombre ?? "Sin categoría",
              edadLabel(deportista.fechaNacimiento),
              deportista.lateralidad,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {datos.real && permisos.opera && (
          <Link
            href={`/deportistas/${deportista.id}/editar`}
            aria-label="Editar deportista"
            title="Editar deportista"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <Pencil className="size-4.5" aria-hidden />
          </Link>
        )}
        <Link
          href={`/deportistas/${deportista.id}/consentimiento`}
          aria-label="Consentimiento imprimible"
          title="Consentimiento imprimible"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <FileSignature className="size-4.5" aria-hidden />
        </Link>
        <Link
          href={`/deportistas/${deportista.id}/informe`}
          aria-label="Informe imprimible"
          title="Informe imprimible"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <Printer className="size-4.5" aria-hidden />
        </Link>
        <CompartirInforme deportista={deportista} datos={datos} variante="icono" />
      </div>

      {!consentimientoOk && (
        <div className="flex flex-wrap items-start gap-2.5 rounded-xl bg-warning-soft p-3.5 text-sm text-warning">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1 font-semibold">
            Consentimiento del tutor pendiente.{" "}
            <span className="font-normal">
              Registrá el formulario firmado antes de seguir cargando datos.
            </span>
          </p>
          {permisos.opera && (
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href={`/deportistas/${deportista.id}/consentimiento`}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-warning/40 px-3 text-xs font-bold text-warning transition-colors hover:bg-warning/10"
              >
                <FileSignature className="size-3.5" aria-hidden />
                Imprimir formulario
              </Link>
              <button
                onClick={() => void registrarFirma()}
                disabled={firmando}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-warning px-3 text-xs font-bold text-white disabled:opacity-60"
              >
                {firmando && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                {datos.real ? "Registrar firma" : "Registrar firma (demo)"}
              </button>
            </div>
          )}
        </div>
      )}
      {errorFirma && (
        <div className="flex items-start gap-2.5 rounded-xl bg-danger-soft p-3 text-xs font-semibold text-danger">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{errorFirma}</p>
        </div>
      )}
      {consentimientoDemo && (
        <div className="flex items-start gap-2.5 rounded-xl bg-success-soft p-3 text-xs text-success">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            {datos.real
              ? "Firma registrada con fecha de hoy. Quedó asociada al deportista; el formulario en papel se archiva en el club."
              : "Firma registrada (demo — no se guarda en esta etapa). En producción queda asociada al tutor, con fecha y quién la registró."}
          </p>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="habilidades" className="flex-1">
            Habilidades
          </TabsTrigger>
          <TabsTrigger value="evolucion" className="flex-1">
            Evolución
          </TabsTrigger>
          <TabsTrigger value="ficha" className="flex-1">
            Ficha
          </TabsTrigger>
          <TabsTrigger value="sesiones" className="flex-1">
            Sesiones
          </TabsTrigger>
        </TabsList>

        {/* ---------- HABILIDADES (mapa del jugador) ---------- */}
        <TabsContent value="habilidades" className="mt-3 flex flex-col gap-3">
          {medidos.length === 0 && (
            <EstadoVacio
              icono={ClipboardPlus}
              titulo="Todavía sin mediciones"
              detalle={`Acá va a estar el mapa de habilidades de ${deportista.nombre}: cada atributo medido con su último valor y su tendencia. Arranca con la primera jornada de medición.`}
              accion={
                permisos.opera
                  ? {
                      href: `/medicion?categoria=${deportista.categoriaId}`,
                      label: "Registrar la primera medición",
                    }
                  : undefined
              }
            />
          )}
          {fisicas.length > 0 && (
            <section className="rounded-2xl border border-border bg-card">
              <h2 className="border-b border-border px-4 py-3 text-sm font-extrabold">
                Mediciones físicas{" "}
                <span className="font-semibold text-muted-foreground">
                  (con protocolo)
                </span>
              </h2>
              <ul>
                {fisicas.map((a) => {
                  const valor = nivelActual(deportista, a.id)!;
                  const ts = tendencia(deportista.mediciones[a.id], a);
                  const ultima =
                    deportista.mediciones[a.id][
                      deportista.mediciones[a.id].length - 1
                    ];
                  return (
                    <li key={a.id} className="border-b border-border last:border-0">
                      <button
                        onClick={() => irAEvolucion(a.id)}
                        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-sm font-bold">
                            {a.nombre}
                            <Info
                              className="size-3.5 text-muted-foreground"
                              aria-label={`Qué mide ${a.nombre}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setInfoAbierta(infoAbierta === a.id ? null : a.id);
                              }}
                            />
                          </span>
                          <span className="block text-[11px] text-muted-foreground">
                            últ. medición {formatFecha(ultima.fecha)}
                          </span>
                        </span>
                        <span className="text-base font-extrabold tabular-nums">
                          {valor.toLocaleString("es-AR")}
                          <span className="ml-1 text-xs font-semibold text-muted-foreground">
                            {a.unidad}
                          </span>
                        </span>
                        <TrendIcon estado={ts.estado} />
                        <ChevronRight
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                      </button>
                      {infoAbierta === a.id && (
                        <p className="px-4 pb-3 text-xs leading-snug text-muted-foreground">
                          {a.descripcion}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {tecnicas.length > 0 && (
            <section className="rounded-2xl border border-border bg-card">
              <h2 className="border-b border-border px-4 py-3 text-sm font-extrabold">
                Apreciación técnica{" "}
                <span className="font-semibold text-muted-foreground">
                  (1-10, a criterio del profe)
                </span>
              </h2>
              <ul>
                {tecnicas.map((a) => {
                  const valor = nivelActual(deportista, a.id)!;
                  const ts = tendencia(deportista.mediciones[a.id], a);
                  return (
                    <li key={a.id} className="border-b border-border last:border-0">
                      <button
                        onClick={() => irAEvolucion(a.id)}
                        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-sm font-bold">
                            {a.nombre}
                            <Info
                              className="size-3.5 text-muted-foreground"
                              aria-label={`Qué observa ${a.nombre}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setInfoAbierta(infoAbierta === a.id ? null : a.id);
                              }}
                            />
                          </span>
                        </span>
                        <NivelBar nivel={valor} />
                        <span className="w-8 text-right text-base font-extrabold tabular-nums">
                          {valor.toLocaleString("es-AR", { maximumFractionDigits: 1 })}
                        </span>
                        <TrendIcon estado={ts.estado} />
                      </button>
                      {infoAbierta === a.id && (
                        <p className="px-4 pb-3 text-xs leading-snug text-muted-foreground">
                          {a.descripcion}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {medidos.length > 0 && (
            <p className="px-1 text-[11px] leading-snug text-muted-foreground">
              Tocá una habilidad para ver su evolución en el tiempo. Las demás
              habilidades del catálogo aparecen acá cuando se cargan mediciones.
            </p>
          )}
        </TabsContent>

        {/* ---------- EVOLUCIÓN (la estrella) ---------- */}
        <TabsContent value="evolucion" className="mt-3 flex flex-col gap-3">
          {medidos.length === 0 && (
            <EstadoVacio
              icono={ClipboardPlus}
              titulo="La curva arranca con la primera medición"
              detalle="Acá se dibuja la evolución de cada atributo en el tiempo, con su tendencia calculada de las últimas 3 mediciones."
              accion={
                permisos.opera
                  ? {
                      href: `/medicion?categoria=${deportista.categoriaId}`,
                      label: "Registrar la primera medición",
                    }
                  : undefined
              }
            />
          )}
          <div
            className="flex gap-2 overflow-x-auto pb-1"
            role="tablist"
            aria-label="Elegir atributo"
          >
            {medidos.map((a) => (
              <button
                key={a.id}
                onClick={() => setAtributoId(a.id)}
                className={cn(
                  "h-9 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors",
                  a.id === atributoId
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                {a.nombre}
              </button>
            ))}
          </div>

          {atributo && t && (
            <section className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-extrabold">
                    {atributo.nombre}{" "}
                    <span className="text-sm font-semibold text-muted-foreground">
                      ({atributo.unidad})
                    </span>
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {atributo.naturaleza === "subjetivo"
                      ? "Apreciación del entrenador (escala 1-10)"
                      : "Medición con protocolo"}
                  </p>
                </div>
                <EstadoBadge estado={t.estado} />
              </div>

              {serie.length > 0 ? (
                <>
                  <EvolutionChart
                    serie={serie}
                    atributo={atributo}
                    hitos={deportista.historial}
                    zonas={zonasEstiron}
                  />
                  <div className="mt-2 flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-[11px] leading-snug text-muted-foreground">
                    <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    <p>
                      Estado basado en las últimas 3 mediciones.
                      {atributo.sentido === "menor_mejor" &&
                        " En este atributo, bajar el valor es mejorar."}
                      {atributo.sentido === null &&
                        " Talla y peso se registran como referencia de crecimiento, sin juzgar mejora o retroceso."}
                    </p>
                  </div>
                </>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Sin mediciones de este atributo todavía.
                </p>
              )}
            </section>
          )}

          {esTalla && serie.length > 0 && <Estiron serie={serie} />}

          {/* Historial: la vista tabla del gráfico */}
          {serie.length > 0 && atributo && (
            <section className="rounded-2xl border border-border bg-card">
              <h3 className="border-b border-border px-4 py-3 text-sm font-extrabold">
                Historial de mediciones
              </h3>
              <ul>
                {[...serie].reverse().map((m) => (
                  <li
                    key={m.fecha}
                    className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-2.5 text-sm last:border-0"
                  >
                    <span className="text-muted-foreground">
                      {formatFecha(m.fecha)}
                    </span>
                    <span className="flex-1 text-right font-bold tabular-nums">
                      {m.valor.toLocaleString("es-AR")}{" "}
                      <span className="text-xs font-medium text-muted-foreground">
                        {atributo.unidad}
                      </span>
                    </span>
                    <span className="w-28 truncate text-right text-xs text-muted-foreground">
                      {m.entrenador}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {permisos.opera && medidos.length > 0 && (
            <Link
              href={`/medicion?atributo=${atributoId}&categoria=${deportista.categoriaId}`}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-extrabold text-primary-foreground transition-transform active:scale-[0.99]"
            >
              <ClipboardPlus className="size-4.5" aria-hidden />
              Registrar medición
            </Link>
          )}
        </TabsContent>

        {/* ---------- FICHA ---------- */}
        <TabsContent value="ficha" className="mt-3">
          <section className="rounded-2xl border border-border bg-card">
            {[
              [
                "Documento interno",
                datos.real
                  ? (deportista.docInterno ?? "—")
                  : `AT-${deportista.id.slice(1).padStart(4, "0")}`,
              ],
              [
                "Nacimiento",
                deportista.fechaNacimiento
                  ? new Date(
                      deportista.fechaNacimiento + "T12:00:00",
                    ).toLocaleDateString("es-AR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "—",
              ],
              [
                "Sexo",
                deportista.sexo === "F"
                  ? "Femenino"
                  : deportista.sexo === "M"
                    ? "Masculino"
                    : (deportista.sexo ?? "—"),
              ],
              ["Lateralidad", deportista.lateralidad ?? "—"],
              ["Categoría", categoria?.nombre ?? "—"],
            ].map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between border-b border-border px-4 py-3 text-sm last:border-0"
              >
                <span className="text-muted-foreground">{k}</span>
                <span className="font-semibold capitalize">{v}</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-muted-foreground">Consentimiento</span>
              {consentimientoOk ? (
                <span className="flex items-center gap-1.5 font-semibold text-success">
                  <ShieldCheck className="size-4" aria-hidden /> Firmado
                </span>
              ) : (
                <span className="flex items-center gap-1.5 font-semibold text-warning">
                  <ShieldAlert className="size-4" aria-hidden /> Pendiente
                </span>
              )}
            </div>
          </section>
          <p className="mt-3 px-1 text-[11px] leading-snug text-muted-foreground">
            Por tratarse mayormente de menores, la ficha guarda los datos
            mínimos necesarios. La talla y el peso no viven acá: son mediciones
            y se ven en Habilidades y Evolución.
          </p>
        </TabsContent>

        {/* ---------- SESIONES ---------- */}
        <TabsContent value="sesiones" className="mt-3 flex flex-col gap-2">
          {sesiones.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Sin sesiones registradas todavía.
            </p>
          )}
          {sesiones.map((s) => {
            const presente = s.asistencia.find(
              (a) => a.deportistaId === deportista.id,
            )?.presente;
            return (
              <Link
                key={s.id}
                href={`/sesiones/${s.id}`}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 transition-colors hover:border-primary/40"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                  <CalendarDays className="size-4.5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">
                    {formatFecha(s.fecha)} ·{" "}
                    {s.atributoFocoId
                      ? datos.atributos.find((a) => a.id === s.atributoFocoId)?.nombre
                      : "General"}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {s.entrenador}
                  </span>
                </span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-semibold",
                    presente
                      ? "bg-success-soft text-success"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {presente ? "Presente" : "Ausente"}
                </span>
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </Link>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
