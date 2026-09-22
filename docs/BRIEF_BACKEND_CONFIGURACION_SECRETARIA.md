# Brief backend · Configuración operativa del Espacio Secretaría

## Objetivo

Completar el circuito de trabajo de la Secretaría sin convertir cada institución
visitada en un tenant ni copiar el modelo de clubes. La navegación objetivo es:

`institución → disciplina → grupo/plantel → deportistas → jornada → resultados → ficha/evolución`.

Todo se implementa y verifica primero en staging `yncidsgcypyyvurtyesx`. No tocar
producción `hjaeihdrrictmgilzaic`.

## Decisión de dominio

- El tenant y dueño operativo de estas evaluaciones sigue siendo el Espacio
  Secretaría (`club.tipo_organizacion = 'secretaria'`).
- El lugar donde se mide no es otro tenant: es una `institucion_origen` de ese
  espacio. Puede ser club, liga, asociación, escuela o grupo independiente.
- Un `categoria` representa un grupo o plantel y debe vincularse a una
  institución y una disciplina.
- El deportista pertenece al Espacio Secretaría y a un grupo. Las fichas de un
  club ajeno no se reutilizan ni se exponen por coincidencia de nombre.
- Disciplina, protocolo, métrica, unidad y rango forman un catálogo técnico
  global curado. Una administración de Secretaría puede elegir elementos
  habilitados, pero no crear unidades o protocolos arbitrarios.

## 1. Instituciones

Crear RPCs transaccionales y auditadas para `admin_secretaria`:

### `crear_institucion_secretaria(p_nombre, p_tipo, p_localidad, p_notas)`

- Resolver `club_id` desde la membresía de `auth.uid()`.
- Normalizar espacios y mayúsculas para detectar posibles duplicados.
- Ante coincidencia, devolver `INSTITUCION_POSIBLE_DUPLICADO` con la institución
  existente; no crear silenciosamente otra variante del nombre.
- Tipos iniciales: `club`, `liga`, `asociacion`, `escuela`, `grupo`, `otro`.
- Registrar actor y fecha.

### `actualizar_institucion_secretaria(p_id, ..., p_motivo)`

- Permitir corregir nombre, tipo, localidad, notas y estado activo.
- No borrar físicamente instituciones con jornadas.
- Conservar antes/después, actor, momento y motivo.

La consulta operativa debe devolver solo instituciones activas con sus
disciplinas, grupos y cantidad de deportistas. Una vista histórica puede incluir
inactivas que tengan jornadas.

## 2. Grupos y disciplinas

### `crear_grupo_secretaria(p_institucion_id, p_disciplina_id, p_nombre, p_tipo)`

- Validar que la institución pertenezca al Espacio Secretaría.
- Validar que la disciplina esté activa en el catálogo global.
- Evitar duplicados por institución + disciplina + nombre normalizado.
- `tipo` puede quedar nullable hasta ampliar el enum actual; nombres como U14,
  Iniciación y Desarrollo no deben forzarse a `inferior` o `primera`.
- Registrar actor y fecha.

### `actualizar_grupo_secretaria(p_id, ..., p_motivo)`

- Permitir nombre, institución, disciplina y estado activo.
- Un cambio de disciplina con mediciones existentes debe rechazarse con
  `GRUPO_CON_MEDICIONES`; se crea un grupo nuevo o se ejecuta una migración
  explícita.
- No borrar físicamente grupos con deportistas, jornadas o mediciones.

### Disciplina inexistente

Crear una solicitud, no una disciplina técnica inmediata:

`solicitar_disciplina_secretaria(p_nombre, p_descripcion, p_contexto)`.

Debe quedar en estado `pendiente|aprobada|rechazada`, con solicitante y fechas.
La aprobación de plataforma crea/habilita la disciplina y luego configura sus
protocolos y métricas. Hasta entonces no se puede medir con ella. Esto evita
variantes como `Volley`, `Vóley` y `Voley` o unidades incompatibles.

## 3. Planteles y deportistas

### `crear_deportista_secretaria(p_grupo_id, p_identidad jsonb)`

Campos mínimos:

- nombre completo o nombre + apellido;
- fecha de nacimiento cuando exista;
- sexo y lateralidad opcionales;
- identificador externo/documento solo si existe base legal y almacenamiento
  protegido;
- estado de consentimiento para menores.

La RPC debe:

