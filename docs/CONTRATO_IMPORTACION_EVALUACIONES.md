# Contrato de backend — importación de evaluaciones

Este contrato permite que el frontend avance sin confundir el archivo recibido con el modelo de Talento Deportivo. La unidad de negocio es una **jornada de evaluación**; el Excel es evidencia de origen y un medio de ingreso.

## Entorno obligatorio

El importador y sus migraciones se desarrollan y prueban en un proyecto Supabase separado. El proyecto de producción/vitrina `hjaeihdrrictmgilzaic` queda explícitamente bloqueado para cargas de Secretaría.

- Crear primero el proyecto de staging y copiar el esquema mediante migraciones versionadas, sin copiar datos personales de producción.
- Revisar las migraciones antes de aplicarlas. Aplicarlas primero en staging y ejecutar allí los tests de RLS, idempotencia e importación.
- El servicio de importación debe fallar al iniciar si el project ref coincide con producción o si el entorno no declara explícitamente `staging`.
- Mantener claves y URLs separadas por entorno. No reutilizar `SUPABASE_DB_URL` ni `SUPABASE_SECRET_KEY` de producción.
- No ejecutar `supabase config push` desde el entorno local enlazado a producción.
- Los datos de demostración deben ser sintéticos o anonimizados.

## Decisiones cerradas

- El `club_id`/espacio de trabajo se deriva de la sesión. Nunca llega como dato confiable del navegador.
- En la primera etapa, la Secretaría opera dentro de un único espacio y organiza los datos por institución de origen, disciplina y grupo.
- `evaluado_por` es texto de procedencia; `importado_por` es la membresía autenticada. No son la misma persona necesariamente.
- CMJ, SJ y Abalakov son protocolos diferentes aunque produzcan una métrica llamada “Altura de salto”.
- Una métrica describe qué se mide; un protocolo describe cómo se obtuvo. Las disciplinas declaran qué combinaciones usan, sin duplicar catálogos.
- Previsualizar no crea deportistas ni mediciones.
- Confirmar es transaccional e idempotente: o se guarda toda la jornada resuelta o no se guarda nada.
- Las filas de media, máximo, mínimo y desvío estándar se separan; nunca son deportistas.

## `POST /api/evaluaciones/previsualizar`

Requiere sesión operativa (`admin_club` o entrenador con alcance sobre el grupo destino). Recibe `multipart/form-data`:

- `archivo`: `.xlsx` o `.csv`, máximo 20 MB. Los `.xls` legados deben guardarse como `.xlsx` antes de cargar.
- `contexto`: JSON con `institucionOrigen`, `disciplina`, `grupo`, `fechaDeclarada` y `evaluadoPor`.

Debe analizar todas las hojas, normalizar encabezados, detectar bloques y devolver el shape `PrevisualizacionEvaluacion` definido en `lib/evaluaciones-importacion.ts`.

`previewToken` debe ser opaco, de vida corta (30 minutos sugeridos), asociado al usuario y al espacio. Puede referenciar almacenamiento temporal; no debe contener PII legible ni permitir confirmar desde otra sesión.

### Controles mínimos

- Fechas contradictorias entre nombre de hoja, celdas y contexto declarado: `bloqueo` con opciones explícitas.
- Cuando la evidencia favorece una resolución, la opción incluye `recomendada: true` y el motivo. La recomendación no reemplaza la confirmación humana.
- Duplicado dentro del archivo: conservar una sola propuesta y reportar cantidad.
- Conflicto con una medición existente: `bloqueo` con opciones de omitir o corregir, nunca sobrescritura silenciosa.
- Protocolo o métrica desconocidos: `bloqueo`; no crearlos automáticamente desde texto libre.
- Valores no numéricos o unidades incompatibles: `bloqueo` o fila ignorada identificable.
- Filas estadísticas: `info`, con cantidad.
- Deportista sin identificador suficiente o coincidencia ambigua: `bloqueo`.
- El servidor vuelve a validar que el operador alcanza el grupo/categoría seleccionado.

## `POST /api/evaluaciones/importar`

Recibe JSON:

```json
{
  "previewToken": "opaque-token",
  "resoluciones": {
    "hallazgos": {
      "fecha-sub13": "2026-02-09"
    }
  }
}
```

