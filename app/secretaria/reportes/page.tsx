"use client";

import { BarChart3, Building2, LockKeyhole, Shapes, Users } from "lucide-react";
import { GuardiaSecretaria } from "@/components/secretaria/guardia-secretaria";
import { Ayuda } from "@/components/ayuda";

const REPORTES = [
  { nombre: "Por grupo", detalle: "Distribución, cobertura y resultados de una jornada.", icon: Users },
  { nombre: "Por institución", detalle: "Grupos evaluados por la Secretaría, sin mezclar datos del club.", icon: Building2 },
  { nombre: "Por disciplina", detalle: "Métricas comparables dentro del mismo protocolo.", icon: Shapes },
];

export default function ReportesSecretaria() {
  return (
    <GuardiaSecretaria>
      <div className="flex flex-col gap-5">
        <div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">Datos de Secretaría</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight">Reportes</h1><p className="mt-1 text-sm text-muted-foreground">Estas estadísticas no mezclan mediciones producidas por los clubes.</p></div>
        <Ayuda titulo="¿Qué vas a poder analizar?" bullets={[
          "Los reportes reunirán cobertura y evolución por grupo, institución y disciplina.",
          "Las comparaciones requieren jornadas confirmadas con fecha, métrica y protocolo claros.",
          "Hasta entonces, esta pantalla te indica qué análisis se preparan y por qué aún no están disponibles.",
        ]} />
        <div className="grid gap-3">
          {REPORTES.map(({ nombre, detalle, icon: Icon }) => (
            <article key={nombre} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><Icon className="size-5" aria-hidden /></span>
              <div className="min-w-0 flex-1"><h2 className="text-sm font-extrabold">{nombre}</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detalle}</p></div>
              <LockKeyhole className="size-4 shrink-0 text-muted-foreground" aria-label="Disponible cuando haya datos validados" />
            </article>
          ))}
        </div>
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-border bg-muted/25 px-6 py-10 text-center">
          <BarChart3 className="size-9 text-muted-foreground" aria-hidden />
          <p className="mt-4 text-sm font-extrabold">Primero validamos, después comparamos</p>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">Los gráficos se habilitarán cuando las métricas, protocolos y fechas de cada jornada estén confirmados.</p>
        </div>
      </div>
    </GuardiaSecretaria>
  );
}
