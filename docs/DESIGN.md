# DESIGN.md — Dirección de diseño: "Cancha clara"

Decisión de dirección visual e interacción para el prototipo (2026-07-06).
Una sola dirección, elegida con criterio de producto; no un menú de opciones.

## Por qué esta dirección

El usuario primario es un entrenador de club de base, en la cancha, con el
celular en una mano y un cronómetro en la otra. El usuario secundario es un
funcionario (Secretaría de Deportes, Liga) que ve la plataforma en una demo.
La dirección tiene que servir a los dos sin traicionar a ninguno:

1. **Clara, no oscura.** El sports-tech de élite (WHOOP, Catapult) es dark
   mode: transmite "laboratorio de alto rendimiento", pero de noche y en
   interiores. Este producto se usa a plena luz del sol en una cancha de
   tierra: fondo claro = legibilidad real en exterior + cercanía. El tono
   base no es blanco puro sino un blanco cálido con matiz verde (#F4F6F3),
   que baja el brillo sin ensuciar.

2. **Verde césped como identidad.** El verde profundo (#15803D) es el color
   del deporte de base (la cancha, no el neón de una startup) y a la vez el
   color universal de "crecimiento" — que es literalmente lo que el producto
   muestra. Un solo color primario, usado con intención: CTA de carga,
   navegación activa, y LA LÍNEA DE EVOLUCIÓN. Nada más compite con él.

3. **El gráfico de evolución es el héroe.** Es el único elemento con área de
   color (degradado verde al 16%→2%), la única curva, el único lugar donde
   el ojo descansa en algo orgánico. Todo lo demás es tarjetas planas con
   bordes finos: el contraste de tratamiento hace que la curva se sienta
   "la funcionalidad", no una tabla más.

4. **Profesional por sobriedad, cercano por redondez.** Radios generosos
   (0.75rem), tipografía Manrope (geométrica pero cálida, excelente en
   números), microcopys en voseo argentino. Sin ilustraciones infantiles,
   sin gradientes decorativos, sin sombras pesadas: lo que un funcionario
   lee como "sistema serio" y un profe lee como "app fácil".

## Tokens

| Rol | Valor |
|---|---|
| Fondo de página | `#F4F6F3` |
| Superficie (cards) | `#FCFCFA` |
| Tinta | `#17211B` · secundaria `#5F6D63` |
| Primario (verde césped) | `#15803D` (blanco encima) |
| Secundario suave | `#E9F1EA` / texto `#14532D` |
| Bordes hairline | `#E2E7E0` |
| Estado creciendo | `#15803D` sobre `#E3F2E7` |
| Estado amesetado | `#B45309` sobre `#F8ECDD` |
| Estado en baja | `#BE123C` sobre `#FBE7EB` |
| Radio base | `0.75rem` |

- La terna de estados fue **validada con el validador de paletas**
  (CVD ΔE 15.4 en el peor par adyacente, contraste ≥3:1 sobre la
  superficie). Además el estado NUNCA es color solo: siempre icono + texto
  (accesibilidad daltonismo).
- Tipografía: **Manrope** (400–800) para todo, números tabulares SOLO en
  columnas/inputs alineados, nunca en números grandes sueltos.
- Modo oscuro: fuera del alcance del prototipo (dirección clara a
  propósito); si se agrega, se re-valida la paleta sobre superficie oscura.

## Reglas del gráfico de evolución (no negociables del diseño)

- Línea 2px verde, puntos ≥8px con anillo de superficie de 2px, área en
  degradado suave (nunca bloque saturado).
- Grilla horizontal hairline sólida (nunca punteada), ejes recesivos.
- Etiqueta directa SOLO en el último punto; el resto vive en tooltip y en
  el historial (la "vista tabla" debajo del gráfico — ningún valor queda
  accesible únicamente por hover).
- Una serie por gráfico (un atributo por vez, elegido con chips) → sin
  leyenda; el título del card nombra la serie. Nunca dos escalas en un eje.
- El estado (creciendo/amesetado/en baja) SIEMPRE se muestra junto al
  gráfico con su explicación ("basado en las últimas 3 mediciones") y
  respeta `sentido`: en Velocidad 30m bajar es mejorar y la UI lo dice.
- Talla/peso se grafican sin juicio de mejora (estado "en registro").

## Interacción y navegación

- **Mobile-first real**: barra inferior de 4 accesos (Inicio, Deportistas,
  **Medir** —botón central elevado—, Sesiones). En desktop la misma
  estructura pasa a sidebar; el contenido está limitado a ~max-w-3xl para
  que la demo en proyector no se desparrame.
- **La carga es el flujo estrella de interacción** (la retención del
  producto depende de que midan): 3 pasos en una sola pantalla — atributo,
  categoría, lista de carga con inputs numéricos grandes (48px de alto,
  teclado decimal) + progreso x/N + guardar sticky. Objetivo: cargar a 12
  chicos en menos de 2 minutos con una mano.
- **Todo conecta con todo**: home → ficha/sesión/carga; lista → ficha;
  ficha → evolución → carga prellenada (`?atributo=&categoria=`) y →
  sesiones del deportista; sesión → ficha de cada asistente. Ninguna
  pantalla es un callejón sin salida.
- Targets táctiles ≥44px, tipografía base 14-16, textos de sistema en
  lenguaje de registro (nunca atribución causal, ver CLAUDE.md).
- Datos de menores visibles en el diseño: banner ámbar de consentimiento
  pendiente en la ficha y contador en el home.

## Patrones agregados en la iteración 2 (2026-07-09)

- **Barra de nivel 1-10** (`components/nivel-bar.tsx`): diez segmentos,
  relleno primario sobre muted, número al lado en tinta. Es la
  representación de las apreciaciones técnicas subjetivas — nunca
  "dots" de videojuego, y siempre acompañada del rótulo "a criterio
  del profe". La flecha de tendencia junto al número usa forma +
  título (nunca color solo).
- **Vista tabla** (toggle en /deportistas): scroll horizontal dentro
  de su propio contenedor (la página nunca scrollea de costado),
  primera columna sticky, encabezados abreviados ordenables. Única
  énfasis: negrita en el mejor valor de cada columna (en Velocidad
  30m, el MENOR tiempo — el `sentido` manda). Sin semáforos de color.
- **Tablero-pincel** (/entrenamiento): se elige un área y se tapea
  jugadores para asignarlos — sin drag & drop, funciona igual en
  celular y en proyector. Mobile: chips de área; desktop: grid de
  cards con el plantel a la derecha (eco del tablero de ManagerZone,
  con nuestra estética).
- **Observatorio** (/observatorio, solo perfil super admin): stat
  tiles provinciales + cards por club con métricas agregadas, y la
  regla de privacidad ("los datos individuales de menores nunca salen
  del club") escrita EN la interfaz.
- **Selector de perfil demo**: switcher en sidebar/header que muestra
  el producto según rol (profesor, admin, comisión directiva solo
  lectura, super admin). Es visibilidad de UI, no seguridad.

## Qué NO es esta dirección

- No es un dashboard denso de BI: una métrica por pantalla, aire generoso.
- No es una app de gaming/neón: nada de dark + lima fluorescente.
- No es un ERP gris: el verde y la redondez están ahí para que un profe
  la abra con ganas.
