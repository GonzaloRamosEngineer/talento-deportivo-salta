"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Check, KeyRound, Loader2 } from "lucide-react";
import { crearClienteBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Acá cae el invitado después de abrir su link de acceso
 * (/auth/confirmar ya validó el token y dejó la sesión): crea su
 * contraseña y entra. También sirve para renovar la clave con un
 * link de recovery.
 */
export default function ClavePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [clave, setClave] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [estado, setEstado] = useState<"idle" | "guardando" | "listo">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    crearClienteBrowser()
      .auth.getUser()
      .then(({ data }) => {
        setEmail(data.user?.email ?? null);
        setCargando(false);
      });
  }, []);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (clave.length < 8) {
      setError("La contraseña necesita al menos 8 caracteres.");
      return;
    }
    if (clave !== confirmacion) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setEstado("guardando");
    setError("");
    const { error: err } = await crearClienteBrowser().auth.updateUser({
      password: clave,
    });
    if (err) {
      setEstado("idle");
      setError(err.message);
      return;
    }
    setEstado("listo");
    setTimeout(() => router.push("/panel"), 700);
  };

  return (
    <div className="flex min-h-[70dvh] items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-7 shadow-sm">
        {cargando ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
          </div>
        ) : !email ? (
          <div className="text-center">
            <AlertCircle className="mx-auto size-8 text-muted-foreground" aria-hidden />
            <h1 className="mt-3 text-lg font-extrabold">El link ya no sirve</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Los links de acceso vencen a las 24 horas. Pedile al admin de tu club que te
              genere uno nuevo desde la pantalla de Staff.
            </p>
            <Link
              href="/login"
              className="mt-4 inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground"
            >
              Ir al ingreso
            </Link>
          </div>
        ) : (
          <>
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <KeyRound className="size-6" aria-hidden />
            </span>
            <h1 className="mt-4 text-xl font-extrabold tracking-tight">Creá tu contraseña</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tu cuenta es <span className="font-bold text-foreground">{email}</span>. Con
              esta contraseña vas a entrar de acá en adelante.
            </p>
            <form onSubmit={guardar} className="mt-5 space-y-3">
              <input
                type="password"
                autoComplete="new-password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                placeholder="Nueva contraseña (mín. 8)"
                minLength={8}
                required
                className="h-12 w-full rounded-xl border border-input bg-background px-4 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <input
                type="password"
                autoComplete="new-password"
                value={confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
                placeholder="Repetila"
                minLength={8}
                required
                className="h-12 w-full rounded-xl border border-input bg-background px-4 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              {error && (
                <p className="flex items-start gap-1.5 text-sm font-semibold text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
                </p>
              )}
              <button
                type="submit"
                disabled={estado !== "idle"}
                className={cn(
                  "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-bold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-70",
                )}
              >
                {estado === "guardando" ? (
                  <>
                    <Loader2 className="size-5 animate-spin" aria-hidden /> Guardando…
                  </>
                ) : estado === "listo" ? (
                  <>
                    <Check className="size-5" aria-hidden /> ¡Listo, entrando!
                  </>
                ) : (
                  "Guardar y entrar"
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
