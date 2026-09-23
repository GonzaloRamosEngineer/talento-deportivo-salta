# Despliegue de Evaluaciones a producción

Estado: **preparado y ensayado, NO aplicado.** Espera aprobación.

Destinatario: quien ejecute el despliegue (Gastón o su agente).

---

## 1. Qué cambia

### Migraciones (13 pendientes en producción)

Producción está en `20260913120000`. Faltan, **en este orden exacto**:

| Migración | Qué hace |
|---|---|
| `20260922090000_espacio_secretaria_evaluaciones` | Base: `tipo_organizacion`, roles nuevos, catálogo, lotes, jornadas |
| `20260922090500_corregir_rango_y_disciplina_base` | `numeric(6,2)`→`(10,2)`, Fútbol, `uq_medicion_manual_dia` |
| `20260922091000_catalogo_evaluaciones_secretaria` | Protocolos CMJ/SJ/ABCMJ/DJ/Sprint y sus atributos |
| `20260922092000_ajustes_importacion_y_observatorio` | Confirmación de lotes, observatorio |
| `20260922130000_operacion_secretaria` | Correcciones auditadas, jornada manual |
| `20260922140000_configuracion_secretaria` | Instituciones, grupos, alta de deportistas |
| `20260922150000_revision_lotes_previsualizados` | Revisión y confirmación de planillas |
| `20260922151000_corregir_edad_filas_mapeadas` | Fix de cast de edad |
| `20260922160000_endurecer_resoluciones_protocolo` | Cierra la exclusión implícita |
| `20260923100000_recepcion_manual_planillas` | Bucket privado + recepción manual |
| `20260923110000_cerrar_recepcion_manual` | Máquina de estados + recuperación de subida |
| `20260923120000_purga_programada_recepcion` | `pg_cron` + `http` + purga diaria |
| `20260923130000_habilitar_evaluaciones_produccion` | **Nueva.** Trigger anti-demo |
| `20260923140000_restituir_una_cuenta_un_club` | **Nueva.** Vuelve a poner `membresia_auth_user_id_key` |
| `20260923150000_declarar_grants_evaluaciones` | **Nueva.** Declara privilegios y saca TRUNCATE a los roles de la API |

No hay `down`. El rollback es restaurar el backup (§5).

### Código

**`lib/evaluaciones/backend.ts`** — se reemplaza el bloqueo por ENTORNO por uno de
CAPACIDAD + IDENTIDAD. Antes: "en el proyecto productivo, no". Eso no distingue
quién pide. Ahora quedan tres capas:

1. `EVALUACIONES_HABILITADAS` — interruptor por ambiente, **apagado por defecto**.
   Sirve para apagar el módulo sin redeploy. No es seguridad.
2. `sesionOperativaSecretaria()` / `sesionSecretaria()` — exigen sesión real,
   membresía en organización `secretaria` y rol operativo, **y rechazan cuentas
   demo**. Las dos compuertas están DENTRO de estas funciones, así que cubren las
   12 rutas de `/api/secretaria/*` por construcción, no por acordarse de llamarlas.
3. RLS — `es_miembro_de` / `es_admin_de` / `opera_categoria` por `club_id`. Es la
   única capa que sigue valiendo si alguien se saltea el server.

Habilitar producción **no le da acceso a nadie que no lo tuviera por membresía**.

### Variables de entorno (Vercel, ambiente Production)

| Variable | Valor | Por qué |
|---|---|---|
| `EVALUACIONES_HABILITADAS` | `true` | Enciende el módulo |
| `IMPORT_PREVIEW_SECRET` | nuevo, ≥32 chars, **distinto al de staging** | Firma los tokens de previsualización |
| `APP_ENV` | `production` | Ya no controla Evaluaciones; queda para la señal de entorno |
| `IMPORT_BACKEND_ENABLED` | *(se puede borrar)* | Reemplazada por `EVALUACIONES_HABILITADAS` |

Secretos del Vault de Postgres en producción (necesarios para la purga):
`supabase_url` y `service_key`. **Sin ellos el cron corre y falla todos los días.**

---

## 2. Traslado de datos desde staging

Mueve **solo** el club Secretaría. No copia la base entera ni toca los clubes.

### Por qué no sirve `pg_dump`

