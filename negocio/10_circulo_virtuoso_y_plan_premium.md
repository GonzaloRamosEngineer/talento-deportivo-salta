# El círculo virtuoso y el "plan premium" — bajado a tierra

*2026-07-14. Un tercero acercó (a) un framing de propuesta de valor
para el entrenador ("círculo virtuoso" diagnóstico→evaluación→
aprendizaje→ejecución) y (b) un plan de 4 módulos "premium". Este doc
es la evaluación honesta de ambos contra las reglas del proyecto
(CLAUDE.md, framing honesto, datos de menores), la versión CORREGIDA
de cada módulo, y el orden de implementación. Continúa la serie de
`08_competencia_eleven_humans.md` y `09_respuesta_informe_externo.md`.*

## Síntesis

El círculo virtuoso es la mejor articulación del valor para el profe
que tenemos hasta ahora — se adopta como narrativa de pitch, con UNA
corrección ética importante (el caso "por qué mi hijo no juega").
De los 4 módulos: **A (tablero real) va primero** — es el único mock
que queda y el usuario ya lo había marcado; **C (foto del
consentimiento) va segundo** pero con bucket PRIVADO, no público como
propone el plan (error grave con firmas de tutores de menores);
**B (protocolos interactivos) va tercero, partido en dos** — la guía
de medición sí, la "prescripción automática de ejercicios por status"
no (reencuadrada a ideas curadas con disclaimer); **D (PHV) va
cuarto y aterrizado** — el plan pide Mirwald, que es IMPOSIBLE con
nuestros datos (requiere talla sentado, que no medimos), y pide
"recomendaciones de carga" que son territorio médico. Hay versión
honesta y valiosa de D; no es la del plan.

## 1 · El círculo virtuoso — adoptado, con una corrección

```
1. DIAGNÓSTICO (medición con protocolo)
        ↓
2. EVALUACIÓN (curva + tendencia "últimas 3")
        ↓
3. APRENDIZAJE (protocolo + ideas de trabajo curadas)
        ↓
4. EJECUCIÓN (tablero de entrenamiento en cancha)
        ↺  re-medir cierra el ciclo
```

Esto ES el producto y se adopta como narrativa (pitch, landing,
onboarding). Los tres dolores que enumera (presión de padres, falta
de método, carga administrativa) son reales y los cubrimos.

**La corrección — el caso "¿por qué mi hijo no juega?":** el plan
propone usar los datos como *respaldo del profe frente al reclamo*.
Cuidado: convertir mediciones de un menor en el argumento para
justificar suplencias es EXACTAMENTE el uso "scouting interno" que
nuestra matriz de acceso existe para prevenir, y en escuelitas
contradice la regla formativa (sin marcador, encuentros formativos).
La versión correcta del mismo valor: el informe le da al profe una
**conversación constructiva** con la familia — mostrar la evolución
del pibe, qué se está trabajando y cómo acompaña la maduración. El
dato invita a la familia al proceso; no la expulsa de la discusión.
Mismo dolor, misma feature (informe + WhatsApp, ya construidos),
framing opuesto. Los copys de la UI y del pitch usan SIEMPRE la
segunda versión.

## 2 · Módulo A — Tablero de entrenamiento real · PRIMERO

Correcto y ya identificado: es el último mock del producto (la
sección "Entrenar"). El esquema propuesto por el plan es razonable
pero le faltan tres decisiones de nuestro modelo:

1. **Integración con la agenda, no paralela a ella.** La sesión ya
   existe (`sesion_entrenamiento`, con `atributo_foco` y sesiones
   virtuales generadas del cronograma). La planificación del tablero
   debe COLGAR de la sesión del día (materializándola si es virtual,
   mismo patrón que pasar lista), no crear un mundo aparte con
   `fecha` propia que después no cruce con asistencia.
2. **RLS con las funciones existentes**: escritura `opera_categoria`,
   lectura `alcanza_categoria` (el plan dice "entrenadores en sus
   categorías" pero no dice cómo — ya tenemos las funciones, se usan
   esas).
