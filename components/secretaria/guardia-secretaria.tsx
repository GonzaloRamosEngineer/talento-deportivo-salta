"use client";

import { type ReactNode } from "react";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { CargandoPelota } from "@/components/cargando-pelota";
import { usePerfil } from "@/components/perfil-context";

export function GuardiaSecretaria({ children }: { children: ReactNode }) {
  const { perfil, cargandoSesion, sesionReal } = usePerfil();

  if (cargandoSesion) return <CargandoPelota />;
  if (perfil !== "secretaria") {
    return (
      <AvisoAcceso
        titulo="Esta pantalla pertenece al Espacio Secretaría"
        detalle="Ingresá como Secretaría · operación para recorrer sus grupos, jornadas y equipo."
        accionHref="/login"
        accionLabel="Ingresar"
      />
    );
  }
  if (!sesionReal) {
    return (
      <AvisoAcceso
        titulo="Ingresá al Espacio Secretaría"
        detalle="Las planillas, deportistas y mediciones son datos reales protegidos. Iniciá sesión con la cuenta de Secretaría para continuar."
        accionHref="/login"
        accionLabel="Ingresar"
      />
    );
  }

  return children;
}
