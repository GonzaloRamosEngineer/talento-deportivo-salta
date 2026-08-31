# Setup de correo transaccional

## Talento Deportivo Salta · pedido de configuración

**Para:** quien administre el dominio `evolucionantoniana.com` y las cuentas técnicas.
**Depende de esto:** la tarea T-002C del `docs/PLAN_CTO_PRIORIZADO.md` (recuperación de
contraseña autoservicio). Sin correo propio, la plataforma no puede dejar de entregarle
tokens de recuperación a los administradores de club, que hoy es una vulnerabilidad P0.

Este documento está pensado para ejecutarse de una sola vez y volver con la
**checklist final** (última sección). No hace falta leer el resto del plan.

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
| Subdominio de envío | `talento.evolucionantoniana.com` |
| Remitente (From) | `no-responder@talento.evolucionantoniana.com` |
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
dig +short TXT resend._domainkey.talento.evolucionantoniana.com
dig +short TXT send.talento.evolucionantoniana.com
dig +short MX  send.talento.evolucionantoniana.com
dig +short TXT _dmarc.talento.evolucionantoniana.com
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
| Sender email | `no-responder@talento.evolucionantoniana.com` |
| Sender name | `Talento Deportivo Salta` |

Si el puerto 465 da problemas, la alternativa es `587`.

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

## 7. Opcional, para más adelante: dominio propio de la aplicación

Hoy la app vive en `talentodeportivo.digitalmatchglobal.com`. Cuando el mail salga de
`talento.evolucionantoniana.com`, el enlace que contiene va a apuntar a un dominio de
Digital Match. Funciona, pero para un tutor o un profe es una señal rara: mail de un
dominio institucional, enlace al dominio del proveedor. Es el patrón que enseñan a
desconfiar.

No bloquea nada y no es urgente, pero cuando se pueda conviene un dominio propio para la
app —`talentodeportivosalta.com.ar`, o un subdominio de la Fundación— para que remitente
y enlace sean coherentes. Anotarlo como pendiente, no como parte de este pedido.

---

## 8. Checklist para volver

Cuando esté todo hecho, hace falta confirmar estos siete puntos:

- [ ] **1.** La Fundación autorizó figurar como remitente.
- [ ] **2.** El subdominio elegido es `talento.evolucionantoniana.com`.
      *(Si por algún motivo se usó otro nombre, indicar cuál.)*
- [ ] **3.** El dominio figura **Verified** en Resend. *(Captura de pantalla o confirmación.)*
- [ ] **4.** Los 3–4 registros DNS están cargados y responden a `dig`.
      *(Pegar la salida de los comandos de la sección 5.)*
- [ ] **5.** Un mail de prueba desde Resend llegó a **bandeja de entrada** de Gmail,
      no a spam.
- [ ] **6.** El SMTP personalizado está activado en Supabase con esos datos, y el límite
      de mails por hora quedó en 30 o más.
- [ ] **7.** Confirmación del remitente final tal como quedó configurado, y del `Reply-To`.

**No hace falta que nos manden la API Key.** Si el SMTP ya quedó cargado en Supabase, la
clave no tiene que salir de ahí. Si prefieren que la carguemos nosotros, que llegue por el
gestor de contraseñas de la organización, nunca por chat ni por mail.

Con esos siete puntos confirmados, la recuperación de contraseña autoservicio se
implementa y se cierra la vulnerabilidad P0 del circuito de usuarios.
