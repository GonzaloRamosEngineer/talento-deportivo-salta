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
tácticas, multi-disciplina por deportista, historial de cambio de
categoría, offline-sync real. (El alta de clubes ya salió de esta
lista: es la pantalla de plataforma `/plataforma/clubes`, Ola 1.5.)

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
reales.

El tablero de entrenamiento también es real (2026-07-14, Módulo A de
`negocio/10`, migración `20260714160059_sesion_asignacion.sql`
APLICADA): la planificación por jugador (a qué estación/área va cada
uno) CUELGA de la sesión del día, no crea un mundo aparte con fecha
propia. `sesion_asignacion(sesion_id, deportista_id, atributo_id)` con
PK `(sesion_id, deportista_id)` (un jugador, una sola estación),
`club_id` denormalizado por trigger (regla 6, como `medicion`) y RLS
lectura=`alcanza_categoria`/escritura=`opera_categoria` resuelta contra
la sesión padre (mismo patrón que `sesion_asistencia`). `/entrenamiento`
consume `useDatos`+`useAgenda`, se posa sobre la sesión de HOY —o la
próxima de esta semana— de la categoría (selector si hay varias),
precarga lo ya guardado y guarda por lote: materializa la sesión
virtual como al pasar lista (queda `programada`) y reconcilia las
asignaciones por reemplazo (descanso = sin fila). `useAgenda` trae
`sesion_asignacion` en el select de sesiones y lo materializa en
`Sesion.asignaciones`. Ya no queda ningún mock de producto salvo el
observatorio en su rama pública.

Endurecimiento pre-piloto y vitrina (2026-07-14) — decisiones que
PISAN el plan de `negocio/10` donde difieran:
- **Backups pilot-grade** (sin costo): `pg_dump` en Docker →
  Google Drive de la Fundación (`scripts/backup.mjs`, `docs/BACKUPS.md`).
  `.env.local` tiene `SUPABASE_DB_URL` (session pooler) y `TDS_BACKUP_DIR`.
- **Capa legal**: `/privacidad` (política pública Ley 25.326, fuera del
  shell) y **consentimiento imprimible** por deportista
  (`/deportistas/[id]/consentimiento`). La **foto del papel firmado a un
  bucket privado quedó DESCARTADA** (decisión del usuario: bajo valor);
  la **firma electrónica online** queda en ROADMAP para cuando escale.
- **`membresia.funcion`** (text, descriptivo, NO toca RLS — el acceso lo
  sigue gobernando `rol`): función profesional del staff (DT, PF,
  nutricionista, psicólogo/a, asistente social…). Se muestra y setea en
  `/club/staff`. Narrativa de "formación integral"; **NO** se guardan
  datos sensibles (evaluaciones psicológicas/cognitivas) de menores.
- **Revisión v6 RESUELTA**: modelo de acceso por categoría confirmado;
  "deportista sin categoría" lo ven solo admin + comisión (se dejó así).
- **El club "Fundación Evolución Antoniana" es la VITRINA con datos
  FICTICIOS** (no menores reales): 302 jugadores, ~16.600 mediciones con
  historia, agenda/tablero/partidos llenos. Reseed con
  `scripts/sembrar-showcase.mjs` + `scripts/sembrar-showcase-agenda.mjs`
  (idempotentes, service role, tag `SHW-` / `@staff.demo.local`). Los
  clubes reales del piloto entran limpios por `/plataforma/clubes`.
- **Módulo B hecho (2026-07-14)**: drawer "¿Cómo medir?" —
  `lib/como-medir.ts` (guías por NOMBRE de atributo: protocolo paso a
  paso + materiales + diagrama SVG para objetivas; "cómo puntuar" +
  "en qué fijarse" para subjetivas; ideas de trabajo con rótulo "no es
  una prescripción"; talla/peso sin ideas, con nota "se registra, no
  se juzga") + `components/como-medir.tsx` (trigger + drawer portal;
  `variante="ideas"` para el tablero). Enganchado en `/medicion`
  (paso 1) y `/entrenamiento` (área activa). TODO el contenido es
  base y está marcado "pendiente de revisión del PF de la Fundación"
  (`GUIA_PENDIENTE_REVISION`): al recibir la versión del PF, se
  reemplaza el texto ahí y se apaga el flag. Atributos nuevos del
  catálogo: agregar su guía en `GUIAS_MEDICION` (clave = nombre).
