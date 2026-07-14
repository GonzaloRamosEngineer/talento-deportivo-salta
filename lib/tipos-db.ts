// Tipos de las filas REALES de Supabase que consumen las pantallas de
// gestión (subconjunto de columnas que efectivamente seleccionamos).
// La fuente de verdad del esquema es supabase/migrations/.

export type TipoCategoria = "escuelita" | "inferior" | "reserva" | "primera";

export interface CategoriaDB {
  id: string;
  nombre: string;
  tipo: TipoCategoria | null;
  anio_nacimiento: number | null;
  disciplina_id: string;
}

export type RolMembresia = "admin_club" | "entrenador" | "comision_directiva";

export interface MembresiaDB {
  id: string;
  auth_user_id: string;
  nombre: string;
  email: string | null;
  rol: RolMembresia;
  /** función/rol profesional, descriptivo (no afecta el acceso) */
  funcion: string | null;
}

export const ROL_LABEL: Record<RolMembresia, string> = {
  admin_club: "Admin del club",
  entrenador: "Profe",
  comision_directiva: "Comisión directiva",
};

// Funciones profesionales sugeridas (el campo es libre: la formación
// es integral, no solo física). `rol` gobierna el acceso; `funcion`
// solo describe qué profesional es la persona.
export const FUNCIONES_SUGERIDAS = [
  "Director técnico",
  "Ayudante de campo",
  "Preparador físico",
  "Entrenador de arqueros",
  "Coordinador",
  "Profe de escuelita",
  "Nutricionista",
  "Médico",
  "Kinesiólogo",
  "Psicólogo/a deportivo/a",
  "Asistente social",
];
