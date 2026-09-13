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

> **Cerradas: T-001 (2026-08-30), y T-004 + T-002B + T-002C (2026-09-13).
> Sigue T-002, la última P0, y ahora se puede cerrar sin dejar a nadie
> afuera.**  
> T-002 elimina el recovery administrado —el circuito por el que un admin
> recibe un token capaz de entrar como otra persona—. No se podía tocar antes
> por dos razones, y las dos están resueltas: T-002B definió qué hacer cuando
> el email pertenece a otro club (rechazar, sin emitir token) y T-002C dio la
> salida para quien pierde la clave (autoservicio por mail, verificado de
> punta a punta).
>
> Después de T-002: **T-003 → T-007 (arnés de tests) → T-005 + T-006.**
>
> Orden acordado el 2026-09-13 para lo que queda del Gate A:
> **T-002B → T-002 + T-002C → T-003 → T-007 (arnés de tests) → T-005 + T-006.**
> T-007 se adelanta a propósito: T-005 y T-006 son cambios de RLS y
> constraints, y escribirlos sin pruebas negativas es verificar a mano lo que
> debería verificar el CI.

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
- Quitar la clave demo del bundle público. **Rotar la clave y volver a
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

**Cierre en producción: 2026-08-30.** `DEMO_PASSWORD` cargada en Vercel
(production + preview, sensitive), branch mergeado a `main` por
fast-forward (`7047661`) y desplegado en
`talentodeportivo.com.ar` (antes `talentodeportivo.digitalmatchglobal.com`).
Verificado sobre el sitio: el
bundle de `/login` ya no contiene la clave vieja ni
`plataforma@demo.talento.ar`, y los tres perfiles demo entran.

Lección para el resto de las tareas P0: **el script de contención corre
contra el mismo Supabase que sirve producción** (la separación es T-003).
Al rotar la clave el 2026-08-02 sin desplegar el frontend nuevo, la
vitrina pública quedó rota 4 semanas — el `/login` desplegado seguía
mandando la clave vieja del bundle y devolvía "Usuario o contraseña
incorrectos". Nadie se dio cuenta porque nada lo monitorea. Hasta T-003,
**todo cambio de backend hay que desplegarlo el mismo día**, y conviene
un smoke del acceso demo después de cada deploy.

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

### [x] T-002B · Definir e imponer "una cuenta = un club" para el MVP

- **Prioridad:** P0, bloquea T-002.
- **Esfuerzo:** ½ día.
- **Complejidad:** media.
- **Impacto:** muy alto.
- **Responsable:** por asignar.
- **Dependencias:** ninguna. **Debe resolverse ANTES de vincular usuarios existentes.**
- **Estado:** terminada y aplicada en producción el 2026-09-13.

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

Cómo se resolvió (2026-09-13):

- Migración `20260913120000_una_cuenta_un_club.sql`, aplicada con
  `supabase db push`. Se deja la constraint vieja: es la que hay que
  restaurar si se revierte. La **reversión está documentada dentro de la
  propia migración** (`drop constraint`, instantáneo, no toca datos).
- `scripts/preflight-una-cuenta-un-club.mjs`: corrido dos veces, la segunda
  ya con el código en producción. 17 membresías, 17 usuarios distintos, 0 en
  más de un club.
- **Orden de despliegue: el código ANTES que la migración.** El código no
  depende de la constraint, y una vez arriba ya no se pueden crear
  membresías cruzadas — cierra la ventana entre el pre-flight y el push.
- `invitarMiembro` rechaza a quien ya tiene membresía. Si es de ESTE club lo
  dice; si es de otro, mensaje genérico con `SOPORTE_EMAIL` — nombrar el otro
  club le confirmaría al admin que ese email trabaja en otra institución. La
  consulta usa el cliente admin: el RLS del admin no ve membresías ajenas.
  **No alcanzaba con dejar reventar la constraint**: las dos violaciones son
  `23505` y distinguirlas por nombre obligaría a parsear el mensaje de error.
- Los tres lookups dejan de fallar en silencio: capturan el error y lo
  registran en vez de confundirlo con "no tiene membresía".