- Pendientes vivos: Módulo D (el estirón) y la revisión del PF sobre
  el contenido del Módulo B. Cuentas demo y rotación de clave de DB:
  diferidos por decisión (la vitrina es ficticia).

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

El alta de clubes es por pantalla (Ola 1.5, 2026-07-13, migración
`20260713064245_club_escudo.sql`): `/plataforma/clubes` (solo perfil
plataforma con sesión real) crea el club + el link de acceso de su
primer admin_club, edita datos y gestiona el ESCUDO del club
(`club.escudo_url`, bucket público `escudos` — lectura pública,
escritura SOLO service role, sin policies de INSERT). Las server
actions (`app/plataforma/actions.ts`) gatean por
`app_metadata.plataforma` y usan el cliente admin: el RLS de
`club`/`membresia` sigue sin INSERT para nadie — mantenerlo así.
El escudo se muestra vía `components/escudo-club.tsx` (fallback de
ícono si no hay imagen): shell, hub /club, panel, observatorio
(columna `escudo_url` de la RPC) e informe imprimible. Gotcha:
`/auth/confirmar` arma el origin del redirect desde el header
Host/x-forwarded-host (con `dev -H 0.0.0.0`, request.url trae la
dirección de bind y el redirect perdería las cookies).

Onboarding minimalista (2026-07-14) — convenciones a mantener en toda
pantalla nueva: (1) estado vacío con `components/estado-vacio.tsx`
(qué va acá + CTA que respeta permisos; si el rol no puede resolverlo,
`nota` diciendo quién sí), nunca una tabla/lista en blanco ni un select
vacío sin salida — si falta la dependencia (ej. categorías), derivar a
crearla; (2) ayuda contextual con `components/ayuda.tsx` (desplegable
cerrado, MÁXIMO 3 bullets) solo en pantallas densas; (3) la card
"Primeros pasos" del panel (`components/primeros-pasos.tsx`) se calcula
del estado real vía useDatos/useAgenda/useObservatorio, se tilda sola y
desaparece al completarse — pasos nuevos = agregar ahí, jamás tours ni
overlays. `useAgenda` expone `staff` (membresías visibles). Los fetch
manuales de las pantallas de gestión chequean `.error` del resultado
(supabase-js no lanza) para no dejar spinners infinitos.

Paquete "día 1 en el club" (2026-07-14): (1) `/deportistas/importar`
— el plantel entra pegando las celdas desde Excel/Sheets (el
portapapeles es TSV) o subiendo un CSV (UTF-8 con fallback
windows-1252); todo se parsea en el navegador, con mapeo de columnas
autodetectado por encabezados y corregible, categoría resuelta por
nombre o por cohorte de nacimiento, duplicados contra el plantel
existente excluidos por defecto y preview antes de confirmar. El
consentimiento NUNCA se importa de una planilla: todos quedan
pendientes. Inserta por lotes de 50 vía RLS (deportista + tutor).
(2) `/medicion` guarda un BORRADOR local (`tds-borrador-medicion` en
localStorage, solo válido el mismo día) a cada tecla: el predio sin
señal no pierde la jornada; se restaura al volver (aviso con
Descartar), se limpia al guardar en la base, y hay banner de
sin-conexión (eventos online/offline). La restauración corre en un
microtask post-mount (la hidratación no puede depender de
localStorage). (3) `components/compartir-informe.tsx`: el informe
resumido como TEXTO de WhatsApp (wa.me) desde la ficha y el informe —
si el tutor tiene teléfono va directo a su chat (heurística AR:
549 + dígitos), mantiene el framing honesto y el aviso de datos de
menor; el link a la app no se comparte porque el tutor no tiene login
por diseño. E2E de las tres piezas: `scripts/e2e-dia1.mjs`
(auto-limpia sus datos de prueba).

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
