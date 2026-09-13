# Plataforma de Desarrollo y Seguimiento de Talento Deportivo

Plataforma para que clubes deportivos formadores (escuelitas, divisiones
inferiores, disciplinas amateurs) registren a sus deportistas y sigan su
**evolución en el tiempo** mediante capacidades medibles y estandarizadas
(velocidad, salto, resistencia, técnica, etc.).

> Producto de **Digital Match Global**, implementado en alianza con la
> **Fundación Evolución Antoniana** (socio institucional y de impacto en Salta).
>
> Sobre los datos de los deportistas, la Fundación y el club son responsables
> del tratamiento y DMG es encargado. Ver `/privacidad` en la app.

📄 Para el contexto completo del proyecto (problema, visión, modelo de
negocio), ver [`CONTEXT.md`](./CONTEXT.md).
🤖 Para las reglas técnicas del proyecto, ver [`CLAUDE.md`](./CLAUDE.md).

---

## Estado actual

🚧 **MVP en producción, sin datos reales todavía** — <https://talentodeportivo.com.ar>

El producto funciona de punta a punta sobre Supabase real: alta de clubes y
staff, deportistas, mediciones con curva de evolución, sesiones, agenda y
observatorio. El único club cargado es la **vitrina con datos ficticios**.

**El producto está congelado para funcionalidades nuevas.** La prioridad es
`docs/PLAN_CTO_PRIORIZADO.md` —seguridad, consentimiento e integridad— hasta
habilitar el Gate A, que es lo que permite cargar datos de menores reales.
Antes de agregar cualquier cosa, leer ese documento.

Finanzas, valorización, gamificación y táctica quedan para etapas posteriores
(ver `docs/02_ola2_finanzas_gamificacion.sql` y `docs/03_ola3_tactica.sql`,
que son documentos de diseño y NO se ejecutan).

## Stack

- **Frontend:** Next.js (App Router) + React + TypeScript
- **Backend / DB:** [Supabase](https://supabase.com) (PostgreSQL + Auth + Row Level Security)
- **Deploy:** [Vercel](https://vercel.com)

## Cómo correr el proyecto localmente

Necesita `.env.local` con las credenciales de Supabase (no está en el repo).
Sin eso, la app levanta igual pero solo sirve la demo pública, que corre con
los datos mock de `lib/mock-data.ts`. La dirección de diseño está en
`docs/DESIGN.md`.

```bash
npm install
npm run dev          # http://localhost:3000

# Para probar desde el celular (misma red WiFi):
npm run dev -- -H 0.0.0.0
# y abrir http://<IP-local-de-esta-máquina>:3000 en el teléfono
# (la IP se ve con: ipconfig getifaddr en0)
#
# next.config.ts ya autoriza las subredes domésticas habituales en
# `allowedDevOrigins` y, solo en desarrollo, las Server Actions desde ahí.
# Son DOS permisos distintos: sin el segundo, la página carga pero las
# acciones de servidor fallan con un error poco claro.
```

## Estructura del proyecto