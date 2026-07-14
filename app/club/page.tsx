"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  Layers,
  Loader2,
  UserPlus,
  Users,
} from "lucide-react";
import { crearClienteBrowser } from "@/lib/supabase/client";
import { useClub } from "@/lib/use-club";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { EscudoClub } from "@/components/escudo-club";

// Hub de gestión del club (admin): la cadena de alta de
// docs/OPERACION.md hecha pantalla — categorías → staff → deportistas.

export default function ClubPage() {
  const sesion = useClub();
  const [conteos, setConteos] = useState<{
    categorias: number;
    staff: number;
    deportistas: number;
    pendientes: number;
    horarios: number;
  } | null>(null);

  const clubId = sesion.membresia?.clubId ?? null;
  const [errorConteos, setErrorConteos] = useState(false);

  useEffect(() => {
    if (!clubId) return;
    const supabase = crearClienteBrowser();
    Promise.all([
      supabase.from("categoria").select("id", { count: "exact", head: true }).eq("club_id", clubId),
      supabase.from("membresia").select("id", { count: "exact", head: true }).eq("club_id", clubId),
      supabase.from("deportista").select("id", { count: "exact", head: true }).eq("club_id", clubId),
      supabase.from("deportista").select("id, consentimiento(id)").eq("club_id", clubId),
      supabase
        .from("horario_entrenamiento")
        .select("id", { count: "exact", head: true })
        .eq("club_id", clubId),
    ]).then(([cats, staff, deps, cons, hors]) => {
      // supabase-js no lanza: los errores vienen en el resultado
      if (cats.error ?? staff.error ?? deps.error ?? cons.error ?? hors.error) {
        setErrorConteos(true);
        return;
      }
      const sinConsentimiento = (cons.data ?? []).filter(
        (d) => !d.consentimiento || (Array.isArray(d.consentimiento) && d.consentimiento.length === 0),
      ).length;
      setConteos({
        categorias: cats.count ?? 0,
        staff: staff.count ?? 0,
        deportistas: deps.count ?? 0,
        pendientes: sinConsentimiento,
        horarios: hors.count ?? 0,
      });
    }).catch(() => setErrorConteos(true)); // sin catch, los "…" quedaban para siempre
  }, [clubId]);

  if (sesion.cargando) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (!sesion.usuario || sesion.membresia?.rol !== "admin_club") {
    return (
      <AvisoAcceso
        titulo="Solo para el admin del club"
        detalle="La gestión del club (categorías, staff, altas) es del administrador. El resto del staff opera desde Deportistas, Medir y Agenda."
        accionHref={sesion.usuario ? "/panel" : "/login"}
        accionLabel={sesion.usuario ? "Volver al inicio" : "Ingresar"}
      />
    );
  }

  const tarjetas = [
    {
      href: "/club/categorias",
      icon: Layers,
      titulo: "Categorías",
      detalle: "La estructura del club: escuelitas por cohorte, inferiores, Reserva y Primera",
      dato: conteos ? `${conteos.categorias} categorías` : "…",
    },
    {
      href: "/club/staff",
      icon: Users,
      titulo: "Staff",
      detalle: "Invitá profes por link, asignales sus categorías, sumá comisión directiva",
      dato: conteos
        ? `${conteos.staff} ${conteos.staff === 1 ? "persona" : "personas"}`
        : "…",
    },
    {
      href: "/club/agenda",
      icon: CalendarDays,
      titulo: "Agenda y lugares",
      detalle: "Horarios fijos por categoría y canchas — la agenda semanal se arma sola",
      dato: conteos ? `${conteos.horarios} horarios fijos` : "…",
    },
    {
      href: "/deportistas/nuevo",
      icon: UserPlus,
      titulo: "Nuevo deportista",
      detalle: "Alta con tutor y consentimiento en el mismo paso",
      dato: conteos
        ? `${conteos.deportistas} cargados${conteos.pendientes > 0 ? ` · ${conteos.pendientes} sin consentimiento` : ""}`
        : "…",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3.5">
        <EscudoClub
          url={sesion.club?.escudoUrl}
          nombre={sesion.club?.nombre ?? "Tu club"}
          className="size-14"
        />
        <div className="min-w-0">
          <h1 className="line-clamp-2 break-words text-2xl font-extrabold leading-tight tracking-tight">
            {sesion.club?.nombre ?? "Tu club"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestión del club — datos reales, guardados en la base
          </p>
        </div>
      </div>

      {errorConteos && (
        <p className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm font-semibold text-destructive">
          No se pudieron cargar los conteos del club. Revisá la conexión y
          recargá la página.
        </p>
      )}

      <div className="grid gap-3">
        {tarjetas.map(({ href, icon: Icon, titulo, detalle, dato }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
              <Icon className="size-6" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-base font-extrabold">
                {titulo}
                {href === "/club/categorias" &&
                  conteos !== null &&
                  conteos.categorias === 0 && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                      Empezá acá
                    </span>
                  )}
              </span>
              <span className="block text-xs leading-relaxed text-muted-foreground">
                {detalle}
              </span>
              <span className="mt-1 block text-[11px] font-bold text-primary">{dato}</span>
            </span>
            <ChevronRight
              className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        ))}
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        El orden natural para arrancar: primero las categorías, después el staff (cada
        profe con sus categorías) y recién ahí los deportistas — es la cadena de alta de
        la plataforma.
      </p>
    </div>
  );
}