El catálogo (`disciplina`, `atributo`, `protocolo`) lo crean las migraciones con
`gen_random_uuid()`. El protocolo CMJ tiene **otro id en cada proyecto**:

```
staging CMJ = de5a2ffd-5444-4bc1-898f-08b96b449d29
destino CMJ = 5ac0c886-8550-4373-b3f9-2b92643b120b
```

Un dump copiaría `medicion.atributo_id` tal cual y las mediciones quedarían
apuntando al atributo equivocado, en silencio, con números que se ven bien.
`scripts/trasladar-secretaria.mjs` exporta el catálogo por **clave natural**
(`codigo`/`nombre`) y lo resuelve contra el destino. Los ids propios del espacio
(club, deportista, jornada, lote, medición) **sí** se preservan: eso es lo que
mantiene la trazabilidad.

`membresia.auth_user_id` también se remapea, **por email**: la cuenta en
producción es otra fila de `auth.users`, con otro uuid.

### Quién crea qué

`alta-secretaria.mjs` prepara **solo la cuenta de Auth**. El club y la
membresía los trae el traslado, con los uuid de origen.

Antes no era así y estaba mal: el alta creaba club y membresía con uuid
nuevos mientras el traslado traía los de staging. Resultado: dos
organizaciones Secretaría y dos membresías para la misma persona, una
huérfana de datos. Y con `20260923140000` aplicada ni siquiera entra: la
segunda membresía viola `unique (auth_user_id)`.

La división es por quién es dueño del identificador:

| Objeto | Dueño del uuid | Quién lo crea |
|---|---|---|
| `auth.users` | Auth del proyecto destino | `alta-secretaria.mjs` |
| `club`, `membresia` | el origen (se preservan) | `trasladar-secretaria.mjs` |
| catálogo | cada proyecto (se remapea) | las migraciones |

El traslado verifica al final que quede **exactamente 1** membresía de
Secretaría, y aborta si no.

### Orden

```bash
# 1. La cuenta Auth (y NADA más)
NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SECRET_KEY=… SECRETARIA_EMAIL=… SITE_URL=… \
  node scripts/alta-secretaria.mjs --ejecutar

# 2. Los archivos (HTTP, reintentable)
ORIGEN_URL=… ORIGEN_KEY=… DESTINO_URL=… DESTINO_KEY=… CLUB_ID=… \
  node scripts/trasladar-planillas-storage.mjs --ejecutar

# 3. Las filas (una transacción: entra todo o nada)
ORIGEN=… DESTINO=… CLUB_ID=… node scripts/trasladar-secretaria.mjs --ejecutar
```

Archivos antes que filas: al revés queda una ventana con `ruta_storage`
apuntando a un objeto inexistente.

Sin `--ejecutar` todos son ensayo y no aplican nada.

### La verificación es condición de commit, no un aviso

Antes la verificación era `RAISE NOTICE`: imprimía "141 vs 141" y commiteaba
igual pasara lo que pasara. Y `ON CONFLICT DO NOTHING` puede saltearse en
silencio una fila que ya existe **con datos distintos**.

Ahora, para cada una de las 12 tablas se calcula en el ORIGEN una firma
`cantidad:md5` sobre **todas** las filas (no una muestra), usando la misma
proyección que se exporta. Esa firma queda embebida en el SQL generado. Al
final de la transacción se recalcula en el destino y se comparan. Si no
coinciden exactamente, `raise exception` y la transacción entera se revierte.

Probado: cambiando **una** medición de las 1.653 en 0,01, el traslado aborta:

```
ABORTA: el traslado no quedó idéntico al origen.
  medicion: origen=1653:5d6368549d30c065680b72d5beef5eca destino=1653:8de3c902dac62c0564d6656522f6fedd
```

**Si aborta**, el destino queda como estaba (la transacción se revierte),
pero las filas de una corrida ANTERIOR siguen ahí. El remedio es borrar las
filas de ese club en el destino y volver a correr — el traslado no pisa
datos existentes por diseño, así que no se arregla solo.

Las marcas de tiempo entran en la firma, por eso ambos lados fuerzan `UTC`
(vía `PGTZ`, no con `set timezone` dentro del `-c`: psql imprime `SET` y esa
línea se cuela como cabecera del CSV).

