"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ClipboardList,
  Eye,
  EyeOff,
  Landmark,
  LogIn,
  Megaphone,
  ShieldCheck,
  UserRound,
  Volleyball,
} from "lucide-react";
import { crearClienteBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Login real (Supabase Auth) con el lenguaje visual del login de
 * DMGFit —card glassy con tilt, glow que sigue el mouse, estados en
 * el botón— traducido a "Cancha clara". Además del form, ofrece
 * ACCESO RÁPIDO por perfil: cuatro usuarios demo reales (sesión y
 * RLS de verdad), pensado para recorrer la demo desde el celular
 * sin tipear nada.
 */

const PASSWORD_DEMO = "TalentoDemo26";

const ACCESOS_DEMO: {
  email: string;
  titulo: string;
  detalle: string;
  icon: React.ElementType;
}[] = [
  {
    email: "profe@demo.talento.ar",
    titulo: "Soy profe de una categoría",
    detalle: "Marcela · 9ª División y Escuelita 2016",
    icon: Megaphone,
  },
  {
    email: "admin@demo.talento.ar",
    titulo: "Administro un club",
    detalle: "Categorías, staff y consentimientos",
    icon: ClipboardList,
  },
  {
    email: "comision@demo.talento.ar",
    titulo: "Estoy en la comisión directiva",
    detalle: "Todo el club, solo consulta",
    icon: UserRound,
  },
  {
    email: "plataforma@demo.talento.ar",
    titulo: "Liga / Secretaría de Deportes",
    detalle: "Observatorio provincial, solo agregados",
    icon: Landmark,
  },
];

type Estado = "idle" | "checking" | "success" | "error";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [estado, setEstado] = useState<Estado>("idle");
  const [error, setError] = useState("");
  const [demoActivo, setDemoActivo] = useState<string | null>(null);

  // Aviso de /auth/confirmar cuando un link de acceso venció
  // (diferido a un tick para no setear estado sincrónico en el effect)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("aviso") !== "link-vencido") return;
    const t = setTimeout(
      () =>
        setError(
          "Ese link de acceso venció o ya se usó. Pedile al admin de tu club que te genere uno nuevo.",
        ),
      0,
    );
    return () => clearTimeout(t);
  }, []);

  // Tilt + glow (el gesto del login de DMGFit)
  const cardRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [glow, setGlow] = useState({ x: 50, y: 40 });

  const onMouseMove = (e: React.MouseEvent) => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setGlow({ x: px * 100, y: py * 100 });
      setTilt({ rx: (0.5 - py) * 8, ry: (px - 0.5) * 8 });
    });
  };

  const entrar = async (mail: string, pass: string): Promise<void> => {
    setEstado("checking");
    setError("");
    const supabase = crearClienteBrowser();
    const { error: e } = await supabase.auth.signInWithPassword({
      email: mail,
      password: pass,
    });
    if (e) {
      setEstado("error");
      setDemoActivo(null);
      setError(
        /invalid/i.test(e.message)
          ? "Usuario o contraseña incorrectos."
          : e.message,
      );
      setTimeout(() => setEstado("idle"), 1600);
      return;
    }
    // El rol de la pantalla ya no lo decide este flag: lo lee
    // PerfilProvider desde `membresia` (RLS) al detectar la sesión.
    setEstado("success");
    setTimeout(() => router.push("/panel"), 400);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (estado === "checking") return;
    void entrar(email.trim(), password);
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background p-4">
      {/* Patrón de puntos + glow que sigue el mouse, en clave verde */}
      <div className="absolute inset-0 opacity-50 [background-image:radial-gradient(#d9e0d8_1px,transparent_1px)] [background-size:30px_30px]" />
      <div
        className="pointer-events-none absolute size-[900px] rounded-full blur-3xl"
        style={{
          left: `${glow.x}%`,
          top: `${glow.y}%`,
          transform: "translate(-50%, -50%)",
          background:
            "radial-gradient(circle at center, rgba(21,128,61,0.14), rgba(21,128,61,0.06), transparent 65%)",
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        {/* Marca */}
        <div className="mb-8 text-center">
          <div
            className={cn(
              "mb-4 inline-flex size-16 items-center justify-center rounded-2xl border border-white/60 shadow-lg transition-colors duration-300",
              estado === "success"
                ? "bg-primary"
                : estado === "error"
                  ? "bg-destructive"
                  : "bg-foreground",
            )}
          >
            {estado === "success" ? (
              <Check className="size-8 text-white" aria-hidden />
            ) : estado === "error" ? (
              <AlertCircle className="size-8 text-white" aria-hidden />
            ) : (
              <Volleyball className="size-8 text-white" aria-hidden />
            )}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Talento Deportivo <span className="text-primary">Salta</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            La evolución de cada deportista, medida en serio
          </p>
        </div>

        {/* Card con tilt */}
        <div
          ref={cardRef}
          onMouseMove={onMouseMove}
          onMouseLeave={() => {
            setTilt({ rx: 0, ry: 0 });
            setGlow({ x: 50, y: 40 });
          }}
          className="relative overflow-hidden rounded-3xl border border-white/60 bg-card/85 shadow-[0_20px_60px_rgba(23,33,27,0.12)] backdrop-blur-2xl transition-transform duration-200"
          style={{
            transform: `perspective(1100px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
            transformStyle: "preserve-3d",
          }}
        >
          {/* Barrido de luz al verificar */}
          <div
            className="pointer-events-none absolute inset-x-0 h-24"
            style={{
              top:
                estado === "checking" || estado === "success"
                  ? "120%"
                  : "-120%",
              transition: "top 900ms ease-in-out",
              background:
                "linear-gradient(to bottom, transparent, rgba(21,128,61,0.12), transparent)",
            }}
          />

          <div className="p-7 md:p-8">
            {/* ---------- Acceso rápido por perfil (mobile-first) ---------- */}
            <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
              Conocé la demo
            </p>
            <p className="font-marker mt-1 rotate-[-1deg] text-2xl font-bold text-primary">
              elegí quién sos y entrá ↓
            </p>
            <div className="mt-4 flex flex-col gap-2.5">
              {ACCESOS_DEMO.map(({ email: mail, titulo, detalle, icon: Icon }) => (
                <button
                  key={mail}
                  type="button"
                  disabled={estado === "checking"}
                  onClick={() => {
                    setDemoActivo(mail);
                    void entrar(mail, PASSWORD_DEMO);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3.5 text-left transition-all hover:border-primary/50 hover:bg-secondary/50 active:scale-[0.99] disabled:opacity-60",
                    demoActivo === mail && "border-primary bg-secondary/70",
                  )}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-extrabold leading-tight">
                      {titulo}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {demoActivo === mail && estado === "checking"
                        ? "Entrando…"
                        : detalle}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            {/* ---------- Separador ---------- */}
            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                o con tu cuenta
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>

            {/* ---------- Form real ---------- */}
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@club.com"
                  required
                  disabled={estado === "checking"}
                  className="h-12 w-full rounded-xl border border-input bg-background px-4 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground"
                >
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={verPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    disabled={estado === "checking"}
                    className="h-12 w-full rounded-xl border border-input bg-background px-4 pr-12 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={() => setVerPassword((v) => !v)}
                    aria-label={
                      verPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {verPassword ? (
                      <EyeOff className="size-4.5" aria-hidden />
                    ) : (
                      <Eye className="size-4.5" aria-hidden />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3">
                  <AlertCircle
                    className="mt-0.5 size-4 shrink-0 text-destructive"
                    aria-hidden
                  />
                  <p className="text-sm font-semibold text-destructive">
                    {error}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={estado === "checking"}
                className={cn(
                  "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-bold text-primary-foreground transition-all active:scale-[0.99] disabled:opacity-70",
                  estado === "success"
                    ? "bg-primary"
                    : "bg-primary hover:opacity-90",
                )}
              >
                {estado === "checking" ? (
                  "Verificando…"
                ) : estado === "success" ? (
                  <>
                    <Check className="size-5" aria-hidden /> ¡Adentro!
                  </>
                ) : (
                  <>
                    <LogIn className="size-5" aria-hidden /> Ingresar
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 flex items-center justify-between">
              <Link
                href="/"
                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="size-3" aria-hidden /> Volver
              </Link>
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                title="RLS activo en todas las tablas"
              >
                <ShieldCheck className="size-3" aria-hidden /> Acceso por rol
              </span>
            </div>
          </div>
        </div>

        {/* Sello DMG, como en DMGFit */}
        <div className="mt-8 flex flex-col items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Engineered by
          </span>
          <a
            href="https://www.digitalmatchglobal.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-border bg-card px-5 py-2 text-xs font-bold text-muted-foreground shadow-sm transition-all hover:border-primary/40 hover:text-primary hover:shadow-md"
          >
            DIGITAL MATCH GLOBAL
          </a>
        </div>
      </div>
    </div>
  );
}
