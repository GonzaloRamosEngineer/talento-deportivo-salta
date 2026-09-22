# Implementación backend · Espacio Secretaría

## Qué quedó preparado

- Organización tipo `secretaria` sobre el tenant compatible existente.
- Membresías multiespacio y roles `admin_secretaria`, `coordinador_secretaria`, `evaluador` y `analista_secretaria`.
- Institución de origen y grupos por institución/disciplina.
- Catálogo curado de protocolos y métricas, sin crear conceptos desde texto libre.
- Jornadas, participantes, lotes, hallazgos, resoluciones y auditoría.
- Mediciones con jornada, protocolo, intento, detalle y procedencia del lote.
- Confirmación transaccional e idempotente mediante `confirmar_lote_evaluacion`.
- Endpoints:
  - `POST /api/evaluaciones/previsualizar`
  - `POST /api/evaluaciones/importar`
  - `GET /api/contextos`
  - `GET /api/secretaria/resumen`
- Cuatro adaptadores estructurales que cubren los nueve archivos recibidos.

## Variables exclusivas de staging

```text
APP_ENV=staging
IMPORT_BACKEND_ENABLED=true
IMPORT_PREVIEW_SECRET=<secreto aleatorio de 32+ caracteres>
NEXT_PUBLIC_SUPABASE_URL=<URL del proyecto separado>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key de staging>
SUPABASE_SECRET_KEY=<secret key de staging, solo servidor>
SECRETARIA_ADMIN_EMAIL=<correo a invitar>
SECRETARIA_ADMIN_NOMBRE=<nombre visible opcional>
```

El código rechaza el project ref productivo `hjaeihdrrictmgilzaic`, incluso si alguien habilita el importador por error.

## Puesta en marcha, en orden

1. Crear y vincular un proyecto Supabase separado de staging.
2. Verificar que las variables anteriores apuntan a staging.
3. Revisar y aplicar, en staging, las migraciones:
   - `20260922090000_espacio_secretaria_evaluaciones.sql`
   - `20260922090500_corregir_rango_y_disciplina_base.sql`
   - `20260922091000_catalogo_evaluaciones_secretaria.sql`
   - `20260922092000_ajustes_importacion_y_observatorio.sql`
4. Ejecutar `npm run setup:secretaria-staging` para crear el espacio e invitar a su primer administrador.
5. Aceptar la invitación, iniciar sesión y comprobar `GET /api/contextos`.
6. Importar primero SUB13 y resolver la fecha como 2026-02-09.
7. Comparar conteos con `npm run test:importadores`.
8. Importar las otras ocho planillas. Atletismo y MMA requieren declarar la fecha porque no está en el archivo.

Vóley declara 16/04/2026 en el título y Levantamiento declara 27/04/2026. El adaptador las reconoce; pueden confirmarse con esas fechas cuando la Secretaría ratifique que el título es la fuente oficial.

No ejecutar `supabase config push`. No usar `SUPABASE_DB_URL` ni `SUPABASE_SECRET_KEY` de producción.

## Conteos de regresión de los archivos recibidos

| Archivo | Deportistas | Mediciones propuestas |
| --- | ---: | ---: |
| Atletismo 2026 | 15 | 287 |
| Levantamiento Desarrollo | 6 | 102 |
| Levantamiento Iniciación | 8 | 144 |
| MMA | 9 | 153 |
| Vóley Central Norte General | 36 | 612 |
| Vóley Central Norte Primera | 10 | 170 |
| Gimnasia rítmica | 26 | 182 |
| SUB13 Liga Salteña | 21 | 273 |
| Rugby U14 | 34 | 170 |

Los conteos de saltos consolidan peso y handgrip repetidos entre protocolos. Las celdas con dos valores en DJ se conservan como intentos separados.

## Decisiones de integridad

- La edad declarada se guarda en `jornada_deportista`; no se inventa una fecha de nacimiento.
- Las asimetrías guardan el valor numérico y la lateralidad en `medicion.detalle`.
- Una planilla de gimnasia con varias fechas produce varias jornadas dentro del mismo lote.
- El lote conserva la previsualización solo hasta confirmar; al confirmar se vacía el JSON con PII y queda la auditoría estructurada.
- Un conflicto de jornada + deportista + métrica + protocolo + intento aborta la transacción completa.
- `.xls` legado no se admite: debe guardarse como `.xlsx`. Los nueve archivos recibidos son `.xlsx` o `.csv`.
