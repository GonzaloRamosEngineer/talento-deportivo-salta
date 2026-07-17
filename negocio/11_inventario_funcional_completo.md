# Inventario funcional completo — Talento Deportivo Salta

*2026-07-17. Documento de referencia ingenieril para armar propuestas
(Secretaría, Liga, clubes, inversores): TODO lo que el producto
contempla — lo que está en producción, lo que está en roadmap
comprometido, lo diseñado para olas futuras, las evoluciones posibles
y, tan importante como lo anterior, lo que decidimos NO construir y
por qué. Continúa la serie de `negocio/` (08 competencia, 09 respuesta
al informe externo, 10 círculo virtuoso).*

---

## 1 · Qué es

**Registro longitudinal de la evolución de deportistas en formación**
(mayoría menores), multi-club, con un observatorio provincial de
agregados. No es una promesa de rendimiento ni una herramienta de
scouting: es la infraestructura de datos del deporte formativo, con la
ética como diferencial de diseño.

El producto ES el círculo virtuoso del profe (adoptado como narrativa
en `negocio/10`):

```
1. DIAGNÓSTICO   → jornada de medición con protocolo
2. EVALUACIÓN    → curva + tendencia "últimas 3"
3. APRENDIZAJE   → guías ¿Cómo medir? + ideas de trabajo curadas
4. EJECUCIÓN     → tablero de entrenamiento en cancha
        ↺ re-medir cierra el ciclo
```

### Principios de diseño no negociables (definen el producto tanto como las features)

| Principio | Implementación concreta |
|---|---|
| Registro, nunca atribución causal | Ningún copy dice "este entrenamiento mejoró a X"; tendencia = "basado en tus últimas 3 mediciones" |
| El confundidor de maduración se muestra, no se esconde | Módulo "El estirón": la mejora física en chicos es en gran parte crecimiento — el producto lo hace visible |
| Cada chico contra sí mismo, nunca contra la media | Filtro "mejorando" = tendencia propia; sin rankings por edad (el ranking premia al que maduró antes) |
| Minimización de datos de menores | `doc_interno` (nunca DNI), sin datos sensibles (psicológicos/médicos), sin fotos, tutores sin login |
| Consentimiento estructural | Todo deportista tiene registro de consentimiento (pendiente visible si falta); imprimible pre-completado |
| Catálogo global curado centralmente | Disciplinas/atributos/guías: un solo estándar provincial → comparabilidad real; los clubes proponen, la plataforma cura |
| La plataforma nunca ve datos individuales | RLS de 0 filas para el perfil provincial; su única ventana es una RPC de agregados |
| Seguridad desde el primer commit | RLS en la misma migración que crea cada tabla; 20 tablas, 44 políticas |

---

## 2 · Stack y arquitectura

| Capa | Tecnología | Nota |
|---|---|---|
| Frontend | Next.js 16 (App Router) + React + TypeScript | Mobile-first (el profe carga desde el celular en el predio) |
| UI | Tailwind v4 + shadcn/ui, sistema "Cancha clara" | Gráficos Recharts; diagramas SVG propios |
| Backend | Supabase (PostgreSQL + Auth + RLS + Storage) | Migraciones versionadas por CLI, nunca a mano |
| Deploy | Vercel (deploy automático desde main) | prod: talentodeportivosalta.vercel.app |
| Backups | pg_dump en Docker → Google Drive institucional (offsite) | Pilot-grade sin costo; PITR pago cuando haya volumen |
| Datos demo | Hooks duales mock/real | La demo pública anónima vive sin tocar la base |

Patrón clave: **hooks duales** (`useDatos`, `useAgenda`,
`useObservatorio`, `useParametrosCrecimiento`) — el visitante anónimo
ve una demo completa con datos mock; con sesión real, las MISMAS
pantallas leen Supabase vía RLS. Una sola UI, dos fuentes.

---

## 3 · EN PRODUCCIÓN — inventario funcional completo

### 3.1 Nivel plataforma (Secretaría / Liga)

