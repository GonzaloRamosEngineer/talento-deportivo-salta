# Setup de correo transaccional

## Talento Deportivo Salta · pedido de configuración

**Para:** quien administre el dominio `evolucionantoniana.com` y las cuentas técnicas.
**Depende de esto:** la tarea T-002C del `docs/PLAN_CTO_PRIORIZADO.md` (recuperación de
contraseña autoservicio). Sin correo propio, la plataforma no puede dejar de entregarle
tokens de recuperación a los administradores de club, que hoy es una vulnerabilidad P0.

Este documento está pensado para ejecutarse de una sola vez y volver con la
**checklist final** (última sección). No hace falta leer el resto del plan.

---

## ESTADO (actualizado el 2026-09-13) — LEER ANTES QUE EL RESTO

Este documento se escribió como **pedido a la Fundación**. Ese pedido **ya se cumplió**:
`talentodeportivo.evolucionantoniana.com` figura **Verified** en Resend desde ~agosto de
2026 (DKIM verificado también por `dig`). Nadie lo registró acá ni en el plan, así que
durante semanas se dio por bloqueada una tarea que no lo estaba.

**Pero la decisión de remitente CAMBIÓ**, porque cambió el dominio de la app:

- Desde el **2026-09-13** la app vive en **`talentodeportivo.com.ar`**, dominio propio
  registrado en NIC Argentina a nombre del titular de DMG, con el DNS delegado a Vercel.
- Por lo tanto el remitente pasa a ser **`no-reply@talentodeportivo.com.ar`**: el mail de
  recuperación lleva adentro un enlace a `talentodeportivo.com.ar`, y remitente y enlace
  tienen que coincidir. Mandarlo desde el dominio de la Fundación reintroduce justo la
  señal de desconfianza que este documento describe en la sección 7.
- El **Reply-To sigue siendo `contacto@evolucionantoniana.com`**, que es el canal que
  publica la política de privacidad: la Fundación y el club son responsables del
  tratamiento, DMG es encargado. El remitente identifica al producto; la respuesta humana
  cae en el responsable. No se pisan.
- **`talentodeportivo.evolucionantoniana.com` NO se borra de Resend**: puede estar en uso
  por el sitio de la Fundación, y su reputación ya está construida.

### Correo ENTRANTE del producto — resuelto el 2026-09-13

Este documento trataba solo el envío. El dominio ahora también **recibe**:

| Qué | Valor |
|---|---|
| Proveedor | Spacemail (Spaceship), 1 casilla, 5 GB |
| Casilla real | **`info@talentodeportivo.com.ar`** |
| MX | `mx1.spacemail.com` / `mx2.spacemail.com`, prioridad 0 |
| Alias | `soporte@`, `ayuda@`, `hola@`, `contacto@`, `no-reply@`, `postmaster@`, `abuse@` |

Es la dirección que la app le muestra al staff cuando una acción se rechaza y
la explicación no puede darse en pantalla (`SOPORTE_EMAIL` en `lib/site.ts`).
**Verificada con un envío externo real que llegó a la bandeja.**

El alias `no-reply@` existe a propósito: es el remitente de Resend, y la gente
le responde a los mails automáticos. Sin el alias esas respuestas se perderían
en un rebote; con él caen en `info@`.

Los dos emisores conviven sin pisarse: **Spacemail firma desde la raíz**
(SPF + DKIM `spacemail._domainkey`) y **Resend desde `send.`** (SPF + DKIM
`resend._domainkey`), con un único `_dmarc` cubriendo a los dos. Al tocar la
zona hay que respetar eso: **un solo TXT que empiece con `v=spf1` por nombre,
y un solo `_dmarc` en todo el dominio.**

Gotcha registrado: el DKIM de Spacemail mide **408 caracteres** y un string
TXT de DNS admite 255, así que va partido en varios. Vercel lo hace solo si
se pega entero; verificar siempre con
`dig +short TXT spacemail._domainkey.talentodeportivo.com.ar` que vuelva
íntegro.