Volumen medido: 1 club · 1 membresía · 6 instituciones · 7 grupos · 141
deportistas · 9 lotes · 14 jornadas · 141 jornada_deportista · 1.653 mediciones ·
11 eventos · 0 recepciones · 11 auditoría. **0 archivos en Storage hoy.**

Estados: se copian tal cual. Los 2 lotes `previsualizado` llegan `previsualizado`.

---

## 3. Cuenta privada de Secretaría

`secretaria@evolucionantoniana.com` **no existe en producción** (verificado).

```bash
NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SECRET_KEY=… \
SECRETARIA_EMAIL=secretaria@evolucionantoniana.com SITE_URL=https://… \
  node scripts/alta-secretaria.mjs --ejecutar
```

Crea **solo la cuenta de Auth**. El club y la membresía los trae el traslado
con los uuid de origen (ver §2, "Quién crea qué"). Si ya hay un Espacio
Secretaría en el destino, lo avisa para que lo revises antes de seguir.

Idempotente: si la cuenta ya existe, lo informa y no la toca. Nunca fija
contraseña: emite un link de invitación construido con
`linkDeAcceso()`, que apunta a nuestro `/auth/confirmar`. **No usar el
`redirectTo` nativo de Supabase**: manda el token en el fragmento y el link
muere antes de llegar. Ya pasó.

Se niega a operar sobre un email demo.

**Correr esto ANTES del traslado**: la membresía se resuelve por email y si la
cuenta no existe el traslado falla al principio, no a la mitad.

---

## 4. Pruebas

```bash
psql "$URL" -v ON_ERROR_STOP=1 -f scripts/verificar-aislamiento-evaluaciones.sql
```

Corre dentro de una transacción que termina en `rollback`: no deja datos de
prueba ni aunque falle. Simula sesiones reales (`authenticated` + claim `sub`),
así que ejercita el RLS de verdad. **15/15 en el ensayo.**

Cubre: la demo no lee ni escribe nada de Secretaría (6 tablas + UPDATE + INSERT
con uuid conocido), la demo sigue viendo su club, Secretaría ve lo suyo y no ve
los clubes, el anónimo no ve nada, y el trigger anti-demo rechaza INSERT y UPDATE.

### Las cuatro demos

| Demo | Cómo funciona | Efecto del cambio |
|---|---|---|
| `profe@demo.talento.ar` | cuenta real, club | ninguno: `contextosDisponibles.secretaria=false` por membresía |
| `admin@demo.talento.ar` | idem | ninguno |
| `comision@demo.talento.ar` | idem | ninguno |
| Liga/Secretaría → `/observatorio?perfil=super_admin` | **anónimo**, mock `CLUBES` | ninguno: `use-observatorio` solo llama al RPC con sesión real de plataforma |

`lib/demo.ts`, `app/login/*` y `lib/use-observatorio.ts` **no se tocaron**.

### Smoke en navegador

```bash
npm i -D playwright && npx playwright install chrome
BASE_URL=… SECRETARIA_EMAIL=… SECRETARIA_PASSWORD=… \
  [DEPORTISTA_ID=… GRUPO=… DISCIPLINA=… INSTITUCION=…] \
  node scripts/verificar-navegador.mjs
```

**29/29 en el ensayo.** Cubre las 4 demos (incluido el observatorio anónimo),
que ninguna demo vea el acceso a Secretaría ni pase la API (403 `CUENTA_DEMO`),
y que la cuenta privada entre, cargue las 5 pantallas y vea los conteos
correctos.

**En producción se corre SIN `DEPORTISTA_ID`**: así no escribe absolutamente
nada. Las variables `ESPERADO_*` convierten los conteos en aserciones, incluida
la que importa de verdad — que las 2 planillas sin confirmar **sigan** sin
confirmar. Confirmar un lote crea mediciones: si `lotesPendientes` bajó, alguien
importó algo que no debía.

```bash
BASE_URL=https://talentodeportivo.com.ar \
SECRETARIA_EMAIL=secretaria@evolucionantoniana.com SECRETARIA_PASSWORD=… \
ESPERADO_PLANILLAS=9 ESPERADO_DEPORTISTAS=141 ESPERADO_MEDICIONES=1653 \
ESPERADO_PENDIENTES=2 ESPERADO_IMPORTADOS=7 \
  node scripts/verificar-navegador.mjs
```

---