| Funcionalidad | Ruta | Detalle |
|---|---|---|
| Alta y gestión de clubes | `/plataforma/clubes` | Crear club + acceso del primer admin por link (WhatsApp), editar datos, escudo institucional, eliminar clubes vacíos |
| Observatorio provincial | `/observatorio` | SOLO agregados por club (deportistas activos, mediciones 30 días, % consentimiento, categorías, última jornada, **pases de salida 12 meses**) sobre mapa real de Salta (23 departamentos IGN interactivos). La plataforma jamás ve un nombre |
| Parámetros de crecimiento | `/plataforma/parametros` | Umbral de "crecimiento acelerado" POR SEXO + separación mínima de tramos, editables por pantalla con advertencia de impacto global y auditoría de quién/cuándo. Sin tocar código |
| Bandeja de sugerencias | `/plataforma/sugerencias` | Propuestas del staff de los clubes sobre las guías del catálogo: aceptar / no incorporar, con respuesta al autor. La plataforma cura; el estándar sigue siendo único |

### 3.2 Nivel club — gestión institucional (admin)

| Funcionalidad | Ruta | Detalle |
|---|---|---|
| Hub del club | `/club` | Conteos y accesos a toda la gestión |
| Categorías | `/club/categorias` | Alta/edición/borrado (solo vacías); "generar estructura estándar" crea las cohortes por año de nacimiento de un tap |
| Staff | `/club/staff` | Invitación POR LINK (sin depender de email), rol de acceso (admin / entrenador / comisión) + función profesional descriptiva (DT, PF, nutricionista, psicóloga deportiva, asistente social…), asignación de categorías por profe, badge "todavía no entró" |
| Agenda institucional | `/club/agenda` | Lugares de entrenamiento + cronograma semanal recurrente por categoría |

### 3.3 Plantel

| Funcionalidad | Ruta | Detalle |
|---|---|---|
| Alta individual | `/deportistas/nuevo` | Deportista + tutor + consentimiento en un solo paso; sugerencia de categoría por cohorte |
| Importación masiva | `/deportistas/importar` | Pegar celdas desde Excel/Sheets o subir CSV; mapeo de columnas autodetectado y corregible, categoría por nombre o cohorte, duplicados excluidos, preview antes de confirmar. El consentimiento NUNCA se importa: queda pendiente y visible |
| Lista / tabla | `/deportistas` | Búsqueda, filtro por categoría, vista lista o tabla ordenable por cualquier atributo (mejor del grupo en negrita) |
| Filtros de seguimiento | `/deportistas?filtro=` | 4 chips combinables con contador: **En estirón** · **Mejorando en 3+ habilidades** (contra sí mismo) · **Sin medir 3+ semanas** · **Consentimiento pendiente**. Deep-linkeables |
| Ciclo de vida | `/deportistas/[id]/editar` | Corregir datos, mover de categoría (queda como hito de promoción), desactivar (conserva historial) o borrado definitivo con cascada (solo admin), con doble confirmación |
| **Trayectoria institucional** | ficha → tab Ficha | Timeline de hitos: ingreso al club (en alta e import), promociones automáticas al mover de categoría, debut en Primera, hitos manuales. Métricas: "En el club: X años" y **"De escuelita a Primera: X años"** — el dato que nadie tiene a nivel formativo. Los hitos también se dibujan sobre la curva de evolución y en el informe |
| **Baja por pase a otro club** | `/deportistas/[id]/editar` | Registra la salida (club destino en texto) y desactiva. **Los datos del menor NO viajan al otro club** — queda en su trayectoria; la plataforma solo ve el total agregado |

### 3.4 Medición y evolución (el corazón)

