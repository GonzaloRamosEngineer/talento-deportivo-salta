# Brief backend · Que las solicitudes de disciplina lleguen a alguien

## Estado de la implementación (2026-09-23)

**Staging: aplicado y verificado. Producción: sin tocar, pendiente de
revisión manual.**

- Migración `20260923170000_solicitudes_disciplina.sql` (staging ✅).
- Lógica en `lib/plataforma/solicitudes.ts` (bandeja, resolución y el gate
  `esUsuarioPlataforma`, que ahora usa también `esPlataforma()` de
  `app/plataforma/actions.ts`) y `lib/secretaria/solicitudes.ts` (lo que ve la
  Secretaría). Las server actions `listarSolicitudesDisciplina` /
  `resolverSolicitudDisciplina` son envoltorios finos: el e2e prueba el mismo
  código.
- `/api/secretaria/configuracion`: el GET suma `solicitudes`; el POST acepta
  `{ accion: "solicitar_protocolo", disciplinaId, texto, contexto? }`.
- Verificación: `npm run test:solicitudes-disciplina` (sección 5, 35 asserts,
  se limpia solo y deja Vóley como estaba).

### Decisiones a revisar

- **Vincular** deja la solicitud en `aprobada` con `disciplina_id` de la
  existente y, si no se escribe otra, la resolución "Ya existe en el catálogo
  como «X»". No se agregó un estado nuevo (el contrato del punto 4 tiene tres).
  Solo aplica a pedidos de tipo `disciplina`.
- **Aprobar** exige al menos un protocolo; si alguno no existe o está
  inactivo, falla entero (no crea nada). Si la disciplina ya existe con ese
  nombre, falla con `DISCIPLINA_YA_EXISTE`: la salida correcta es vincular. En
  un pedido de protocolo, los que ya estaban activos no se duplican; uno
  inactivo se reactiva. `protocolosNuevos` dice cuántos se sumaron de verdad.
- `aprobar_solicitud_disciplina` es ejecutable solo por `service_role` **y**
  además verifica en `auth.users` que `p_usuario` sea plataforma y no demo:
  ni con la clave de servicio se aprueba a nombre de otro.
- Rechazar y vincular son un `update … where estado = 'pendiente'` (atómico,
  como `resolverSugerencia`); aprobar es la RPC transaccional.
- El texto de un pedido de protocolo admite hasta 200 caracteres (el nombre de
  una disciplina sigue en 80).
- `disciplina_solicitud`: `anon` sin privilegios; `authenticated` solo
  `SELECT`; nadie con `TRUNCATE`. Los grants de `disciplina`,
  `disciplina_protocolo` y `protocolo` no se tocaron (siguen sin políticas de
  escritura, regla 2).

## Objetivo

Hoy una coordinadora de la Secretaría puede tocar **"Solicitar disciplina"**
(Planteles → Disciplinas), el pedido se guarda en `disciplina_solicitud`… y
**nadie lo ve nunca**. No hay pantalla que lo liste ni función que lo
resuelva. Hay que cerrar ese circuito antes de que la Secretaría empiece a
usar el sistema: pedir, que alguien lo revise, resolver y que quien pidió vea
la respuesta.

Todo se implementa y prueba primero en staging `yncidsgcypyyvurtyesx`. Producción
`hjaeihdrrictmgilzaic` se toca recién con la aprobación explícita del responsable.
Cambios de esquema, RLS o funciones `security definer` **requieren revisión
manual** (CLAUDE.md).

## Lo que hay hoy (auditado el 2026-09-23)

- Tabla `disciplina_solicitud` (`20260922140000_configuracion_secretaria.sql:59`):
  `estado` pendiente/aprobada/rechazada, `disciplina_id`, `resolucion`,
  `solicitado_por` y `resuelto_por` (ambos → `membresia`). RLS: lectura para
  miembros del club o `es_plataforma()`; escritura directa bloqueada.
- Alta: `solicitar_disciplina_secretaria(p_nombre, p_descripcion, p_contexto)`,
  solo `admin_secretaria` / `coordinador_secretaria`.
- **No existe ninguna función ni pantalla que liste o resuelva.** 0 solicitudes
  en staging hoy.
- El catálogo que se aprobaría es global: `disciplina`, `disciplina_protocolo`
  y `protocolo_atributo`, cargado por migración. Regla 2 del CLAUDE.md: sin
  políticas de escritura para `authenticated`; lo cura la plataforma.

Tres problemas concretos:

1. **Nadie revisa**: falta la bandeja y la resolución.
2. **No se puede pedir un protocolo** para una disciplina que ya existe (por
   ejemplo, DJ para Vóley, o un test de velocidad para Fútbol): la función
   devuelve `DISCIPLINA_YA_EXISTE` y termina.
3. **`resuelto_por` apunta a `membresia`**, pero quien resuelve es la cuenta de
   plataforma (`app_metadata.plataforma`), que no tiene membresía de club: no
   hay dónde registrar quién aprobó.

## Quién resuelve

**La plataforma**, igual que las sugerencias de las guías (`/plataforma/sugerencias`)
y los parámetros de crecimiento: el catálogo es común a toda la provincia y se
cura en un solo lugar. Si el responsable decide que lo resuelva la
`admin_secretaria`, cambia el gate, no el diseño.

## 1. Esquema (una migración)

En `disciplina_solicitud`:

- `tipo text not null default 'disciplina' check (tipo in ('disciplina','protocolo'))`.
- `disciplina_objetivo_id uuid references disciplina(id)`: en `tipo = 'protocolo'`,
  la disciplina existente a la que se le pide sumar algo. Obligatorio en ese
  tipo (check).
- `resuelto_por_usuario uuid references auth.users(id) on delete set null`:
  quién resolvió desde la plataforma. `resuelto_por` (membresía) queda para
  compatibilidad.
- `protocolos_habilitados text[]`: en una aprobación, qué protocolos quedaron
  habilitados (trazabilidad legible sin reconstruir joins).
- Ajustar el índice único de pendientes para incluir `tipo` y
  `disciplina_objetivo_id` (dos pedidos distintos para la misma disciplina no
  son duplicados).

Mantener el RLS actual (lectura miembro del club o plataforma; sin escritura
directa). Declarar grants y revocar lo que no se usa, como en
`20260923150000_declarar_grants_evaluaciones.sql`.

## 2. Pedir un protocolo

Nueva `solicitar_protocolo_secretaria(p_disciplina_id uuid, p_texto text, p_contexto text)`,
mismo gate de roles que la de disciplina. `p_texto` es libre ("Drop Jump para
Vóley", "Test de velocidad 20 m"): la Secretaría no conoce el catálogo de
protocolos ni tiene por qué. Devuelve los mismos estados que la de disciplina
(`SOLICITADA`, `SOLICITUD_YA_PENDIENTE`).

## 3. Bandeja y resolución (plataforma)

Server actions en `app/plataforma/actions.ts`, con el **mismo patrón que
`listarSugerencias` / `resolverSugerencia`**: `esPlataforma()` (que ya rechaza
cuentas demo) y cliente admin.

- `listarSolicitudesDisciplina()`: pendientes primero, después resueltas (200
  como máximo). Por fila: tipo, nombre o texto, descripción, contexto, club,
  quién pidió (nombre y función), disciplina objetivo, estado, resolución,
  fechas, protocolos habilitados.
- `resolverSolicitudDisciplina(input)` con tres salidas:
  - `{ id, accion: "rechazar", resolucion }`: resolución **obligatoria**, porque
    quien pidió tiene que saber por qué.
  - `{ id, accion: "vincular", disciplinaId, resolucion? }`: "ya existe como
    Vóley". Para un pedido de disciplina que en realidad existía con otro
    nombre.
  - `{ id, accion: "aprobar", nombre, protocolos: string[], resolucion? }`: crea
    la disciplina (tipo `disciplina`) o suma los protocolos a la existente (tipo
    `protocolo`), en **una sola transacción**, vía RPC
    `aprobar_solicitud_disciplina(...)` `security definer` con `search_path`
    fijo y **ejecutable solo por `service_role`**. Los protocolos se eligen de
    `protocolo` (el catálogo existente); crear protocolos o métricas nuevas
    **no** entra acá: es el punto 3 de la hoja de ruta (edición del catálogo,
    con el preparador físico).
- Todas: exigen `estado = 'pendiente'` (no re-resuelven, igual que
  `resolverSugerencia`), guardan `resuelto_por_usuario`, `resuelto_en` y
  `resolucion`.

## 4. Lo que ve la Secretaría

La lectura ya está permitida por RLS (miembros del club). Alcanza con que el
endpoint de configuración (`/api/secretaria/configuracion`, que ya usa la
pantalla de Planteles) sume `solicitudes`:

```json
{ "id": "uuid", "tipo": "disciplina" | "protocolo", "nombre": "text",
  "disciplinaObjetivo": "text | null", "estado": "pendiente" | "aprobada" | "rechazada",
  "resolucion": "text | null", "creadoEn": "timestamptz", "resueltoEn": "timestamptz | null" }
```

## 5. Verificación

Script e2e en `scripts/` con el estilo de `scripts/e2e-carga-planillas.mts`
(bloqueado contra producción, se limpia solo):

1. Una coordinadora pide una disciplina y un protocolo; los dos quedan
   pendientes y los ve en `configuracion`.
2. La plataforma los lista; una cuenta demo y un usuario común no pueden
   (`listar` y `resolver` fallan).
3. Aprobar una disciplina nueva con 2 protocolos: la disciplina aparece en el
   catálogo que usa Medir (`/api/secretaria/medir`) con esos 2 protocolos.
4. Aprobar un protocolo para una disciplina existente: se suma a
   `disciplina_protocolo` sin duplicar.
5. Rechazar sin resolución falla; con resolución, quien pidió la ve.
6. Resolver dos veces la misma solicitud falla.
7. Otro espacio de Secretaría no ve las solicitudes ajenas (RLS).

## Frontend (lo hacemos nosotros cuando estén los endpoints)

- `/plataforma/solicitudes` en la navegación de plataforma, con un contador de
  pendientes: la bandeja con las tres salidas (rechazar, vincular, aprobar
  eligiendo protocolos).
- En Planteles → Disciplinas, "Tus solicitudes" con su estado y la respuesta.
- En el formulario de "Solicitar", elegir entre "una disciplina nueva" y "algo
  que falta en una disciplina existente".

## No hacer

- `supabase config push`. Recordatorio: el CLI de este repo está vinculado a
  producción, así que para staging siempre `--db-url`.
- Políticas de escritura sobre `disciplina`, `disciplina_protocolo` o
  `protocolo_atributo` para `authenticated` (regla 2).
- Crear protocolos o métricas desde una solicitud: eso es la edición del
  catálogo y necesita al preparador físico.
- Tocar producción sin aprobación.
