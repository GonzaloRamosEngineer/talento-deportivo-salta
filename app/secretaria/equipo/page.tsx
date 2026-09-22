"use client";

import { ContactRound, LockKeyhole, UserPlus } from "lucide-react";
import { GuardiaSecretaria } from "@/components/secretaria/guardia-secretaria";
import { ROLES_SECRETARIA } from "@/lib/secretaria-demo";
import { useSecretaria } from "@/lib/use-secretaria";
import { CargandoPelota } from "@/components/cargando-pelota";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { AvatarIniciales } from "@/components/avatar-iniciales";
import { ROL_LABEL, type RolMembresia } from "@/lib/tipos-db";

export default function EquipoSecretaria() {
  const { resumen, cargando, error, real } = useSecretaria();
  if (cargando) return <CargandoPelota texto="Cargando equipo…" />;
  if (error) return <AvisoAcceso titulo="No pudimos cargar el equipo" detalle={error} accionHref="/secretaria/equipo" accionLabel="Reintentar" />;
  return (
    <GuardiaSecretaria>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">Acceso por alcance</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight">Equipo</h1><p className="mt-1 text-sm text-muted-foreground">Administrativos, coordinadores, evaluadores y analistas.</p></div>
          <button type="button" disabled className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-extrabold text-primary-foreground opacity-50"><UserPlus className="size-4" aria-hidden />Invitar</button>
        </div>

        {!real && <div className="flex items-start gap-3 rounded-2xl border border-warning/25 bg-warning-soft/45 p-4">
          <LockKeyhole className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <div><p className="text-sm font-extrabold">El equipo real se habilita en staging</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Esta demo no crea usuarios en producción. Backend deberá vincular la primera cuenta como Administrador/a de Secretaría.</p></div>
        </div>}

        <section className="overflow-hidden rounded-3xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4"><ContactRound className="size-4 text-primary" aria-hidden /><h2 className="text-sm font-extrabold">{real ? `${resumen?.equipo.length ?? 0} integrantes` : "Roles propuestos"}</h2></div>
          <div className="divide-y divide-border">
            {(real && resumen ? resumen.equipo : ROLES_SECRETARIA).map((rol, indice) => (
              <div key={rol.nombre} className="flex items-start gap-3 px-5 py-4">
                {real ? <AvatarIniciales nombre={rol.nombre} apellido="" className="size-8" /> : <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-extrabold text-primary">{indice + 1}</span>}
                <div><p className="text-sm font-extrabold">{rol.nombre}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{"rol" in rol ? `${ROL_LABEL[rol.rol as RolMembresia]}${rol.funcion ? ` · ${rol.funcion}` : ""}` : rol.alcance}</p></div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </GuardiaSecretaria>
  );
}
