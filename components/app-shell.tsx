"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Users,
  CalendarDays,
  ClipboardPlus,
  Dumbbell,
  Landmark,
  Settings,
  LogIn,
  LogOut,
  Check,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoTalento } from "@/components/logo";
import { CLUB } from "@/lib/mock-data";
import { crearClienteBrowser } from "@/lib/supabase/client";
import { PERFILES, usePerfil, type Perfil } from "@/components/perfil-context";

/** Estado de sesión real: "Salir" si hay sesión, "Ingresar" si no. */
function BotonSesion({ compacto = false }: { compacto?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const supabase = crearClienteBrowser();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setCargando(false);
    });
  }, []);

  if (cargando) return null;

  if (!email) {
    return (
      <Link
        href="/login"
        className={cn(
          "flex items-center gap-2 rounded-lg text-xs font-bold text-muted-foreground transition-colors hover:text-foreground",
          compacto ? "px-2 py-1" : "px-3 py-2",
        )}
      >
        <LogIn className="size-3.5" aria-hidden />
        Ingresar
      </Link>
    );
  }

  return (
    <button
      onClick={async () => {
        await crearClienteBrowser().auth.signOut();
        router.push("/login");
      }}
      className={cn(
        "flex items-center gap-2 rounded-lg text-left text-xs font-bold text-muted-foreground transition-colors hover:text-foreground",
        compacto ? "px-2 py-1" : "px-3 py-2",
      )}
      title={email}
    >
      <LogOut className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">Salir ({email.split("@")[0]})</span>
    </button>
  );
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  destacado?: boolean;
}

function navPara(perfil: Perfil): NavItem[] {
  if (perfil === "comision") {
    return [
      { href: "/panel", label: "Inicio", icon: Home },
      { href: "/deportistas", label: "Deportistas", icon: Users },
      { href: "/sesiones", label: "Agenda", icon: CalendarDays },
    ];
  }
  if (perfil === "super_admin") {
    // La plataforma NO navega datos individuales de ningún club:
    // su mundo es el observatorio (solo agregados).
    return [
      { href: "/panel", label: "Inicio", icon: Home },
      { href: "/observatorio", label: "Observatorio", icon: Landmark, destacado: true },
    ];
  }
  const base: NavItem[] = [
    { href: "/panel", label: "Inicio", icon: Home },
    { href: "/deportistas", label: "Deportistas", icon: Users },
    { href: "/medicion", label: "Medir", icon: ClipboardPlus, destacado: true },
    { href: "/entrenamiento", label: "Entrenar", icon: Dumbbell },
    { href: "/sesiones", label: "Agenda", icon: CalendarDays },
  ];
  if (perfil === "admin_club") {
    // Gestión del club (categorías, staff, altas) — pantallas reales
    base.push({ href: "/club", label: "Club", icon: Settings });
  }
  return base;
}

function esActiva(pathname: string, href: string) {
  return href === "/panel" ? pathname === "/panel" : pathname.startsWith(href);
}

function SelectorPerfil({ compacto = false }: { compacto?: boolean }) {
  const { perfil, setPerfil, sesionReal } = usePerfil();
  const [abierto, setAbierto] = useState(false);
  const actual = PERFILES.find((p) => p.id === perfil)!;

  // Con sesión real el rol lo decide la base (membresía/RLS), no un
  // selector de UI: se muestra como badge de solo lectura.
  if (sesionReal) {
    return (
      <span
        className={cn(
          "flex items-center gap-1.5 rounded-full bg-secondary font-bold text-secondary-foreground",
          compacto
            ? "px-2.5 py-1 text-[10px] uppercase tracking-wide"
            : "w-full justify-center rounded-lg px-3 py-2.5 text-xs",
        )}
        title="Rol de tu sesión — no se puede cambiar desde acá"
      >
        {actual.label}
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setAbierto((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-full bg-secondary font-bold text-secondary-foreground transition-colors",
          compacto
            ? "px-2.5 py-1 text-[10px] uppercase tracking-wide"
            : "w-full justify-between rounded-lg px-3 py-2.5 text-xs",
        )}
        aria-expanded={abierto}
        aria-label="Cambiar perfil (demo)"
      >
        <span className="truncate">{actual.label}</span>
        <ChevronDown className={cn("size-3 shrink-0", abierto && "rotate-180")} aria-hidden />
      </button>

      {abierto && (
        <div
          className={cn(
            "absolute z-50 w-64 rounded-xl border border-border bg-popover p-1.5 shadow-lg",
            compacto ? "right-0 top-9" : "bottom-12 left-0",
          )}
        >
          <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Ver la demo como…
          </p>
          {PERFILES.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setPerfil(p.id);
                setAbierto(false);
              }}
              className={cn(
                "flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted",
                p.id === perfil && "bg-secondary/60",
              )}
            >
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                {p.id === perfil && <Check className="size-3.5 text-primary" aria-hidden />}
              </span>
              <span>
                <span className="block text-sm font-bold">{p.label}</span>
                <span className="block text-[11px] leading-snug text-muted-foreground">
                  {p.descripcion}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { perfil } = usePerfil();
  const nav = navPara(perfil);

  // La landing pública (/) y el login viven fuera del shell de la app.
  if (pathname === "/" || pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-dvh w-full">
      {/* ---------- Sidebar (desktop) ---------- */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <Link
          href="/panel"
          className="flex items-center gap-3 px-5 py-6 transition-opacity hover:opacity-80"
        >
          <LogoTalento className="size-10" />
          <div className="leading-tight">
            <p className="text-sm font-extrabold tracking-tight">
              Talento Deportivo
            </p>
            <p className="text-xs text-muted-foreground">
              {perfil === "super_admin" ? "Provincia de Salta" : CLUB.nombre}
            </p>
          </div>
        </Link>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {nav.map(({ href, label, icon: Icon }) => {
            const activa = esActiva(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                  activa
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4.5" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex flex-col gap-2 px-4 py-4">
          <SelectorPerfil />
          <BotonSesion />
          <p className="text-[11px] leading-snug text-muted-foreground">
            Demo · la gestión del club (Club) guarda en la base real; los
            paneles siguen con datos de ejemplo
          </p>
        </div>
      </aside>

      {/* ---------- Contenido ---------- */}
      <div className="flex min-w-0 flex-1 flex-col md:pl-60">
        {/* Header mobile */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:hidden">
          <Link href="/panel" className="flex items-center gap-2.5">
            <LogoTalento className="size-8" />
            <div className="leading-tight">
              <p className="text-sm font-extrabold tracking-tight">
                Talento Deportivo
              </p>
              <p className="text-[11px] text-muted-foreground">
                {perfil === "super_admin" ? "Provincia de Salta" : CLUB.nombre}
              </p>
            </div>
          </Link>
          <SelectorPerfil compacto />
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-5 md:px-8 md:pb-12 md:pt-8">
          {children}
        </main>
      </div>

      {/* ---------- Barra inferior (mobile) ---------- */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          {nav.map(({ href, label, icon: Icon, destacado }) => {
            const activa = esActiva(pathname, href);
            if (destacado) {
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex flex-col items-center gap-0.5 px-2 pb-1.5 pt-2"
                >
                  <span
                    className={cn(
                      "-mt-5 flex size-12 items-center justify-center rounded-full border-4 border-background text-primary-foreground shadow-md transition-colors",
                      activa ? "bg-primary" : "bg-primary/90",
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-bold",
                      activa ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {label}
                  </span>
                </Link>
              );
            }
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex min-w-14 flex-col items-center gap-0.5 px-2 pb-1.5 pt-2.5 text-[10px] font-bold transition-colors",
                  activa ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