Validación previa en el Supabase local, por comportamiento real con
savepoints: mismo usuario en otro club RECHAZADO; mismo usuario en el mismo
club rechazado por la constraint vieja; **otro usuario en el mismo club sigue
funcionando** (un club puede tener todo el staff que quiera).

Verificación en producción: ambas constraints presentes, migración
registrada, y 17 membresías / 17 usuarios / 308 deportistas / 17.082
mediciones — los cuatro idénticos al backup previo.

Backup verificado antes de aplicar (no solo ejecutado: se contaron las filas
dentro del dump). Es la primera evidencia concreta para T-011.

### [x] T-002C · Recuperación de clave autoservicio con Resend

- **Prioridad:** P0, cierra el hueco funcional que deja T-002.
- **Esfuerzo:** ½–1 día.
- **Complejidad:** media.
- **Impacto:** muy alto.
- **Responsable:** por asignar.
- **Dependencias:** T-002. La dependencia externa de DNS **YA NO EXISTE**
  (2026-09-13): ver la decisión de remitente, actualizada.

Al eliminar el recovery administrado, "perdí mi clave" deja de ser tarea del
admin y pasa a ser autoservicio. Sin esto, T-002 deja gente afuera.

### Decisión de remitente — CORREGIDA el 2026-09-13

**La decisión del 2026-08-02 (remitente de la Fundación) queda superada.**

Dos hechos la cambiaron:

1. El pedido de `docs/SETUP_CORREO.md` **se cumplió y nadie lo registró**:
   `talentodeportivo.evolucionantoniana.com` está **Verified** en Resend desde
   ~agosto de 2026 (DKIM confirmado por `dig`). Durante semanas se dio por
   bloqueada una tarea que no lo estaba. Lección operativa: el estado de las
   dependencias externas se verifica, no se supone.
2. La app tiene **dominio propio desde el 2026-09-13**:
   `talentodeportivo.com.ar`, con el DNS delegado a Vercel y bajo control de
   DMG. El mail de recuperación lleva adentro un enlace a ese dominio, así que
   remitente y enlace deben coincidir.

| Qué | Valor |
|---|---|
| Dominio de envío | `talentodeportivo.com.ar` |
| From | `no-reply@talentodeportivo.com.ar` |
| Reply-To | `contacto@evolucionantoniana.com` |

El Reply-To sigue siendo de la Fundación a propósito: `/privacidad` declara a la
Fundación y al club **responsables del tratamiento** y a DMG **encargado**. El
remitente identifica al producto; la respuesta humana cae en el responsable.

`talentodeportivo.evolucionantoniana.com` **no se borra** de Resend. Pendiente
menor: la cuenta de Resend es de la organización `evolucionantoniana`; si el
producto es de DMG, debería migrar. No bloquea el piloto.

### Secuencia: el dominio NO bloquea

El SMTP por defecto de Supabase manda ~2 mails/hora. Eso fue el motivo para
hacer la invitación por link/WhatsApp —que es carga masiva— pero alcanza de
sobra para recuperaciones de clave puntuales en un piloto de 2 profesores. Así:

1. **Ahora:** implementar el autoservicio con el SMTP default. T-002 se puede
   cerrar sin esperar a nadie.
2. **Antes de que el piloto crezca:** cambiar a Resend sobre
   `talentodeportivo.com.ar`. Es configuración de Auth + variables de entorno,
   no código. El DNS ya está bajo control de DMG, así que no depende de nadie.

Acciones:

- Pantalla "Olvidé mi clave" en `/login` → `resetPasswordForEmail`.
- Registrar la URL de retorno en los *Redirect URLs* permitidos de Auth
  (si no, el enlace del mail muere en un error).
- Plantilla del mail de recuperación en español, con la voz del producto.
- El enlace llega exclusivamente al email del titular y aterriza en
  `/cuenta/clave`, que ya existe.
- La respuesta al usuario no revela si el email existe.
- Configurar SMTP propio (Resend) cuando el dominio esté verificado — por panel
  o Management API, **nunca `supabase config push`**. Subir el límite de mails
  por hora, que viene bajo por defecto.

Criterios de aceptación:

- Un usuario recupera su clave sin intervención de ningún admin.
- Ningún admin obtiene tokens de otra persona por ninguna vía.
- El circuito funciona con el SMTP default (piloto) y luego con el dominio
  propio, sin cambios de código.

