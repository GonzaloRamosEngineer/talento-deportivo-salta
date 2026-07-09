# DOCUMENTO MADRE DEL PROYECTO
## Plataforma Provincial de Desarrollo y Seguimiento de Talento Deportivo

*(Nombre de trabajo — pendiente de definir)*

**Impulsan:** Fundación Evolución Antoniana · Digital Match Global
**Referente:** (tu nombre) — Ing. en Sistemas · Diplomado en Transformación Digital · Gestor Deportivo CONMEBOL
**Ámbito:** Provincia de Salta, Argentina
**Versión:** 2.0 — Actualizado post-revisión técnica pre-código
**Fecha:** Julio 2026

---

## 0. Nota de versión

Esta versión incorpora los hallazgos de una revisión crítica técnica realizada antes de empezar a construir (ver `04_diagnostico_pre_codigo.md`), que ajustó supuestos del proyecto en tres frentes: el riesgo real del proyecto no es tecnológico sino de adopción; la promesa de "medir evolución" debe separarse con cuidado de cualquier insinuación de causalidad del entrenamiento; y la protección de datos de menores pasó de ser una declaración de principios a un requisito modelado desde el esquema de datos. Estos ajustes están integrados en todo el documento, no aislados en una sección aparte.

## 1. Resumen ejecutivo

Los clubes formadores de Salta —escuelitas de fútbol, divisiones inferiores y disciplinas amateurs— no cuentan hoy con ningún sistema para registrar a sus deportistas ni para seguir su desarrollo. La información vive en cuadernos y en la memoria del entrenador de turno, y se pierde con cada recambio.

Este proyecto propone una plataforma digital que registra a los deportistas de base y lleva un **registro longitudinal** de su evolución a través de capacidades medibles y estandarizadas, conectando ese registro con el entrenamiento, la preparación deportiva y, a futuro, la gestión institucional del club. El diferencial central es la trayectoria en el tiempo del deportista, no una foto aislada de su rendimiento actual.

Es importante ser precisos desde esta primera página: el sistema registra evolución observable, no demuestra que el entrenamiento la produce. En deportistas jóvenes buena parte de la mejora física responde a la maduración natural, no solo al trabajo del entrenador. El valor del proyecto no depende de una promesa de causalidad, sino de dar por primera vez visibilidad y memoria a algo que hoy no se registra en absoluto.

La propuesta no es vender software club por club, sino constituirse gradualmente como infraestructura pública digital del deporte formativo salteño, con la Fundación Evolución Antoniana como brazo de implementación e impacto social y Digital Match Global como brazo de desarrollo tecnológico. Pero esa escala institucional es un horizonte, no el punto de partida: el proyecto arranca y se valida en un único club, con foco total en que el hábito de carga de datos prenda entre los entrenadores.

## 2. Fundamentos y contexto

El proyecto se apoya en una convergencia poco común de capacidades. En lo técnico, Digital Match Global aporta más de catorce años de experiencia en automatización, IA y desarrollo, con stack directamente aplicable (Node, Next, React, PostgreSQL/Supabase, Power BI, nube), experiencia en sector público y privado, y estándares de seguridad ISO 9001 y PCI-DSS. En lo institucional, la Fundación Evolución Antoniana aporta legitimidad y acceso: es una organización sin fines de lucro salteña centrada en deporte, educación y tecnología, con alianzas con el Ministerio de Educación de la Provincia de Salta, Google for Nonprofits, la UBA y Mercado Libre Solidario. En lo deportivo, el referente del proyecto combina formación en ingeniería y transformación digital con la condición de gestor deportivo CONMEBOL.

Esta combinación de capacidad de construcción, credibilidad institucional y conocimiento del negocio deportivo es un activo real. Pero conviene decirlo con honestidad: ese activo resuelve la distribución y la confianza, no resuelve por sí solo el riesgo más importante del proyecto, que se describe en la siguiente sección.

## 3. El problema

Los clubes de base operan sin datos. No existe una ficha estandarizada del deportista, no se registra su evolución, y las decisiones sobre a quién promover o cómo entrenar se toman a ciegas. El conocimiento se pierde con cada cambio de cuerpo técnico y no hay manera de justificar con evidencia la inversión en las inferiores.

