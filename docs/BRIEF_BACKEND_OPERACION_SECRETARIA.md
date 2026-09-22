# Brief backend · Operación diaria del Espacio Secretaría

## Objetivo

Completar el paso de importador inicial a herramienta operativa: explorar qué se
midió, corregir metadatos con trazabilidad y registrar nuevas jornadas desde el
celular sin depender de una planilla.

Todo se implementa y prueba primero en staging `yncidsgcypyyvurtyesx`. No tocar
producción `hjaeihdrrictmgilzaic`.

## 1. Correcciones auditadas

### Antes de confirmar un lote

Permitir que `admin_secretaria` corrija en un lote `previsualizado`:

- `institucionOrigen`
- `disciplina`
- `grupo`
- `fechaDeclarada`
- `evaluadoPor`

La operación debe registrar membresía, instante, motivo, valor anterior y valor
nuevo. No debe permitir editar un lote importado por esta vía.

### Después de confirmar una jornada

Crear una operación transaccional para corregir:

- nombre de la institución de origen;
- fecha oficial de la jornada;
- responsable/evaluador.

Si cambia la fecha, deben cambiar en la misma transacción
`jornada_evaluacion.fecha` y las filas de `medicion.fecha` asociadas. Antes de
aplicar, validar conflictos con los índices únicos. Nunca hacer un `update`
aislado de la jornada.

Toda corrección debe dejar auditoría consultable. No borrar el valor anterior.

No cargar fechas inventadas para Atletismo o MMA. Hasta recibir la fecha oficial,
los lotes deben permanecer pendientes. Si se decide admitir fechas provisorias,
modelarlas explícitamente (`estado_fecha = provisoria|confirmada`) y mostrarlas
como tales; no usar una fecha aparentemente definitiva.

## 2. Exploración de datos

Exponer consultas acotadas por el `club_id` de la membresía resuelta en servidor:

### Detalle de lote/planilla

- contexto y estado;
- archivo original y hash;
- fecha de recepción y confirmación;
- filas leídas, ignoradas y duplicadas;
- cantidad de deportistas, jornadas y mediciones;
- hallazgos y resoluciones;
- jornadas creadas;
- protocolos y métricas detectados.

Para lotes importados, reconstruir el detalle desde las jornadas y mediciones;
`preview_json` se vacía al confirmar y no puede ser la fuente posterior.

### Resumen por disciplina

Por cada disciplina devolver:

- instituciones y grupos medidos;
- deportistas distintos;
- jornadas y última fecha;
- protocolos efectivamente utilizados;
- métricas efectivamente registradas, con unidad y cantidad;
- métricas/protocolos del catálogo todavía sin datos.

Preferir una RPC o vista agregada. No descargar todas las mediciones al browser.

## 3. Registro manual de una jornada

Crear una RPC transaccional e idempotente, por ejemplo
`guardar_jornada_evaluacion_manual(p_contexto jsonb, p_mediciones jsonb,
p_idempotency_key uuid)`.

El contexto debe incluir:

- institución de origen;
- disciplina;
- grupo/categoría;
- fecha;
- `evaluado_por`;
- protocolo;
- membresía que registra.

Cada medición debe incluir:

- deportista;
- atributo/métrica;
- intento;
- valor;
- nota opcional.

La función debe:

1. Resolver la membresía desde `auth.uid()`, nunca desde un `club_id` enviado por
   el browser.
2. Validar `opera_categoria`.
3. Validar que protocolo pertenezca a disciplina y atributo a protocolo.
4. Validar unidad/rango y que el deportista pertenezca al grupo.
5. Crear o reutilizar la jornada de forma idempotente.
6. Crear `jornada_deportista` y todas las mediciones en una transacción.
7. Conservar intentos separados; no reducirlos silenciosamente al mejor o al
   promedio.
8. Devolver `jornadaId`, deportistas y mediciones guardadas.

El frontend mantendrá un borrador local para trabajo sin señal, pero la
confirmación remota debe ser atómica.

## 4. Doble contexto de Secretaría

La cuenta de Secretaría debe poder alternar entre:

- **Evaluaciones:** fichas individuales únicamente de su propio espacio.
- **Observatorio:** agregados provinciales de organizaciones tipo `club`, sin
  acceso a fichas individuales ajenas.

Habilitar la llamada al observatorio agregado sin otorgar `SELECT` individual
sobre deportistas o mediciones de clubes. Verificar ambos contextos con la misma
cuenta real.

## 5. Datos pendientes actuales

Antes de confirmar los cuatro lotes, actualizar sus contextos a:

- Vóley: `Club Atlético Central Norte`.
- Levantamiento: `Grupo de Levantamiento`.

Atletismo y MMA quedan pendientes de fecha oficial.

## Criterios de aceptación

- Secretaría abre una planilla y comprende qué se importó.
- Secretaría abre una disciplina y ve protocolos, métricas y cobertura reales.
- Puede registrar una jornada completa desde el teléfono.
- Repetir la misma petición no duplica datos.
- Una corrección de fecha nunca deja jornada y mediciones desalineadas.
- Toda corrección conserva actor, momento, motivo, antes y después.
- Secretaría ve el observatorio agregado pero cero fichas individuales ajenas.
- Las pruebas de RLS y producción intacta quedan documentadas.
