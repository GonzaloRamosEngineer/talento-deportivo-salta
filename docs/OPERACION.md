# OPERACION.md — Quién da de alta qué (la cadena completa)

*Definido el 2026-07-12 al armar el login real. Responde la pregunta
operativa fundamental: ¿cómo arranca un club en la plataforma y quién
carga cada cosa? La matriz de permisos es `PERFILES.md`; esto es la
SECUENCIA. El estado indica qué existe hoy y qué falta construir.*

## La cadena de alta, en orden

```
PLATAFORMA (service role)          ADMIN DEL CLUB                    PROFE
─────────────────────────          ──────────────────────────        ─────────────────────
1. Alta del club                →  3. Crea las categorías        →   6. Carga deportistas
2. Alta del primer admin           4. Invita a los profes            (de SUS categorías)
   (membresía admin_club)          5. Asigna categorías a c/profe    7. Jornada de medición
                                   (también puede hacer 6 y 7        8. Sesiones y asistencia
                                    sobre todo el club)
```

### 1-2 · Alta del club y su primer admin — LO HACE LA PLATAFORMA

Decisión de MVP: **no hay onboarding self-service de clubes**. Un
club entra porque la plataforma (nosotros) lo da de alta, junto con
la primera membresía `admin_club` (el referente institucional del
club). Razones: control de calidad del piloto, y las tablas `club` y
`membresia` inicial solo se escriben por service role (RLS no da
INSERT de club a nadie).

- **Hoy**: `supabase/seed.sql` (club Antoniana) +
  `scripts/crear-usuarios-demo.mjs` (usuarios y membresías demo).
  Para un club nuevo: duplicar ese patrón de script — 10 minutos.
- **Futuro (Ola 1.5)**: pantalla interna de la plataforma
  ("crear club + invitar admin por email"). No es prioridad: damos
  de alta un club por mes, no cien por día.

### 3 · Categorías del club — LAS CREA EL ADMIN

El admin define la estructura real del club sobre el catálogo global:
- **Escuelitas** por año de nacimiento (`tipo=escuelita`,
  `anio_nacimiento=2019…2014`)
- **Divisiones inferiores** 9ª→3ª (`tipo=inferior`, cohorte 2013…2007)
- **Reserva** y **Primera** (sin cohorte)

RLS ya lo permite (`categoria_insert_admin`). Las 15 de Antoniana ya
están sembradas.

- **Hoy (construido 2026-07-12)**: pantalla `/club/categorias` — alta,
  edición y eliminación (solo si la categoría no tiene deportistas),
  más el botón "generar estructura estándar" (escuelitas + 9ª→3ª +
  Reserva + Primera, cohortes calculadas según el año actual; solo
  crea las que faltan). Verificada e2e contra la base real.

### 4-5 · Profes y sus categorías — LOS INVITA EL ADMIN

El admin crea la membresía del profe (`rol=entrenador`) y le asigna
categorías en `membresia_categoria`. El profe SOLO ve y opera esas
categorías (RLS v6, no es configurable por UI).

- **Hoy (construido 2026-07-12)**: pantalla `/club/staff` — invitar
  (nombre, email, rol, categorías tildadas), editar las categorías de
  cada profe, quitar del staff (no a uno mismo), y badge "todavía no
  entró" para los pendientes. La invitación es **por LINK, no por
  mail**: el server genera el link de acceso
  (`auth.admin.generateLink`, gateado a que quien pide sea admin de su
  club) y el admin lo comparte por WhatsApp — evita el límite del SMTP
  default de Supabase (~2 mails/hora) y calza con cómo se comunica un
  club. El link (`/auth/confirmar?token_hash=…`, vence a las 24 h,
  regenerable desde la lista) valida el token, deja la sesión y lleva
  a `/cuenta/clave` a crear la contraseña. Cuando haya SMTP propio
  (Resend), el envío por mail es un paso más, no un cambio de modelo.

### 6 · Deportistas — LOS CARGA EL PROFE (de sus categorías) O EL ADMIN

Alta con lo mínimo: nombre, año de nacimiento, categoría, y el
consentimiento del tutor como parte del MISMO flujo (si falta, queda
visible como pendiente — nunca bloquea en el piloto, nunca se
esconde). Sin DNI real: `doc_interno`.

- **Hoy (construido 2026-07-12)**: formulario `/deportistas/nuevo` —
  deportista + tutor + consentimiento en el mismo paso; si el
  consentimiento falta, el alta no se bloquea pero queda marcado
  pendiente. El profe solo puede dar de alta en sus categorías (el
  select ni ofrece las otras; RLS lo garantiza igual), con sugerencia
  de categoría por cohorte al elegir la fecha de nacimiento. Queda
  listo para cargar al siguiente de la misma categoría. La lista de
  /deportistas sigue siendo mock (fase wiring pendiente). Para la
  carga masiva inicial de un club real: planilla → script con
  service role (como hicimos en DMGFit), no UI.
- **Prueba e2e**: `scripts/limpiar-e2e.mjs` verifica y limpia los
  datos del recorrido completo (admin crea categoría → invita profe →
  profe entra por link y da de alta con consentimiento).

### 7-8 · Mediciones, sesiones, asistencia — EL DÍA A DÍA DEL PROFE

Jornada de medición (atributo → categoría → carga de corrido),
sesiones con estado, asistencia POR EXCEPCIÓN (todos presentes por
defecto, se tocan solo las faltas — `presente default true` ya está
en el esquema), partidos con citación.

- **Hoy**: UI completa en mocks; esquema completo en la base.
- **Falta (fase wiring)**: conectar las pantallas.

## Los 4 accesos demo (login público)

El login (`/login`) permite entrar con usuarios REALES (sesión y RLS
de verdad) para recorrer cada perfil — pensado para demo en celular:

| Botón | Usuario | Rol real |
|---|---|---|
| "Soy profe de una categoría" | `profe@demo.talento.ar` | `entrenador` (9ª + Escuelita 2016) |
| "Administro un club" | `admin@demo.talento.ar` | `admin_club` |
| "Estoy en la comisión directiva" | `comision@demo.talento.ar` | `comision_directiva` |
| "Liga / Secretaría de Deportes" | `plataforma@demo.talento.ar` | plataforma (sin membresía) |

Contraseña de todos: `TalentoDemo26` (en
`scripts/crear-usuarios-demo.mjs`). **⚠ Antes de cargar datos reales
del piloto: borrar estos usuarios o rotar la contraseña** — hoy son
inofensivos porque la base solo tiene el catálogo y categorías (sin
deportistas).

## Regla de oro para no perderse

Si la duda es "¿quién puede X?" → `PERFILES.md`.
Si la duda es "¿en qué orden se hace X?" → este documento.
Si la duda es "¿qué política lo hace cumplir?" → `supabase/migrations/`.
