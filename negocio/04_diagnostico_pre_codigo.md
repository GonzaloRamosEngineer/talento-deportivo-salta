Ready for review
Select text to add comments on the plan
Diagnóstico crítico — Talento Deportivo Salta (pre-código)
Contexto
Revisión crítica solicitada antes de escribir código: evaluar propuesta de producto, modelo de datos (docs/01-03 SQL), y decisiones pendientes. Rol: CTO escéptico. Material revisado: CONTEXT.md, CLAUDE.md, README.md, docs/01_ola1_mvp.sql, docs/02_ola2_finanzas_gamificacion.sql, docs/03_ola3_tactica.sql.

1. Puntos débiles y supuestos no validados (producto)
1.1 El supuesto fundacional no está validado: que los clubes VAN A MEDIR
Todo el valor del producto depende de que entrenadores de clubes amateurs (voluntarios, semi-rentados, sin tiempo ni instrumental) carguen mediciones consistentes y sostenidas durante meses. Este es el riesgo #1 y no es técnico. El gráfico de evolución —la funcionalidad estrella— está vacío los primeros 2-3 meses (problema de arranque en frío) y muere si la carga decae.

Recomendación: diseñar el MVP alrededor de la CAPTURA, no del gráfico. Pantalla de "jornada de medición" (cargar un atributo para toda una categoría de corrido, en el celular, en la cancha). Métrica de éxito del piloto: mediciones/deportista/mes, no features entregadas.
1.2 "Estandarizadas" se declara pero no está diseñado
El esquema hace los atributos configurables POR CLUB (atributo → disciplina → club). Dos clubes definirán "Velocidad" distinto (uno escala 0-10 a ojo, otro segundos en 30m). El observatorio provincial —la visión que justifica el proyecto— colapsa sin catálogo compartido: datos no comparables no se agregan. Hay una tensión estructural entre "configurable por club" y "comparable entre clubes" que hoy nadie resolvió.

Recomendación: catálogo global curado de disciplinas y atributos; los clubes los activan y solo excepcionalmente crean propios (marcados como no-comparables). Decidir AHORA porque cambia las FK.
1.3 Mediciones subjetivas disfrazadas de datos
"Técnica: 7" a ojo de entrenador no es una medición, es una opinión, y la curva de evolución de una opinión mide al entrenador (o al cambio de entrenador), no al chico.

Recomendación: distinguir en el modelo y en la UI atributos objetivos (unidad = segundos/cm/kg) vs subjetivos (escala), mostrar quién evaluó (entrenador_id ya existe, bien), y no derivar "estados" fuertes de series subjetivas.
1.4 El confundidor del crecimiento (la crítica más seria al diferencial)
En chicos de 8-16 años casi toda métrica física mejora con la edad y la maduración, entrene o no. Una curva ascendente cruda no dice nada de talento ni de impacto del entrenamiento; la literatura de detección de talento juvenil gira alrededor de esto (maduración/PHV, efecto de edad relativa). La capa 3 promete "medir el impacto del entrenamiento sobre la evolución": eso es causalmente ingenuo sin controles.

