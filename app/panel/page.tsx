"use client";

import Link from "next/link";
import {
  ChevronRight,
  ClipboardPlus,
  Dumbbell,
  Eye,
  Landmark,
  Loader2,
  Settings,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { ENTRENADORES, PROFE_DEMO } from "@/lib/mock-data";
import { useDatos } from "@/lib/use-datos";
import { useAgenda } from "@/lib/use-agenda";
import { useObservatorio } from "@/lib/use-observatorio";
import { AlertasRegistro } from "@/components/alertas-registro";
import {
  PrimerosPasos,
  PrimerosPasosPlataforma,
} from "@/components/primeros-pasos";
import { EscudoClub } from "@/components/escudo-club";
import { EventoCard } from "@/components/evento-card";
import { EnElRadar, Proximamente } from "@/components/proximamente";
import { tendencia } from "@/lib/tendencia";
import { EstadoBadge } from "@/components/estado-badge";
import { AvatarIniciales } from "@/components/avatar-iniciales";
import { Sparkline } from "@/components/sparkline";
import { usePerfil } from "@/components/perfil-context";

// Selección curada para la demo mock: cubre los tres estados y las
// categorías de la profesora demo. Con sesión real, los destacados se
// calculan de las series reales (últimas evoluciones con historia).
const DESTACADOS_DEMO: { deportistaId: string; atributoId: string }[] = [
  { deportistaId: "d01", atributoId: "velocidad30" },
  { deportistaId: "d05", atributoId: "salto" },
  { deportistaId: "d03", atributoId: "velocidad30" },
  { deportistaId: "d24", atributoId: "velocidad30" },
  { deportistaId: "d29", atributoId: "remates" },
];

function InicioPlataforma() {
  const { cargando, clubes, real } = useObservatorio();
  const totales = clubes.reduce(
    (acc, c) => ({
      deportistas: acc.deportistas + c.deportistas,
      mediciones: acc.mediciones + c.medicionesMes,
    }),
    { deportistas: 0, mediciones: 0 },
  );

  if (cargando) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Plataforma · Provincia de Salta
        </h1>
        <p className="text-sm text-muted-foreground">
          Vista de operador: solo datos agregados, sin acceso a fichas
        </p>
      </div>
      <PrimerosPasosPlataforma clubes={clubes} real={real} />
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-card p-3.5">
          <p className="text-2xl font-extrabold">{clubes.length}</p>
          <p className="text-xs font-medium text-muted-foreground">clubes activos</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3.5">
          <p className="text-2xl font-extrabold">{totales.deportistas}</p>
          <p className="text-xs font-medium text-muted-foreground">
            deportistas con trayectoria
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3.5">
          <p className="text-2xl font-extrabold">{totales.mediciones}</p>
          <p className="text-xs font-medium text-muted-foreground">
            mediciones · 30 días
          </p>
        </div>
      </div>
      <Link
        href="/observatorio"
        className="flex items-center gap-4 rounded-2xl bg-primary p-5 text-primary-foreground shadow-sm transition-transform active:scale-[0.99]"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
          <Landmark className="size-6" aria-hidden />
        </span>
        <span className="flex-1">
          <span className="block text-base font-extrabold">
            Observatorio provincial
          </span>
          <span className="block text-sm text-primary-foreground/80">
            Mapa, clubes y constancia de carga
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 opacity-80" aria-hidden />
      </Link>
      <p className="px-1 text-[11px] leading-snug text-muted-foreground">
        Los datos individuales de los deportistas nunca salen de su club. La
        plataforma cura el catálogo global y opera la infraestructura.
      </p>
    </div>
  );
}