Existe una herramienta líder mundial para la gestión federativa del fútbol, COMET, adoptada por FIFA, CONMEBOL y la AFA, entre muchas federaciones, pero diseñada para el nivel de federaciones y ligas: registro, transferencias, competiciones, disciplina, licencias. No modela el desarrollo del talento del deportista de base. Ahí existe un espacio vacío: el club formador, que hoy no tiene absolutamente nada.

## 4. El riesgo más importante del proyecto (léase antes que la solución)

Antes de describir la solución, hay que nombrar con franqueza el riesgo número uno, que no es técnico: **que los clubes no sostengan la carga de datos en el tiempo.** Todo el valor del proyecto depende de que entrenadores con poco tiempo, muchas veces voluntarios, midan de forma consistente durante meses. Si esa carga decae, la funcionalidad estrella —el gráfico de evolución— queda vacía o se corta, y el proyecto pierde su razón de ser antes de poder demostrar nada.

Esto tiene una consecuencia directa de diseño: el producto se construye alrededor de la **facilidad de captura** (una carga rápida, en el celular, en la cancha), no alrededor de la sofisticación del gráfico. Y tiene una consecuencia de gestión del piloto: el indicador de éxito temprano no son las funcionalidades entregadas, sino la cantidad de mediciones por deportista por mes sostenidas en el tiempo.

## 5. La solución y su visión

La plataforma acompaña el ciclo deportivo del club formador con el deportista como hilo conductor, organizada en cinco capas funcionales, de las cuales el MVP construye las primeras tres.

La primera capa es la ficha del deportista y sus atributos: datos de identidad y físicos, y un conjunto de capacidades medibles. A diferencia de un diseño inicial más simple, tanto la altura como el peso se tratan igual que cualquier otra capacidad medible —como mediciones con fecha, no como datos fijos de la ficha— porque también cambian con el tiempo y son relevantes para contextualizar el resto. Las capacidades provienen de un **catálogo curado de forma centralizada**, no definido club por club, precisamente para que "Velocidad" signifique lo mismo en todos los clubes y los datos puedan compararse a futuro. El sistema también distingue explícitamente entre mediciones objetivas (tiempos, centímetros, kilos) y mediciones subjetivas a criterio del entrenador (una escala de percepción técnica), porque tratarlas como equivalentes sería engañoso.

La segunda capa es la evolución del deportista: en lugar de guardar solo el valor actual de una capacidad, el sistema guarda una serie histórica de mediciones con fecha, graficable como curva en el tiempo. Se calcula un estado de tendencia simple y explícito —basado en las últimas tres mediciones, mostrado como tal en la interfaz— evitando cualquier algoritmo opaco o pretencioso. Es central remarcar, y así se comunica dentro del producto, que esta curva refleja una trayectoria observada y no un veredicto sobre el impacto del entrenamiento: en deportistas en edad de crecimiento, la maduración natural explica buena parte de cualquier mejora física, entrene el chico bien, poco, o nada.

La tercera capa es el entrenamiento: cada sesión registra fecha, capacidad trabajada, participantes y entrenador responsable. Esto permite observar qué se trabajó y cuándo, en paralelo a la evolución registrada, sin prometer que se puede aislar el efecto causal de esa sesión sobre el progreso del deportista.

La cuarta y quinta capa —preparación de partidos/táctica, y gestión financiera con valorización del deportista— quedan fuera del MVP y se describen en la sección de roadmap, con una salvedad importante sobre la valorización que se detalla en la sección 10.

## 6. Actores del sistema y modelo de acceso

El sistema define con precisión quién es usuario y quién es solamente un registro de datos, distinción que resultó crítica en la revisión técnica. Son usuarios con acceso al sistema (login) el personal del club: administradores de club y entrenadores. Los deportistas y sus tutores **no tienen usuario ni acceso al sistema en esta etapa**: son datos gestionados por el staff, nunca titulares de una cuenta.

Esta decisión evita por completo el problema de gestionar autenticación de menores, que es delicado tanto en lo legal como en lo técnico. Tiene una consecuencia consciente que vale la pena dejar explícita: la idea original de que el propio deportista viera y "gamificara" su progreso queda pospuesta a una fase posterior, cuando se diseñe un mecanismo de acceso liviano y apropiado (por ejemplo, un enlace de solo lectura para las familias, sin cuenta completa). En el MVP, ese progreso se comparte por fuera del sistema, a criterio del entrenador.