Vuelve a validar sesión, pertenencia del token, expiración, alcance, catálogo de protocolos y que todos los bloqueos tengan resolución. La respuesta cumple `ResultadoImportacion` y devuelve `jornadaIds` más `jornadasCreadas`; `jornadaId` se conserva como compatibilidad para pantallas que navegan una única jornada.

La confirmación debe persistir, en una única transacción:

1. lote/importación con hash del archivo, nombre original, actor, timestamp y resultado;
2. jornada con institución, disciplina, grupo, fecha resuelta y `evaluado_por`;
3. vínculos o altas de deportistas según reglas de identidad;
4. mediciones con métrica, protocolo, jornada e intento estructurados;
5. auditoría de filas ignoradas, duplicados y resoluciones humanas.

Una repetición con el mismo token o hash+contexto debe devolver el resultado previo o `409 IMPORTACION_DUPLICADA`, nunca duplicar mediciones.

## Errores esperados

- `400 ARCHIVO_NO_SOPORTADO` / `ARCHIVO_INVALIDO`
- `401 SESION_REQUERIDA`
- `403 SIN_ALCANCE`
- `409 IMPORTACION_DUPLICADA` / `CONFLICTO_MEDICION`
- `410 PREVIEW_EXPIRADO`
- `422 BLOQUEOS_PENDIENTES`

Todos devuelven `{ "error": "mensaje claro para la persona" }`.

## Archivos recibidos: adaptadores

Implementar adaptadores por estructura detectada, no por nombre exacto de archivo. La primera batería debe cubrir los nueve libros entregados y reconocer atletismo, fútbol, gimnasia rítmica, levantamiento, MMA, rugby y vóley.

El caso SUB13 exige una prueba de regresión específica:

- no interpretar las filas estadísticas como deportistas;
- detectar la contradicción 09/02/2026 vs 02/09/2026;
- detectar los 21 SJ repetidos;
- mantener separados CMJ, SJ y Abalakov;
- proponer 273 resultados: peso corporal una vez por deportista y jornada, más cuatro métricas específicas en cada uno de los tres protocolos;
- marcar 09/02/2026 como fecha recomendada, explicando que coincide con el nombre de la hoja, el bloque SJ y el patrón de peso de una misma sesión;
- no afirmar que existen dos jornadas ni una curva longitudinal sin resolución humana.

## Modelo que permite crecer

- `disciplina`: catálogo administrable, sin lógica condicional por deporte.
- `metrica` (o evolución compatible de `atributo`): nombre canónico, unidad, naturaleza y sentido.
- `protocolo`: código y versión del procedimiento (CMJ, SJ, Abalakov, DJ, Sprint 10 m, etc.).
- `disciplina_protocolo`: combinaciones habilitadas y orden de presentación para cada disciplina.
- `protocolo_metrica`: métricas que produce cada protocolo, unidades y reglas de validación.
- `jornada`: procedencia, disciplina, grupo, fecha resuelta, evaluador y condiciones de la toma.
- `lote_importacion`: archivo, hash, adaptador utilizado, actor, resoluciones y auditoría.
- `medicion`: jornada, deportista, métrica, protocolo nullable para medidas transversales, valor, unidad e intento.

La identidad de una medición no debe depender solo de la fecha. Como base, usar jornada + deportista + métrica + protocolo + intento. Esto admite dos jornadas el mismo día, varios intentos y protocolos distintos sin colisiones. Para protocolos nulos, la restricción debe tratar `NULL` de forma explícita para que el peso no se duplique.

`categoria.nombre` puede alojar U14, Iniciación o Desarrollo durante el piloto y dejar `categoria.tipo` nulo. No conviene sumar esos nombres al enum futbolístico: a futuro corresponde una clasificación configurable y neutral por disciplina.

## Salida del workaround

Mover más adelante una institución a su propio espacio no puede ser un `UPDATE deportista.club_id` aislado. El script de migración debe actualizar dentro de una transacción los `club_id` denormalizados de mediciones e hitos, verificar RLS, recalcular agregados y dejar auditoría. Este procedimiento debe existir antes del primer traslado.
