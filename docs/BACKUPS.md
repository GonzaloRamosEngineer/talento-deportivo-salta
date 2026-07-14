# Backups — talento-deportivo-salta

Resguardo **pilot-grade** mientras el proyecto Supabase está en plan
Free (sin backups automáticos ni PITR). Suficiente para arrancar el
piloto con 1-2 clubes; cuando haya volumen real se pasa a Supabase Pro
+ PITR y esto queda como red secundaria.

## Qué guarda

`scripts/backup.mjs` crea una carpeta con fecha/hora y adentro:

- **`db_public.sql`** — volcado completo del esquema `public` vía
  `pg_dump` en un contenedor `postgres:17` (matchea el Postgres 17.x de
  Supabase, sin instalar nada local). Incluye estructura + RLS +
  funciones + triggers + **todos los datos** (club, categorías,
  deportistas, tutores, consentimientos, mediciones, sesiones,
  asistencia, asignaciones, partidos).
- **`consentimientos/`** — todos los archivos del bucket privado de
  consentimientos (fotos/PDF de las firmas). Si el bucket todavía no
  existe (Módulo C sin desplegar), se omite sin fallar.

## Requisitos

- Docker corriendo (Docker Desktop abierto).
- `.env.local` con `SUPABASE_DB_URL` (cadena del session pooler) y
  `SUPABASE_SECRET_KEY`. Ya están cargadas (gitignored).

## Dónde caen los backups → Google Drive de la Fundación (offsite)

La idea: que el archivo salga **fuera de la laptop** solo. Con Google
Drive para escritorio, la carpeta de Drive es una carpeta normal del
Mac; el script escribe ahí y Drive la sube.

**Setup (una vez):**

1. Instalar **Google Drive para escritorio** e iniciar sesión con la
   cuenta de la Fundación (la del Drive non-profit).
2. En ese Drive, crear una carpeta, p. ej. `Backups Talento Deportivo`.
3. Averiguar su ruta local. Con Drive Desktop en Mac suele ser algo
   como:
   `~/Library/CloudStorage/GoogleDrive-<cuenta>/Mi unidad/Backups Talento Deportivo`
   (o `Unidades compartidas/...` si es unidad compartida de la
   organización).

## Correr un backup

```sh
TDS_BACKUP_DIR="/ruta/a/tu/carpeta/de/Drive/Backups Talento Deportivo" \
  node scripts/backup.mjs
```

Sin `TDS_BACKUP_DIR` cae en `~/talento-backups` (LOCAL — habría que
moverlo a Drive a mano; no es offsite).

## Cadencia recomendada

- **Cada 2 semanas** (2 veces al mes), y además
- **después de cada carga grande** (importaste un plantel nuevo, se
  sumó un club) → corré uno enseguida.

Si querés que corra solo, ver "Automatizar" abajo (con el asterisco de
que la Mac tiene que estar despierta).

## Restore

### Caso común: recuperar datos borrados/corruptos (sin tocar prod)

Levantás un Postgres descartable local, cargás el dump y sacás de ahí
lo que falta (nunca escribís sobre prod a ciegas):

```sh
docker run -d --name tds-restore -e POSTGRES_PASSWORD=tmp -p 5433:5432 postgres:17
# esperar unos segundos a que arranque
cat "<carpeta>/db_public.sql" | docker exec -i tds-restore psql -U postgres -d postgres
# inspeccionar / exportar las filas que necesitás:
docker exec -it tds-restore psql -U postgres -d postgres
#   select * from deportista where ...;   \copy (...) to '/tmp/x.csv' csv
# y reinsertar esas filas puntuales en prod (a mano o con un script).
docker rm -f tds-restore
```

### Caso grave: pérdida total → proyecto Supabase nuevo

1. Crear un proyecto Supabase nuevo.
2. `supabase db push` con la nueva `--db-url` → recrea esquema + RLS
   desde `supabase/migrations/`.
3. Cargar **solo los datos** desde el dump (los bloques `COPY public.*`
   de `db_public.sql`), o cargar el dump completo en un proyecto vacío
   ANTES de correr migraciones.
4. Recrear el bucket (Módulo C) y subir de vuelta `consentimientos/`.
5. Reinvitar a los usuarios (auth.users no está en este dump: los
   logins se rehacen con la cadena de alta de `docs/OPERACION.md`).

> El dump cubre el esquema `public` (nuestros datos). NO incluye
> `auth.users` (logins) — es intencional: los accesos se regeneran por
> invitación, no se restauran.

## Automatizar (opcional) — launchd

Un `LaunchAgent` de macOS puede dispararlo, p. ej. cada lunes 9:00,
**siempre que la Mac esté encendida** (si está dormida, corre al
despertar con `StartCalendarInterval`). Pedir a Claude que genere e
instale el `.plist` si se quiere esto; el default recomendado para el
piloto es correrlo a mano según la cadencia de arriba.

## Techo honesto

Esto NO es PITR: no restaura a un segundo exacto, no es always-on y
depende de que alguien corra el script y de que Drive sincronice. Es
una red mínima responsable para el piloto. El upgrade natural es
Supabase Pro + PITR cuando entren datos de menores en volumen.