Cómo se resolvió (2026-09-13):

- `pedirRecuperacion()` en `app/login/actions.ts`, del lado del server para
  poder aplicar el guard de cuentas demo (su clave vive en `DEMO_PASSWORD` y
  es compartida, así que no se recupera — con la misma respuesta genérica,
  para no delatar cuáles son demo).
- **No revela si el email existe.** Respuesta idéntica exista la cuenta o no;
  los errores se registran en el server. Única excepción, el 429 por límite
  de envíos: depende del ritmo de pedidos, no de que la cuenta exista.
- `/login` con tres modos: login, recuperar, enviado.
- No hizo falta tocar `/cuenta/clave` ni `/auth/confirmar`: ambos ya
  contemplaban `type=recovery`.

**Hallazgo verificado sobre PKCE.** `@supabase/ssr` usa PKCE por defecto, así
que `resetPasswordForEmail` emite un `token_hash` con prefijo `pkce_` (la
invitación del panel, que va por la API admin, no lo lleva). La duda era si
`verifyOtp` necesitaba el *code verifier* guardado en cookie — lo que ataría
la recuperación al mismo navegador y rompería el caso típico: pedirla en el
celular y abrir el mail en la compu.

**No lo necesita.** Probado el 2026-09-13 pidiendo el reset desde
`localhost:3000` y abriendo el enlace en `talentodeportivo.com.ar`: dos
orígenes sin cookie compartida, y el circuito cerró igual hasta
`/cuenta/clave` con la sesión iniciada. El flujo es independiente del
dispositivo. **No forzar `flowType: 'implicit'`: no hace falta.**

El segundo criterio ("ningún admin obtiene tokens de otra persona") **no lo
cierra esta tarea**: el recovery administrado sigue vivo hasta T-002. Lo que
T-002C aporta es la salida que hacía falta para poder eliminarlo.

Pendiente relacionado **RESUELTO el 2026-09-13**: la app dejó de vivir en un
dominio del proveedor. Está en `talentodeportivo.com.ar`, dominio propio del
producto registrado a nombre del titular de DMG. `lib/site.ts` es la fuente de
verdad del dominio en el repo y `NEXT_PUBLIC_SITE_URL` lo pisa en Vercel. Los
dominios viejos siguen respondiendo a propósito: hay links de invitación
circulando.

---

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

### [x] T-004 · Resolver vulnerabilidades de dependencias

- **Prioridad:** P0.
- **Esfuerzo:** ½–1 día.
- **Complejidad:** baja–media.
- **Impacto:** muy alto.
- **Responsable:** Gastón + agente.
- **Dependencias:** ninguna.
- **Estado:** terminada el 2026-09-13, branch `fix/t004-dependencias`.
  **Real: ~1 hora.**

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

Cómo se resolvió (2026-09-13):

- **El objetivo `next@16.2.12` de este documento estaba viejo.** El audit
  marca el rango afectado `9.3.4-canary.0 - 16.3.2` como **CRITICAL** con
  `fixAvailable: 16.3.5` (también `latest`). Se subió a **16.3.5**, pineada
  sin caret como estaba la anterior. React no se tocó: 19.2.4 ya satisface el
  peer `^19.0.0`.
- Ese único salto tapó tres entradas del audit: `next` y sus transitivas
  `postcss` y `sharp`.
- `npm audit fix` resolvió las 10 restantes; todas transitivas con arreglo
  no-breaking, solo cambió el lockfile.
- **`shadcn` pasó a `devDependencies`**: no se importa en `app/`,
  `components/` ni `lib/` — es solo el CLI, y arrastraba 6,5 MB a producción.

Resultado: **0 vulnerabilidades**, con `--omit=dev` y con el audit completo.