3. **`club_id` denormalizado** con trigger, como en `medicion` (regla
   6 de CLAUDE.md), y `unique (sesion_id, deportista_id)` — un pibe,
   una estación por sesión.

Esquema corregido (borrador para la migración — REQUIERE REVISIÓN
MANUAL como todo cambio de esquema):

```sql
create table sesion_asignacion (
  sesion_id     uuid not null references sesion_entrenamiento(id) on delete cascade,
  deportista_id uuid not null references deportista(id) on delete cascade,
  atributo_id   uuid not null references atributo(id) on delete restrict, -- la estación/área
  creado_en     timestamptz not null default now(),
  primary key (sesion_id, deportista_id)
);
-- RLS: lectura vía sesión alcanzada, escritura vía sesión operada
-- (mismo patrón que sesion_asistencia).
```

UI: `/entrenamiento` consume `useAgenda` (sesión del día por
categoría), guarda por lote al confirmar, borra el banner de demo.
El tablero-pincel actual se conserva tal cual — solo cambia dónde
persiste.

## 3 · Módulo C — Foto del consentimiento firmado · SEGUNDO

Valor real (auditoría legal del papel firmado) y esfuerzo bajo. Pero
el plan tiene **un error grave: pide bucket "público/protegido"**.
No existe "público/protegido": público es público. Fotos de firmas
de tutores de menores en un bucket público = incidente de datos
esperando fecha. La versión correcta:

- Bucket `consentimientos` **PRIVADO**. Nada de URLs públicas.
- Columna `consentimiento.archivo_path` (path de storage, NO una URL
  — las URLs se firman al momento de ver, con vencimiento corto).
- Subida desde el alta/ficha (cámara o galería, JPG/PDF, límite de
  tamaño) con policies de Storage por club (path `club_id/...` +
  `es_miembro_de`), o vía server action gateada si las policies de
  Storage se hacen incómodas.
- Visor en la ficha con URL firmada on-demand; descarga solo
  admin_club.
- **Prerrequisito no negociable: backups.** Antes de custodiar
  documentos legales reales, el plan de resguardo (punto pendiente
  del endurecimiento pre-piloto) tiene que estar activo. Este módulo
  absorbe ese pendiente: backups + página de privacidad + texto de
  consentimiento imprimible + este upload forman UNA sesión coherente
  ("la capa legal completa").

## 4 · Módulo B — Protocolos y guía metodológica · TERCERO, partido en dos

**B1 — "¿Cómo medir?" (SÍ, entera):** drawer en la jornada de
medición con diagrama de conos (SVG propio, estilo Cancha clara),
pasos del protocolo, materiales. El contenido para las 5 objetivas
sale del campo `protocolo` que el catálogo ya tiene, expandido. Es
barato, refuerza la comparabilidad provincial (la razón de ser del
observatorio) y ataca el dolor real del profe voluntario sin método.
Respeta la convención de ayuda contextual existente (`components/
ayuda.tsx`): cerrado por defecto, el que lo necesita lo abre.

**B2 — "Ejercicios sugeridos por status" (NO como lo pide el plan):**
tres problemas: (a) **contenido**: prescribir ejercicios por cohorte
de edad es trabajo de un profesional de educación física, no nuestro
— publicar recetas no revisadas a cargo de menores es riesgo puro;
(b) **framing**: "tu velocidad está amesetada → hacé esto y va a
mejorar" es la promesa causal que este proyecto tiene prohibida por
diseño; (c) **alcance**: catálogo de ejercicios × atributo × cohorte
es un producto editorial completo. La versión honesta y alcanzable:
**"Ideas de trabajo"** — 2-3 líneas genéricas por atributo (no por
status, no por cohorte), redactadas y firmadas por un PF real (la
Fundación tiene acceso a profesionales — ese es nuestro moat, no un
texto generado), guardadas como contenido curado del catálogo global
(mismo modelo de curaduría central que `atributo`), SIEMPRE con el
rótulo "ideas para conversar con el cuerpo técnico — no es una
prescripción". La automatización status→ejercicio queda para cuando
haya un curador metodológico institucional (¿la Secretaría? ¿la
Liga?) que firme el contenido. Eso, además, es una razón más para
que el organismo público adopte: la plataforma es el canal de SU
línea metodológica.

