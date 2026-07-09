# La presentación — el guion del efecto wow

*(2026-07-09) La tesis: el wow no sale de las features. Sale de
mostrarle a gente de fútbol algo que conoce profundamente —un pibe, un
plantel, un club— visto como nunca lo vio. La presentación no es un
tour de pantallas: es UNA historia contada en cuatro alturas de zoom:
**el chico → el profe → el club → la provincia**. Máximo 15 minutos.*

---

## El arco (7 momentos, en este orden)

### 1. Abrir con la herida, no con la solución
Primera diapositiva: **la foto de un cuaderno de entrenador real** (o
tu Excel de 2021 en CJA, que es oro puro porque es tuyo y es verdad).
"Así se gestiona hoy el talento deportivo de Salta. Cuando este profe
se va del club, esta libreta se va con él."
> Sin este contraste, todo lo que sigue parece un software más. Con
> este contraste, lo que sigue parece un milagro.

### 2. El QR — la plataforma en SUS manos
Segunda diapositiva: un QR gigante. "Sáquenle una foto. Eso que tienen
ahora en el celular no es un video ni un PowerPoint: es la plataforma,
funcionando." Que naveguen ellos mientras hablás.
> El wow físico de tenerla en la mano vale más que 20 slides. Nadie de
> los que presentan en esa oficina hace esto, porque casi nadie tiene
> algo real que mostrar.
> **Requiere: deploy público en Vercel (el prototipo mock, tal cual).**

### 3. La historia de UN chico (el corazón de la presentación)
No "el sistema tiene fichas": **"Este es Thiago. 13 años, 9ª división,
zurdo. En enero corría los 30 metros en 5,9 segundos; el sábado pasado,
5,27. Acá está creciendo — literalmente: 8 centímetros en 18 meses. En
marzo cambió de profe. ¿Ven que la historia no se cortó?"**
La curva multi-año con el cambio de categoría marcado en el gráfico
("pasó de Escuelita 2014 a 9ª") es LA imagen del proyecto.
> **Requiere: un "jugador histórico" en el mock con 3-4 AÑOS de serie**
> (hoy el mock cubre 6 meses) y los cambios de categoría anotados como
> línea vertical en el gráfico. Es la línea de vida hecha imagen.

### 4. Medir EN VIVO — los 90 segundos que cierran la venta
Con tu celular proyectado (o el de un dirigente): jornada de medición,
Velocidad 30m, 9ª División, cargás 8 valores tocando la pantalla,
guardás. Cronometralo en voz alta: "eso fue una categoría entera, en la
cancha, con una mano".
> Es la única prueba creíble de que los profes van a cargar. Al que
> pregunte "¿y quién carga todo esto?", ya le respondiste antes de que
> pregunte.
> Práctico: ensayarlo 10 veces; datos precargados; hotspot propio
> (NUNCA depender del WiFi del lugar); video de respaldo grabado por
> si todo falla.

### 5. Zoom out: del profe a la provincia
Tres pantallas en 90 segundos, siempre nombrando al actor: "esto lo ve
el profe (tablero de entrenamiento) — esto lo ve la comisión directiva
(plantel completo, solo lectura) — y esto lo verían USTEDES:" y abrís
el **Observatorio provincial**, idealmente con el mapa de Salta con
puntos por club.
> Para un funcionario, ver "su" pantalla con el mapa de la provincia es
> el momento en que el proyecto deja de ser de un club y pasa a ser
> política pública.
> **Requiere: mapa estilizado de Salta en /observatorio** (SVG con
> puntos y contadores; no hace falta cartografía real).

### 6. El momento confianza: mostrar lo que NO se puede ver
Desde el observatorio, intentás "entrar" a los datos de un chico de
otro club: no se puede. "Los datos individuales de los menores nunca
salen de su club. No es una promesa: está diseñado así, hasta en la
base de datos. Ustedes ven la provincia; al pibe lo ve su profe."
> Contraintuitivo y letal: todos muestran lo que su sistema hace; vos
> mostrás lo que el tuyo SE NIEGA a hacer. En un país quemado por
> escándalos de datos, este beat te separa de todo lo que vieron.
> Bonus físico: entregar impreso el **informe de evolución de un
> jugador** (una hoja) — el dirigente se lleva un papel, y los
> dirigentes aman los papeles.

### 7. Cerrar con EL número y un pedido concreto
Última diapositiva, un solo número gigante: **"menos de USD 1 por chico
por mes"** (el costo del programa provincial por deportista registrado,
ver `06_costos_y_financiamiento.md`). Y el pedido en tres escalones
(ampliar piloto / 30 clubes / provincial) — que elijan, no que
regateen.
> El wow final no es tecnológico: es que algo tan grande cueste tan
> poco. Y un pedido concreto convierte el aplauso en próxima reunión:
> "¿con cuál escalón empezamos?"

---

## Qué hay que CONSTRUIR en el prototipo para este guion

1. **Deploy público en Vercel** + slide con QR (momento 2).
2. **Jugador histórico**: 3-4 años de mediciones mock + cambios de
   categoría marcados en el gráfico de evolución (momento 3).
3. **Mapa de Salta** en /observatorio con clubes como puntos (momento 5).
4. **Informe de evolución imprimible** (una página por jugador, CSS de
   impresión) para entregar en mano (momento 6).

## Anti-wow — lo que NO hacer en la presentación

- **No mostrar más de 5 pantallas.** El tour de features mata el cuento.
- **Nada de "sistema de gestión deportiva"**: la frase es *"la memoria
  del talento salteño"*. Gestión suena a carga; memoria suena a legado.
- **No prometer causalidad** ("el entrenamiento mejoró a X") ni scouting
  mágico ni IA — un solo escéptico informado en la sala te desarma, y
  el framing honesto es tu diferencial, no tu debilidad. Decilo vos
  antes: "esto registra evolución; no promete milagros".
- **No mostrar** valorización, finanzas, táctica, SQL, paneles de
  administración. No existen en esta reunión.
- **No abrir con la visión provincial**: abrí con el pibe. La provincia
  es el final del cuento, no el principio (a menos que la audiencia sea
  SOLO Secretaría; ahí el mapa puede subir al momento 3).
- **No llevar más de una persona hablando**: un solo narrador; el resto
  asiente y anota nombres.

## Checklist del día

- [ ] Hotspot propio probado en el lugar (jamás WiFi ajeno)
- [ ] Datos demo precargados y ensayados (jornada de 8 valores < 2 min)
- [ ] Video de respaldo de toda la demo (por si el vivo falla)
- [ ] QR impreso grande + en slide
- [ ] 3 informes de jugador impresos para dejar en la mesa
- [ ] El número (USD/chico/mes) actualizado con los costos reales
- [ ] Pedido de próxima reunión preparado (¿quién, cuándo, qué escalón?)
