# Plan CTO priorizado

## Talento Deportivo Salta

**Fecha del diagnóstico:** 1 de agosto de 2026  
**Objetivo:** convertir el producto actual —hoy sólido como demostración— en una plataforma segura, operable y validada para trabajar con datos reales de menores.

Este documento es un backlog vivo. Debe actualizarse al comenzar y terminar cada tarea, registrando decisiones, responsables y evidencias.

## Estado ejecutivo

El producto tiene una propuesta deportiva clara, una experiencia móvil bien resuelta y una base técnica razonable para un MVP. Los principales riesgos actuales no son la falta de funcionalidades, sino:

1. Cuentas demo públicas con privilegios elevados.
2. Un flujo inseguro de invitación/recuperación de cuentas existentes.
3. Consentimiento declarado, pero no exigido técnicamente en toda la operación.
4. Falta de pruebas automáticas de RLS e integridad multi-club.
5. Ausencia de validación sostenida con profesores reales.

**Decisión CTO recomendada:** congelar nuevas funcionalidades hasta completar P0, los controles P1 que bloquean el piloto y la preparación formal del piloto.

## Cómo usar este documento

Estados:

- `[ ]` Pendiente.
- `[~]` En curso.
- `[x]` Terminado y verificado.
- `[!]` Bloqueado; explicar el motivo en el registro de decisiones.

Escala de impacto:

- **Crítico:** evita una exposición, toma de cuenta o tratamiento indebido de datos de menores.
- **Muy alto:** condición necesaria para operar de manera confiable.
- **Alto:** mejora sustancialmente adopción, continuidad o escalabilidad.
- **Medio:** reduce deuda o mejora eficiencia, sin bloquear el piloto.

Las estimaciones suponen una persona senior que conoce el repositorio. No incluyen tiempos de aprobación externa.

## Próxima tarea recomendada

> **Comenzar por T-001: contención inmediata de cuentas demo.**  
> Es una tarea corta, reduce el mayor riesgo actual y prepara la separación definitiva entre demo y producción.

---

## Severidad corregida del hallazgo P0 (2026-08-02)

La redacción original del diagnóstico subestimó la gravedad. La descripción correcta es:

> Una cuenta pública con privilegios de plataforma puede enumerar clubes y
> administradores y generar un recovery link para **tomar la cuenta de un
> administrador real**. Además, la cuenta admin demo puede explotar la rama
> global de `invitarMiembro`. Antes del primer club real, ambas vías deben
> quedar eliminadas.

Cadenas verificadas en código:

1. `PASSWORD_DEMO` está en el bundle público (`app/login/page.tsx:32`) y
   `plataforma@demo.talento.ar` tiene `app_metadata.plataforma = true`
   (`scripts/crear-usuarios-demo.mjs:37`). Con esa cuenta, `linkAdminClub()`
   (`app/plataforma/actions.ts:287`) acuña un recovery link del admin de
   cualquier club → toma de cuenta completa. `listarClubes()` además expone
   nombre y email del admin de cada club por service role.
2. `invitarMiembro()` (`app/club/staff/actions.ts:98-109`) es la única de las
   tres funciones que **no** valida alcance: cualquier `admin_club` —incluida la
   demo pública— puede invitar cualquier email existente de toda la instancia y
   recibir su recovery link. `regenerarLink` y `linkAdminClub` sí están acotadas
   (mismo club / admin de ese club), pero igual entregan el token al invitador.

Atenuante vigente, que no reduce la severidad técnica: hoy el único club es la
vitrina ficticia, así que no hay menores expuestos. Permite corregir sin
incidente. La ventana se cierra con el primer club real (Gate A).

---

## P0 — Seguridad inmediata

### [x] T-001 · Contener las cuentas demo privilegiadas

- **Prioridad:** P0, inmediata.
- **Esfuerzo:** 30–90 minutos. **Real: ~90 minutos.**
- **Complejidad:** baja.
- **Impacto:** crítico.
- **Responsable:** Gastón + agente.
- **Dependencias:** ninguna.
- **Estado:** terminada y verificada el 2026-08-02, branch
  `fix/p0-contencion-demo`.

No alcanza con quitarle `plataforma = true` a la cuenta demo: la cuenta pública
`admin_club` conserva el agujero de `invitarMiembro()` para cualquier email
existente. Hay que cerrar las dos vías.

