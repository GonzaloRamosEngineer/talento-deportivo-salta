# Respuesta al informe externo de viabilidad (2026-07-12)

*Un tercero acercó un "Informe Ejecutivo de Evaluación y Viabilidad
Estratégica" del proyecto. Este doc lo contrasta punto por punto
contra el estado real del código y las decisiones ya tomadas
(CLAUDE.md, docs/PERFILES.md, supabase/migrations/). Mismo criterio
de siempre: sin dejarse impresionar ni ofender.*

## Síntesis

El informe es correcto en lo general pero llega tarde a lo
específico: **sus tres "dudas estratégicas" ya están resueltas en el
código** (RLS multi-tenant verificado, minimización de datos de
menores por diseño, y la de reportes es post-MVP consciente). De sus
recomendaciones de campo, **dos son buenas y las adoptamos**
(asistencia por excepción; evaluación por excepción, que ya era
nuestra filosofía) y **una es un error técnico** (sliders para
mediciones objetivas). De sus "puntos ciegos", el PHV es la joya:
nuestro modelo de datos ya lo permite sin tocar el esquema. El
WhatsApp al tutor es buena idea con trampa legal. El offline-first ya
lo habíamos decidido en su justa medida (borrador local sí,
sync real no).

## Lo que el informe pregunta y ya está resuelto

| Duda del informe | Estado real |
|---|---|
| ¿RLS multi-tenant sin penalizar rendimiento? | **Hecho y verificado e2e.** 16 tablas, 36 policies, aislamiento por club vía `es_miembro_de()` (security definer, search_path fijado), `medicion.club_id` denormalizado por trigger justamente para que la tabla más consultada no haga joins en sus policies. Un anónimo recibe 0 filas; probado contra la base real el 2026-07-12. |
| ¿Encriptación/anonimización de datos sensibles de menores (historiales médicos, psicológicos)? | **Resuelto por una vía superior: NO recolectamos esos datos.** No hay historial médico, ni seguimiento psicológico, ni DNI real (`doc_interno`). La mejor protección de un dato sensible es no tenerlo. Además: profe solo ve sus categorías, plataforma solo agregados, consentimiento estructural. El informe asume un producto que decidimos explícitamente no ser (ver también `08_competencia_eleven_humans.md`: la psicometría en menores es campo minado). |
| ¿Reportes mensuales automatizados para el coordinador? | **No existe y es decisión consciente de alcance**: el MVP valida que el club MIDA (riesgo #1). Automatizar reportes de datos que todavía nadie carga es construir el techo antes que los cimientos. Candidato natural a Ola 1.5/2 (pg_cron o edge function + el informe imprimible que ya existe). |
| Perfiles Escuelitas vs Inferiores | **Hecho**: `categoria.tipo` (escuelita/inferior/reserva/primera) + cohortes por año de nacimiento; en escuelitas ni siquiera se registra marcador. |
| Infraestructura (Vercel, mobile con señal pobre) | Hecho. Next.js estático donde se puede, Vercel edge. |

## Lo que adoptamos del informe

1. **Asistencia por excepción ("todos presentes por defecto, tocás
   las faltas")** — la mejor observación del informe. El esquema ya
   lo insinuaba (`sesion_asistencia.presente default true`); ahora lo
   hacemos regla de UI para la fase de wiring: la pantalla de
   asistencia arranca con todos presentes y el profe solo marca
   ausencias. Segundos, no minutos.
2. **Evaluación por excepción** — coincide con nuestra filosofía (la
   carga diaria individual mata la adopción). Nuestro modelo ya es
   así: las mediciones son por jornada periódica, no por sesión; la
   sesión registra datos grupales (foco, asistencia). Lo reforzamos
   como principio explícito de diseño: **ninguna pantalla del flujo
   de entrenamiento exige datos individuales diarios**.
3. **PHV (pico de velocidad de crecimiento)** — la joya escondida del
   informe. Como talla y peso son series temporales desde el día uno
   (regla #1 del proyecto, la que nos hizo pelear contra las columnas
   en `deportista`), calcular la velocidad de crecimiento
   (cm/año entre mediciones) NO requiere tocar el esquema: es una
   vista o una función sobre `medicion`. Ojo con el framing: se
   presenta como "registro de crecimiento" (tendencia observada),
   NUNCA como alerta médica — no somos dispositivo médico ni
   queremos serlo. Candidato fuerte a Ola 2, y golazo para el pitch
   (los softwares que lo hacen cuestan fortunas, cf. informe).
4. **Reporte al tutor por WhatsApp** — buena idea con trampa. Los
   tutores no tienen login (decisión de MVP) y WhatsApp es el canal
   real de las familias. Versión segura: botón "compartir informe"
   que abre `wa.me` con el PDF del informe imprimible QUE YA EXISTE,
   disparado por el profe/admin (humano decide, humano envía; la
   plataforma nunca contacta menores ni tutores directo). Post-MVP,
   esfuerzo bajo, valor alto para el club.

## Lo que NO adoptamos (y por qué)

- **Sliders para carga en cancha**: error técnico del informe. Una
  Velocidad 30m de 4,96s no se carga con un slider (precisión de
  centésimas); un slider en pantalla táctil al sol es LO más
  impreciso que hay. Nuestro flujo ya elimina el teclado QWERTY
  (inputs numéricos grandes con teclado decimal, targets ≥44px) que
  es lo que el informe realmente quiere decir. Para las técnicas
  1-10 subjetivas sí valen selectores de tap — y la barra de nivel
  ya existe (`components/nivel-bar.tsx`).
- **Offline-first "estrategia"**: ya decidido en su justa medida en
  el diagnóstico pre-código: borrador en localStorage para no perder
  una jornada si se corta la señal, SIN sync offline real en MVP
  (complejidad alta, beneficio marginal con draft local). Se revisa
  con datos del piloto, no antes.
- **Texto libre prohibido**: matizado. En el flujo de carga en
  cancha, de acuerdo (no hay texto libre obligatorio). Pero `nota`
  en medición y `descripcion` en sesión existen y son opcionales:
  prohibir anotar es tan burocrático como obligar a anotar.

## Sobre la pregunta final del informe (¿cuál pilar priorizar?)

Ninguno de los tres. La prioridad absoluta del próximo ciclo ya está
definida y es anterior a los tres pilares: **conectar la app real a
la base real con Auth** (login de staff, deportistas, jornada de
medición, curva). Sin eso, offline/reportes/WhatsApp son features de
un producto que no existe. Orden después del wiring: PHV liviano →
reporte automatizado → compartir por WhatsApp.
