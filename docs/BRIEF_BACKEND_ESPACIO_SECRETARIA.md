# Brief backend — Espacio Secretaría

## Resultado esperado

Una misma cuenta puede operar dentro del Espacio Secretaría y, si tiene permiso, cambiar al Observatorio provincial. Son contextos distintos:

- **Secretaría · operación:** fichas individuales, grupos, jornadas, importaciones y estadísticas producidas por la Secretaría.
- **Observatorio provincial:** agregados autorizados de Secretaría y clubes. No habilita fichas individuales de otros tenants.
- **Club:** conserva sus miembros, deportistas, mediciones y estadísticas actuales.

El frontend demo ya representa `perfil = secretaria` y las rutas `/secretaria/*`.

## Orden de implementación

1. Crear proyecto Supabase de staging separado. No aplicar cambios en `hjaeihdrrictmgilzaic`.
2. Versionar y revisar migraciones.
3. Aplicar migraciones en staging.
4. Crear el tenant Secretaría y catálogos iniciales.
5. Invitar una cuenta provisoria real en staging y asignarla como administradora.
6. Implementar selector de contexto y RLS.
7. Implementar el contrato de importación.
8. Cargar y validar primero SUB13; después los otros ocho archivos.

## Tenant

Camino incremental recomendado: mantener la tabla `club` por compatibilidad y convertirla conceptualmente en organización mediante una columna:

```text
tipo_organizacion = club | secretaria | liga | federacion
```

Crear en staging:

```text
nombre: Secretaría de Deportes de la Provincia de Salta
tipo_organizacion: secretaria
```

La interfaz nunca debe llamarlo “club”; usa “Espacio Secretaría”.

## Membresías y contextos

- Eliminar `unique(auth_user_id)` de `membresia`.
- Agregar `unique(auth_user_id, club_id)` mientras la FK conserve ese nombre.
- Una cuenta puede tener membresías en varias organizaciones.
- El permiso de observatorio no debe tomar precedencia automática sobre una membresía operativa.
- Reemplazar la decisión actual basada solamente en `app_metadata.plataforma` por contextos elegibles.
- Cada request valida en servidor que el usuario tenga membresía o permiso para el contexto solicitado.
- Nunca confiar en un `club_id`/`organizacion_id` recibido desde el navegador sin volver a validarlo.

Contrato mínimo sugerido:

```text
GET /api/contextos
→ organizaciones y contextos que la sesión puede usar

GET /api/contextos/:id/resumen
→ identidad visual, tipo de organización, rol y alcances
```

El frontend necesita mapear:

```text
organización tipo secretaria + rol operativo → perfil secretaria
contexto observatorio → perfil super_admin
organización tipo club → perfiles actuales
```

## Roles de Secretaría

Evitar reutilizar `admin_club` como etiqueta visible. Roles propuestos:

- `admin_secretaria`: administra organización, equipo y todas las jornadas.
- `coordinador_secretaria`: administra instituciones, grupos y asignaciones.
- `evaluador`: registra/importa/corrige solamente grupos asignados.
- `analista_secretaria`: lectura individual y reportes autorizados, sin gestionar accesos.

Si se mantiene un único enum de membresía durante el piloto, documentar el mapeo transitorio y no exponer nombres de club en la UI.

## Datos y procedencia

Toda jornada debe guardar:

- organización propietaria;
- institución de origen;
- disciplina;
- grupo;
- fecha resuelta;
- evaluador declarado;
- actor que cargó/importó;
- fuente y lote de importación.

Toda medición debe pertenecer a una jornada. La unicidad se basa en:

```text
jornada + deportista + métrica + protocolo + intento
```

El peso corporal y otras métricas transversales pueden tener protocolo nulo, pero la restricción debe evitar duplicados con `NULL` de forma explícita.

## Catálogos iniciales

Disciplinas recibidas:

- Atletismo
- Fútbol
- Gimnasia rítmica
- Levantamiento
- MMA
- Rugby
- Vóley

No crear métricas o protocolos automáticamente desde encabezados. El importador propone mapeos contra catálogos versionados; un responsable técnico los valida.

## Cuenta provisoria

- Crear solamente en staging.
- Usar invitación de Supabase al correo que indique el responsable; no compartir una contraseña fija.
- Asignar `admin_secretaria` en la organización Secretaría.
- Forzar creación de contraseña personal desde el enlace.
- No usar service role desde el navegador.
- No reutilizar cuentas demo de clubes.

## RLS y pruebas de aceptación

1. Admin Secretaría ve individuos y jornadas de Secretaría.
2. Evaluador asignado ve solamente sus grupos.
3. Secretaría no ve fichas individuales pertenecientes a clubes.
4. Admin de club no ve fichas ni jornadas de Secretaría.
5. Observatorio recibe únicamente agregados autorizados.
6. Cambiar el identificador de contexto manualmente devuelve `403` o cero filas.
7. Una cuenta con Secretaría + Observatorio puede cambiar de contexto sin elevar privilegios.
8. Service role queda limitado al servidor y cada operación registra actor humano.
9. El importador se niega a iniciar si el project ref es producción.

## Integración con el frontend existente

Cuando staging esté listo, reemplazar el deep-link demo `?perfil=secretaria` por el contexto devuelto por sesión. Las pantallas ya preparadas son:

- `/panel` para Resumen Secretaría;
- `/secretaria/jornadas`;
- `/secretaria/grupos`;
- `/secretaria/disciplinas`;
- `/secretaria/equipo`;
- `/secretaria/reportes`;
- `/evaluaciones/importar`.

La primera integración real debe alimentar el resumen y las listas desde endpoints de staging, manteniendo el fixture anonimizado como estado de demostración explícito.