Alcance de la verificación, para no sobrevender: tsc y eslint sin errores
(quedan los 2 warnings de `<img>` que ya existían), build OK, y smoke sobre
el build de producción (`next start`) con `/`, `/login`, `/panel`,
`/privacidad`, `/observatorio`, `/medicion`, `/deportistas`, `/sesiones` y
`/entrenamiento` todos en 200, `/auth/confirmar` con token inválido
redirigiendo a `/login?aviso=link-vencido`, y cero errores en el log del
server. **Los circuitos autenticados NO se ejercitaron con una sesión real**:
las pantallas se arman en cliente con `useDatos`, así que el 200 prueba que
la ruta y el render funcionan, no que la carga de una medición end-to-end
siga bien. Eso lo cubrirá T-007.

**Queda pendiente de esta tarea:** configurar **Dependabot o Renovate**. Sin
eso, esto se vuelve a acumular solo — de hecho pasó: entre el 1-ago y el
13-sep el conteo fue de 7 a 14 sin que cambiara una línea de código, porque
el ecosistema publicó advisories nuevos.

Gotcha registrado: **`next lint` ya no existe** en esta versión. El lint del
repo es `npm run lint` (eslint directo).

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

Hallazgo abierto (2026-09-13): **el perfil por defecto es un rol, y debería
ser un estado.**

`components/perfil-context.tsx` resuelve `perfil = "profesor"` cuando una
sesión real no tiene membresía. No da acceso a nada —el alcance lo gobierna
el RLS, no ese estado de cliente— y desde ese día la UI ya no lo muestra
(`sinMembresia` pinta una pantalla que explica la situación, sin rol ni
navegación). Pero el modelo sigue diciendo "profesor" cuando la respuesta
correcta es "ninguno".

Mientras sea un rol por defecto, cualquier pantalla nueva que consulte
`perfil` sin chequear antes `sinMembresia` va a tratar a esa sesión como
profesor. Hoy no pasa; es una trampa puesta para el futuro.

Corresponde a esta tarea porque es modelado de autorización: el tipo `Perfil`
debería admitir la ausencia de rol de forma explícita, en vez de que el
código de UI tenga que acordarse de mirar un flag aparte.

Criterios de aceptación:

- Todos los intentos cruzados entre clubes fallan en base de datos.
- Un UUID conocido de otro club no permite crear relaciones ni modificar datos.
- Las reglas tienen tests positivos y negativos.
- Una sesión sin membresía no resuelve a ningún rol por defecto.

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
| 3 | ~~T-002B · Imponer "una cuenta = un club"~~ **HECHA** | ½ día | Muy alto |
| 4 | ~~T-002C · Recuperación autoservicio con Resend~~ **HECHA** | ½–1 día | Muy alto |
| 5 | ~~T-004 · Next.js y dependencias~~ **HECHA (16.3.5)** | ½ día | Muy alto |
| 6 | T-003 · Separar demo y producción | 1–2 días | Crítico antes del piloto |

- [x] T-001 · Contención demo. *(código 2026-08-02; en producción 2026-08-30)*
- [ ] T-002 · Recuperación e invitaciones.
- [x] T-002B · Una cuenta = un club. *(2026-09-13, en producción)*
- [x] T-002C · Autoservicio de clave (Resend). *(2026-09-13)*
- [x] T-004 · Dependencias. *(2026-09-13, 0 vulnerabilidades)*
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
| 2026-08-30 | T-001 | **DESPLEGADA.** `DEMO_PASSWORD` en Vercel, merge ff a `main` y deploy verificado en el sitio. Hallazgo colateral: la demo pública estuvo caída 4 semanas porque la clave se rotó en el backend compartido sin desplegar el frontend. Regla nueva hasta T-003: cambio de backend = deploy el mismo día + smoke del acceso demo | Gastón + agente | `main` en `7047661`; bundle de `/login` sin la clave vieja; `verificar-contencion-demo.mjs` 9 OK; los 3 perfiles verificados a mano |

## Riesgos que deben permanecer visibles