## 7. Protección de datos de menores

Este punto pasó de ser una declaración de principios a un requisito modelado en el sistema desde el primer esquema de base de datos, no agregado después. El sistema registra, para cada deportista, a sus tutores y un consentimiento explícito asociado —quién autoriza, cuándo, y con posibilidad de revocación—, y minimiza los datos personales que se cargan (por ejemplo, evitando el número de documento real cuando alcanza con un identificador interno del club). El acceso a los datos está además restringido por club mediante control de acceso a nivel de fila en la base de datos, de manera que el personal de un club nunca puede ver datos de otro club.

Este nivel de rigurosidad, lejos de ser solo una obligación, se sostiene como un diferencial del proyecto frente a cualquier alternativa: ser la plataforma pensada desde el diseño, y no como parche posterior, para proteger los datos de los chicos.

## 8. Alcance del MVP

El MVP construye únicamente lo necesario para validar el riesgo de adopción y demostrar el diferencial central, deliberadamente acotado: alta de deportistas con su tutor y consentimiento asociado; categorías del club definidas sobre el catálogo curado de disciplinas y atributos (el catálogo en sí se carga a mano, sin una interfaz de administración todavía); carga de mediciones optimizada para uso rápido en el celular durante el entrenamiento, con su gráfico de evolución; y registro de sesiones de entrenamiento con asistencia.

Deliberadamente no se construye en esta etapa: valorización económica del deportista, finanzas del club, gamificación para el deportista, tácticas y preparación de partidos, alta de nuevos clubes (el MVP se siembra a mano para un único club), manejo de un deportista en más de una disciplina, e historial de cambios de categoría. Todas estas quedan documentadas como roadmap, no como pendientes olvidados.

## 9. El diferencial real del proyecto (leído con honestidad)

Conviene distinguir con precisión en qué consiste la ventaja de este proyecto, porque no es donde parece a primera vista. Una tabla de datos que registra mediciones en el tiempo no es, en sí misma, una barrera tecnológica difícil de replicar; de hecho existen plataformas de monitoreo longitudinal de atletas a nivel de alto rendimiento en el mercado internacional, aunque costosas, en inglés y no orientadas a la base amateur.

La ventaja real de este proyecto está en otro lado: en ofrecerse en español y de forma gratuita o subsidiada para el deporte de base argentino; en la distribución institucional a través de la Fundación y eventualmente de la Liga y la Secretaría de Deportes; en el dataset longitudinal que se acumula con el tiempo, siempre que se resuelva el riesgo de adopción descrito en la sección 4; y en la confianza que genera un manejo serio de los datos de menores. El diferencial es sólido como posicionamiento y como confianza; es débil si se lo plantea como innovación tecnológica. La consecuencia práctica es priorizar en todo momento la facilidad de adopción y la confianza del usuario por sobre la acumulación de funcionalidades.

Esto también matiza el modelo de sostenibilidad: depender exclusivamente de que un ente provincial adopte y financie el proyecto es frágil, porque las gestiones cambian y un canal político puede cerrarse. Por eso el producto debe tener valor por sí mismo para un único club, de forma independiente de cualquier decisión institucional, y ofrecer a cada club una exportación de sus propios datos como algo dado por sentado: el club es dueño de su información en todo momento.

## 10. La valorización económica del deportista — tratamiento especial

Este punto, que en versiones anteriores del proyecto se planteaba como una capa de roadmap relativamente directa, requiere un tratamiento más cuidadoso. Poner un valor monetario a un deportista menor de edad, en una base de datos que aspira a que eventualmente vea una Secretaría de Deportes, es un riesgo legal, ético y reputacional considerable, con un beneficio de producto acotado para un club formador.

La decisión adoptada es que, si esta capa se construye en algún momento, cualquier valor monetario individual de un deportista es y permanece una herramienta estrictamente interna del club, nunca expuesta ni agregada hacia la Liga, la Secretaría o cualquier observatorio provincial. Lo que puede compartirse hacia arriba, si acaso, es siempre una agregación a nivel de plantel, categoría o club — nunca un monto asociado a un menor identificado.

## 11. Modelo de gobernanza