| Funcionalidad | Ruta | Detalle |
|---|---|---|
| Jornada de medición | `/medicion` | Carga de un atributo para toda una categoría de corrido, pensada para el celular en el predio. Upsert por deportista/atributo/día (corregir no duplica), decimales con coma, hint de "ya cargado hoy" |
| Borrador offline | `/medicion` | Cada tecla se guarda en el teléfono; el predio sin señal no pierde la jornada. Banner de sin-conexión, restauración al volver, se limpia al guardar |
| Catálogo híbrido | (global) | 5 mediciones objetivas con protocolo (talla, peso, velocidad 30m, salto vertical, resistencia) + 9 apreciaciones técnicas 1-10 estilo juego (pases, control, visión de juego, atajando…). La UI las distingue SIEMPRE |
| Ficha del deportista | `/deportistas/[id]` | Tabs Habilidades (mapa del jugador con último valor y tendencia) · Evolución · Ficha (datos mínimos) · Sesiones |
| Curva de evolución | ficha → Evolución | Recharts, hitos de trayectoria (ingreso, cambio de categoría) como líneas verticales, historial tabular de cada medición con quién la tomó |
| Tendencia honesta | en toda la app | "Creciendo / amesetado / en baja" comparando las últimas 3 mediciones, interpretada por `sentido` del atributo (en velocidad, bajar es mejorar; talla/peso se registran sin juzgar) |
| **El estirón (Módulo D)** | ficha → Talla | Velocidad de crecimiento (cm/año) por tramos ≥90 días; zona de "crecimiento acelerado (registro observado)" sombreada en la curva, umbral por sexo configurable por la plataforma; nota educativa con derivación al profesional (nunca prescripción) |
| **Madurez estimada (Moore et al. 2015)** | ficha → Talla | Años hasta/desde el pico de crecimiento estimados con edad+talla, por sexo, margen ±7 meses SIEMPRE visible, explicación llana y link al paper (DOI). Solo aparece si el modelo aplica (sexo, nacimiento, ≥2 tallas, edad en rango de calibración). Único en el segmento formativo |
| **Guías "¿Cómo medir?" (Módulo B)** | drawer en `/medicion` y `/entrenamiento` | Por atributo: protocolo paso a paso, materiales, diagrama SVG de conos (objetivas); guía de puntuación 1-10 y "en qué fijarse" (subjetivas); "ideas de trabajo" con rótulo "no es una prescripción". Contenido base bajo flag "pendiente de revisión del PF" |
| Sugerencias sobre guías | drawer → "Sugerir un cambio" | El staff propone agregar/modificar/sacar contenido; ve el estado de sus pedidos (pendiente/aceptada/no incorporada) y la respuesta de la plataforma; puede retirar pendientes |

### 3.5 Agenda deportiva

| Funcionalidad | Ruta | Detalle |
|---|---|---|
| Semana + cronograma | `/sesiones` | La semana se genera sola del cronograma (sesiones "virtuales" que recién se materializan al usarlas) |
| Pasar lista | `/sesiones/[id]` | Asistencia por excepción (solo se guardan las faltas — eficiencia y minimización), cancelación con motivo |
| Partidos | `/partidos/nuevo`, `/partidos/[id]` | Citación (arranca con todo el plantel), resultado post-partido. SOLO datos grupales; en escuelitas no hay marcador: "encuentro formativo" (regla formativa) |
| Tablero de entrenamiento | `/entrenamiento` | Asignación de cada jugador a una estación/área de trabajo, colgada de la sesión del día de la agenda (no un mundo aparte); precarga lo guardado, guarda por lote |

### 3.6 Informes y comunicación con las familias

| Funcionalidad | Ruta | Detalle |
|---|---|---|
| Informe imprimible | `/deportistas/[id]/informe` | Evolución completa del deportista con membrete y escudo del club |
| Informe por WhatsApp | ficha e informe | Resumen como TEXTO al chat del tutor (si hay teléfono, directo), con framing honesto y aviso "datos de un menor, no reenviar". Sin link a la app: el tutor no tiene login por diseño |
| Consentimiento imprimible | `/deportistas/[id]/consentimiento` | Formulario pre-completado (club, deportista, tutor) con líneas de firma para el papel |
| Política de privacidad | `/privacidad` | Pública, Ley 25.326, fuera del shell de la app |

### 3.7 Panel, onboarding y adopción (el riesgo #1 es que no midan)

