"use client";

import { type ReactNode } from "react";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { CargandoPelota } from "@/components/cargando-pelota";
import { usePerfil } from "@/components/perfil-context";

export function GuardiaSecretaria({ children }: { children: ReactNode }) {
  const { perfil, cargandoSesion } = usePerfil();

  if (cargandoSesion) return <CargandoPelota />;
  if (perfil !== "secretaria") {
    return (
      <AvisoAcceso
        titulo="Esta pantalla pertenece al Espacio Secretaría"
        detalle="Ingresá como Secretaría · operación para recorrer sus grupos, jornadas y equipo."
        accionHref="/panel?perfil=secretaria"
        accionLabel="Abrir demo Secretaría"
      />
    );
  }

  return children;
}