## 5. Ensayo ya hecho (entorno aislado)

Dos entornos, ninguno con red a un proyecto remoto:

- **A — réplica de producción**: contenedor `supabase/postgres:17.6.1.166`,
  restaurando un `pg_dump` real de producción. Sirve para probar las
  migraciones contra los datos que existen.
- **B — stack Supabase completo** (`project_id = tds-ensayo`, puertos 553xx,
  separado del stack de otros proyectos): Auth + PostgREST + Storage, con el
  seed y el showcase sembrados. Sirve para el traslado y el navegador.

| Paso | Resultado |
|---|---|
| Backup de producción (`pg_dump -Fc`, solo lectura) | 709 KB, sin errores |
| Restauración en A | 9 migraciones · 2 clubes · 308 deportistas · 17.082 mediciones · 17 membresías · 267 consentimientos — **exacto** |
| Aplicar las migraciones pendientes en A | **sin error** |
| Datos preexistentes tras migrar | idénticos |
| Esquema resultante | 33 tablas, **ninguna sin RLS**, cron `purgar-planillas-recepcion 15 4 * * *` activo |
| Bucket `escudos` | intacto y público (se reaplicó la migración de Storage para probarlo) |
| Rollback (restaurar el backup) | 9 migraciones · 308 · 17.082 · 17 — **verificado** |
| Secuencia del runbook en B (alta → storage → filas) | completa |
| Reejecución de la secuencia | idempotente: verificación OK, 1 sola membresía |
| Verificación estricta ante 1 valor alterado de 1.653 | **aborta y revierte** |
| Tras reparar el valor | vuelve a dar OK |
| `20260923140000` aplicada después del traslado | `membresia_auth_user_id_key UNIQUE (auth_user_id)` restituida, conviviendo |
| Remapeo de catálogo | verificado sobre las **1.653** mediciones vía firma md5 |
| Clubes existentes tras el traslado | 305 deportistas / 17.067 mediciones — **sin cambios** |
| Estados | 7 `importado` + 2 `previsualizado`, igual que origen |
| Aislamiento (SQL) | **15/15** |
| Navegador | **26/26** |

Los artefactos con datos reales (el dump y la réplica A) se destruyeron al
terminar. El stack B queda levantado para validación visual (§7).

### Dos pruebas que estaban en verde por el motivo equivocado

Vale anotarlas porque son el tipo de error que hace confiar de más:

1. **"demo inserta medición en Secretaría"** pasaba porque el `INSERT ... SELECT`
   leía de una tabla que el RLS ya le ocultaba: insertaba 0 filas sin fallar.
   Ahora usa un UUID literal —el ataque real, con un id que el atacante ya
   conoce— y ahí sí el RLS lo rechaza de verdad.
2. **"anónimo lee deportistas"** daba 0 porque la prueba limpiaba
   `request.jwt.claim.sub` pero no `request.jwt.claims`. En un stack Supabase
   real `auth.uid()` lee la segunda, así que el "anónimo" seguía siendo la
   sesión anterior. Con el stack completo se vio: leía exactamente 141 y 1.653,
   los datos de Secretaría. Corregido, da 0.

## 6. Runbook

### Antes

1. **Reapuntar el CLI.** Hoy `supabase/.temp/project-ref` dice
   `hjaeihdrrictmgilzaic` (producción) mientras la app usa staging. Verificar el
   destino **antes de cada comando**.
2. Commitear: 1 archivo modificado, 4 nuevos, 13 migraciones. Borrar `scripts/_tmp-v.ts`.
3. `npm run lint && npm run build` (verificado: 0 errores, 2 warnings preexistentes).
4. **T-002B: resuelto, no pendiente.** `20260922090000` hacía
   `drop constraint membresia_auth_user_id_key` para permitir que una persona
   estuviera en un club Y en la Secretaría. Revisado el caso real, no hace falta:
   la Secretaría la opera una cuenta privada dedicada. Como las migraciones ya
   aplicadas no se reescriben, `20260923140000` **vuelve a poner la constraint**
   al final de la cadena. Queda por actualizar la entrada de T-002B en
   `PLAN_CTO_PRIORIZADO.md` con este ida y vuelta.

### Durante

5. Backup `pg_dump -Fc` y **verificar que restaura** en una base descartable.
   Un backup no verificado no es un backup.