## 5 · Módulo D — PHV / "el estirón" · CUARTO, aterrizado

La dirección es correcta (es la joya del roadmap desde `09_...md`) y
el plan la infla hasta romperla:

- **"Algoritmo de Mirwald": IMPOSIBLE con nuestros datos.** Mirwald
  requiere talla sentado (sitting height), que no medimos ni vamos a
  medir en el MVP. Alternativa real: el método de **Moore et al.
  (2015)** estima el maturity offset con edad + talla solamente —
  compatible con nuestro catálogo actual. Aun así es una ESTIMACIÓN
  con margen de error conocido; se muestra como tal.
- **"Potencial de talla final estimada": NO.** (Khamis-Roche requiere
  talla de los padres — más datos familiares que hoy no pedimos y
  que van contra la minimización). Y "proyectarle la altura adulta"
  a un pibe de 11 años en la pantalla del club es combustible para
  el uso scouting que evitamos.
- **"Recomendaciones de fatiga y cargas": NO como recomendación.**
  Eso es territorio médico/kinesiológico. Versión honesta: una NOTA
  educativa fija cuando la velocidad de crecimiento se acelera — "en
  etapas de crecimiento acelerado suele aconsejarse moderar cargas e
  impactos; hablalo con el profesional del club" — información
  general con derivación al humano, jamás una prescripción calculada.

**D aterrizado (lo que sí construimos):**
1. **Velocidad de crecimiento** (cm/año entre mediciones de talla) —
   pura aritmética sobre la serie que ya existe, cero cambio de
   esquema.
2. **Marcador en la curva de talla** cuando la velocidad supera el
   umbral de aceleración: "zona de crecimiento acelerado (registro
   observado)".
3. La **nota educativa** con derivación al profesional.
4. (Opcional, si el PF de la Fundación lo avala) estimación Moore et
   al. del maturity offset, mostrada con su margen de error y
   solo con N mediciones mínimas de talla.

Esto sigue siendo único en el mercado de base (el argumento del plan
es correcto: ninguna planilla lo hace, y en élite cuesta fortunas) —
sin convertirnos en dispositivo médico trucho.

## Orden de implementación y por qué

| # | Sesión | Contenido | Por qué en este orden |
|---|---|---|---|
| 1 | **Tablero real** (Módulo A) | `sesion_asignacion` + wiring de /entrenamiento sobre la agenda | Último mock visible; el usuario ya lo marcó; cierra "EJECUCIÓN" del círculo |
| 2 | **Capa legal completa** (Módulo C + endurecimiento) | Backups + bucket privado + upload/visor de consentimiento + página de privacidad + texto imprimible + rotar accesos demo + revisión v6 | Prerrequisito del piloto; C sin backups es irresponsable |
| 3 | **Saber medir** (B1 + ideas de trabajo) | Drawer "¿Cómo medir?" con diagramas + contenido curado "ideas de trabajo" con disclaimer | Cierra "APRENDIZAJE"; contenido necesita al PF de la Fundación (pedírselo YA, es el cuello de botella) |
| 4 | **El estirón** (D aterrizado) | Velocidad de crecimiento + marcador + nota educativa (+ Moore et al. si el PF avala) | El diferencial científico, construido sobre series que el piloto ya habrá engordado |

Nota de secuencia: el piloto NO espera a los 4 módulos. Con la sesión
1 y 2 hechas, el piloto arranca; 3 y 4 llegan con el piloto andando
(y mejor: informados por él).

## Qué le pedimos al mundo real (no es código)

- **Al PF de la Fundación**: redactar/firmar los protocolos expandidos
  y las "ideas de trabajo" por atributo (sesión 3) y avalar (o no) la
  estimación de maturity offset (sesión 4).
- **Al usuario**: la revisión v6 pendiente (entra en la sesión 2) y
  la decisión de plan pago de Supabase para backups PITR.
