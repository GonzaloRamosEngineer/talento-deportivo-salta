import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite abrir el server de dev desde el celular por la IP de la
  // red local (sin esto, Next bloquea la navegación con 404).
  allowedDevOrigins: ["192.168.1.130"],
};

export default nextConfig;