Acciones:

- Eliminar o deshabilitar `plataforma@demo.talento.ar`.
- Retirar de la demo pública el perfil administrador, o bloquearle invitaciones
  y gestión sensible.
- Quitar `TalentoDemo26` del bundle público. **Rotar la clave y volver a
  escribirla en `login/page.tsx` no sirve: seguiría siendo pública.**
- Rotar las credenciales conocidas.
- Invalidar sesiones activas.
- Mantener el observatorio demo sobre el mock anónimo que ya existe
  (`lib/use-observatorio.ts`, rama anónima).
- Actualizar los scripts que dependen de la clave demo
  (`scripts/e2e-dia1.mjs`, `scripts/e2e-trayectoria.mjs`,
  `scripts/crear-usuarios-demo.mjs`) y la tabla de accesos de
  `docs/OPERACION.md:141-146`.

Criterios de aceptación:

- Una cuenta demo no puede ejecutar ninguna Server Action con service role.
- Una cuenta demo no puede listar clubes, emails ni membresías reales.
- Una cuenta demo no puede modificar ni eliminar datos persistidos.
- Ninguna credencial demo viaja en el bundle del cliente.
- La verificación se realiza llamando directamente al backend, no solo
  ocultando botones.

Cómo se resolvió:

- `plataforma@demo.talento.ar` **eliminada** (con sus sesiones). El botón
  "Liga / Secretaría de Deportes" es ahora un deep-link ANÓNIMO a
  `/observatorio?perfil=super_admin`, que ya corría sobre el mock
  agregado de `lib/use-observatorio.ts`. La demo no perdió nada.
- La clave salió del bundle: el acceso rápido pasa por la server action
  `entrarComoDemo` (`app/login/actions.ts`) y la clave vive en
  `DEMO_PASSWORD`. Rotarla ya no requiere redeploy de código.
- `lib/demo.ts` es la fuente de verdad del bloqueo: las cuentas demo
  llevan `app_metadata.demo = true` (solo escribible con service role) y
  quedan rechazadas en `invitarMiembro`, `regenerarLink`, `quitarMiembro`
  y el gate `esPlataforma()`. **Al agregar una action sensible nueva hay
  que sumarle el guard.**
- Se mantuvo el perfil admin en la demo, en modo lectura: `/club/staff`
  sigue visible (lecturas por RLS sobre datos ficticios) pero no puede
  invitar ni generar links. Decisión de producto: la demo vende el
  circuito de gestión, y hasta T-003 el riesgo se contiene en el server.

Hallazgos laterales de la auditoría:

- **La instancia no tiene clubes reales**, solo la vitrina ficticia: la
  cadena existió pero nunca hubo menores expuestos.
- **Nadie tiene membresía en más de un club** → la constraint de T-002B
  se puede aplicar sin migración de datos previa.
- `scripts/crear-usuarios-demo.mjs` buscaba el club por un nombre viejo
  ("Club Atlético Antoniana"): estaba roto desde que se renombró la
  vitrina. Corregido.

Límite conocido, asumido: rotar la contraseña **no invalida las sesiones
demo ya abiertas**. Quedan contenidas por el guard del server, y la única
cuenta cuyo privilegio importaba se eliminó junto con sus sesiones. La
invalidación dura llega con T-003.

Evidencia:

- Branch: `fix/p0-contencion-demo`.
- `node scripts/verificar-contencion-demo.mjs` → **9 OK · 0 fallos**
  (incluye: la clave vieja ya no autentica, la sesión demo no obtiene
  filas de `observatorio_clubes()`, ninguna clave demo aparece en
  `.next/static` ni `.next/server`).
- Smoke por el circuito real (puppeteer, dev en :3210): el acceso rápido
  entra a `/panel` con sesión real, el observatorio anónimo renderiza, y
  **la invitación desde el admin demo a un email existente devuelve el
  motivo de bloqueo sin `token_hash` ni link de acceso** — o sea, el
  rechazo es del backend, no de la UI.
- `npm run lint` sin errores (2 warnings preexistentes de `<img>`) y
  `npm run build` exitoso.
- Fecha de cierre: 2026-08-02.

Acción pendiente del lado de infra, **bloquea el deploy**: agregar
`DEMO_PASSWORD` a las env vars de Vercel. Sin eso, el acceso rápido de la
demo publicada devuelve "La demo no está configurada en este entorno".

