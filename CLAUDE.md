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

## Etapa actual: backend real creado, UI en transición mock→real
El circuito de gestión del admin YA es real (2026-07-12): `/club`
(hub), `/club/categorias` (alta/edición/borrado + estructura
estándar), `/club/staff` (invitación por LINK vía server actions
gateadas a admin + asignación de categorías) y `/deportistas/nuevo`
(deportista + tutor + consentimiento en un paso). El flujo del
invitado es `/auth/confirmar` (route handler que valida el token y
ata las cookies a la respuesta) → `/cuenta/clave`. La secuencia
operativa completa está en `docs/OPERACION.md`.

El corazón del producto también es real (2026-07-12): `/medicion`
(jornada con upsert por deportista/atributo/día, fecha LOCAL — nunca
current_date del server UTC—, `registrado_por` = membresía),
`/deportistas` (lista/tabla), la ficha `/deportistas/[id]` (curva de
evolución + tendencia "últimas 3" calculadas de la serie real, firma
de consentimiento) y el informe imprimible. Todo pasa por
`lib/use-datos.ts`: hook DUAL que para el visitante anónimo devuelve
el mock (la demo pública sigue viva) y con sesión real arma
`Deportista`/`Atributo`/`Categoria` (las MISMAS interfaces del mock)
desde Supabase con UUIDs reales — RLS + categorías asignadas acotan
el alcance, sin filtro cliente propio. Al escribir pantallas nuevas:
consumir `useDatos()`, NUNCA importar `DEPORTISTAS`/`CATEGORIAS`
directo (los ids del mock no son los de la base).

La agenda también es real (2026-07-12): `lib/use-agenda.ts` es el
segundo hook dual — recibe el `useDatos()` de la página (nunca lo
duplica) y arma `Sesion`/`Partido`/`Horario`/`Lugar` con las mismas
interfaces del mock. Tres decisiones de diseño a respetar:
(1) **asistencia POR EXCEPCIÓN**: en `sesion_asistencia` solo se
guardan las FALTAS (`presente=false`); el hook materializa la lista
completa contra el plantel actual, y al guardar se borran y reinsertan
solo las ausencias. (2) **sesiones virtuales**: la semana se genera
del cronograma (`horario_entrenamiento`); una sesión sin registrar es
virtual (id `v_<horarioId>_<fecha>`) y recién se inserta en
`sesion_entrenamiento` al pasar lista o cancelarla. (3) los partidos
guardan SOLO datos grupales (citación + marcador; sin marcador en
escuelitas). Pantallas: `/sesiones` (semana + cronograma), 
`/sesiones/[id]` (pasar lista), `/partidos/nuevo`, `/partidos/[id]`
(resultado), `/club/agenda` (admin: lugares + cronograma). El panel
(`/panel`) y la tab Sesiones de la ficha también consumen datos
reales. Sigue en mock: tablero de entrenamiento (/entrenamiento,
oculto en el panel con sesión real).

El observatorio también es real (2026-07-12, migración
`20260712231049_observatorio_agregados.sql` APLICADA): la ÚNICA
ventana de la plataforma a los datos es la RPC `observatorio_clubes()`
— security definer con el gate `es_plataforma()` (app_metadata)
ADENTRO, devuelve exclusivamente totales por club (deportistas
activos, mediciones 30 días, % consentimiento, categorías activas,
última jornada). El RLS de la plataforma (0 filas en todo) NO se tocó
y no debe tocarse; cualquier métrica nueva del observatorio se agrega
como columna agregada de esa RPC, jamás como policy. `club.departamento`
ubica al club en el mapa IGN (lo carga la plataforma por service
role). Frontend: `lib/use-observatorio.ts` (dual mock/real) alimenta
/observatorio y el panel de plataforma; `MapaSalta` recibe los clubes
por prop.
`scripts/sembrar-demo-9na.mjs [--limpiar]` siembra 3 deportistas demo
con historial; `scripts/limpiar-e2e-agenda.mjs [--verificar]` verifica
y limpia el e2e de agenda.

Ciclo de vida del deportista completo (2026-07-12):
`/deportistas/[id]/editar` (lápiz en la ficha, solo sesión real +
perfil que opera) corrige datos, mueve de categoría (el select ya
viene acotado al alcance del rol; el RLS exige operar también la de
destino) y tiene DOS bajas con confirmación en dos pasos: desactivar
(`activo=false`, conserva historial — cualquier operador) y borrado
definitivo con cascada (solo admin). El panel además muestra "Para
estar encima" (`components/alertas-registro.tsx`): categorías con
plantel sin medir hace 3+ semanas o sin mediciones, y deportistas sin
primera medición — todo computado de useDatos, con copy de AUSENCIA
de registro (nunca de rendimiento, framing honesto).

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