---

Todo lo que sigue queda como registro de cómo se pidió y por qué. Las razones técnicas
(subdominio aislado, no tocar el Workspace del dominio raíz) siguen siendo correctas para
`evolucionantoniana.com`; no aplican a `talentodeportivo.com.ar`, que es un dominio nuevo
sin correo institucional encima.

**Pendiente, no urgente:** la cuenta de Resend pertenece a la organización
`evolucionantoniana`. Si el producto es de DMG, la cuenta de envío debería migrar a una
organización de DMG. No bloquea el piloto.

---

## 1. Qué necesitamos y por qué

La plataforma tiene que poder mandar **un solo tipo de mail**: el enlace para que una
persona del staff de un club recupere su contraseña. Nada de marketing, nada de
notificaciones masivas.

Hoy eso no existe, y por eso el sistema tiene un agujero: cuando un administrador de club
quiere darle acceso a alguien que ya tiene cuenta, el servidor **le entrega al
administrador un enlace de recuperación de esa persona**. Con ese enlace, el
administrador puede cambiarle la contraseña y entrar como esa persona. Para cerrarlo hay
que eliminar ese circuito, y para eliminarlo la persona necesita poder recuperar su clave
por sí misma, con un enlace que llegue **solo a su casilla**.

### Por qué el remitente tiene que ser de la Fundación y no de Digital Match Global

Dos razones, y las dos ya están escritas en el proyecto:

1. La política de privacidad publicada (`/privacidad` en la app) declara que **"la
   Fundación y el club son responsables del tratamiento de esos datos"**, y publica
   `contacto@evolucionantoniana.com` como contacto. Un mail sobre el acceso a la
   plataforma donde están los datos de los chicos tiene que salir del responsable
   declarado. Si sale de `@digitalmatchglobal.com`, contradice la política publicada.
2. El documento madre del proyecto (`negocio/00_documento_madre.md`) define que la
   Fundación lidera la relación institucional y Digital Match Global provee el desarrollo
   bajo contrato, y que **"las cajas no se mezclan"**. Digital Match Global figura como
   desarrollador al pie de la app, que es donde corresponde, no como remitente de los
   mails institucionales.

**Entonces: el remitente es de `evolucionantoniana.com`.** Lo que sigue es cómo hacerlo
sin poner en riesgo el correo que la Fundación ya usa.

---

## 2. Decisión previa (Fundación)

Antes de tocar nada técnico, que quede confirmado por quien corresponda en la Fundación:

- [ ] La Fundación acepta figurar como remitente de los mails de la plataforma.
- [ ] Se autoriza crear el subdominio técnico `talento.evolucionantoniana.com`
      exclusivamente para envío de correo de la plataforma.
- [ ] Se define quién queda como responsable operativo de esa configuración
      (a quién avisar si el correo deja de salir).

---

## 3. Por qué un subdominio y no una casilla común

La opción intuitiva sería crear `talentodeportivo@evolucionantoniana.com` y mandar desde
ahí. **No conviene**, por una razón concreta:

El dominio `evolucionantoniana.com` ya tiene Google Workspace funcionando: es el correo
institucional de la Fundación (incluida la cuenta `talentodeportivosalta@evolucionantoniana.com`
que se usa para los backups en Drive). Habilitar un servicio de envío externo sobre el
**dominio raíz** implica modificar los registros de correo que hoy hacen funcionar ese
Workspace. Un error ahí no rompe la plataforma: **rompe el mail de toda la Fundación.**

Con un subdominio dedicado:

- La configuración es **aislada**: no se toca ni un registro del correo actual.
- La **reputación de envío** de la plataforma no afecta al correo institucional. Si
  mañana la plataforma manda volumen y algo sale mal, los mails de la Fundación siguen
  llegando.