### [ ] T-002 · Corregir invitaciones y recuperación de cuentas

- **Prioridad:** P0.
- **Esfuerzo:** 1–2 días.
- **Complejidad:** media.
- **Impacto:** crítico.
- **Responsable:** por asignar.
- **Dependencias:** T-001 como contención recomendada.

Problema a resolver:

Cuando el email invitado ya existe, el sistema genera un enlace de recuperación y se lo devuelve al administrador. El token nunca debe quedar en manos del invitador.

**La invitación por LINK vía WhatsApp NO se toca.** Es una decisión de producto
deliberada (CLAUDE.md: evita depender del SMTP default de Supabase, y es como se
comunica un club de verdad). La vulnerabilidad no está en el link: está en la
rama de *recovery* para cuentas preexistentes. Un token de `invite` sobre una
cuenta que el admin acaba de crear no da acceso a nada previo.

Comportamiento objetivo:

```text
Email nuevo
→ crear usuario pendiente
→ generar invite de un solo uso
→ el admin lo comparte por WhatsApp
→ el usuario crea su clave
```

```text
Email existente y cuenta ya activada
→ NUNCA generar recovery
→ vincular la membresía solo si corresponde (ver T-002B)
→ informar al admin: "Esta persona ya tiene cuenta; debe ingresar con su clave"
```

```text
Olvidó su contraseña
→ autoservicio "Olvidé mi clave" (T-002C)
→ el enlace lo envía Supabase al email por Resend
→ ningún admin recibe el token
```

Eliminar la rama recovery de:

- `invitarMiembro` (`app/club/staff/actions.ts:102`).
- `regenerarLink` para cuentas ya activadas (`app/club/staff/actions.ts:179`).
- `linkAdminClub` para administradores ya activados (`app/plataforma/actions.ts:306`).

Distinción que hay que respetar en las tres:

- **Cuenta pendiente, nunca ingresó** (`last_sign_in_at === null`): se puede
  reemitir un acceso de onboarding controlado para la misma membresía.
- **Cuenta ya activada**: nunca reemitir un token al admin; recuperación
  únicamente por email del titular.

Gotcha de implementación: `generateLink({ type: 'invite' })` **rechaza emails
existentes** — es exactamente por eso que el código actual cae en la rama
recovery. Reemitir onboarding a una cuenta pendiente requiere
`type: 'magiclink'` gateado por `last_sign_in_at === null`, o borrar y recrear el
usuario de Auth. No sale del `invite` a secas.

Criterios de aceptación:

- Ninguna respuesta al admin contiene `token_hash`, OTP ni recovery link de una
  cuenta ya activada.
- Un admin no puede cambiar o tomar la contraseña de otra persona.
- Existen pruebas para: usuario nuevo, usuario pendiente sin activar, usuario
  activado, email de otro club y email inválido.
- Los errores no confirman innecesariamente qué emails existen globalmente.
  **Tensión conocida:** rechazar con "ya pertenece a otro club" (T-002B) es un
  oráculo de existencia global. Para una action autenticada, solo-admin y con
  rate limiting es un tradeoff aceptable, pero se toma a conciencia y el mensaje
  queda genérico ("no se puede incorporar ese email; escribí a la plataforma"),
  sin confirmar pertenencia.
- Hay rate limiting y auditoría de quién intentó invitar a quién.

Evidencia:

- PR/commit:
- Prueba ejecutada:
- Fecha de cierre:

### [ ] T-002B · Definir e imponer "una cuenta = un club" para el MVP

- **Prioridad:** P0, bloquea T-002.
- **Esfuerzo:** ½ día.
- **Complejidad:** media.
- **Impacto:** muy alto.
- **Responsable:** por asignar.
- **Dependencias:** ninguna. **Debe resolverse ANTES de vincular usuarios existentes.**

Problema verificado:

La base **ya permite** dos membresías del mismo usuario:
`membresia` tiene `unique (club_id, auth_user_id)`
(`supabase/migrations/20260712063635_ola1_mvp.sql:88`) — unicidad por club, no
por usuario. Pero tres lookups resuelven la membresía sin filtrar por club y con
`.maybeSingle()`:

- `lib/use-club.ts:48-52`
- `components/perfil-context.tsx:118-122`
- `adminActual()` en `app/club/staff/actions.ts:32-37`

