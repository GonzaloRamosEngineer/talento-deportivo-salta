# FODA y estrategia — devolución honesta

*Análisis crítico solicitado por el referente del proyecto (2026-07-09),
con instrucción explícita de no dejarse influenciar por el planteo propio.
Complementa el `04_diagnostico_pre_codigo.md` y el documento madre.*

## Síntesis (leer esto si no se lee nada más)

El proyecto está inusualmente bien parado en **distribución** y en
**honestidad intelectual**, y sigue completamente invalidado en lo único
que lo puede matar: **que un profe voluntario siga cargando datos en la
semana seis**. Nada de lo construido hasta hoy prueba eso. Todo lo demás
se ordena detrás de esa frase.

---

## Fortalezas

1. **Founder-market fit real, que es raro.** Ex dirigente de un club
   grande + ingeniero + gestor CONMEBOL + brazo técnico (DMG) + brazo
   institucional (Fundación con alianzas). La mayoría del sports-tech
   tiene el software y le falta la cancha; acá está la cancha. Eso
   resuelve distribución y confianza — justo lo que no se puede comprar.
2. **Espacio genuinamente vacío.** COMET gestiona federación, no
   desarrollo de base. El club formador salteño tiene *nada* (el Excel
   de 2021 es el estado del arte). Competir contra "nada" es la mejor
   posición posible de producto.
3. **El framing honesto es un activo.** Registro longitudinal sin
   promesa causal, menores protegidos desde el esquema, observatorio
   solo con agregados. Frente a un funcionario, eso diferencia de
   cualquier vendedor de humo.
4. **Costo de construcción bajo** con stack que DMG domina.

## Debilidades

1. **Cero validación del supuesto fundacional.** El prototipo es
   demo-ware hasta que un club real lo use un trimestre. Ninguna
   feature más lo cambia; solo la cancha lo cambia.
2. **Bus factor = 1.** El referente es el dominio, el canal, la visión
   y el sponsor interno. No se resuelve con código: se resuelve con un
   coordinador deportivo co-dueño del piloto.
3. **El sesgo ManagerZone es la tentación permanente.** Riesgo de
   construir *un juego de gestión* en vez de *una herramienta de
   laburo*. Filtro para cada feature: ¿quién carga este dato, cuándo,
   y qué decisión mejora?
4. **Las notas 1-10 miden también al que evalúa.** Sin rúbricas, la
   mitad técnica de la "línea de vida" no es comparable — es opinión
   con fecha. Mitigable, hoy no resuelto.
5. **Sostenibilidad sin modelo.** "Gratis, subsidiado por adopción
   institucional" = DMG financia hasta que el Estado quiera. Falta un
   piso de sostenibilidad explícito (ver `06_costos_y_financiamiento.md`).
6. **El gap prototipo→producción está subestimado**: auth real, RLS
   probado, consentimientos operativos, soporte a profes que nunca
   usaron un sistema.

## Oportunidades

1. **Caso testigo replicable**: el modelo "infraestructura pública de
   datos del deporte de base" no existe en ninguna provincia argentina.
   El primero que llega con evidencia define el estándar.
2. **El dataset como activo con efecto de red**: series longitudinales
   + estandarización = estudios de maduración, efecto de edad relativa,
   equidad territorial. Convenios con universidades (la Fundación ya
   tiene puerta con la UBA) = legitimidad académica.
3. **Fútbol femenino formativo**: crece, nadie lo mide, el modelo ya lo
   soporta sin esfuerzo extra.
4. **Financiamiento por impacto**: Google for Nonprofits, RSE,
   programas deportivos nacionales — rutas que no dependen del humor
   político provincial.
5. **La Liga como canal federativo**: "complemento de COMET, no
   competencia" — esa frase abre puertas.

## Amenazas

1. **El statu quo es el competidor real**: WhatsApp, el cuaderno y
   "siempre lo hicimos así". Se le gana con fricción cero, no con
   features.
2. **Un incidente de datos de menores** — propio o ajeno del sector —
   quema la categoría entera. El flanco débil no es la base de datos:
   es el papel del consentimiento mal llevado.
3. **Ecosistema chico, memoria larga**: si el primer piloto fracasa,
   "eso ya se probó y no anduvo" viaja por toda la Liga. Mejor un
   piloto chico e impecable que uno ambicioso y mediocre.
4. **Cambio de gestión política**: se mitiga con valor standalone por
   club y export de datos.

---

## Propuesta de valor (una por actor — producto multi-lado)

- **Profe**: *"lo que sabés de cada chico deja de perderse cuando te
  vas"* — y heredás lo que sabía el anterior. Planificás con datos.
- **Club / comisión directiva**: el mapa completo del semillero y
  evidencia para justificar la inversión en inferiores.
- **Secretaría / Liga**: observatorio del deporte formativo con datos
  reales y cero exposición de menores.
- **El chico y su familia (futuro)**: su historia deportiva existe,
  registrada, más allá de qué profe le tocó.

**El corazón de todas: memoria institucional del desarrollo deportivo.**
Hoy esa memoria muere con cada recambio de cuerpo técnico.

## Diferencial (el de verdad)

La serie temporal NO es el diferencial — es copiable en semanas. Lo
defendible es la combinación: **(a)** español, gratis, diseñado para un
club de barrio con celular y sol de frente; **(b)** distribución
institucional que otros no pueden comprar; **(c)** el dataset que se
acumula — solo si la estandarización se sostiene; **(d)** protección de
menores como principio de diseño. (b), (c) y (d) se defienden
**ejecutando adopción**, no programando.

## Público objetivo

**Usuario ≠ comprador ≠ audiencia.** El *usuario* es el profe/
coordinador de inferiores — para él se diseña. El *comprador* es el
presidente/CD del club — a él se le vende memoria institucional. La
*audiencia* es Secretaría/Liga — a ella se le muestra el observatorio,
**recién cuando haya datos reales**. Beachhead: CJA, una o dos
categorías; después 3–5 clubes de la Liga elegidos por el coordinador
comprometido, no por el tamaño del club. Anti-público por ahora: clubes
profesionales AFA y alto rendimiento.

## Lo que SÍ o SÍ debe tener (y cómo)

1. **Un piloto real antes que cualquier otra feature.** Una categoría,
   dos profes, ocho semanas, un KPI: mediciones por deportista por mes
   (+ % de sesiones con asistencia cargada).
2. **Asistencia como caballo de Troya del hábito**: pasar lista es
   diario y fácil; la medición es quincenal. Si el profe abre la app
   todos los días para la lista, la medición cae sola.
3. **Rúbricas para el 1-10**: una línea por nivel y franja de edad,
   visible al cargar. Convierte opinión en dato defendible. Es una
   tabla, no un desarrollo grande.
4. **Consentimiento operativo**: plantilla en papel + registro en app +
   bloqueo suave + política de datos de UNA página firmada por el club.
5. **Export CSV del club desde el día 1**: anti lock-in, confianza.
6. **Evaluador siempre visible** en las curvas técnicas: un cambio de
   ojo no puede leerse como caída del pibe.
7. **Backups automáticos + un responsable de datos nombrado** en el club.

## Lo que NO hacer todavía (aunque tiente)

Valorización (ni la reencuadrada, hasta post-piloto), gamificación,
táctica, onboarding self-service de clubes, y cualquier feature nueva
que no haya pedido un profe con la app en la mano.
