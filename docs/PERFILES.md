# PERFILES.md — Matriz de acceso (fuente de verdad)

Definida el 2026-07-09 tras el doble check de perfiles. El prototipo
la refleja vía `permisosDe()` en `components/perfil-context.tsx`
(visibilidad de UI, sin auth real); en producción la aplican las
policies de RLS de `docs/01_ola1_mvp.sql` (ver propuesta v6 al final
de ese archivo para el alcance por categoría del profesor).

## Los 4 perfiles

| Capacidad | Profesor/a (`entrenador`) | Admin del club (`admin_club`) | Comisión directiva (`comision_directiva`) | Plataforma (super admin) |
|---|---|---|---|---|
| **Alcance de datos** | Solo SUS categorías asignadas | Todo el club | Todo el club | **Ningún dato individual** — solo agregados por club |
| Ver fichas y evolución | ✅ sus categorías | ✅ | ✅ (lectura) | ❌ |
| Cargar mediciones | ✅ sus categorías | ✅ | ❌ | ❌ |
| Planificar entrenamiento (tablero) | ✅ sus categorías | ✅ | ❌ | ❌ |
| Registrar asistencia / sesiones | ✅ sus categorías | ✅ | ❌ | ❌ |
| Registrar consentimiento firmado | ✅ | ✅ | ❌ | ❌ |
| Alta/edición de deportistas | ✅ sus categorías | ✅ | ❌ | ❌ |
| Trayectoria (`deportista_hito`: ingreso, promociones, debut, pase) | ✅ sus categorías | ✅ | ✅ (lectura) | ❌ — solo el agregado `pases_12m` |
| Baja por pase a otro club (los datos NO viajan con el pase) | ✅ sus categorías | ✅ | ❌ | ❌ |
| Borrar deportistas | ❌ | ✅ | ❌ | ❌ |
| Gestionar categorías y staff (membresías) | ❌ | ✅ | ❌ | ❌ |
| Ver agenda (entrenamientos y partidos) | ✅ sus categorías | ✅ | ✅ (lectura) | ❌ |
| Cargar partidos (rival, citados, resultado) | ✅ sus categorías | ✅ | ❌ | ❌ |
| Gestionar cronograma semanal y lugares | ❌ | ✅ | ❌ | ❌ |
| Vista tabla del plantel | ✅ sus categorías | ✅ | ✅ | ❌ |
| Informe imprimible | ✅ sus categorías | ✅ | ✅ | ❌ |
| Observatorio provincial (agregados) | ❌ | ❌ | ❌ | ✅ |
| Catálogo global de atributos | lectura | lectura | lectura | **curaduría** (vía service role) |

## Racionales (por qué así y no de otra forma)

- **El profesor ve solo sus categorías** — minimización de datos de
  menores: un profe de escuelita no necesita las fichas de Primera.
  Además es el guard-rail contra el uso "scouting interno" no
  autorizado. Requiere asignación profe↔categoría (propuesta
  `membresia_categoria`, v6 del SQL).
- **Comisión directiva es consulta pura** — supervisa, no opera. Si un
  directivo también entrena, se le da además membresía de entrenador.
- **La plataforma NO ve fichas** — es el corazón del argumento de
  confianza frente a Secretaría/Liga: los datos individuales de
  menores nunca salen del club, ni siquiera para el operador de la
  plataforma (acceso individual solo por vía excepcional auditada,
  p. ej. soporte con consentimiento del club).
- **Sin perfiles nuevos por ahora**: tutor/familia sigue pospuesto
  (decisión de MVP: deportistas y tutores no tienen login);
  "coordinador deportivo" = admin_club en la práctica. Se revisa
  después del piloto.

## En el prototipo (selector demo)

El profesor demo es **Marcela Díaz**, asignada a **9ª División** y
**Escuelita 2016** (`PROFE_DEMO` en `lib/mock-data.ts`). El selector
de perfil es un switcher de UI para demostrar el modelo — la
seguridad real es RLS en producción, nunca el frontend.