Recomendación MVP: no prometer causalidad; el framing honesto es "registro longitudinal". Registrar altura/peso COMO SERIE TEMPORAL (hoy son columnas estáticas en deportista — ver 2.2, el esquema viola su propia regla #1). Guardar fecha_nacimiento permite a futuro graficar por edad y comparar cohortes.
1.5 Datos de menores: declarado crítico, ausente en el esquema
CONTEXT.md dice que consentimiento de tutores y privacidad son "estructurales desde el día 1". En el SQL no existe tutor, ni consentimiento, ni política de acceso, ni RLS (ver 2.1). Ley 25.326 + datos que rozan salud (peso, aptitud física) de menores.

Recomendación: tabla mínima tutor/consentimiento (quién, cuándo, qué autoriza, revocación) en Ola 1, minimización de datos (bien el doc_interno en vez de DNI), y una política escrita de acceso antes del piloto.
1.6 Valorización de menores (Ola 2): radioactiva — recomiendo cortarla
Aun con el encuadre ético declarado, poner un valor monetario por chico en una base que aspiran a que vea una Secretaría de Deportes es un riesgo legal, ético y reputacional enorme, con valor de producto casi nulo para clubes formadores.

Recomendación: eliminarla del roadmap o reencuadrarla como "inversión formativa del club" (costo agregado por disciplina/categoría, nunca por deportista).
1.7 El moat real no es la tecnología
Una tabla de serie temporal es trivial de copiar; además ya existen plataformas de athlete monitoring longitudinal (Smartabase/Fusion Sport, Kinduct, AthleteMonitoring…) — caras, en inglés, para alto rendimiento. Lo defendible acá es otra cosa: (a) posicionamiento gratuito/localizado para base amateur argentina, (b) distribución institucional (Liga/Secretaría), (c) el dataset longitudinal acumulado — solo si se resuelve 1.2, (d) confianza en el manejo de datos de menores. El diferencial planteado es sólido como posicionamiento, débil como tecnología. Consecuencia práctica: priorizar facilidad de adopción y confianza sobre features.

Riesgo adicional del modelo de negocio: depender de adopción política provincial es frágil (cambia la gestión, muere el canal). Mitigación: que el producto tenga valor standalone para UN club, y exportación de datos de primera clase (el club es dueño).
2. Problemas concretos del modelo de datos (Ola 1)
2.1 No hay RLS ni modelo de usuarios — la regla "no negociable" #3 no está en el esquema
Ni un enable row level security, ni una policy, ni una tabla de membresía usuario↔club↔rol. entrenador.auth_user_id opcional no alcanza: sin modelo de membresía las policies son imposibles de escribir. Es EL bloqueante.

Recomendación: tabla membresia (user_id, club_id, rol) con roles MVP mínimos (admin_club, entrenador), función helper es_miembro_de(club_id) (security definer) y policies escritas EN el mismo script que crea cada tabla.
2.2 altura_cm / peso_kg como columnas estáticas violan la regla #1 del propio proyecto
Talla y peso son LOS atributos serie-temporal por excelencia en menores (y necesarios para contextualizar todo lo demás, ver 1.4).

Recomendación: modelarlos como atributos físicos globales medidos en medicion (o quitarlos de la ficha). Si hace falta "último valor" para la ficha, es una vista.
2.3 Tenancy inconsistente en atributo
disciplina_id NULL = físico global mezcla alcances: un atributo global es visible para TODOS los clubes — ¿quién lo cura? ¿un club puede crear uno global? Además falta unique de nombre por disciplina (duplicados garantizados).

Recomendación: se resuelve con la decisión de catálogo (1.2). Agregar uniques.
2.4 medicion sin club_id complica el RLS
Las policies sobre la tabla más caliente del sistema necesitarían joins (medicion → deportista → club).

Recomendación: denormalizar club_id en medicion (y validar consistencia por trigger o en la app). RLS barato y directo.
2.5 Sin unicidad ni tie-break en mediciones
Dos mediciones del mismo atributo el mismo día son posibles (¿intencional?). El gráfico necesita una regla (¿promedio? ¿última?).

Recomendación: permitirlas pero definir la regla de graficado explícitamente; o unique (deportista_id, atributo_id, fecha) y listo. Decisión chica, tomarla ya.
2.6 Limitaciones aceptables para MVP (documentar, no resolver)
deportista.disciplina_id único: un chico en dos disciplinas requiere duplicar ficha.
categoria_id es snapshot: al pasar de sub-13 a sub-15 se pierde la historia de cohorte. La solución (tabla de inscripción con vigencias) es sobre-diseño hoy.
on delete cascade desde club borra TODO (mediciones incluidas) — aceptable con backups, pero conscientemente.
Falta campo sexo/género: necesario para categorías y para cualquier comparación seria (percentiles, observatorio). Agregarlo (es dato sensible: cubierto por consentimiento).
"Estado derivado (creciendo/amesetado/en baja)" prometido en CONTEXT capa 2 no tiene definición. Con series ralas y ruidosas no es trivial. MVP: regla tonta y explícita (ej. pendiente de las últimas 3 mediciones) calculada en vista o cliente.
2.7 Menores del repo
CLAUDE.md referencia docs/sql/ pero los scripts están en docs/ — corregir.
Olas 2 y 3: mantener como documentos, NO ejecutarlas en la base del MVP.
3. Decisiones pendientes ANTES de codear (con recomendación)
Decisiones ya tomadas con el usuario (2026-07-05): D1 = solo staff, D4 = catálogo global curado, valorización (1.6) = reencuadrar a nivel club.

#	Decisión	Recomendación
D1	Roles y acceso MVP	✅ DECIDIDO: Solo admin_club + entrenador con login. Deportistas/tutores SIN acceso en MVP (evita todo el problema de auth de menores). Tabla membresia + RLS por rol.
D2	Estrategia RLS	Shared-schema multi-tenant por club_id + helper es_miembro_de() + club_id denormalizado en medicion. Policies en el mismo script que el DDL.
D3	Multi-tenancy real del MVP	Un solo club sembrado a mano (Antoniana). CERO flujo de alta de clubes. El modelo ya soporta N clubes; la UI no hace falta.
D4	Catálogo de atributos	Catálogo global curado + activación por club (ver 1.2).
D5	UI kit	Tailwind + shadcn/ui (estándar de facto Next.js, ya lo conocés de otros proyectos).
D6	Librería de gráficos	Recharts para el timeline de evolución: simple, React-first, suficiente. Nivo/visx son sobre-diseño acá.
D7	Mobile / conectividad en cancha	Mobile-first responsive, páginas livianas, borrador local en localStorage para la pantalla de carga (si se corta la señal no se pierde la jornada). NO offline-sync real en MVP: es un proyecto en sí mismo. Revisar tras el piloto.
D8	Consentimiento	Tabla consentimiento mínima + flujo simple (admin marca que tiene el papel firmado, con fecha). Digitalizar la firma NO es MVP.
D9	Migraciones	Supabase CLI con migraciones versionadas (mismas convenciones que sitio-evolucion-antoniana). Nunca config push.
D10	Regla de "estado" de evolución	Pendiente de las últimas N=3 mediciones con umbral; documentada y visible ("basado en tus últimas 3 mediciones").
4. Resumen priorizado
SÍ o SÍ antes de tocar código
Modelo de usuarios/roles/membresía + RLS escrito junto al DDL (2.1, D1, D2) — hoy no existe y es la regla #3 del propio proyecto.
Consentimiento/tutores mínimo + minimización de datos (1.5, D8) — menores.
Correcciones al esquema Ola 1: altura/peso a serie temporal, sexo, uniques, club_id en medicion, regla de tie-break (2.2–2.5).
Decisión de catálogo global vs por-club (1.2, D4) — retrofitear comparabilidad después es doloroso.
Stack UI/gráficos y estrategia mobile (D5–D7) — decisiones chicas, tomarlas y no volver.
Puede esperar (post-MVP o post-piloto)
Algoritmo de tendencia sofisticado (arrancar con regla tonta).
Alta/onboarding de clubes (sembrar a mano).
Multi-disciplina por deportista e historial de categorías (documentar la limitación).
Exportación de datos (pronto, pero no bloquea).
Offline-sync real / PWA.
Sobre-diseñado o a cortar
Valorización de menores (Ola 2): cortar o reencuadrar a nivel club (1.6).
Motor de logros con criterios JSONB (Ola 2): diferir; si hay gamificación en MVP, que sea "ver mi progreso" y nada más.
Táctica (Ola 3): ya está bien diferida; no ejecutar su SQL.
No ejecutar NINGÚN script de Ola 2/3 en la base real.
Verificación (cuando se implemente)
Tests de RLS: usuario de club A no puede leer deportistas/mediciones de club B (probar con dos usuarios reales vía Supabase, no solo con service role).
Carga de una "jornada de medición" completa desde un celular con red 3G simulada.
Gráfico de evolución con 1, 2 y N mediciones (estados vacío/insuficiente/normal).
Add Comment