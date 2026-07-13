import type { Metadata, Viewport } from "next";
import { Caveat, Manrope } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { PerfilProvider } from "@/components/perfil-context";

const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// Letra "de marcador" — solo para las anotaciones a mano de la landing
const caveat = Caveat({
  variable: "--font-marker",
  subsets: ["latin"],
  weight: ["400", "700"],
});

// URL canónica para que og:image y demás metadata salgan absolutas
// (WhatsApp y las redes lo exigen). Sobreescribible por entorno.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://talentodeportivosalta.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Talento Deportivo Salta",
    template: "%s · Talento Deportivo Salta",
  },
  description:
    "La evolución de cada deportista, medida en serio. Seguimiento longitudinal de deportistas de clubes formadores.",
  applicationName: "Talento Deportivo Salta",
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Talento Deportivo Salta",
    title: "Talento Deportivo Salta",
    description:
      "La evolución de cada deportista, medida en serio. Seguimiento longitudinal de deportistas de clubes formadores.",
    locale: "es_AR",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f4f6f3",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${manrope.variable} ${caveat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PerfilProvider>
          <AppShell>{children}</AppShell>
        </PerfilProvider>
      </body>
    </html>
  );
}
