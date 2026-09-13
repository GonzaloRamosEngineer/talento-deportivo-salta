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

## Diseño

Las plantillas usan la paleta de `docs/DESIGN.md`: fondo `#F4F6F3`, tarjeta `#FCFCFA` con
borde `#E2E7E0`, tinta `#17211B` / `#5F6D63` y el verde césped `#15803D` en el botón. Es
el mismo lenguaje visual que la app, para que el mail y el sitio se lean como una sola cosa.

Restricciones de email que hay que respetar al editarlas:

- **Tablas, no flex ni grid.** Outlook no soporta layout moderno.
- **Todo el CSS en línea.** Las hojas de estilo y las clases se descartan.
- **Ancho máximo 520 px** y el botón como celda de tabla con fondo, no un `<button>`.
- **El logo se referencia con `{{ .SiteURL }}/logo-512.png`**, que ya existe en `public/`.
  Sale del MISMO dominio que el remitente y que el enlace: además de verse bien, refuerza
  la coherencia que hace que el mail no parezca una suplantación. No usar SVG: Gmail lo
  descarta. Y el `alt` importa, porque muchos clientes bloquean imágenes por defecto — con
  las imágenes apagadas el mail tiene que seguir entendiéndose, por eso el texto no depende
  del logo.

---

## Invite user

**Subject:** `Te dieron acceso a Talento Deportivo`

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F6F3;margin:0;padding:32px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#FCFCFA;border:1px solid #E2E7E0;border-radius:18px;overflow:hidden;">

        <tr>
          <td style="padding:32px 32px 0 32px;">
            <img src="{{ .SiteURL }}/logo-512.png" width="52" height="52" alt="Talento Deportivo" style="display:block;border:0;border-radius:14px;">
          </td>
        </tr>

        <tr>
          <td style="padding:22px 32px 0 32px;">
            <h1 style="margin:0;font-size:21px;line-height:1.3;font-weight:800;color:#17211B;letter-spacing:-0.01em;">Te dieron acceso a Talento Deportivo</h1>
          </td>
        </tr>

        <tr>
          <td style="padding:14px 32px 0 32px;font-size:15px;line-height:1.6;color:#5F6D63;">
            <p style="margin:0 0 12px 0;">Hola,</p>
            <p style="margin:0 0 12px 0;">Alguien del cuerpo técnico de tu club te dio acceso a
              <strong style="color:#17211B;">Talento Deportivo</strong>, la plataforma donde el club
              registra cómo evolucionan sus deportistas.</p>
            <p style="margin:0;">Para entrar por primera vez, creá tu contraseña:</p>
          </td>
        </tr>

        <tr>
          <td style="padding:26px 32px 0 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background-color:#15803D;border-radius:11px;">
                  <a href="{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&amp;type=invite"
                     style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:11px;">Crear mi contraseña</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 32px 0 32px;font-size:13px;line-height:1.6;color:#5F6D63;">
            <p style="margin:0 0 10px 0;">El enlace vence en unas horas y se usa una sola vez.</p>
            <p style="margin:0;">Si no esperabas esta invitación, ignorá el mensaje: sin crear la
              contraseña, la cuenta no se activa.</p>
          </td>
        </tr>

        <tr>
          <td style="padding:26px 32px 30px 32px;">
            <div style="height:1px;background-color:#E2E7E0;font-size:0;line-height:0;">&nbsp;</div>
            <p style="margin:18px 0 0 0;font-size:12px;line-height:1.6;color:#5F6D63;">
              <strong style="color:#17211B;">Talento Deportivo</strong> — plataforma de seguimiento
              deportivo para clubes formadores.<br>
              Desarrollada por Digital Match Global, implementada en alianza con la Fundación
              Evolución Antoniana.
            </p>
            <p style="margin:10px 0 0 0;font-size:12px;line-height:1.6;color:#5F6D63;">
              Mensaje automático. Las respuestas llegan a
              <a href="mailto:info@talentodeportivo.com.ar" style="color:#15803D;text-decoration:none;">info@talentodeportivo.com.ar</a>.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
```

## Reset password (T-002C)

**Subject:** `Recuperá tu contraseña de Talento Deportivo`

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F6F3;margin:0;padding:32px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#FCFCFA;border:1px solid #E2E7E0;border-radius:18px;overflow:hidden;">

        <tr>
          <td style="padding:32px 32px 0 32px;">
            <img src="{{ .SiteURL }}/logo-512.png" width="52" height="52" alt="Talento Deportivo" style="display:block;border:0;border-radius:14px;">
          </td>
        </tr>

        <tr>
          <td style="padding:22px 32px 0 32px;">
            <h1 style="margin:0;font-size:21px;line-height:1.3;font-weight:800;color:#17211B;letter-spacing:-0.01em;">Recuperá tu contraseña</h1>
          </td>
        </tr>

        <tr>
          <td style="padding:14px 32px 0 32px;font-size:15px;line-height:1.6;color:#5F6D63;">
            <p style="margin:0 0 12px 0;">Hola,</p>
            <p style="margin:0;">Pediste restablecer la contraseña de tu cuenta de
              <strong style="color:#17211B;">Talento Deportivo</strong>.</p>
          </td>
        </tr>

        <tr>
          <td style="padding:26px 32px 0 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background-color:#15803D;border-radius:11px;">
                  <a href="{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&amp;type=recovery"
                     style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:11px;">Crear una contraseña nueva</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 32px 0 32px;font-size:13px;line-height:1.6;color:#5F6D63;">
            <p style="margin:0 0 10px 0;">El enlace vence en una hora y se usa una sola vez.</p>
            <p style="margin:0;"><strong style="color:#17211B;">Si vos no lo pediste, ignorá este
              mensaje.</strong> Tu contraseña actual sigue funcionando y nadie puede cambiarla sin
              abrir este enlace.</p>
          </td>
        </tr>

        <tr>
          <td style="padding:26px 32px 30px 32px;">
            <div style="height:1px;background-color:#E2E7E0;font-size:0;line-height:0;">&nbsp;</div>
            <p style="margin:18px 0 0 0;font-size:12px;line-height:1.6;color:#5F6D63;">
              <strong style="color:#17211B;">Talento Deportivo</strong> — plataforma de seguimiento
              deportivo para clubes formadores.<br>
              Desarrollada por Digital Match Global, implementada en alianza con la Fundación
              Evolución Antoniana.
            </p>
            <p style="margin:10px 0 0 0;font-size:12px;line-height:1.6;color:#5F6D63;">
              Mensaje automático. Las respuestas llegan a
              <a href="mailto:info@talentodeportivo.com.ar" style="color:#15803D;text-decoration:none;">info@talentodeportivo.com.ar</a>.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
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