Con dos filas, PostgREST devuelve 2, `.maybeSingle()` falla y `data` queda
`null`. **El modo de falla es silencioso:** el fallback de "sin membresía" en
`perfil-context.tsx:125-131` asigna `perfil = "profesor"` con sesión real y
categorías vacías. Un `admin_club` con dos clubes vería la UI de profe mientras
`adminActual()` lo rechaza en todas las server actions: bloqueo total sin
mensaje explicativo.

Aclaración para no sobredimensionar: **no es un bypass de RLS.** El alcance de
datos lo sigue gobernando `membresia_categoria` en el server, no ese estado de
cliente. Es rotura funcional, no fuga.

Opción elegida para el MVP (reversible):

- Agregar `unique (auth_user_id)` en `membresia`.
- Si el email ya pertenece a otro club, rechazar la incorporación (mensaje
  genérico, ver T-002).
- Plataforma y cuentas de club siguen siendo mutuamente excluyentes (la cuenta
  de plataforma no tiene fila en `membresia`, por regla #4 de CLAUDE.md).
- Documentarla como decisión de MVP, no como límite del modelo: en Salta un PF
  puede trabajar en dos clubes.

Opción futura, cuando el piloto lo pida:

- Selector de club y membresía activa explícita.
- Contexto de autorización por club.
- Server Actions que reciban y validen el club activo.

Pre-flight obligatorio: verificar que **hoy no exista ningún `auth_user_id` con
dos membresías** antes de aplicar la constraint, o la migración falla.

Cambio de esquema → requiere revisión manual explícita (regla de CLAUDE.md).

Criterios de aceptación:

- La constraint está aplicada por migración versionada.
- Invitar un email que ya es staff de otro club falla con mensaje genérico.
- Los tres lookups siguen funcionando y ninguno puede recibir 2 filas.

### [ ] T-002C · Recuperación de clave autoservicio con Resend

- **Prioridad:** P0, cierra el hueco funcional que deja T-002.
- **Esfuerzo:** ½–1 día.
- **Complejidad:** media.
- **Impacto:** muy alto.
- **Responsable:** por asignar.
- **Dependencias:** T-002. Requiere SMTP propio.

Al eliminar el recovery administrado, "perdí mi clave" deja de ser tarea del
admin y pasa a ser autoservicio. Sin esto, T-002 deja gente afuera.

Acciones:

- Configurar SMTP propio (Resend) en Auth de Supabase — vía Management API,
  nunca `supabase config push`.
- Pantalla "Olvidé mi clave" en `/login` → `resetPasswordForEmail`.
- El enlace llega exclusivamente al email del titular y aterriza en
  `/cuenta/clave`, que ya existe.
- La respuesta al usuario no revela si el email existe.

Criterios de aceptación:

- Un usuario recupera su clave sin intervención de ningún admin.
- Ningún admin obtiene tokens de otra persona por ninguna vía.
- El circuito funciona en producción con el dominio propio.

### [ ] T-003 · Separar Supabase demo y producción

- **Prioridad:** P0.
- **Esfuerzo:** 1–2 días.
- **Complejidad:** media.
- **Impacto:** crítico.
- **Responsable:** por asignar.
- **Dependencias:** migraciones reproducibles y seeds sintéticos.

Arquitectura objetivo:

```text
Deployment demo       → Supabase Demo       → usuarios y datos sintéticos
Deployment producción → Supabase Producción → usuarios y datos reales
```

Acciones:

- Crear un proyecto Supabase exclusivo para demo.
- Aplicar las mismas migraciones versionadas.
- Crear un seed exclusivamente sintético y regenerable.
- Configurar variables de entorno separadas en Vercel.
- Eliminar usuarios demo de producción.
- Documentar cómo reiniciar la demo.
- Añadir una señal visual inequívoca de entorno demo.

Criterios de aceptación:

- La demo no posee credenciales, URLs ni conexiones hacia producción.
- Los usuarios demo no existen en Auth de producción.
- Se puede destruir y regenerar la demo sin afectar producción.
- Una prueba automatizada confirma el aislamiento.

Evidencia:

- Proyectos/entornos:
- Documento operativo:
- Fecha de cierre:

### [ ] T-004 · Resolver vulnerabilidades de dependencias

- **Prioridad:** P0.
- **Esfuerzo:** ½–1 día.
- **Complejidad:** baja–media.
- **Impacto:** muy alto.
- **Responsable:** por asignar.
- **Dependencias:** ninguna.

Línea base del 1 de agosto de 2026:

- `npm audit --omit=dev`: 7 vulnerabilidades, 5 altas y 2 moderadas.
- Afectados principales: Next.js, PostCSS, Sharp y dependencias transitivas de `shadcn`.

Acciones:

- Actualizar Next.js y lockfile a versiones corregidas.
- Revisar PostCSS y Sharp resultantes.
- Quitar `shadcn` de dependencias de producción o moverlo a desarrollo si solo se usa como CLI.
- Ejecutar lint, build y smoke test después de actualizar.
- Configurar Dependabot o Renovate.

Criterios de aceptación:

- Cero vulnerabilidades altas en dependencias de producción.
- `npm run lint` sin errores.
- `npm run build` exitoso.
- Los circuitos de login, panel y medición funcionan.

---

## P1 — Condiciones para iniciar el piloto

### [ ] T-005 · Hacer cumplir el consentimiento en base de datos

- **Prioridad:** P1, bloquea datos reales.
- **Esfuerzo:** 3–5 días.
- **Complejidad:** alta.
- **Impacto:** crítico.
- **Responsable:** por asignar.
- **Dependencias:** definición legal/operativa aprobada.

Modelo sugerido:

```text
preinscripto → consentimiento vigente → activo
activo       → revocación             → restringido
restringido  → resolución             → reactivado, anonimizado o eliminado
```

Reglas mínimas:

- Un preinscripto puede tener solo los datos indispensables para gestionar el consentimiento.
- Sin consentimiento vigente no se pueden crear mediciones, asistencias, asignaciones, citaciones ni informes.
- La revocación bloquea nuevas operaciones inmediatamente.
- Registrar versión del consentimiento, tutor, fecha, operador y revocación.
- Las restricciones deben vivir en RLS, triggers o funciones transaccionales; no solo en React.

Criterios de aceptación:

- Insertar una medición sin consentimiento vigente falla en base de datos.
- Revocar un consentimiento bloquea inmediatamente nuevas operaciones.
- Comisión y plataforma no pueden modificar consentimientos.
- Existe un circuito documentado para acceso, rectificación y supresión.

### [ ] T-006 · Reforzar integridad multi-club y multi-categoría

- **Prioridad:** P1.
- **Esfuerzo:** 2–4 días.
- **Complejidad:** alta.
- **Impacto:** muy alto.
- **Responsable:** por asignar.
- **Dependencias:** T-005 puede compartir funciones de autorización.

Garantías requeridas:

- Deportista, sesión, partido y categoría deben pertenecer al mismo club.
- Un citado debe pertenecer a la categoría del partido.
- Una asignación o asistencia debe corresponder a la categoría de la sesión.
- Responsable y `registrado_por` deben ser miembros autorizados del club.
- El atributo debe ser global o corresponder a la disciplina.
- El valor debe respetar naturaleza, unidad y rangos razonables.

Criterios de aceptación:

- Todos los intentos cruzados entre clubes fallan en base de datos.
- Un UUID conocido de otro club no permite crear relaciones ni modificar datos.
- Las reglas tienen tests positivos y negativos.

### [ ] T-007 · Crear suite automática de seguridad, RLS y CI

- **Prioridad:** P1.
- **Esfuerzo:** 2–4 días.
- **Complejidad:** media–alta.
- **Impacto:** muy alto.
- **Responsable:** por asignar.
- **Dependencias:** entorno Supabase local o staging aislado.

Pipeline mínimo:

```text
lint → build/typecheck → unitarios → RLS/integración → smoke E2E
```

Matriz mínima:

- Profe ve y opera su categoría.
- Profe no ve ni opera otra categoría.
- Admin opera únicamente su club.
- Comisión solo consulta.
- Plataforma recibe solo agregados.
- Demo no alcanza producción.
- Sin consentimiento no hay operación deportiva.
- No existen relaciones cruzadas entre clubes.
- Ningún admin obtiene credenciales o tokens de otra persona.

Criterios de aceptación:

- Las pruebas corren en cada pull request.
- Los E2E no mutan la base compartida o productiva.
- Un fallo de seguridad bloquea el merge/deploy.

### [ ] T-008 · Diseñar e instrumentar el piloto real

- **Prioridad:** P1.
- **Esfuerzo:** 2–3 días de preparación; ejecución de 8–12 semanas.
- **Complejidad:** media.
- **Impacto:** crítico para el negocio.
- **Responsable:** coordinador/a del piloto por asignar.
- **Dependencias:** T-001 a T-007 terminadas para usar datos reales.

Alcance recomendado:

- Un club.
- Una o dos categorías.
- Dos profesores.
- Entre 30 y 50 deportistas.
- Ocho a doce semanas.
- Un responsable operativo de seguimiento y soporte.

KPIs:

- Profesores activos semanalmente.
- Porcentaje de sesiones con asistencia registrada.
- Mediciones por deportista por mes.
- Tiempo medio y percentil 90 para completar una jornada.
- Jornadas abandonadas, fallidas o recuperadas desde borrador.
- Cobertura y vigencia de consentimientos.
- Retención de profesores en semanas 4, 8 y 12.
- Uso real de informes con familias.

Criterios de éxito iniciales:

- Al menos 75% de semanas con actividad.
- Al menos 80% de sesiones relevantes registradas.
- Dos jornadas completas de medición por categoría.
- Menos de cinco minutos para una jornada típica.
- Cero datos deportivos registrados sin consentimiento vigente.

Entregables:

- Completar `negocio/03_plan_piloto.md`.
- Dashboard de adopción sin analítica individual de rendimiento.
- Informe de cierre con decisiones: continuar, corregir o detener.

### [ ] T-009 · Incorporar auditoría de acciones sensibles

- **Prioridad:** P1.
- **Esfuerzo:** 2–4 días.
- **Complejidad:** media–alta.
- **Impacto:** alto.
- **Responsable:** por asignar.
- **Dependencias:** identidad y entornos estabilizados.

Registrar como mínimo:

- Altas, modificaciones, bajas y exportaciones de deportistas.
- Consentimientos, revocaciones y supresiones.
- Invitaciones, cambios de rol y asignaciones de categorías.
- Cambios de parámetros globales.
- Acciones administrativas realizadas con service role.
- Informes compartidos o descargados cuando sea técnicamente viable.

Criterios de aceptación:

- Cada evento registra actor, fecha, entidad, acción y contexto mínimo.
- El log no puede ser modificado por usuarios de club.
- Existe una política de conservación y revisión de alertas.

### [ ] T-010 · Validar protocolos y módulos científicos

- **Prioridad:** P1.
- **Esfuerzo:** 1–3 sesiones profesionales + 1 día técnico.
- **Complejidad:** media.
- **Impacto:** alto.
- **Responsable:** preparador físico/revisor científico por asignar.
- **Dependencias:** disponibilidad del especialista.

Acciones:

- Revisar protocolos objetivos y materiales necesarios.
- Crear rúbricas 1–10 por edad/nivel para evaluaciones subjetivas.
- Validar umbrales de crecimiento y presentación de madurez.
- Definir error esperado, intervalos mínimos y condiciones de repetición.
- Ocultar con feature flag cualquier contenido no aprobado en producción.

Criterios de aceptación:

- Cada protocolo muestra autor/revisor, versión y fecha.
- Las evaluaciones subjetivas tienen rúbrica visible.
- No se presentan módulos pendientes de revisión como decisión científica cerrada.

### [ ] T-011 · Automatizar backups y probar restauración

- **Prioridad:** P1.
- **Esfuerzo:** 1–2 días.
- **Complejidad:** media.
- **Impacto:** alto.
- **Responsable:** por asignar.
- **Dependencias:** entorno de producción definido.

Acciones:

- Activar backups administrados y PITR cuando entren datos reales.
- Mantener una copia secundaria cifrada si se considera necesario.
- Quitar dependencia de una laptop encendida.
- Documentar RPO, RTO y responsables.
- Ejecutar y registrar una restauración de prueba.

Criterios de aceptación:

- Backups automáticos monitoreados.
- Una restauración completa fue probada exitosamente.
- Credenciales, dumps y archivos sensibles están cifrados y con acceso restringido.

---

## P2 — Consolidación después de asegurar el piloto

### [ ] T-012 · Exportación completa de datos del club

- **Esfuerzo:** 1–2 días.
- **Complejidad:** media.
- **Impacto:** alto.

Debe incluir datos propios del club en formatos documentados, respetando permisos, consentimiento y auditoría. Refuerza portabilidad, confianza y ausencia de lock-in.

### [ ] T-013 · Optimizar consultas y carga longitudinal

- **Esfuerzo:** 3–6 días.
- **Complejidad:** alta.
- **Impacto:** alto a escala.

Acciones sugeridas:

- No descargar todas las mediciones visibles en cada carga.
- Consultar por deportista, categoría, atributo y ventana temporal.
- Crear agregados server-side para paneles.
- Medir latencia y volumen antes/después.
- Diseñar índices a partir de consultas reales.

### [ ] T-014 · Modularizar hotspots del frontend

- **Esfuerzo:** 4–8 días progresivos.
- **Complejidad:** media.
- **Impacto:** medio–alto.

Priorizar archivos de 500–900 líneas: importación, staff, entrenamiento, agenda, ficha y alta de deportistas. Separar dominio, acceso a datos, validaciones y presentación sin hacer una reescritura total.

---

## P3 — Solo después de validar adopción

### [ ] T-015 · Modo offline completo con sincronización

- **Esfuerzo:** 2–4 semanas.
- **Complejidad:** alta.
- **Impacto:** potencialmente alto.
- **Condición:** confirmar en el piloto que la conectividad es una causa relevante de abandono.

Debe contemplar cola local, resolución de conflictos, cifrado/limpieza del dispositivo, identidad de usuario, reintentos y señal clara de sincronización.

### [ ] T-016 · Interoperabilidad Liga/COMET

- **Esfuerzo:** 3–8 semanas según API y acuerdos.
- **Complejidad:** alta.
- **Impacto:** estratégico.
- **Condición:** disponer de clubes activos y un acuerdo institucional concreto.

Objetivo: reducir doble carga administrativa, no intentar reemplazar sistemas federativos.

### [ ] T-017 · Nuevas disciplinas y expansión territorial

- **Esfuerzo:** variable.
- **Complejidad:** media–alta.
- **Impacto:** estratégico.
- **Condición:** el flujo de fútbol debe mostrar retención y calidad de datos sostenidas.

Cada disciplina requiere catálogo, protocolos, referentes profesionales y validación propia. No debe tratarse como un simple cambio de etiquetas.

---

## Secuencia de ejecución sugerida

### Semana 1

Orden corregido el 2026-08-02 (T-002B antes de vincular usuarios existentes,
T-002C para no dejar a nadie sin recuperación):

| Orden | Tarea | Esfuerzo | Impacto |
|---:|---|---:|---|
| 1 | T-001 · Deshabilitar plataforma y admin demo privilegiados | 30–90 min | Crítico |
| 2 | T-002 · Eliminar el recovery entregado a administradores | ½–1 día | Crítico |
| 3 | T-002B · Imponer "una cuenta = un club" | ½ día | Muy alto |
| 4 | T-002C · Recuperación autoservicio con Resend | ½–1 día | Muy alto |
| 5 | T-004 · Next.js 16.2.12 y dependencias | ½ día | Muy alto |
| 6 | T-003 · Separar demo y producción | 1–2 días | Crítico antes del piloto |

- [x] T-001 · Contención demo. *(2026-08-02 — falta `DEMO_PASSWORD` en Vercel)*
- [ ] T-002 · Recuperación e invitaciones.
- [ ] T-002B · Una cuenta = un club.
- [ ] T-002C · Autoservicio de clave (Resend).
- [ ] T-004 · Dependencias.
- [ ] T-003 · Separación demo/producción.

### Semana 2

- [ ] T-005 · Consentimiento obligatorio.
- [ ] T-006 · Integridad multi-club.
- [ ] T-007 · Tests RLS y CI.

### Semana 3

- [ ] T-009 · Auditoría.
- [ ] T-010 · Revisión profesional.
- [ ] T-011 · Backups.
- [ ] T-008 · Instrumentación y preparación del piloto.

### Semanas 4–12

- [ ] Ejecutar el piloto.
- [ ] Revisar métricas semanalmente.
- [ ] Corregir fricciones verificadas en cancha.
- [ ] Evitar nuevas funcionalidades no solicitadas por usuarios reales.

### Después del piloto

- [ ] T-012 · Exportación.
- [ ] T-013 · Escalabilidad.
- [ ] T-014 · Modularización progresiva.
- [ ] Evaluar T-015 a T-017 usando evidencia del piloto.

---

## Puertas de decisión

### Gate A · Habilitar datos reales

Solo se habilita cuando T-001 a T-007 estén terminadas y verificadas.

### Gate B · Ampliar a más categorías

Solo si el piloto mantiene adopción durante al menos ocho semanas y no existen incidentes de privacidad o pérdida de datos.

### Gate C · Incorporar otros clubes

Requiere proceso repetible de onboarding, soporte, consentimiento, exportación y recuperación ante incidentes.

### Gate D · Escala provincial

Requiere evidencia de retención, calidad metodológica, costos operativos reales, gobernanza de datos y observatorio con reglas de anonimización/mínimos de muestra.

---

## Registro de decisiones y avances

| Fecha | Tarea | Decisión o avance | Responsable | Evidencia |
|---|---|---|---|---|
| 2026-08-01 | Diagnóstico | Se prioriza seguridad, consentimiento y piloto sobre nuevas funcionalidades | Por asignar | Este documento |
| 2026-08-02 | T-001 | Severidad corregida a toma de cuenta completa (no solo exposición institucional). Alcance ampliado: además del flag `plataforma`, cerrar la rama global de `invitarMiembro` del admin demo y sacar la clave del bundle. Esfuerzo corregido a 30–90 min | Por asignar | Verificación en código: `login/page.tsx:32`, `crear-usuarios-demo.mjs:37`, `plataforma/actions.ts:287`, `staff/actions.ts:98-109` |
| 2026-08-02 | T-002 | Se PRESERVA la invitación por link vía WhatsApp para emails nuevos. Se elimina por completo el recovery administrado, distinguiendo cuenta pendiente de cuenta activada. Gotcha registrado: `generateLink({type:'invite'})` rechaza emails existentes | Por asignar | `staff/actions.ts:88-109`, `plataforma/actions.ts:60-97` |
| 2026-08-02 | T-002B | Nueva tarea. La base ya permite multi-club (`unique (club_id, auth_user_id)`) y los tres lookups con `.maybeSingle()` rompen en silencio, degradando el perfil a "profesor". Decisión MVP: una cuenta = un club, reversible. No es bypass de RLS | Por asignar | `ola1_mvp.sql:88`, `use-club.ts:48-52`, `perfil-context.tsx:118-131`, `staff/actions.ts:32-37` |
| 2026-08-02 | T-002C | Nueva tarea. Al eliminar el recovery administrado hace falta autoservicio por email (Resend) o T-002 deja gente sin poder recuperar la clave | Por asignar | — |
| 2026-08-02 | T-001 | **CERRADA.** Cuenta de plataforma demo eliminada, clave fuera del bundle (`DEMO_PASSWORD` + server action), cuentas demo bloqueadas en el server vía `lib/demo.ts`. Se mantiene el perfil admin en la demo en modo lectura (decisión de producto: la vitrina vende el circuito de gestión). Auditoría: no hay clubes reales, no hubo exposición de menores | Gastón + agente | branch `fix/p0-contencion-demo`; `verificar-contencion-demo.mjs` 9 OK; smoke puppeteer del rechazo backend |
| 2026-08-02 | T-002B | Pre-flight OK: ningún `auth_user_id` tiene membresía en más de un club, la constraint se puede aplicar sin migrar datos | Agente | `scripts/contener-demo.mjs` |
| 2026-08-02 | T-004 | Línea base confirmada: 7 vulnerabilidades (5 altas). Next 16.2.10 con 9 avisos, incluidos bypass de middleware en App Router y disclosure de Server Functions internas. Fix = `next@16.2.12` (patch) | Por asignar | `npm audit --omit=dev` del 2026-08-02 |

## Riesgos que deben permanecer visibles

- El mayor riesgo de negocio sigue siendo que el profesor deje de cargar en la semana seis u ocho.
- Un incidente con datos de menores puede destruir la confianza institucional del proyecto.
- Las evaluaciones técnicas subjetivas no son comparables sin rúbricas y calibración.
- La plataforma registra evolución observada; no demuestra causalidad ni predice talento.
- El observatorio debe trabajar con agregados y mínimos de muestra, nunca rankings individuales.
- La operación humana y el acompañamiento al club son más importantes que el costo de infraestructura.

