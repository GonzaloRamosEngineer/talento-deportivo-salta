# Plantillas de email de Auth

Se configuran en **Supabase → Authentication → Emails → Templates**. Viven en el panel,
no en el repo, así que **este documento es la copia de referencia**: si alguien las
cambia en el panel, hay que actualizarlas acá.

## La regla que no se puede romper: el link va a NUESTRO dominio

Por defecto Supabase arma el enlace contra `https://<project-ref>.supabase.co/auth/v1/verify`.
Eso produce un mail que sale de `talentodeportivo.com.ar` y cuyo botón lleva a
`hjaeihdrrictmgilzaic.supabase.co` — remitente de marca, destino opaco de un tercero, token
en la query. **Es la firma de phishing de manual, y por eso Gmail lo mandó a spam el
2026-09-13** (con SPF, DKIM y DMARC los tres en PASS: no era un problema de autenticación).

La app ya tiene la pieza para evitarlo: `app/auth/confirmar/route.ts` recibe
`token_hash` + `type`, valida con `verifyOtp`, ata las cookies de sesión a la respuesta y
manda a `/cuenta/clave`. Así que las plantillas usan:

```
{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=invite
```

`{{ .SiteURL }}` sale de **Authentication → URL Configuration** (hoy
`https://talentodeportivo.com.ar`), así que el día que cambie el dominio las plantillas
siguen funcionando sin tocarlas.

**No usar `{{ .ConfirmationURL }}`**: esa variable es la que apunta al dominio de Supabase.

## Por qué el texto está en español y es largo

El mail de prueba del 2026-09-13 era la plantilla default: tres líneas en inglés, un link
y nada más, a un destinatario hispanohablante. Gmail ofreció traducirlo. Un mail así, desde
un dominio recién registrado, es indistinguible de un phishing.

El texto explica **qué plataforma es, por qué le llega a esa persona y qué hacer si no fue
ella**. No es cortesía: es lo que separa un transaccional legítimo de uno sospechoso.

---

## Invite user

**Subject:** `Te invitaron a Talento Deportivo`

```html
<h2>Te invitaron a Talento Deportivo</h2>

<p>Hola,</p>

<p>Alguien del cuerpo técnico de tu club te dio acceso a <strong>Talento Deportivo</strong>,
la plataforma donde el club registra la evolución de sus deportistas.</p>

<p>Para entrar por primera vez tenés que crear tu contraseña:</p>

<p><a href="{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=invite">Crear mi contraseña</a></p>

<p>El enlace vence en unas horas y se usa una sola vez.</p>

<p>Si no esperabas esta invitación, ignorá este mensaje: sin crear la contraseña, la cuenta
no se activa. Ante cualquier duda escribinos a
<a href="mailto:info@talentodeportivo.com.ar">info@talentodeportivo.com.ar</a>.</p>

<hr>
<p><small>Talento Deportivo — plataforma de seguimiento deportivo para clubes formadores.
Desarrollada por Digital Match Global, implementada en alianza con la Fundación Evolución
Antoniana. Este es un mensaje automático; las respuestas llegan a
info@talentodeportivo.com.ar.</small></p>
```

## Reset password (T-002C)

**Subject:** `Recuperá tu contraseña de Talento Deportivo`

```html
<h2>Recuperá tu contraseña</h2>

<p>Hola,</p>

<p>Pediste restablecer la contraseña de tu cuenta de <strong>Talento Deportivo</strong>.</p>

<p><a href="{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=recovery">Crear una contraseña nueva</a></p>

<p>El enlace vence en una hora y se usa una sola vez.</p>

<p><strong>Si vos no lo pediste, ignorá este mensaje.</strong> Tu contraseña actual sigue
funcionando y nadie puede cambiarla sin abrir este enlace. Si te preocupa, escribinos a
<a href="mailto:info@talentodeportivo.com.ar">info@talentodeportivo.com.ar</a>.</p>

<hr>
<p><small>Talento Deportivo — plataforma de seguimiento deportivo para clubes formadores.
Desarrollada por Digital Match Global, implementada en alianza con la Fundación Evolución
Antoniana. Este es un mensaje automático; las respuestas llegan a
info@talentodeportivo.com.ar.</small></p>
```

---

## Qué NO decir en estos mails

Nunca nombrar deportistas, categorías ni datos de menores. Estos mails van a cuentas de
staff y pueden terminar en una casilla compartida del club, reenviados o impresos. El único
dato personal que llevan es el email del destinatario.

## Cómo verificar después de cambiarlas

Mandar una invitación de prueba a un Gmail desde
**Authentication → Users → Invite user**, y revisar:

1. Que **no caiga en spam**.
2. Que el link del botón apunte a `talentodeportivo.com.ar/auth/confirmar`, **no** a
   `*.supabase.co`. Se mira con "Mostrar original" o pasando el mouse por encima.
3. Que al abrirlo aterrice en `/cuenta/clave` con la sesión iniciada.
4. Que *Responder* vaya a `info@talentodeportivo.com.ar`.

Borrar el usuario de prueba al terminar.
