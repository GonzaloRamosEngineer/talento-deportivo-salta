# CONTEXT.md — Plataforma Provincial de Desarrollo y Seguimiento de Talento Deportivo

## Qué es este proyecto
Plataforma digital para que clubes deportivos formadores (escuelitas, divisiones
inferiores, disciplinas amateurs) registren a sus deportistas y sigan su
EVOLUCIÓN en el tiempo mediante capacidades medibles y estandarizadas
(ej: velocidad, salto, resistencia, técnica), conectando ese desarrollo con
el entrenamiento y, a futuro, con la gestión institucional y financiera del club.

## El diferencial (no perder esto de vista nunca)
No es una ficha estática de jugador. El valor central del producto es la
SERIE HISTÓRICA de mediciones de cada atributo, que permite graficar una
curva de evolución por deportista a lo largo del tiempo. Todo el diseño de
datos gira en torno a esto.

## Impulsores del proyecto
- Fundación Evolución Antoniana (ONG, Salta — deporte, educación, tecnología)
- Digital Match Global (desarrollo, stack Next.js + Supabase + Vercel)
- Referente: ingeniero en sistemas, gestor deportivo CONMEBOL

## Visión a escala (no construir todavía, pero tenerlo presente en el diseño)
Cuando varios clubes de una provincia cargan datos, la información agregada
se convierte en un observatorio provincial de talento deportivo. El modelo
de datos debe poder escalar a multi-club y multi-disciplina sin reescritura.

## Las 5 capas funcionales del sistema completo
1. **Ficha del deportista y atributos**: identidad, datos físicos, y
   capacidades medibles de un catálogo GLOBAL curado (nunca hardcodeadas
   ni definidas club por club). El catálogo distingue mediciones
   OBJETIVAS con protocolo (talla, peso, velocidad 30m, resistencia,
   salto) de apreciaciones SUBJETIVAS 1-10 del entrenador (en fútbol:
   pases, pases largos, remates, cabezazos, control de balón, entradas,
   atajando, balón parado, visión de juego). Las categorías del club
   siguen la estructura real del fútbol formador: escuelitas por año
   de nacimiento (en 2026, los de 7 años son "2019"), divisiones
   inferiores 9ª→3ª, Reserva y Primera; adaptable a otras disciplinas
   por rango de edad.
2. **Evolución y potencial**: serie temporal de mediciones por atributo,
   con estado derivado (creciendo / amesetado / en baja). Esta es la
   capa diferencial del producto.
3. **Entrenamiento**: sesiones con fecha, foco (qué capacidad se trabajó),
   entrenador a cargo y deportistas participantes. Habilita medir el
   impacto del entrenamiento sobre la evolución, y gamificación para
   el deportista (ver su propio progreso).
4. **Preparación de partidos / táctica**: formaciones y posiciones.
   Baja prioridad — roadmap lejano.
5. **Finanzas e inversión formativa**: movimientos por área/disciplina
   e inversión del club en formación, agregada por disciplina/categoría.
   Decisión 2026-07-05: NO existe valorización monetaria por
   deportista — nunca un valor en pesos por chico, por tratarse
   mayormente de menores. Roadmap cercano, no MVP.

## Alcance del MVP actual (lo único que se construye ahora)
SOLO capas 1, 2 y 3. Nada de finanzas, táctica ni gamificación avanzada
todavía. Ver CLAUDE.md para las reglas técnicas no negociables.

## Roles del sistema
Usuarios con login: staff del club — `admin_club` (gestiona),
`entrenador`/profesor (carga y planifica) y `comision_directiva`
(consulta todo su club, solo lectura). Por encima, un super admin de
plataforma ve el observatorio interclubes con DATOS AGREGADOS
únicamente. Deportistas y tutores NO tienen login en esta etapa.

## Consideración crítica: datos de menores
La mayoría de los deportistas registrados son niños/adolescentes.
Privacidad, consentimiento de tutores y control de acceso (RLS en
Supabase) son requisitos estructurales, no opcionales, desde el día 1.

## Modelo de negocio (contexto, no afecta el código todavía)
No se vende licencia por club. El objetivo es infraestructura pública:
uso gratuito/subsidiado para clubes, sostenido por adopción institucional
(Secretaría de Deportes, Liga) a escala provincial. El MVP se valida
primero en un club propio y un piloto de 3-5 clubes antes de escalar.

## Referencias de inspiración de producto (NO son requisitos, son ejemplos)
- ManagerZone: ficha de jugador con atributos en escala 0-10, timeline
  de entrenamiento, tablero de asignación de entrenamiento, valorización
  económica del jugador.
- COMET (Analyticom): sistema líder de gestión federativa de fútbol
  (FIFA/CONMEBOL/AFA). Cubre registro, competiciones, transferencias,
  disciplina. NO cubre desarrollo de talento de base — ahí está
  nuestro espacio.