// ============================================================
// Guías "¿Cómo medir?" + "Ideas de trabajo" — Módulo B (negocio/10)
//
// Contenido BASE redactado desde el campo `protocolo` del catálogo
// global, expandido para el profe voluntario sin método. Es contenido
// curado centralmente (mismo modelo que `atributo`): los clubes no lo
// editan. TODO el texto está PENDIENTE DE REVISIÓN del preparador
// físico de la Fundación — al recibir su versión, se reemplaza acá y
// se quita el flag `pendienteRevision`.
//
// Las "ideas de trabajo" respetan la regla de negocio/10: 2-3 líneas
// genéricas por atributo (no por status, no por cohorte), SIEMPRE con
// el rótulo "para conversar con el cuerpo técnico — no es una
// prescripción". Nada de promesas causales (CLAUDE.md).
//
// La clave es el NOMBRE del atributo: es el puente estable entre los
// ids del mock y los UUID reales del catálogo (coinciden por diseño).
// ============================================================

export const GUIA_PENDIENTE_REVISION = true;

export type DiagramaMedicion =
  | "talla"
  | "peso"
  | "velocidad30"
  | "salto"
  | "cooper";

export interface GuiaMedicion {
  /** Solo objetivas: qué hace falta llevar a la cancha */
  materiales?: string[];
  /** Objetivas: protocolo paso a paso. Subjetivas: cómo puntuar. */
  pasos: string[];
  /** Subjetivas: en qué fijarse durante el juego */
  queMirar?: string[];
  /** Un consejo para que la serie sea comparable en el tiempo */
  consejo?: string;
  /** Ideas de trabajo (2-3 líneas). null = atributo no entrenable. */
  ideas: string[] | null;
  /** Talla/peso: recordatorio de framing (se registra, no se juzga) */
  notaRegistro?: string;
  diagrama?: DiagramaMedicion;
}

// Cómo se puntúa una apreciación 1-10: común a todas las subjetivas.
// La escala se ancla contra lo esperable PARA LA CATEGORÍA, nunca
// contra un adulto ni contra otro chico puntual.
const PASOS_SUBJETIVO: string[] = [
  "Observalo en varios entrenamientos y partidos, no en una sola jugada ni un solo día.",
  "Compará contra lo esperable para SU categoría (no contra un adulto ni contra el mejor del club).",
  "Usá la escala completa: 1-3 en desarrollo inicial · 4-6 acorde a la categoría · 7-8 sobresale en su categoría · 9-10 excepcional (muy raro).",
  "Puntuá a toda la categoría el mismo día, con el mismo criterio: la comparación justa es la de cada chico con su propia curva.",
];

const CONSEJO_SUBJETIVO =
  "Es una apreciación del entrenador y así se muestra en la app. Si hoy dudás entre dos números, elegí uno y sostené el criterio: lo que importa es la evolución en el tiempo, no el número de un día.";