export default function Inicio() {
  const { perfil, permisos } = usePerfil();
  const datos = useDatos();
  const agenda = useAgenda(datos);

  if (perfil === "super_admin") return <InicioPlataforma />;

  if (agenda.cargando) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  const hoy = agenda.hoy;
  const deportistas = datos.deportistas; // ya acotados al alcance

  // Próximos eventos de la agenda (entrenamientos y partidos mezclados)
  const proximos = [
    ...agenda.sesiones.map((sesion) => ({
      tipo: "sesion" as const,
      fecha: sesion.fecha,
      sesion,
    })),
    ...agenda.partidos.map((partido) => ({
      tipo: "partido" as const,
      fecha: partido.fecha,
      partido,
    })),
  ]
    .filter((e) => new Date(e.fecha) >= hoy)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(0, 2);

  const sinConsentimiento = deportistas.filter((d) => !d.consentimientoOk);

  // Mediciones del mes de referencia (el de HOY, demo o real)
  const mesPrefix = datos.real
    ? `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`
    : "2026-06";
  const mesNombre = datos.real
    ? hoy.toLocaleDateString("es-AR", { month: "long" })
    : "junio";
  const medicionesMes = deportistas.reduce(
    (acc, d) =>
      acc +
      Object.values(d.mediciones)
        .flat()
        .filter((m) => m.fecha.startsWith(mesPrefix)).length,
    0,
  );

  // Evoluciones destacadas: en la demo, la selección curada; con datos
  // reales, las series con más historia medidas más recientemente.
  const destacados = datos.real
    ? deportistas
        .flatMap((d) =>
          Object.entries(d.mediciones)
            .filter(([, serie]) => serie.length >= 2)
            .map(([atributoId, serie]) => ({
              deportistaId: d.id,
              atributoId,
              ultima: serie[serie.length - 1].fecha,
              puntos: serie.length,
            })),
        )
        .sort(
          (a, b) => b.ultima.localeCompare(a.ultima) || b.puntos - a.puntos,
        )
        .filter(
          // un destacado por deportista, para variar
          (x, i, arr) =>
            arr.findIndex((y) => y.deportistaId === x.deportistaId) === i,
        )
        .slice(0, 3)
    : DESTACADOS_DEMO.filter((x) =>
        deportistas.some((d) => d.id === x.deportistaId),
      ).slice(0, 3);

  const nombrePila = datos.real
    ? (datos.membresiaNombre?.split(" ")[0] ?? "")
    : PROFE_DEMO.nombre.split(" ")[0];
  const titulo =
    perfil === "profesor"
      ? `Hola, ${nombrePila} 👋`
      : perfil === "admin_club"
        ? "Panel del club"
        : "Consulta del club";
  const subtitulo =
    perfil === "profesor"
      ? datos.categorias.map((c) => c.nombre).join(" · ")
      : `${datos.clubNombre} · ${(() => {
          const f = hoy.toLocaleDateString("es-AR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          });
          return f.charAt(0).toUpperCase() + f.slice(1);
        })()}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        {perfil !== "profesor" && datos.clubEscudoUrl && (
          <EscudoClub
            url={datos.clubEscudoUrl}
            nombre={datos.clubNombre}
            className="size-12"
          />
        )}
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold tracking-tight">
            {titulo}
          </h1>
          <p className="text-sm text-muted-foreground">{subtitulo}</p>
        </div>
      </div>

      {perfil === "comision" && (
        <div className="flex items-center gap-2.5 rounded-xl bg-secondary px-3.5 py-2.5 text-xs font-semibold text-secondary-foreground">
          <Eye className="size-4 shrink-0" aria-hidden />
          Modo consulta: ves todo el club, sin cargar ni editar.
        </div>
      )}

      {/* Onboarding: pasos por rol calculados del estado real; se
          tildan solos y la card desaparece al completarse */}
      <PrimerosPasos
        datos={datos}
        agenda={agenda}
        gestiona={permisos.gestiona}
        opera={permisos.opera}
      />

      {/* CTAs de operación: solo perfiles que cargan */}
      {permisos.opera && (
        <>
          <Link
            href="/medicion"
            className="flex items-center gap-4 rounded-2xl bg-primary p-5 text-primary-foreground shadow-sm transition-transform active:scale-[0.99]"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <ClipboardPlus className="size-6" aria-hidden />
            </span>
            <span className="flex-1">
              <span className="block text-base font-extrabold">
                Nueva jornada de medición
              </span>
              <span className="block text-sm text-primary-foreground/80">
                Cargá un atributo para toda una categoría, de corrido
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 opacity-80" aria-hidden />
          </Link>
          <Link
            href="/entrenamiento"
            className="-mt-2 flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 transition-colors hover:border-primary/40"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <Dumbbell className="size-4.5" aria-hidden />
            </span>
            <span className="flex-1 text-sm font-bold">
              Tablero de entrenamiento
              <span className="block text-xs font-medium text-muted-foreground">
                Asigná áreas de trabajo a tu plantel
              </span>
            </span>
            <ChevronRight
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </Link>
        </>
      )}

      {/* Stat tiles (siempre del alcance visible) */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-card p-3.5">
          <p className="text-2xl font-extrabold">{deportistas.length}</p>
          <p className="text-xs font-medium text-muted-foreground">
            {permisos.categorias ? "deportistas a cargo" : "deportistas activos"}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3.5">
          <p className="text-2xl font-extrabold">{medicionesMes}</p>
          <p className="text-xs font-medium text-muted-foreground">
            mediciones en {mesNombre}
          </p>
        </div>
        <Link
          href="/deportistas"
          className="rounded-2xl border border-border bg-card p-3.5 transition-colors hover:border-warning/40"
        >
          <p className="flex items-center gap-1 text-2xl font-extrabold">
            {sinConsentimiento.length}
            {sinConsentimiento.length > 0 && (
              <ShieldAlert className="size-4 text-warning" aria-hidden />
            )}
          </p>
          <p className="text-xs font-medium text-muted-foreground">
            consentimientos pendientes
          </p>
        </Link>
      </div>

      {/* Constancia de registro: el producto reclama solo */}
      <AlertasRegistro datos={datos} hoy={hoy} opera={permisos.opera} />

      {/* Gestión del club: SOLO admin */}
      {permisos.gestiona && (
        <section className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-extrabold">Gestión del club</h2>
            {datos.real && (
              <Link href="/club" className="text-sm font-semibold text-primary">
                Ir a gestión
              </Link>
            )}
          </div>
          <div className="rounded-2xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-bold">
                Consentimientos pendientes ({sinConsentimiento.length})
              </p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {sinConsentimiento.slice(0, 6).map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/deportistas/${d.id}`}
                      className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <ShieldAlert className="size-3.5 text-warning" aria-hidden />
                      <span className="flex-1 truncate">
                        {d.apellido}, {d.nombre} ·{" "}
                        {datos.categorias.find((c) => c.id === d.categoriaId)?.nombre}
                      </span>
                      <ChevronRight className="size-3.5" aria-hidden />
                    </Link>
                  </li>
                ))}
                {sinConsentimiento.length === 0 && (
                  <li className="text-sm text-muted-foreground">
                    Todo el plantel tiene consentimiento firmado.
                  </li>
                )}
              </ul>
            </div>
            {datos.real ? (
              <Link
                href="/club/agenda"
                className="flex items-center gap-2.5 px-4 py-3 text-sm font-bold transition-colors hover:bg-muted/50"
              >
                <Settings className="size-4 text-muted-foreground" aria-hidden />
                <span className="flex-1">
                  Cronograma, lugares, categorías y staff
                  <span className="block text-xs font-medium text-muted-foreground">
                    Todo lo institucional vive en Club
                  </span>
                </span>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </Link>
            ) : (
              <div className="px-4 py-3">
                <p className="text-sm font-bold">Cuerpo técnico</p>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {ENTRENADORES.map((e) => (
                    <li
                      key={e}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <UserRound className="size-3.5" aria-hidden />
                      <span className="flex-1">{e}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                        Profesor/a
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Alta de staff y asignación de categorías: por administración de
                  la plataforma en esta etapa (demo).
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Agenda: próximos entrenamientos y partidos */}
      {proximos.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-extrabold">Agenda</h2>
            <Link href="/sesiones" className="text-sm font-semibold text-primary">
              Ver la semana
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {proximos.map((e) => (
              <EventoCard
                key={e.tipo === "sesion" ? e.sesion.id : e.partido.id}
                evento={e}
                agenda={agenda}
                conFecha
              />
            ))}
          </div>
        </section>
      )}

      {/* Evoluciones destacadas — el diferencial, visible desde el home */}
      {destacados.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-extrabold">Evoluciones para mirar</h2>
            <Link href="/deportistas" className="text-sm font-semibold text-primary">
              Ver todos
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {destacados.map(({ deportistaId, atributoId }) => {
              const d = deportistas.find((x) => x.id === deportistaId);
              const a = datos.atributos.find((x) => x.id === atributoId);
              if (!d || !a) return null;
              const serie = d.mediciones[atributoId] ?? [];
              const t = tendencia(serie, a);
              return (
                <Link
                  key={deportistaId + atributoId}
                  href={`/deportistas/${d.id}?atributo=${a.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 transition-colors hover:border-primary/40"
                >
                  <AvatarIniciales nombre={d.nombre} apellido={d.apellido} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">
                      {d.nombre} {d.apellido}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {a.nombre} ·{" "}
                      {datos.categorias.find((c) => c.id === d.categoriaId)?.nombre}
                    </span>
                  </span>
                  <Sparkline valores={serie.map((m) => m.valor)} />
                  <EstadoBadge estado={t.estado} />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Probadita del roadmap, según el perfil */}
      <EnElRadar>
        {permisos.opera && (
          <Proximamente
            titulo="Modo sin señal"
            detalle="Cargá mediciones y asistencia en la cancha sin conexión; se sincroniza solo al volver la señal."
            etiqueta="Próximamente"
          />
        )}
        {permisos.gestiona && (
          <Proximamente
            titulo="Exportación de todos tus datos (CSV)"
            detalle="El club es dueño de su información: descargá deportistas, mediciones y asistencia cuando quieras."
            etiqueta="Próximamente"
          />
        )}
        {(permisos.gestiona || !permisos.opera) && (
          <Proximamente
            titulo="Informe mensual por categoría (PDF)"
            detalle="Resumen automático de constancia de carga, asistencia y evoluciones destacadas, listo para la reunión de comisión."
            etiqueta="Próximamente"
          />
        )}
        {permisos.opera && !permisos.gestiona && (
          <Proximamente
            titulo="Sugerencias de foco de entrenamiento"
            detalle="A partir de la evolución del plantel, la plataforma sugiere qué áreas conviene trabajar esta semana."
            etiqueta="A evaluar"
          />
        )}
        <Proximamente
          titulo="Acceso para familias (solo lectura)"
          detalle="Que cada familia vea la evolución de su hijo/a con un enlace seguro, sin cuenta. Se define después del piloto."
          etiqueta="A evaluar"
        />
      </EnElRadar>
    </div>
  );
}