1. Resolver el Espacio Secretaría desde `auth.uid()`.
2. Validar alcance sobre el grupo.
3. Buscar posibles duplicados dentro del mismo espacio usando nombre
   normalizado + fecha de nacimiento y devolver candidatos para decisión.
4. Crear o vincular únicamente después de una resolución explícita.
5. Auditar actor y fecha.

### Importación de plantel

Agregar previsualización y confirmación idempotente para CSV/XLSX de nómina. La
previsualización debe separar `nuevos`, `posibles duplicados`, `actualizaciones`
y `rechazados`. Nunca sobreescribir identidad silenciosamente.

### Cambios posteriores

- Permitir corregir datos personales con motivo y auditoría.
- Mover de grupo debe actualizar de forma transaccional la pertenencia futura,
  pero no reescribir el contexto histórico de jornadas pasadas.
- Baja lógica (`activo = false`), nunca borrado si tiene mediciones.

## 4. Catálogo técnico

Mantener de plataforma:

- disciplinas;
- protocolos;
- métricas/atributos;
- unidades, sentido, mínimos y máximos;
- relaciones disciplina-protocolo y protocolo-métrica.

La Secretaría puede seleccionar qué batería habilita para un grupo o disciplina.
Si se implementa personalización, crear una tabla de configuración del tenant;
no mutar el catálogo global ni guardar el protocolo dentro de un string.

## 5. Consultas necesarias para el frontend

### Preparar jornada

Extender `GET /api/secretaria/medir` o respaldarlo con una RPC que devuelva una
estructura jerárquica:

```json
{
  "instituciones": [{
    "id": "uuid",
    "nombre": "Club Atlético Central Norte",
    "disciplinas": [{
      "id": "uuid",
      "nombre": "Vóley",
      "grupos": [{ "id": "uuid", "nombre": "Primera", "deportistas": 10 }]
    }]
  }]
}
```

El servidor siempre deriva el `club_id` de la sesión. Ningún id del browser
amplía alcance.

### Detalle de planilla

El frontend ya consume una lista normalizada de resultados. Formalizar este
contrato para lote importado y previsualizado:

```ts
type ResultadoPlanilla = {
  deportistaId: string | null;
  deportistaClave: string | null;
  nombre: string;
  apellido: string | null;
  fecha: string | null;
  protocoloCodigo: string | null;
  protocoloNombre: string | null;
  atributoCodigo: string;
  atributoNombre: string;
  unidad: string | null;
  valor: number;
  intento: number;
};
```

Para importados, reconstruir desde `medicion` filtrada por
`lote_importacion_id` y `club_id`. Para previsualizados, normalizar desde
`preview_json`. Conservar intentos separados y no fusionar protocolos.

### Ficha y navegación inversa

- Cada resultado importado debe incluir `deportistaId` para abrir su ficha.
- La ficha debe indicar institución, disciplina y grupo actuales, además de las
  series separadas por atributo + protocolo.
- Una jornada debe poder volver a su planilla/lote de origen.
- Una ficha debe listar las jornadas en las que participó.

## 6. Roles

- `admin_secretaria`: administra instituciones, grupos, planteles y equipo;
  corrige datos con auditoría; ve todas las fichas del espacio.
- `coordinador_secretaria`: administra solo los grupos asignados y registra
  jornadas.
- `evaluador`: ve planteles asignados y registra mediciones; no cambia estructura
  ni catálogo.
- plataforma: aprueba catálogo técnico y accede solo a agregados, salvo soporte
  excepcional auditado.

Usar `membresia_categoria`/`opera_categoria` para minimizar acceso a menores.

## 7. Criterios de aceptación

- Un administrador crea una institución, elige una disciplina existente, crea
  un grupo y carga su plantel sin usar SQL.
- La nueva combinación aparece inmediatamente en `Medir` siguiendo institución
  → disciplina → grupo.
- Un evaluador sin asignación no puede ver ni medir ese plantel.
- Una disciplina inexistente genera una solicitud; no contamina el catálogo.
- Una jornada guardada aparece en planillas, grupo y ficha de cada atleta.
- La planilla muestra valores, protocolos e intentos reales y enlaza a fichas.
- Ninguna operación permite leer o escribir fichas individuales de otro tenant.
- Altas, correcciones, movimientos y bajas quedan auditados.
- Reintentos no duplican instituciones, deportistas, jornadas ni mediciones.