El proyecto involucra a una organización sin fines de lucro y a una empresa con fines de lucro sobre una iniciativa de eventual destino público, lo que bien resuelto es una fortaleza y mal resuelto es un riesgo de transparencia. La Fundación Evolución Antoniana lidera la relación institucional, la implementación y la medición de impacto social. Digital Match Global provee el desarrollo y mantenimiento tecnológico bajo contrato transparente y auditable. El referente del proyecto articula ambas partes. Las cajas no se mezclan: cada organización factura y rinde según su naturaleza.

## 12. Plan por fases

La primera fase es el desarrollo del MVP descripto en la sección 8 y su validación en el club propio del referente, con seguimiento activo de la constancia de carga, que es el riesgo central del proyecto. La segunda fase es un piloto acotado con algunos clubes salteños adicionales, obtenido a través de contactos existentes, con el mismo foco en sostener el hábito de medición antes que en sumar funcionalidades. La tercera fase es la presentación a la Secretaría de Deportes con evidencia real de uso y evolución de deportistas. La cuarta fase, más lejana, incorpora la capa federativa de scouting orientada a la Liga, de forma complementaria a COMET.

## 13. Impacto y su medición

Los indicadores de impacto se ajustan al aprendizaje de esta revisión: el indicador temprano más importante es la constancia de carga (mediciones por deportista por mes sostenidas en el tiempo), no la cantidad de funcionalidades entregadas. A partir de ahí se suman la cantidad de deportistas con trayectoria registrada, la cantidad de clubes adheridos y, a escala, la capacidad de la provincia de tomar decisiones deportivas con evidencia.

## 14. Riesgos y mitigaciones

El riesgo principal, ya descripto en la sección 4, es la adopción y constancia de carga por parte de los clubes; se mitiga diseñando el producto alrededor de la facilidad de captura y midiendo el piloto por ese indicador. El segundo riesgo es comunicar el producto con una promesa de causalidad que no puede sostener («el entrenamiento produjo esta mejora»); se mitiga con el framing de registro longitudinal adoptado en todo este documento y en la propia interfaz del producto. El tercer riesgo es el conflicto de roles entre la organización sin fines de lucro y la empresa; se mitiga con la gobernanza transparente de la sección 11. El cuarto riesgo es la protección de datos de menores; se mitiga con el modelo de consentimiento y control de acceso descripto en la sección 7. El quinto riesgo es la dependencia excesiva de tiempos políticos y presupuestarios del sector público; se mitiga sosteniendo que el producto tenga valor independiente para un único club, sin depender de que el Estado lo adopte.

## 15. Posicionamiento frente a COMET

COMET gestiona la competición y el registro federativo a nivel de federaciones y ligas. Esta plataforma gestiona el registro longitudinal de desarrollo del deportista de base, un nivel que COMET no cubre. No es un competidor frontal sino un complemento que ocupa el espacio vacío por debajo del territorio federativo. Frente a la Liga Salteña, dado que la AFA ya opera con COMET, la plataforma se presenta como una capa complementaria de seguimiento de talento de base. Frente a la Secretaría de Deportes, se presenta como infraestructura de desarrollo deportivo y equidad para los clubes que hoy no tienen absolutamente nada.

## 16. Equipo y credenciales

El referente aporta formación en ingeniería en sistemas, un diplomado en transformación digital, la condición de gestor deportivo CONMEBOL y experiencia dirigencial real en un club. Digital Match Global aporta más de catorce años de trayectoria, experiencia en sector público y estándares de calidad y seguridad. La Fundación Evolución Antoniana aporta trayectoria, impacto social medido y alianzas institucionales relevantes en la provincia.

---

## Anexo — bitácora de decisiones técnicas clave

Para trazabilidad, estas son las decisiones de diseño tomadas tras la revisión técnica pre-código, detalladas en `04_diagnostico_pre_codigo.md` y reflejadas en el esquema de `docs/sql/01_ola1_mvp.sql` y en `CLAUDE.md`: acceso exclusivo de personal del club sin login de deportistas ni tutores; catálogo global curado de disciplinas y atributos; altura y peso modelados como mediciones en el tiempo y no como datos fijos; tabla explícita de tutores y consentimiento; una medición por deportista, atributo y día; control de acceso por club a nivel de fila en la base de datos escrito junto con cada tabla; y valorización económica, si se construye, nunca expuesta a nivel individual fuera del club.