- El mayor riesgo de negocio sigue siendo que el profesor deje de cargar en la semana seis u ocho.
- Un incidente con datos de menores puede destruir la confianza institucional del proyecto.
- Las evaluaciones técnicas subjetivas no son comparables sin rúbricas y calibración.
- La plataforma registra evolución observada; no demuestra causalidad ni predice talento.
- El observatorio debe trabajar con agregados y mínimos de muestra, nunca rankings individuales.
- La operación humana y el acompañamiento al club son más importantes que el costo de infraestructura.
| 2026-09-13 | Dominio | **Dominio propio en producción: `talentodeportivo.com.ar`**, registrado en NIC Argentina a nombre del titular de DMG (nunca de la Fundación: el activo queda del lado de quien retiene la IP). Delegado a `ns1/ns2.vercel-dns.com`, apex canónico, `www` con 308. Descartados `.online` y `.club` por renovación cara, deliverability y peso institucional; `talentodeportivo.com` estaba tomado desde 2011 | Gastón + agente | `dig NS/A`, HTTPS 200 en apex y 308 en www |
| 2026-09-13 | Atribución | `/privacidad` decía **"desarrollada e impulsada por la Fundación"** sin mencionar a DMG. Corregido: DMG desarrolla y provee (**encargado del tratamiento**); la Fundación y el club son **responsables del tratamiento**. Alineados `negocio/00_documento_madre.md` (decía "Impulsan: Fundación · DMG") y `negocio/11`. ⚠️ El Convenio Marco que instrumenta la IP sigue SIN FIRMAR y la entidad argentina sin constituir | Gastón + agente | commit `eb74883`, verificado en producción |
| 2026-09-13 | T-002C | La dependencia externa de DNS **ya estaba cumplida hace un mes** y nadie lo registró. Remitente corregido a `no-reply@talentodeportivo.com.ar` para que coincida con el enlace del mail | Gastón + agente | Resend: `talentodeportivo.evolucionantoniana.com` Verified; DKIM confirmado por `dig` |
| 2026-09-13 | T-004 | **CERRADA.** El objetivo `next@16.2.12` del diagnóstico había quedado viejo: al retomar, el audit marcaba `next` como **CRITICAL** hasta 16.3.2 con fix en **16.3.5**. Se subió a 16.3.5 (arrastra el fix de `postcss` y `sharp`), `npm audit fix` para el resto y `shadcn` movido a devDependencies. De 14 vulnerabilidades (9 altas, 1 crítica) a **0**. El aumento desde las 7 del baseline no fue por cambios de código sino por advisories nuevos. Queda pendiente Dependabot/Renovate | Gastón + agente | branch `fix/t004-dependencias`; `npm audit` 0; build + smoke de 9 rutas |
| 2026-09-13 | T-002B | **CERRADA y en producción.** Constraint `unique (auth_user_id)` aplicada por `supabase db push`. Secuencia usada: backup verificado por conteo de filas → código desplegado ANTES que la migración (cierra la ventana de carrera) → pre-flight repetido → push → verificación. Datos intactos: 17/17/308/17.082, idénticos al backup. Habilita T-002: ya hay respuesta definida para "el email pertenece a otro club" sin emitir ningún token | Gastón + agente | migración `20260913120000`; `scripts/preflight-una-cuenta-un-club.mjs`; validación local con savepoints |
| 2026-09-13 | T-002C | **CERRADA.** Autoservicio andando de punta a punta sobre el dominio propio: pantalla en /login, mail en español con el diseño del producto y enlace a /auth/confirmar en nuestro dominio. Verificado que `verifyOtp` resuelve el token `pkce_` SIN el code verifier, así que la recuperación no está atada al mismo navegador ni dispositivo. Frente de correo completo: Resend + SMTP propio + casilla info@ | Gastón + agente | prueba cruzada localhost→producción; mail a bandeja de entrada |
| 2026-09-13 | UX/Auth | Una sesión real sin membresía caía en el fallback de "profesor" y veía el MOCK: club y deportistas inventados, con la app aparentemente funcional. No era fuga (datos ficticios, RLS intacto) pero en una plataforma sobre datos de chicos se lee como "se perdieron los datos del club". El caso dejó de ser teórico con T-002C: quien fue dado de baja ahora vuelve a entrar por su cuenta. Se agregó `sinMembresia` al contexto (solo se afirma si la consulta salió bien) con pantalla, sin rol y sin navegación. Aparte: el cartel "los paneles siguen con datos de ejemplo" NO estaba condicionado y se lo comían los usuarios reales — el error inverso y más caro. **Queda abierto en T-006**: el perfil por defecto sigue siendo un rol y debería ser un estado | Gastón + agente | commits `929775b`, `6e053ed` |