| Funcionalidad | Detalle |
|---|---|
| Panel por rol | Saludo real, destacados calculados de las series, próximos eventos |
| Alertas "Para estar encima" | Categorías sin medir hace 3+ semanas o sin mediciones, deportistas sin primera medición — copy de AUSENCIA de registro, nunca de rendimiento |
| "Primeros pasos" | Card por rol calculada del estado REAL del club: se tilda sola y desaparece al completarse. Sin tours ni overlays |
| Estados vacíos con salida | Toda pantalla vacía explica qué va ahí y ofrece el CTA que el rol puede resolver (o dice quién sí puede) |
| Ayuda contextual | Desplegables cerrados de máx. 3 bullets solo en pantallas densas |
| Landing pública | Curva héroe animada, pelota pateable con física, copy en voseo de club; demo completa sin registrarse |
| Selector de perfil demo | El visitante anónimo puede mirar la app como profe/admin/comisión/plataforma sin crear cuenta |

### 3.8 Seguridad, acceso y datos (arquitectura del moat ético)

| Pieza | Detalle |
|---|---|
| Matriz de perfiles (`docs/PERFILES.md`) | **admin_club**: config institucional + todo el club · **entrenador**: SOLO sus categorías asignadas · **comisión directiva**: consulta pura, sin escritura · **plataforma**: solo agregados, jamás fichas |
| RLS integral | 19 tablas, 42 políticas, escritas en la misma migración que crea cada tabla; funciones `es_miembro_de` / `es_admin_de` / `alcanza_categoria` / `opera_categoria` (security definer, search_path fijado) |
| Auth solo staff | Deportistas y tutores NO tienen usuario (decisión estructural); invitación de staff por link, sin dependencia de SMTP |
| Auditoría | `registrado_por` en mediciones, `actualizado_por/en` en parámetros, `resuelto_en` en sugerencias |
| Denormalizaciones deliberadas | `club_id` por trigger en las tablas calientes para que las políticas no requieran joins |
| Backups | `pg_dump` → Google Drive de la Fundación (offsite automático); runbook de restore documentado (`docs/BACKUPS.md`); regla: no cargar menores reales sin backup activo (cumplida) |
| Serie temporal pura | Los atributos NUNCA son columnas del deportista: una fila por medición con fecha, una medición por deportista/atributo/día (corregir actualiza, no duplica) |

### 3.9 La vitrina (demo comercial con datos ficticios)

El club "Fundación Evolución Antoniana" en producción es una **demo
rica 100% ficticia** (no hay menores reales): ~305 jugadores en 15
categorías (Escuelita 2019→2014, 9ª→3ª, Reserva, Primera), ~16.000
mediciones con un año de historia biológicamente coherente (arcos de
estirón reales en el 15% del plantel, ruido de tallímetro realista),
13 profesionales multi-rol, 45 sesiones con asistencia, tablero
armado y 17 partidos. Reseed reproducible por scripts idempotentes.
**Muestra el alcance completo de la solución en 5 minutos de demo.**
Los clubes reales entran limpios por `/plataforma/clubes`.

---

## 4 · ROADMAP comprometido (decidido, no construido)

Orden sugerido; ninguno bloquea el piloto.

| # | Ítem | Qué es | Esfuerzo | Cuándo |
|---|---|---|---|---|
| 1 | **Revisión del PF** | Cuello de botella HUMANO, no de código: validar contenido de guías (Módulo B), umbrales y nota del estirón, y presentación de Moore et al. Al recibirla se reemplaza texto y se apagan los flags "pendiente de revisión" | Horas (código) | YA — es el pendiente vivo |
| 2 | **Piloto con club real** | Secuencia completa ya operativa por pantalla (`docs/OPERACION.md`): la plataforma crea el club → admin arma categorías e invita staff → importan plantel → primera jornada | 0 código | Decisión comercial |
| 3 | Higiene pre-menores-reales | Rotar cuentas demo (`TalentoDemo26`) y clave de DB (diferido a propósito: la vitrina es ficticia) | Horas | Antes del primer menor real |
| 4 | Email transaccional (Resend) | Invitaciones de staff también por mail + notificación a la plataforma cuando entra una sugerencia | 1 sesión | Con el piloto andando |
| 5 | Firma electrónica del consentimiento | Link al tutor, firma en pantalla, huella de auditoría (la foto del papel se DESCARTÓ por decisión) | 2-3 sesiones | Cuando haya varios clubes |
| 6 | Supabase Pro + PITR | Backups point-in-time pagos | Config | Con volumen real de menores |
| 7 | UI de reactivación | Hoy un deportista desactivado se recupera solo por service role | Horas | Cuando el piloto lo pida |
| 8 | Editar función del staff | Hoy la función profesional se setea al invitar | Horas | Menor |