6. Ensayo en seco sobre los datos reales — los cuatro deben dar 0:
   duplicados de `uq_medicion_manual_dia`, valores fuera de `numeric(10,2)`,
   duplicados de `categoria(club,disciplina,nombre)`, roles fuera del check nuevo.
7. Cargar `supabase_url` y `service_key` en el Vault **antes** de `20260923120000`.
8. Aplicar las 13 migraciones, **una sola vez**, mirando la salida.
9. Variables en Vercel (§1) y **deploy el mismo día** — la regla que dejó T-001:
   backend sin frontend = demo caída 4 semanas.
10. `alta-secretaria.mjs --ejecutar` (solo la cuenta), entregar el link por
    canal privado.
11. Storage y después filas (§2). La verificación aborta sola si algo no cuadra.
12. Confirmar que quedó **1 sola** membresía de Secretaría (el traslado lo
    verifica, pero mirarlo).

### Smoke tests

- Los 4 accesos demo, uno por uno.
- `/panel`, `/deportistas`, `/medicion` con conteos intactos: 2 clubes · 308 · 17.082.
- Sesión de Secretaría: `/secretaria/planillas` muestra 9, `/secretaria/deportistas` 141.
- Registrar una medición desde `/secretaria/medir` y verla.
- `scripts/verificar-aislamiento-evaluaciones.sql` → 15/15.
- `scripts/verificar-navegador.mjs` → 26/26 (cubre las 4 demos y la cuenta privada).
- Con sesión demo, `GET /api/secretaria/resumen` → **403 `CUENTA_DEMO`**.

### Abortar si

- cualquier conteo del ensayo en seco da ≠ 0;
- `db push` falla a mitad (Supabase no envuelve el lote en una transacción:
  quedás a medio camino → restaurar, no improvisar);
- un conteo de los clubes existentes cambia;
- una demo ve algo de Secretaría;
- el aislamiento no da 15/15;
- el backup no restauró en el paso 5;
- el traslado imprime `ABORTA:` (no insistir: revisar qué difiere);
- queda más de una membresía de Secretaría.

---

## 7. Validación visual

El stack del ensayo y la app quedan levantados:

```
app         http://localhost:3000     (y en la red: http://192.168.1.215:3000)
Supabase    http://127.0.0.1:55321    · Studio http://127.0.0.1:55323
```

Apunta al **ensayo**, no a staging ni a producción. Para volver a levantarlo:
`supabase start` dentro de la carpeta del ensayo, y `npm run dev` con las
variables del ensayo exportadas (las del shell tienen prioridad sobre
`.env.local`, así que no hace falta tocar ese archivo).

## 8. Hallazgos colaterales · **corregidos**

- **`supabase/seed.sql` estaba roto** por las migraciones: usaba
  `on conflict (club_id, disciplina_id, nombre)` y `20260922090000` cambió esa
  unicidad para incluir `institucion_origen_id`. Sin esto no levanta el entorno
  local ni, más adelante, se regenera el proyecto demo de T-003. **Corregido.**
- **`seed.sql` creaba "Club Atlético Antoniana"** mientras los scripts de
  siembra buscaban "Club Fundación Evolución Antoniana" y fallaban. Producción
  usa el segundo, así que ese es el bueno: **renombrado** en `seed.sql` y en
  `sembrar-demo-9na.mjs`. Ahora `supabase db reset` + los seeds corren de una.
- **Los GRANT no se declaraban.** Se dependía del default del proveedor
  (`anon/authenticated/service_role` con `arwdDxtm` sobre todo `public`), que en
  el stack local es distinto (`Dxtm`). Dos consecuencias: el entorno local no
  reproducía al real, y `anon` tenía escritura y **TRUNCATE** sobre tablas con
  datos de menores. TRUNCATE **no pasa por RLS**. `20260923150000` declara los
  privilegios, se los quita a `anon` en las tablas de Secretaría y saca TRUNCATE
  a los tres roles de la API. No cambia lo que la app puede hacer.
- **`/api/secretaria/medir` devolvía 422 genérico** (`JORNADA_NO_GUARDADA`)
  cuando `idempotencyKey` no era un UUID. Ahora responde **400
  `IDEMPOTENCY_KEY_INVALIDA`** diciendo qué pasa.
