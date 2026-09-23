import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Forma de comparar en los buscadores: sin tildes, sin mayúsculas y sin
 * espacios, así "natacion" encuentra "Natación" y "sub 13" encuentra "SUB13".
 */
export function paraBuscar(texto: string) {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es").replace(/\s+/g, "")
}