## 5 · Olas 2 y 3 — diseñadas (SQL de diseño en `docs/`, explícitamente fuera del MVP)

| Ola | Contenido diseñado | Nota de diseño ya tomada |
|---|---|---|
| **Ola 2 — Economía formativa** | `inversion_formativa` + `movimiento_financiero`: lo que el club invierte en formación, agregado por disciplina/categoría, serie temporal. Argumento institucional: visibilizar cuánto cuesta formar | La valorización monetaria POR DEPORTISTA fue eliminada en la revisión pre-código (riesgo legal/ético inaceptable con menores). Es a nivel CLUB o no es |
| **Ola 2 — Gamificación** | `logro` + `deportista_logro`: logros por constancia y participación | Por asistencia/constancia, no por rendimiento comparado |
| **Ola 3 — Táctica** | `tactica` + `tactica_posicion`: formaciones y posiciones por partido | Roadmap lejano; recién tiene sentido con clubes que ya midan sostenidamente |

## 6 · Evoluciones posibles (el espacio de crecimiento del producto)

Ideas evaluadas o naturales del diseño actual. Ninguna comprometida;
ordenadas por afinidad. Las que la propia app ya muestra como "En el
radar" están marcadas (★).

**Del dato al valor provincial**
- ★ **Percentiles provinciales por cohorte**: cuando el observatorio
  tenga volumen multi-club, referencias de talla/velocidad/salto por
  edad PROPIAS de Salta (hoy no existen). Requiere salvaguardas: solo
  agregados, mínimos de N por celda, nunca ranking individual.
- ★ **Más disciplinas** (vóley, básquet, hockey): el catálogo global
  ya modela disciplina; es sembrar atributos + guías nuevas, no
  re-arquitectura.
- ★ **Complemento federativo** (Liga / COMET): interoperar con el
  registro federativo para no duplicar carga administrativa.
- **Panel de adopción para la Secretaría**: cobertura territorial,
  clubes activos/inactivos, tendencia de medición — el argumento de
  renovación del contrato institucional.

**Del club al día a día**
- ★ **Exportación CSV de todos los datos del club** (el dato es del
  club, no nuestro — refuerza confianza).
- ★ **Informe mensual por categoría (PDF)** para comisión directiva.
- ★ **Modo sin señal completo** (PWA/offline-sync; hoy existe el
  borrador local de la jornada, que cubre el 80% del dolor).
- **Recordatorios de jornada** (notificación/WhatsApp al profe cuando
  su categoría cumple X semanas sin medir — las alertas ya existen en
  el panel; esto es empujarlas).
- **Multi-disciplina por deportista** (el pibe que juega fútbol y
  básquet) — el modelo lo permite; la UI no lo expone aún.

**De la ciencia aplicada (siempre con aval profesional)**
- **Módulo educativo del PF**: la plataforma como canal de la línea
  metodológica oficial (videos, clínicas, actualizaciones de guías) —
  convierte el moat de curaduría en programa institucional.
- **Alertas de carga en estirón**: hoy la nota educativa es fija;
  podría señalarse también al armar el tablero de entrenamiento
  (nunca prescripción, siempre derivación al humano).
- ★ **Sugerencias de foco de entrenamiento** (en el radar de la app):
  SOLO como contenido curado por el PF por atributo — la versión
  automática por status está en el anti-roadmap.

**De la plataforma**
- **Transferencia completa entre clubes de la plataforma**: hoy el
  pase es registro sin datos (v1 honesta); la mudanza del legajo con
  consentimiento del tutor y aceptación de ambos clubes queda para la
  fase de firma electrónica. La matriz de flujos origen→destino para
  la Liga llega cuando los destinos estén normalizados.
- **Roles nuevos** (p. ej. kinesiólogo con vista específica): la
  matriz de perfiles lo soporta; requiere decidir QUÉ ve (cuidado:
  datos de salud de menores = dato sensible, hoy prohibido).