export const GUIAS_MEDICION: Record<string, GuiaMedicion> = {
  // ---------- Físicas objetivas (con protocolo) ----------
  Talla: {
    diagrama: "talla",
    materiales: [
      "Pared lisa, sin zócalo",
      "Cinta métrica o tallímetro",
      "Escuadra o libro rígido",
      "Lápiz para marcar",
    ],
    pasos: [
      "Descalzo, de espaldas a la pared: talones, cola y espalda apoyados.",
      "Mirada al frente, mentón paralelo al piso (sin levantar la cabeza).",
      "Apoyá la escuadra o el libro sobre la cabeza, bien horizontal contra la pared, y marcá.",
      "Medí del piso a la marca y registrá en centímetros (ej: 152,5).",
    ],
    consejo:
      "Medí siempre en el mismo momento de la jornada: a la mañana somos hasta 1-2 cm más altos que a la noche.",
    ideas: null,
    notaRegistro:
      "La talla no se entrena: se registra para acompañar el crecimiento. En la curva no hay 'mejor' ni 'peor' — cada chico crece a su ritmo.",
  },

  Peso: {
    diagrama: "peso",
    materiales: [
      "Balanza digital",
      "Piso firme y parejo (no césped ni alfombra)",
    ],
    pasos: [
      "Apoyá la balanza en piso firme y verificá que marque cero.",
      "Con ropa liviana y sin botines, que se suba y se quede quieto, peso repartido en los dos pies.",
      "Registrá en kilos con un decimal (ej: 43,5).",
    ],
    consejo:
      "Usá siempre la misma balanza y el mismo momento de la jornada para que la serie sea comparable.",
    ideas: null,
    notaRegistro:
      "El peso se registra como referencia de crecimiento, no se juzga. Cualquier inquietud sobre el peso de un menor se conversa entre adultos con un profesional de la salud — nunca con el chico delante de la balanza.",
  },

  "Velocidad 30m": {
    diagrama: "velocidad30",
    materiales: [
      "Cinta métrica (30 m exactos)",
      "4 conos (2 en la salida, 2 en la llegada)",
      "Cronómetro (el del celular sirve)",
      "Superficie pareja y seca",
    ],
    pasos: [
      "Medí con cinta 30 m exactos sobre terreno parejo y marcá salida y llegada con dos conos cada una.",
      "Entrada en calor antes de los piques: nunca velocidad 'en frío'.",
      "Partida detenida, un pie adelante, sin trote previo ni salida lanzada.",
      "El que cronometra se para en la LLEGADA, alineado con los conos: arranca el crono con el primer movimiento y lo para cuando el pecho cruza la línea.",
      "Dos intentos con pausa completa entre uno y otro; se registra el MEJOR, en segundos con coma (ej: 4,8).",
    ],
    consejo:
      "Para comparar en el tiempo, repetí siempre las mismas condiciones: misma superficie, mismo calzado, misma cinta. Un pique en tierra seca no se compara con uno en pasto mojado.",
    ideas: [
      "Juegos de persecución, manchas y relevos cortos (10 a 30 m) con pausas completas entre pasadas.",
      "Salidas desde distintas posiciones (sentado, de espaldas, tras un giro) en forma de juego.",
      "Técnica de carrera como juego: skipping, taloneo, zancadas — mejor al inicio de la práctica, con los chicos descansados.",
    ],
  },

  "Salto vertical": {
    diagrama: "salto",
    materiales: [
      "Pared lisa y alta",
      "Tiza (o dedos mojados/con magnesio)",
      "Cinta métrica",
    ],
    pasos: [
      "De costado a la pared, pies planos en el piso: estirá el brazo más cercano y marcá el ALCANCE con la tiza.",
      "Sin pasos previos, saltá con contramovimiento (flexión rápida de piernas y brazos) y marcá lo más alto posible.",
      "Medí la diferencia entre las dos marcas: ese es el salto, en centímetros.",
      "Dos o tres intentos con pausa; se registra el MEJOR.",
    ],
    consejo:
      "Cuidá que no dé pasos ni carrera previa: cambia el resultado y la serie deja de ser comparable.",
    ideas: [
      "Juegos con saltos: soga, alcanzar objetos colgados, saltar a cabecear una pelota sostenida.",
      "Multisaltos suaves y de poco volumen, adecuados a la edad, sobre pasto y con buena pausa.",
      "Salidas y caídas bien apoyadas (aprender a caer) antes que buscar altura.",
    ],
  },

  Resistencia: {
    diagrama: "cooper",
    materiales: [
      "Circuito de perímetro conocido (pista de 400 m o cancha medida con cinta)",
      "Conos cada 25-50 m para contar la distancia",
      "Cronómetro con alarma a los 12 minutos",
      "Planilla o celular para anotar vueltas",
    ],
    pasos: [
      "Medí el perímetro del circuito con cinta y colocá conos a distancias conocidas (ej: cada 50 m).",
      "Test de Cooper: correr 12 minutos continuos. Caminar está permitido — la consigna es no detenerse.",
      "Cada uno cuenta sus vueltas (o un compañero se las cuenta desde afuera).",
      "Al sonar los 12 minutos, cada uno se queda parado donde está.",
      "Distancia = vueltas completas × perímetro + los metros hasta el último cono. Se registra en metros (ej: 2150).",
    ],
    consejo:
      "En escuelitas, plantealo como juego y sin exigir: que caminen si lo necesitan. El dato sirve igual y la experiencia no les arruina el gusto por correr.",
    ideas: [
      "Juegos de carrera continua: manchas en espacios amplios, circuitos con pelota, búsquedas del tesoro por estaciones.",
      "Fútbol en espacios grandes y con pocas pausas — la resistencia en formativas se construye jugando.",
      "Alternar trote y caminata en distancias cortas, sumando de a poco, siempre en forma de juego.",
    ],
  },

  // ---------- Técnicas subjetivas (apreciación 1-10) ----------
  Pases: {
    pasos: PASOS_SUBJETIVO,
    queMirar: [
      "El pase llega al compañero en condiciones de seguir jugando (al pie correcto, con la fuerza justa).",
      "Elige bien cuándo y a quién: no regala la pelota ni fuerza pases imposibles.",
      "Puede dar el pase corto con las dos piernas.",
    ],
    consejo: CONSEJO_SUBJETIVO,
    ideas: [
      "Rondos (loros) con distintos tamaños y cantidad de toques.",
      "Juegos de posesión en espacios reducidos donde el pase corto valga puntos.",
      "Circuitos de pase y movimiento en parejas o tríos, con las dos piernas.",
    ],
  },

  "Pases largos": {
    pasos: PASOS_SUBJETIVO,
    queMirar: [
      "Alcanza la distancia con precisión: el pase largo cae donde puede jugarlo un compañero.",
      "La trayectoria es la adecuada (tensa o con altura según la jugada).",
      "Los centros al área son aprovechables, no solo 'tirados adentro'.",
    ],
    consejo: CONSEJO_SUBJETIVO,
    ideas: [
      "Juegos de precisión a blancos lejanos (aros, zonas pintadas, compañero en movimiento).",
      "Cambios de frente en juegos reducidos con bandas anchas.",
      "Centros al área con definición, rotando quién centra y quién define.",
    ],
  },

  Remates: {
    pasos: PASOS_SUBJETIVO,
    queMirar: [
      "Golpea prolijo (empeine, cuerpo sobre la pelota) y el remate va al arco, no a las nubes.",
      "Define bien las situaciones claras: elige palo, potencia y momento.",
      "Remata aceptablemente con las dos piernas.",
    ],
    consejo: CONSEJO_SUBJETIVO,
    ideas: [
      "Definición tras pared o conducción corta, rotando perfiles y palos.",
      "Juegos de gol rápido en canchas chicas (mucho volumen de remates por chico).",
      "Precisión antes que potencia: blancos en el arco (esquinas, palos) como juego de puntos.",
    ],
  },

  Cabezazos: {
    pasos: PASOS_SUBJETIVO,
    queMirar: [
      "Técnica: golpea con la frente, ojos abiertos, cuello firme.",
      "Gana el tiempo del salto en el juego aéreo (no llega ni antes ni después).",
      "Dirige el cabezazo con intención: despeje, pase o definición según la jugada.",
    ],
    consejo: CONSEJO_SUBJETIVO,
    ideas: [
      "Pelota sostenida o lanzada suave para trabajar el gesto sin miedo (frente, ojos abiertos).",
      "Juegos aéreos en parejas: cabeza-mano, tenis-fútbol con cabezazo permitido.",
      "Centros suaves y definición de cabeza en área chica, siempre con volumen bajo y pelota adecuada a la edad.",
    ],
  },

  "Control de balón": {
    pasos: PASOS_SUBJETIVO,
    queMirar: [
      "El primer toque amortigua y deja la pelota jugable (no la rebota lejos).",
      "Conduce con la cabeza levantada, mirando el juego y no la pelota.",
      "Puede recibir bajo presión, protegiendo la pelota con el cuerpo.",
    ],
    consejo: CONSEJO_SUBJETIVO,
    ideas: [
      "Mucho contacto con la pelota: conducción libre, slalom entre conos, superficies variadas (borde interno, externo, planta).",
      "Rondos y juegos reducidos donde reciba presionado y con poco espacio.",
      "Recepciones orientadas: recibir de un lado y salir jugando hacia el otro.",
    ],
  },

  Entradas: {
    pasos: PASOS_SUBJETIVO,
    queMirar: [
      "Elige bien el momento de ir: no llega tarde ni se tira sin necesidad.",
      "El quite es limpio, con la pelota como objetivo (no comete falta).",
      "Perfil y posición del cuerpo en el 1 contra 1: espera, acompaña, empuja hacia afuera.",
    ],
    consejo: CONSEJO_SUBJETIVO,
    ideas: [
      "Duelos de 1 contra 1 en espacios reducidos, rotando atacante y defensor.",
      "Juegos de sombra y persecución para trabajar el posicionamiento del cuerpo.",
      "Consignas de quite limpio en los juegos reducidos (la falta resta puntos).",
    ],
  },

  Atajando: {
    pasos: PASOS_SUBJETIVO,
    queMirar: [
      "Ubicación bajo los tres palos y achique: acorta el ángulo en el momento justo.",
      "Seguridad de manos: ataja firme, descuelga centros, no da rebotes regalados.",
      "Decisiones: cuándo salir, cuándo quedarse, cómo arranca el juego con las manos o el pie.",
    ],
    consejo: CONSEJO_SUBJETIVO,
    ideas: [
      "Volumen de atajadas variadas: al cuerpo, a media altura, abajo, con desplazamiento previo.",
      "Juegos de achique y 1 contra 1 con delantero real.",
      "Salida jugando: que participe con los pies en los rondos como un jugador más.",
    ],
  },

  "Balón parado": {
    pasos: PASOS_SUBJETIVO,
    queMirar: [
      "Córners y tiros libres ejecutados con intención: caen donde se planificó.",
      "Variedad de ejecución: centro tenso, al primer palo, jugado corto.",
      "Penales: rutina estable y definición convencida.",
    ],
    consejo: CONSEJO_SUBJETIVO,
    ideas: [
      "Bloques cortos de ejecución al final de la práctica, con blancos en el área.",
      "Rotar ejecutantes en los partidos de práctica para descubrir pateadores.",
      "Penales como juego de puntos, sin cargar la responsabilidad en un solo chico.",
    ],
  },

  "Visión de juego": {
    pasos: PASOS_SUBJETIVO,
    queMirar: [
      "Mira antes de recibir: ya sabe dónde está el compañero libre.",
      "Elige la opción que hace progresar al equipo, no siempre la más vistosa.",
      "Se ofrece y pide la pelota en el lugar justo, dando línea de pase.",
    ],
    consejo: CONSEJO_SUBJETIVO,
    ideas: [
      "Rondos y posesiones con consignas de mirar antes de recibir (nombrar al receptor, jugar a dos toques).",
      "Juegos con superioridad numérica donde la pausa y la elección valgan puntos.",
      "Preguntar en vez de corregir: '¿qué otra opción tenías?' después de la jugada.",
    ],
  },
};

export function guiaDe(nombreAtributo: string): GuiaMedicion | null {
  return GUIAS_MEDICION[nombreAtributo] ?? null;
}
