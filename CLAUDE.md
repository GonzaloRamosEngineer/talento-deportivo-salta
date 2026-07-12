# CLAUDE.md — Instrucciones para el agente de código en este repo

@AGENTS.md

## Stack obligatorio
- Frontend: Next.js (App Router) + React + TypeScript
- UI: Tailwind + shadcn/ui
- Gráficos: Recharts (timeline de evolución)
- Backend/DB: Supabase (PostgreSQL + Auth + Row Level Security)
- Deploy: Vercel
- Migraciones: Supabase CLI, versionadas. Nunca "config push" directo.
- No introducir otro stack de base de datos, UI o hosting sin preguntar.

## Reglas de diseño de datos — NO NEGOCIABLES

1. **Las mediciones de atributos son SIEMPRE una serie temporal**
   (tabla `medicion`, una fila por medición con fecha propia). Nunca
   guardar un atributo como columna del deportista. Esto incluye
   altura y peso: NO son columnas de `deportista`, son mediciones
   como cualquier otra.

2. **`disciplina` y `atributo` son catálogo GLOBAL, curado
   centralmente, sin `club_id`.** Los clubes activan categorías
   sobre ese catálogo pero nunca crean ni editan disciplinas o
   atributos propios. No crear políticas de escritura para el rol
   `authenticated` en esas dos tablas.

3. **Row Level Security activado desde el primer commit** en toda
   tabla con datos de deportistas o de staff, escrita en el mismo
   script que crea la tabla (no como anexo posterior). El modelo de
   acceso se apoya en la tabla `membresia` (club_id, auth_user_id,
   rol) y las funciones `es_miembro_de(club_id)` / `es_admin_de(club_id)`
   (ambas security definer con `search_path` fijado — mantenerlo así).
   Reparto de roles: config institucional (club, membresías,
   categorías) y borrado de deportistas = solo `admin_club`;
   operación diaria (deportistas, mediciones, sesiones,
   consentimientos) = cualquier miembro.

4. **Solo `membresia` tiene login** (roles: `admin_club`,
   `entrenador`, `comision_directiva`). La matriz completa de qué ve
   y hace cada perfil es `docs/PERFILES.md` — fuente de verdad, la UI
   y el RLS deben reflejarla. Claves: comisión directiva es consulta
   pura (`puede_operar()` en las policies de escritura); el entrenador
   accede SOLO a sus categorías asignadas (propuesta v6:
   `membresia_categoria`); el super admin de plataforma NUNCA accede a
   datos individuales, solo agregados. Deportistas y tutores NUNCA
   tienen fila en `auth.users` en esta etapa; no implementar auth para
   ellos sin discutirlo antes.

5. **IDs como UUID**, no seriales autoincrementales.

6. **`medicion.club_id` va denormalizado** (con trigger que lo
   sincroniza desde `deportista`), para que las políticas de RLS
   sobre la tabla más usada del sistema sean directas y no requieran
   joins.

7. **Una medición por deportista/atributo/día** (constraint unique).
   Si se necesita corregir una medición del mismo día, se actualiza,
   no se duplica.

## Framing honesto del producto (afecta código Y copys de la UI)
El sistema es un REGISTRO LONGITUDINAL de evolución del deportista,
no una prueba de impacto causal del entrenamiento. En chicos, buena
parte de la mejora física es maduración/crecimiento, no efecto del
entrenamiento. No programar ni redactar en la interfaz frases que
insinúen causalidad ("este entrenamiento mejoró a X"); usar lenguaje
de registro y tendencia observada, nunca de atribución causal.

## Datos de menores — requisito estructural
Toda carga de un deportista requiere que exista un registro de
`consentimiento` asociado (o al menos permitir cargarlo sin bloquear
en el piloto, pero dejarlo visible como pendiente). Minimizar datos:
usar `doc_interno`, nunca DNI real, salvo que sea imprescindible.

## Alcance actual (Ola 1 — MVP, lo único a construir ahora)
Construir SOLO:
- Registro de deportistas, tutores y consentimiento
- Gestión de categorías del club sobre el catálogo global de
  disciplinas/atributos (el catálogo en sí se siembra a mano, no
  se construye UI de administración de catálogo en el MVP)
- Carga de mediciones + gráfico de evolución (Recharts) — funcionalidad
  estrella. Priorizar la pantalla de CARGA rápida en el celular
  ("jornada de medición": cargar un atributo para toda una categoría
  de corrido) por sobre pulir el gráfico.
- Registro de sesiones de entrenamiento y asistencia
- Estado de evolución simple: tendencia basada en las últimas 3
  mediciones, mostrado explícitamente como "basado en tus últimas
  3 mediciones" (no un algoritmo opaco). SIEMPRE interpretar la
  tendencia según `atributo.sentido`: en atributos `menor_mejor`
  (ej. velocidad en segundos) bajar es mejorar; con `sentido` null
  (talla, peso) se registra sin juzgar mejora/retroceso.

NO construir todavía: finanzas, valorización, gamificación/logros,
tácticas, alta/onboarding de nuevos clubes (se siembra un solo club
—Antoniana— a mano), multi-disciplina por deportista, historial de
cambio de categoría, offline-sync real.

## Etapa actual: backend real creado, UI aún en mocks (transición)
El 2026-07-12 se aplicó la migración inicial al proyecto Supabase real
(v5 + v6 alcance por categoría + v7 agenda/partidos, con RLS completo)
y se sembró el catálogo global + club Antoniana + 15 categorías +
lugares. La UI sigue corriendo 100% con `lib/mock-data.ts`; el próximo
paso es migrar pantallas a datos reales (Auth de staff primero).
Credenciales en `.env.local` (gitignored) y en Vercel env; falta la
publishable key. La dirección de diseño está en `docs/DESIGN.md`.
Iteración 2 (2026-07-09) sumó: categorías por cohorte de nacimiento,
catálogo futbolero híbrido (objetivas con protocolo + técnicas 1-10
subjetivas), tab Habilidades en la ficha, vista tabla ordenable,
tablero de entrenamiento (/entrenamiento), observatorio multi-club
(/observatorio) y selector de perfil DEMO (`components/perfil-context.tsx`,
sin auth real — es solo visibilidad de UI).

## Esquema de base de datos
La fuente de verdad del esquema REAL es
`supabase/migrations/` (aplicadas vía `supabase db push`, nunca a
mano en el SQL Editor) + `supabase/seed.sql` (idempotente, se corre
con conexión directa/service role). Los scripts en `docs/` quedan
como documentos de diseño y roadmap (02 finanzas y 03 táctica NO se
ejecutan en el MVP). Nota de red: la conexión directa del proyecto es
IPv6-only; desde redes IPv4 usar el session pooler
(`aws-0-ca-central-1.pooler.supabase.com:5432`, user
`postgres.<project-ref>`).

## Estilo de trabajo esperado
- Priorizar simplicidad y velocidad de entrega: esto es un MVP para
  validar en un club real en pocas semanas.
- Ir armando el proyecto de forma incremental, preguntando antes de
  tomar decisiones grandes de arquitectura no cubiertas acá.
- Documentar en README.md cómo correr el proyecto localmente.
- Nunca commitear credenciales ni keys de Supabase — usar
  `.env.local` (gitignored).
- Ante cualquier cambio en esquema de datos, RLS o manejo de datos
  de menores: señalar explícitamente que requiere revisión manual,
  no asumir aprobación automática.
