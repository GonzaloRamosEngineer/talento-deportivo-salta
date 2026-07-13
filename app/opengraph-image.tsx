import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Tarjeta de preview para WhatsApp / redes (og:image + twitter fallback).
// Misma dirección "Cancha clara" que la UI: fondo claro cálido, verde
// césped #15803D y la curva de evolución como único elemento con área
// de color. Se genera estáticamente en el build.

export const alt =
  "Talento Deportivo Salta — la evolución de cada deportista, medida en serio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const [manropeExtraBold, manropeMedium] = await Promise.all([
    readFile(join(process.cwd(), "lib/fonts/manrope-latin-800-normal.woff")),
    readFile(join(process.cwd(), "lib/fonts/manrope-latin-500-normal.woff")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: "#f4f6f3",
          fontFamily: "Manrope",
          position: "relative",
        }}
      >
        {/* Curva de evolución de fondo, lado derecho */}
        <svg
          width="640"
          height="630"
          viewBox="0 0 640 630"
          style={{ position: "absolute", right: 0, bottom: 16 }}
        >
          <defs>
            <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#15803D" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#15803D" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <line x1="60" y1="180" x2="600" y2="180" stroke="#e2e7e0" strokeWidth="2" />
          <line x1="60" y1="320" x2="600" y2="320" stroke="#e2e7e0" strokeWidth="2" />
          <line x1="60" y1="460" x2="600" y2="460" stroke="#e2e7e0" strokeWidth="2" />
          <path
            d="M80 500 L210 430 L340 452 L470 300 L570 170 L570 560 L80 560 Z"
            fill="url(#area)"
          />
          <path
            d="M80 500 L210 430 L340 452 L470 300 L570 170"
            fill="none"
            stroke="#15803D"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="80" cy="500" r="11" fill="#15803D" stroke="#fcfcfa" strokeWidth="4" />
          <circle cx="210" cy="430" r="11" fill="#15803D" stroke="#fcfcfa" strokeWidth="4" />
          <circle cx="340" cy="452" r="11" fill="#15803D" stroke="#fcfcfa" strokeWidth="4" />
          <circle cx="470" cy="300" r="11" fill="#15803D" stroke="#fcfcfa" strokeWidth="4" />
          <circle cx="570" cy="170" r="15" fill="#fcfcfa" stroke="#15803D" strokeWidth="7" />

        </svg>

        {/* Columna de texto */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 0 24px 84px",
            width: 720,
          }}
        >
          {/* Isologo */}
          <svg width="108" height="108" viewBox="0 0 64 64">
            <rect width="64" height="64" rx="18" fill="#15803D" />
            <path
              d="M13.5 45.5 29 36.5 50 18"
              fill="none"
              stroke="#fff"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="13.5" cy="45.5" r="5" fill="#fff" stroke="#15803D" strokeWidth="2.6" />
            <circle cx="29" cy="36.5" r="5" fill="#fff" stroke="#15803D" strokeWidth="2.6" />
            <circle cx="50" cy="18" r="6.8" fill="#fff" stroke="#15803D" strokeWidth="2.6" />
          </svg>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: 40,
              fontSize: 76,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "#17211b",
              lineHeight: 1.05,
            }}
          >
            <span>Talento Deportivo</span>
            <span style={{ color: "#15803D" }}>Salta</span>
          </div>

          <div
            style={{
              marginTop: 28,
              fontSize: 31,
              fontWeight: 500,
              color: "#5f6d63",
              lineHeight: 1.35,
              width: 600,
            }}
          >
            La evolución de cada deportista, medida en serio.
          </div>

          <div
            style={{
              marginTop: 52,
              fontSize: 22,
              fontWeight: 500,
              color: "#5f6d63",
            }}
          >
            Fundación Evolución Antoniana · Digital Match Global
          </div>
        </div>

        {/* Base verde césped */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 16,
            backgroundColor: "#15803D",
          }}
        />
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Manrope", data: manropeExtraBold, weight: 800, style: "normal" },
        { name: "Manrope", data: manropeMedium, weight: 500, style: "normal" },
      ],
    },
  );
}
