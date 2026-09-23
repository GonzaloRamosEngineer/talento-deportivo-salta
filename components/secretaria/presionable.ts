// Respuesta al presionar del Espacio Secretaría: en la cancha, con el dedo,
// es la única señal de que el toque se registró. Curva `--ease-out` de
// globals.css; con reduced-motion queda solo el cambio de color.
export const PRESIONABLE =
  "transition-[transform,background-color,border-color] duration-150 ease-(--ease-out) active:scale-[0.97] motion-reduce:active:scale-100";