- **API pública / interoperabilidad** para federaciones u organismos
  (solo agregados, mismo principio que el observatorio).
- **IA asistiva**: redacción de informes para familias con framing
  controlado y revisión humana. NUNCA: predicción de talento,
  prescripción de cargas, proyecciones individuales.

## 7 · ANTI-ROADMAP — lo que decidimos NO hacer (y es parte de la propuesta)

Cada "no" está documentado en la serie `negocio/` y es un argumento de
venta institucional: este producto se puede auditar.

| NO construimos | Por qué |
|---|---|
| Valorización monetaria por deportista | Ponerle precio a un menor en una base institucional: riesgo legal, ético y reputacional inaceptable |
| Rankings contra la media / scouting interno | A edad formativa mide maduración, no talento; descarta tarde-maduradores. Todo es "cada chico contra sí mismo" |
| Proyección de talla adulta (Khamis-Roche) y Mirwald | Requieren datos que no pedimos (talla de padres, talla sentado) y proyectarle la altura a un pibe de 11 años es combustible de scouting |
| Prescripción automática de ejercicios ("tu velocidad está amesetada → hacé esto") | Promesa causal prohibida + prescribir a menores es trabajo del profesional, no de un texto generado |
| Psicometría / fichas psicológicas-cognitivas individuales | Dato sensible de un menor (Ley 25.326), riesgo de etiquetado. La formación integral se honra con el equipo profesional (staff multi-rol), no con fichas del chico |
| Marcador en partidos de escuelitas | Regla formativa: son encuentros, no tabla de posiciones |
| Login para deportistas/tutores (en esta etapa) | Minimización: menos cuentas de menores = menos superficie de riesgo. El tutor recibe el informe por WhatsApp |
| Foto del consentimiento firmado | Evaluada y descartada (bajo valor, fricción); la versión buena es la firma electrónica del roadmap |
| Recomendaciones de carga/fatiga calculadas | Territorio médico/kinesiológico: la app informa y deriva al profesional |

## 8 · Estado operativo (números al 2026-07-17)

- **Código**: ~0 mocks de producto (la demo anónima es intencional);
  build y lint limpios; e2e por browser de los circuitos críticos.
- **Base**: 20 tablas, 44 políticas RLS, funciones de acceso
  security definer, 8 migraciones versionadas.
- **Vitrina en prod**: 1 club demo · ~305 deportistas · ~17.000
  mediciones · 614 hitos de trayectoria (3 debuts en Primera, 3 pases)
  · 45 sesiones · 18 partidos · 13 staff multi-rol.
- **Legal**: política de privacidad pública, consentimiento
  imprimible, minimización aplicada, backups offsite activos.
- **Pendiente humano** (no técnico): revisión del PF + primer club
  real.

## 9 · Apéndice — mapa completo de rutas

| Ruta | Perfil | Qué hace |
|---|---|---|
| `/` | público | Landing + demo |
| `/login`, `/auth/confirmar`, `/cuenta/clave` | — | Acceso e invitaciones por link |
| `/panel` | todos | Panel por rol, alertas, primeros pasos |
| `/deportistas` (+filtros), `/nuevo`, `/importar` | club | Plantel |
| `/deportistas/[id]` (+`/editar`, `/informe`, `/consentimiento`) | club | Ficha, evolución, estirón, madurez, informes |
| `/medicion` | opera | Jornada de medición (+borrador offline, guías) |
| `/entrenamiento` | opera | Tablero por estaciones (+ideas de trabajo) |
| `/sesiones`, `/sesiones/[id]` | club | Agenda semanal, asistencia |
| `/partidos/nuevo`, `/partidos/[id]` | club | Citaciones y resultados |
| `/club`, `/club/categorias`, `/club/staff`, `/club/agenda` | admin | Gestión institucional |
| `/observatorio` | plataforma (+demo) | Agregados provinciales sobre mapa |
| `/plataforma/clubes`, `/parametros`, `/sugerencias` | plataforma | Alta de clubes, parámetros globales, curaduría |
| `/privacidad` | público | Ley 25.326 |
