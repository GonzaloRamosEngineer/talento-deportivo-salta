# Brief backend · Que ninguna planilla se pierda al cargarla

## Estado de la implementación (2026-09-23)

**Staging y producción: aplicado.** En producción el 2026-09-23 con
aprobación explícita, después del backup
`Backups Talento Deportivo/2026-09-23_1144/db_public.sql` (5,4 MB). El
frontend (`fix/panel-secretaria-ui`, PR #1) tiene que desplegarse ya: con
estas migraciones, el código viejo no guarda el original y sus lotes nuevos
no se pueden confirmar (`ORIGINAL_PENDIENTE`).

| Paso | Staging | Producción |
| --- | --- | --- |
| 0 · Sincronizar las 3 migraciones que faltaban | ✅ aplicado; `schema_migrations` igual a prod | — |
| P0 · `20260923160000_conservar_original_lotes.sql` (puntos 1 y 2) | ✅ aplicado | ✅ aplicado y verificado (2026-09-23) |
| P1 · `20260923161000_filas_pendientes_y_bandeja.sql` (puntos 3, 4 y 5) | ✅ aplicado | ✅ aplicado y verificado (2026-09-23); frontend en `2253d31` |

Verificación: `npm run test:carga-planillas` (e2e de la sección 6, 44
asserts, se limpia solo) y `npm run test:importadores` (9 planillas reales
con mediciones y resumen fijados + casos sintéticos de cada motivo).

### Decisiones que difieren del texto del brief

- **`filas-pendientes` es un bloqueo, no solo un `info`.** Si fuera
  informativo, al confirmar esas filas se perderían sin que nadie decida,
  que es justo lo que este brief prohíbe. El `info` con los conteos existe
  aparte (`conteo-filas`). Resoluciones: `carga_manual` o `excluir`.
- **Bucket paralelo `planillas-lotes`** (misma configuración que
  `planillas-recepcion`), ruta `<club_id>/<lote_id>.<ext>`, con su propia
  policy de lectura. La purga diaria existente recorre los dos buckets.
- **Motivo extra `sin_nombre`**: una fila con datos y sin nombre también se
  conserva. Y `valor_ilegible` trae `columnasIlegibles` y `seImportoElResto`
  (en saltos/gimnasia/rugby lo legible de la fila sí entra).
- **El pie de estadísticas se detecta** ("Mín", "Máx", "DS", "Estadísticas",
  tabla de clasificación). Antes caía como "fila sin fecha": convertirlo
  tal cual en pendientes habría llenado la bandeja de "deportistas" llamados
  "Muy Malo". SUB13 cuenta 18 filas de resumen (el `+= 8` fijo estaba mal).
- **Sin filas abiertas se purga a los 30 días; con filas para carga manual
  el original espera** a que se cierren (tope duro de 180 días igual).

### Cambios de comportamiento a revisar

1. `lote_importacion` pasa a **privilegios por columna** para
   `authenticated` (insert del alta; update solo de `estado, resoluciones,
   resultado, confirmado_en, preview_json`). Sin esto la policy
   `lote_update` dejaba reescribir `ruta_storage` y pedir el original de otro
   espacio. Una migración futura con `grant update on lote_importacion` a
   nivel tabla lo deshace.
2. **Trigger de invariantes** en `lote_importacion`: no se importa un lote
   nuevo sin original guardado (`ORIGINAL_PENDIENTE`), y un lote con
   `protocolos-desconocidos` o `filas-pendientes` solo se importa por
   `confirmar_lote_revisado` (`REQUIERE_REVISION`). Consecuencia: desde la
   pantalla de carga rápida ya no se confirma una planilla con protocolos
   sin mapear. Antes, elegir "Mapear" ahí **descartaba esas filas sin
   avisar**; ahora el mensaje manda a resolverla desde Planillas.
3. `/api/evaluaciones/importar` ya no corta por el `exp` del token: decide
   `vence_en` del lote.
4. `filas_ignoradas` = pendientes + resumen + vacías. En SUB13 pasa de 8 a 18.

### Antes de aplicar en producción

- [ ] Revisión manual de las dos migraciones (datos de menores, RLS, bucket,
      privilegios, trigger).
- [x] P0 puede ir sola. **P1 no debe ir antes del frontend** que resuelve el
      bloqueo `filas-pendientes` en la revisión. → **Hecho en `2253d31`**
      (revisión con "carga manual / excluir", filas de carga manual en el
      detalle, bandeja y contador del panel), probado contra staging.
      P0, P1 y el frontend tienen que salir juntos: el frontend ya llama a
      los endpoints nuevos.
- [ ] Aplicar con `supabase db push --db-url <prod>` (el CLI de este repo está
      linkeado a producción: nunca un `db push` pelado para probar).
- [ ] Verificar en prod: bucket `planillas-lotes` privado, ACL de las
      funciones nuevas, `TRUNCATE` en 0, job de purga activo.
- [ ] Decidir la retención de `lote_fila_pendiente.datos` (nombres y valores
      de menores): hoy queda como traza después de cerrada la fila.

### Endpoints nuevos para el frontend

- `GET /api/secretaria/planillas/[id]/original` → URL firmada de 5 min (admin, coordinación, analista).
- `POST /api/secretaria/planillas/[id]/reprocesar` → sin archivo si `archivoGuardado`.
- `GET /api/secretaria/planillas/[id]/revision` → suma `archivoGuardado`, `reprocesoPideArchivo`, `filasPendientes`, `conteoFilas`, `filasCargaManual`.
- `GET /api/secretaria/planillas/[id]/filas-pendientes` → filas en la bandeja de un lote.
- `POST /api/secretaria/filas-pendientes/[id]` → `{ tipo: "cargada", jornadaId }` o `{ tipo: "descartada", motivo }`.
- `GET /api/secretaria/pendientes` → `pendientes_de_carga()`; y `indicadores.pendientesCarga` en `/api/secretaria/resumen`.

## Objetivo

Lo primero que va a hacer la Secretaría es cargar planillas. El principio:
**todo archivo que entra se conserva, y ninguna fila se pierde en silencio ni
deja la planilla trabada.** Hoy eso se cumple solo para los archivos ilegibles
(recepción manual). Para los que se leen, aunque sea en parte, no.

Todo se implementa y prueba primero en staging `yncidsgcypyyvurtyesx`. Producción
`hjaeihdrrictmgilzaic` se toca recién con la aprobación explícita del responsable.
Cambios de esquema, RLS o manejo de datos de menores **requieren revisión manual**
(CLAUDE.md): no se asumen aprobados.

## Auditoría (2026-09-23, solo lectura, staging y producción)

Lo que ya funciona en producción:

- Planilla ilegible → `planilla_recepcion` + original en el bucket privado
  `planillas-recepcion` (20 MB), descarga con URL firmada, estados
  `RECIBIDA_PARA_REVISION / EN_REVISION / PROCESADA / RECHAZADA / PURGADA`.
- Retención: 180 días, o 30 después de cerrada. Job `purgar-planillas-recepcion`
  activo (`15 4 * * *`).
- Formato de saltos (`saltos_tabular`): las filas con protocolo desconocido se
  conservan en `preview_json.filasSinProtocolo` para mapearlas o excluirlas
  (solo en subidas nuevas; los lotes viejos no las tienen).

Los huecos, por gravedad:

| # | Hueco | Dónde |
| --- | --- | --- |
| 1 | La vista previa **vence a los 30 minutos** y `guardar_resoluciones_lote` **no la extiende** (solo `reprocesar_lote_previsualizado` suma 2 h). Si hay que pedirle la fecha al club, el lote muere. El token de `firmarPreview` también vence a los 30 min | `app/api/evaluaciones/previsualizar/route.ts:81` y `:94`; `supabase/migrations/20260922160000_endurecer_resoluciones_protocolo.sql` (`guardar_resoluciones_lote`, `confirmar_lote_revisado`) |
| 2 | **El original de un lote no se guarda** (solo `hash_sha256`). Con el lote vencido no hay de dónde retomar, y nunca se puede reprocesar con un lector mejor. El reproceso exige volver a subir *exactamente* el mismo archivo | `lote_importacion` (`20260922090000_espacio_secretaria_evaluaciones.sql:150`) |
| 3 | **Filas descartadas en silencio**: en `gimnasia_cmj` y `rugby_sprint`, un deportista con nombre pero sin fecha suma a `ignoradas` y desaparece. No hay forma de ver qué filas fueron | `lib/evaluaciones/importador/parsear.ts` (bloques `if (!fecha) { ignoradas += 1; continue; }`) |
| 4 | **Todo o nada**: un bloqueo sin resolver impide importar las filas buenas | `confirmar_lote_revisado` |
| 5 | Hay 4 formatos reconocidos (`sub13_bloques`, `rugby_sprint`, `gimnasia_cmj`, `saltos_tabular`). La planilla de un club nuevo va a recepción manual: ese camino va a ser el principal al arrancar | `parsear.ts:417` |
| 6 | **Staging tiene 3 migraciones menos que producción**: `20260923130000_habilitar_evaluaciones_produccion`, `20260923140000_restituir_una_cuenta_un_club`, `20260923150000_declarar_grants_evaluaciones`. Lo que se prueba en staging no representa producción (sobre todo los grants) | `supabase_migrations.schema_migrations` |

Menor: `sub13_bloques` suma `ignoradas += 8` fijo por las filas estadísticas.
Es correcto con el formato actual, pero si la planilla trae otra cantidad, el
contador miente. Contarlas en lugar de asumirlas.

## 0. Antes de empezar

Aplicar en staging las 3 migraciones que le faltan (`supabase db push`, nunca a
mano ni `config push`) y verificar que `schema_migrations` quede igual que en
producción. Sin esto, las pruebas de este brief no valen.

## 1. Guardar el original de TODO lote (P0)

- En `previsualizar`, después de parsear y antes de responder, subir el archivo
  al bucket privado con la clave de servicio (mismo patrón que
  `app/api/secretaria/recepcion/route.ts`). Ruta sugerida:
  `lotes/<club_id>/<lote_id><ext>`. Reusar `planillas-recepcion` o crear uno
  paralelo con la misma configuración (privado, 20 MB, csv/xls/xlsx).
- Columnas nuevas en `lote_importacion`: `ruta_storage text`,
  `retener_hasta date`, `purgado_en timestamptz`. Misma política de retención
  que la recepción (180 días, o 30 después de importado/cerrado) y sumar los
  lotes al job de purga existente. **Revisión manual requerida**: son datos de
  menores.
- Si la subida falla, el lote NO queda como previsualizado usable: mismo
  tratamiento que `marcar_error_subida_recepcion`.
- `reprocesar_lote_previsualizado` pasa a leer el original del bucket. El
  endpoint `/api/secretaria/planillas/[id]/reprocesar` deja de exigir el archivo
  cuando el lote lo tiene guardado (mantener la subida con verificación de hash
  solo para los lotes viejos sin `ruta_storage`).
- Descarga con URL firmada de 5 min, igual que en la recepción, solo para roles
  de la Secretaría del mismo club.

Criterio de aceptación: subir una planilla, dejar vencer el lote y poder
reabrirlo o reprocesarlo **sin volver a subir nada**.

## 2. Que la revisión no muera a los 30 minutos (P0)

- Separar dos vencimientos: el de la **sesión de vista previa**, que puede seguir
  corto, y el de la **revisión**. Un lote con bloqueos pendientes se tiene que
  poder retomar días después.
- Propuesta: `vence_en` inicial de 7 días para lotes con bloqueos; cada
  `guardar_resoluciones_lote` extiende a `greatest(vence_en, now() + 7 days)`.
  Con el original guardado (punto 1), un lote vencido se reabre reprocesándolo.
- Revisar que `/api/evaluaciones/importar` (token firmado de 30 min) y
  `confirmar_lote_revisado` no corten antes: la confirmación de un lote revisado
  debe depender del estado del lote, no de un token emitido al subir.
- `revision_lote` ya devuelve `venceEn`; mantenerlo, porque el frontend lo usa
  para el aviso de vencimiento (ver "Frontend ya hecho").

## 3. No descartar filas en silencio (P1)

- Todo lo que hoy suma a `ignoradas` porque le falta un dato (fecha, protocolo,
  valor ilegible) se guarda en `preview_json.filasPendientes`, con la misma forma
  que `filasSinProtocolo` más un `motivo`:
  `{ fila, motivo: "sin_fecha" | "protocolo_desconocido" | "valor_ilegible", nombre, apellido, valores }`.
- Las filas de resumen (media, máximo…) y las vacías siguen fuera, pero contadas
  por separado: `filasResumen` y `filasVacias`. `filas_ignoradas` pasa a ser la
  suma de las tres, para no romper nada.
- Hallazgo `info` con la cantidad de cada tipo, para que la pantalla diga qué
  pasó con cada fila.

## 4. Importar lo reconocido y dejar el resto para carga manual (P1)

- Resolución nueva en `guardar_resoluciones_lote`, válida para
  `protocolos-desconocidos` y para las `filasPendientes`:
  `"carga_manual"`. Es explícita, con motivo, y queda en la trazabilidad como
  las demás. **Nunca automática.**
- `confirmar_lote_revisado` importa las mediciones reconocidas y deja las filas
  marcadas `carga_manual` en una tabla nueva, por ejemplo
  `lote_fila_pendiente (id, lote_id, club_id, fila, motivo, datos jsonb, estado, resuelto_por, resuelto_en, resolucion jsonb)`.
  `club_id` denormalizado por trigger (regla 6). RLS desde el primer commit:
  lectura y escritura solo para roles operativos de la Secretaría del club.
  Revocar lo que no se usa (TRUNCATE saltea RLS; ver la nota sobre los GRANT en
  CLAUDE.md). **Revisión manual requerida.**
- La fecha **no** puede ir a carga manual: sin fecha no hay jornada. Ese bloqueo
  se resuelve (punto 2, con tiempo) o la planilla entera va a recepción manual.
- RPC para cerrar una fila pendiente: `resolver_fila_pendiente(p_id, p_resolucion)`
  con `resolucion` = `{ tipo: "cargada", jornada_id }` o
  `{ tipo: "descartada", motivo }`.

## 5. Una sola bandeja de pendientes (P1)

Extender `recepciones_manuales` (o crear `pendientes_de_carga()`) para que
devuelva, en una sola lista, las recepciones abiertas **y** los lotes con filas
en `lote_fila_pendiente` abiertas:

```json
{
  "tipo": "recepcion" | "filas",
  "id": "uuid",
  "loteId": "uuid | null",
  "archivo": "text",
  "numeroSeguimiento": "text | null",
  "contexto": { "institucionOrigen": "", "disciplina": "", "grupo": "" },
  "estado": "text",
  "etiquetaEstado": "text",
  "filasPendientes": 0,
  "recibidaEn": "timestamptz"
}
```

Sumar `pendientesCarga` a `indicadores` de `/api/secretaria/resumen` para
mostrarlo en el panel.

## 6. Verificación

- Script e2e en `scripts/` con el mismo estilo que `scripts/verificar-t002.mjs`
  (asserts, se niega a correr contra producción, se limpia solo):
  1. un lote con bloqueo de fecha sobrevive más de 30 min y se confirma;
  2. un lote vencido se reprocesa sin volver a subir el archivo;
  3. una fila sin fecha aparece en `filasPendientes` y no desaparece;
  4. "carga manual" importa las filas buenas y deja las otras en la bandeja;
  5. un usuario de otro club no ve el original, las filas ni la bandeja (RLS);
  6. la purga borra el original de un lote vencido fuera de retención.
- Correr también `npm run test:importadores`.

## Frontend ya hecho (branch `fix/panel-secretaria-ui`)

- Planillas: las recepciones manuales entran a la lista con el filtro
  "Carga manual"; los lotes `vencido`/`fallido` se muestran como tales.
- Detalle: aviso de "la revisión sigue abierta hasta…" usando `venceEn`, en rojo
  los últimos 10 min, y "Volver a subir el archivo" al vencer. Cuando exista el
  punto 2, el texto del aviso cambia (hoy dice que después hay que volver a
  subir el archivo).

## Frontend que queda para después de este brief

Se hace cuando estén los endpoints:

- La opción "Importar lo reconocido y dejar el resto para carga manual" en la
  revisión (punto 4).
- La lista de `filasPendientes` con su motivo en el detalle (punto 3).
- La bandeja leyendo `pendientes_de_carga()` (punto 5) y el contador en el panel.
- Reprocesar sin pedir el archivo cuando el lote lo tenga (punto 1).

## No hacer

- `supabase config push` (clobbea producción; la configuración de Auth va por la
  Management API).
- Importaciones parciales automáticas: toda fila que no entra es una decisión
  explícita de una persona, con motivo.
- Guardar originales fuera del bucket privado o sin retención.
- Tocar producción sin aprobación.
