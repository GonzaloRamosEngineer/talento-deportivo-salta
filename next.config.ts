import type { NextConfig } from "next";

// Revisar la app desde el celular por la IP de la red local es parte del
// flujo de trabajo de este proyecto (es mobile-first y se usa en la cancha).
// Next bloquea por defecto el acceso cross-origin al server de desarrollo, y
// eso incluye DOS cosas distintas: servir los assets del dev server y aceptar
// las Server Actions.
//
// Va con comodín de subred a propósito: antes estaba fijada `192.168.1.130`
// y el día que el router repartió otra IP el dev server empezó a fallar con
// errores de WebSocket y assets bloqueados, sin que la causa fuera evidente.
const LAN = ["192.168.0.*", "192.168.1.*", "10.0.0.*"];

const nextConfig: NextConfig = {
  allowedDevOrigins: LAN,
  // En la revisión mobile por localhost el indicador flotante de Next tapa
  // acciones y la barra inferior. Los errores siguen disponibles en terminal
  // y en .next/dev/logs; solo se oculta el botón rojo del framework.
  devIndicators: false,
  // Solo en desarrollo: en producción la protección de origen de las Server
  // Actions se deja intacta.
  ...(process.env.NODE_ENV === "development"
    ? { experimental: { serverActions: { allowedOrigins: LAN } } }
    : {}),
};

export default nextConfig;
