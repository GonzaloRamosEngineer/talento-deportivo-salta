# Plataforma de Desarrollo y Seguimiento de Talento Deportivo

Plataforma para que clubes deportivos formadores (escuelitas, divisiones
inferiores, disciplinas amateurs) registren a sus deportistas y sigan su
**evolución en el tiempo** mediante capacidades medibles y estandarizadas
(velocidad, salto, resistencia, técnica, etc.).

> Una iniciativa de **Fundación Evolución Antoniana**, con desarrollo de
> **Digital Match Global**.

📄 Para el contexto completo del proyecto (problema, visión, modelo de
negocio), ver [`CONTEXT.md`](./CONTEXT.md).
🤖 Para las reglas técnicas del proyecto, ver [`CLAUDE.md`](./CLAUDE.md).

---

## Estado actual

🚧 **En desarrollo — MVP (Ola 1)**

Alcance de esta etapa: ficha de deportistas, atributos configurables,
mediciones con gráfico de evolución, y sesiones de entrenamiento.
Finanzas, valorización, gamificación y táctica quedan para etapas
posteriores (ver `docs/sql/` para el esquema completo por olas).

## Stack

- **Frontend:** Next.js (App Router) + React + TypeScript
- **Backend / DB:** [Supabase](https://supabase.com) (PostgreSQL + Auth + Row Level Security)
- **Deploy:** [Vercel](https://vercel.com)

## Cómo correr el prototipo localmente

Etapa actual: **prototipo visual** con datos mock (sin Supabase, sin
variables de entorno). La dirección de diseño está en `docs/DESIGN.md`.

```bash
npm install
npm run dev          # http://localhost:3000

# Para probar desde el celular (misma red WiFi):
npm run dev -- -H 0.0.0.0
# y abrir http://<IP-local-de-esta-máquina>:3000 en el teléfono
# (la IP se ve con: ipconfig getifaddr en0)
```

## Estructura del proyecto