- Es la práctica estándar de la industria para correo transaccional.

**Configuración objetivo:**

| Qué | Valor |
|---|---|
| Subdominio de envío | ~~`talento.evolucionantoniana.com`~~ → **`talentodeportivo.com.ar`** (ver ESTADO) |
| Remitente (From) | ~~`no-responder@talento...`~~ → **`no-reply@talentodeportivo.com.ar`** |
| Nombre visible | `Talento Deportivo Salta` |
| Responder a (Reply-To) | `contacto@evolucionantoniana.com` |

El `Reply-To` es importante: es el que ya publica la política de privacidad, así que si
alguien contesta el mail, la respuesta cae en una casilla real y atendida. La casilla
`no-responder@...` **no necesita existir como buzón** — es solo una dirección de envío.

---

## 4. Tarea A · Crear el proyecto en el proveedor de envío (Resend)

Proveedor elegido: **Resend** (https://resend.com). El plan gratuito cubre 3.000
mails/mes y 100/día, muy por encima de lo que necesita el piloto (unos pocos mails por
semana). No hace falta plan pago.

Pasos:

1. Crear una cuenta, o usar una existente si ya se administra una para otros proyectos.
   Una misma cuenta puede tener varios dominios verificados sin mezclarlos.
2. En la sección **Domains**, agregar el dominio: `talento.evolucionantoniana.com`
   (el subdominio completo, no el raíz).
3. Elegir región de envío. Si aparece la opción, usar la más cercana a Sudamérica.
4. Resend va a mostrar una lista de registros DNS para copiar. **Esa lista es la fuente
   de verdad**: los valores son únicos de esta cuenta y este dominio. Copiarlos textuales,
   sin reescribirlos a mano.
5. Crear una **API Key** con permiso de solo envío (*Sending access*). Empieza con `re_`.
   **Esta clave es una credencial: no va por chat, ni por mail, ni al repositorio.**
   Guardarla en el gestor de contraseñas de la organización.

### Nota sobre la titularidad de la cuenta

Si la cuenta de Resend la abre Digital Match Global, la Fundación queda dependiendo de
DMG para ese servicio — igual que ya ocurre con el resto de la infraestructura. Es
aceptable para el piloto, pero **conviene dejarlo asentado en el contrato** junto con el
resto de los accesos, para que una eventual transición no se trabe. Si la Fundación
prefiere ser titular desde el principio, que abra ella la cuenta y comparta el acceso.
Técnicamente da igual; es una decisión de gobernanza.

---

## 5. Tarea B · Cargar los registros DNS

En el panel donde se administra el DNS de `evolucionantoniana.com` (el registrador o
proveedor de DNS), agregar los registros que muestre Resend.

**Regla de oro: se AGREGAN registros nuevos sobre el subdominio. No se modifica ni se
borra ningún registro existente del dominio raíz.** Si algún paso pide cambiar un registro
que ya está, detenerse y consultar: eso no debería pasar con un subdominio.

Van a ser 3 o 4 registros, de este tipo (los valores exactos los da Resend):

| Tipo | Nombre / Host aproximado | Para qué sirve |
|---|---|---|
| TXT | `resend._domainkey.talento` | **DKIM**: firma criptográfica que prueba que el mail salió de nosotros y no fue alterado. Es el registro más importante. |
| TXT | `send.talento` | **SPF**: autoriza a los servidores de Resend a enviar en nombre del subdominio. |
| MX | `send.talento` | Recibe los rebotes y las quejas de spam, para saber qué mails no llegaron. |
| TXT | `_dmarc.talento` | **DMARC** (recomendado): le dice a Gmail/Outlook qué hacer si un mail no pasa las verificaciones. Empezar con `v=DMARC1; p=none; rua=mailto:contacto@evolucionantoniana.com` |

Aclaración práctica sobre el campo "Nombre": algunos paneles piden el nombre **relativo**
(`resend._domainkey.talento`) y otros el **completo**
(`resend._domainkey.talento.evolucionantoniana.com`). Si se carga mal, el registro queda
duplicando el dominio (`...evolucionantoniana.com.evolucionantoniana.com`) y no verifica.
Ante la duda, cargar uno, esperar y verificar antes de cargar el resto.

La propagación suele tardar entre minutos y unas pocas horas. Resend marca el dominio como
**Verified** cuando los encuentra.

### Cómo verificar desde una terminal

```bash
# Resend (envío del producto) — VERIFICADOS el 2026-09-13
dig +short TXT resend._domainkey.talentodeportivo.com.ar
dig +short TXT send.talentodeportivo.com.ar
dig +short MX  send.talentodeportivo.com.ar
dig +short TXT _dmarc.talentodeportivo.com.ar

# Spacemail (recepción de info@) — VERIFICADOS el 2026-09-13
dig +short MX  talentodeportivo.com.ar
dig +short TXT spacemail._domainkey.talentodeportivo.com.ar
```

Cada uno tiene que devolver el valor cargado. Si devuelve vacío, el registro no está o el
nombre quedó mal armado.

**Y la comprobación que importa de verdad:** que el dominio figure **Verified** en el
panel de Resend, y que un mail de prueba enviado desde ahí a una casilla de Gmail llegue
a la bandeja de entrada (no a spam). Resend tiene un botón para mandar un mail de prueba.

---

## 6. Tarea C · Configurar el envío en Supabase

Esto se hace en el proyecto Supabase de la plataforma (ref `hjaeihdrrictmgilzaic`), en
**Project Settings → Authentication → SMTP Settings**, activando *Enable Custom SMTP*.

Datos a cargar:

| Campo | Valor |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` (literal, esa palabra) |
| Password | la API Key de Resend (`re_...`) |
| Sender email | **`no-reply@talentodeportivo.com.ar`** |
| Sender name | **`Talento Deportivo`** (sin "Salta" — ver nota abajo) |
| Reply-To | **`info@talentodeportivo.com.ar`** |

Si el puerto 465 da problemas, la alternativa es `587`.

**Sobre el Sender name (decidido el 2026-09-13):** firma **`Talento Deportivo`**, sin
"Salta". El dominio se compró sin la provincia a propósito —"Talento Deportivo Salta" no
escala a otras provincias— así que el remitente arranca ya con el nombre definitivo. ⚠️ Eso
deja una inconsistencia abierta: la app, el `<title>` del sitio, el repo y los documentos
siguen diciendo "Talento Deportivo Salta". **Es una decisión de producto pendiente**, no un
descuido: alinear todo es un trabajo aparte.

**Sobre el Reply-To (decidido el 2026-09-13):** `info@talentodeportivo.com.ar`, no la
casilla de la Fundación. Este mail va dirigido a **staff de club** —un profe que no puede
entrar—, así que la respuesta tiene que caer en el soporte del producto.
`contacto@evolucionantoniana.com` se queda donde sí corresponde: en `/privacidad`, para el
ejercicio de derechos sobre los datos de los menores. Son dos canales distintos y no se
pisan.

Después, en la misma sección de Authentication, subir el **límite de mails por hora**
(viene muy bajo por defecto, pensado para el SMTP compartido). Con 30 por hora sobra.

### Dos advertencias importantes

1. **No usar `supabase config push`** para esto. En este proyecto ese comando sobrescribe
   configuración de producción. La configuración de Auth se toca por el panel o por la
   Management API. Está anotado como regla en el `CLAUDE.md` del repositorio.
2. **La API Key no se commitea.** No va en ningún archivo del repositorio. Vive en el
   panel de Supabase y en el gestor de contraseñas.

### Lo que queda de nuestro lado (no hace falta que lo hagan ustedes)

Para que el circuito funcione completo, del lado del código hay que: agregar la pantalla
"Olvidé mi clave", traducir la plantilla del mail de recuperación al español con la voz
del producto, y registrar la URL de retorno en la lista de *Redirect URLs* permitidas de
Auth. Eso lo hacemos nosotros una vez que el envío esté andando.

---

## 7. RESUELTO — dominio propio de la aplicación

**Hecho el 2026-09-13.** La app tiene dominio propio: **`talentodeportivo.com.ar`**,
registrado en NIC Argentina a nombre del titular de DMG (no de la Fundación: el activo
queda del lado de quien retiene la propiedad intelectual). DNS delegado a
`ns1/ns2.vercel-dns.com`, apex canónico y `www` con redirect 308.

Eso resuelve la incoherencia que describía este apartado —mail institucional con enlace al
dominio del proveedor— por la vía de darle dominio propio al producto, y de paso deja el
DNS de envío bajo control de DMG, sin depender de terceros para los registros de Resend.

## 8. Checklist — estado al 2026-09-13

- [–] **1.** ~~La Fundación autorizó figurar como remitente.~~ **Ya no aplica:** el
      remitente es `no-reply@talentodeportivo.com.ar`, dominio propio de DMG.
- [x] **2.** ~~El subdominio elegido es `talento.evolucionantoniana.com`.~~ Superado:
      el envío va por `talentodeportivo.com.ar`.
- [x] **3.** El dominio figura **Verified** en Resend. *(Confirmado: Domain verified,
      Sep 13 13:04, provider Vercel, región São Paulo.)*
- [x] **4.** Los registros DNS están cargados y responden a `dig`. *(Los 4 de Resend y
      los 5 de Spacemail, verificados uno por uno.)*
- [x] **5.** Un mail de prueba **enviado desde Resend** llegó a **bandeja de entrada** de
      Gmail. *(2026-09-13, al segundo intento: el primero cayó en spam con SPF/DKIM/DMARC
      los tres en PASS. Lo que lo sacó de spam fue cambiar la plantilla — ver
      `docs/PLANTILLAS_EMAIL.md`.)*
- [x] **6.** El **SMTP personalizado está activado en Supabase** (Resend, `smtp.resend.com`
      puerto 465, usuario `resend`, API Key acotada a *Sending access* + solo el dominio
      `talentodeportivo.com.ar`). El límite subió solo a 30 mails/hora al activarlo.
- [x] **7.** Remitente final y `Reply-To` confirmados: From `no-reply@talentodeportivo.com.ar`
      con nombre `Talento Deportivo`, Reply-To `info@talentodeportivo.com.ar`.

### Lección registrada: el spam no era el dominio

El primer envío cayó en spam **con SPF, DKIM y DMARC los tres en PASS**. Es fácil
concluir "el dominio es nuevo, hay que esperar" y quedarse esperando. No era eso:

1. El enlace apuntaba a `hjaeihdrrictmgilzaic.supabase.co` mientras el remitente era
   `talentodeportivo.com.ar`. Remitente de marca + destino opaco de un tercero + token en
   la query = firma de phishing.
2. La plantilla era la default de Supabase: tres líneas en inglés a un hispanohablante.

Corregidas las dos, el mismo dominio —con menos de un día de vida— entró directo a la
bandeja de entrada. **Antes de culpar a la reputación, mirar el mensaje.**

### Pendientes anotados, que no bloquean

- **La cuenta de Resend pertenece a la organización `evolucionantoniana`.** Decisión del
  2026-09-13: se deja así por ahora. El dominio ya está verificado en esa cuenta y mover
  todo implica re-verificarlo. Queda como deuda de coherencia: si el producto es de DMG,
  su infraestructura de envío debería vivir en una cuenta de DMG.
- **El nombre del producto.** Los mails van a firmar "Talento Deportivo", pero la app y
  los documentos dicen "Talento Deportivo Salta". Decisión de producto pendiente.
