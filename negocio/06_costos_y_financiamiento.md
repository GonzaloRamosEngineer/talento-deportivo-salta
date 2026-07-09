# Costos, beneficios y cómo pedir la plata

*Análisis honesto (2026-07-09). Los montos son ÓRDENES DE MAGNITUD para
ordenar la conversación, no un presupuesto: hay que validarlos con
costos reales de DMG y de Salta antes de mostrarlos afuera.*

## La respuesta corta a "¿presento el proyecto y tiro un número?"

**No.** No se le pide plata al Estado para *construir* software — se le
pide para *operar un programa* que ya demostró funcionar. La secuencia
correcta es: financiar el piloto con recursos propios (DMG + Fundación),
llegar a la Secretaría/Liga **con evidencia y un costo por chico
ridículamente bajo**, y ahí negociar un convenio de operación anual.
Pedir antes de tener evidencia es vender promesas: posición débil,
número arbitrario, y el Estado argentino paga tarde y mal. El piloto no
es un gasto: es la compra de tu posición negociadora.

---

## 1. Estructura de costos (qué cuesta esto de verdad)

### a) Construcción (MVP → producción)
Auth real, RLS probado, consentimientos, carga, gráficos, export, QA,
deploy. **A precio de mercado: USD 15.000–25.000** (2-3 meses de un
equipo chico). En la práctica lo pone DMG como inversión (in-kind).
⚠ Regla: aunque no se facture, **valuarlo y registrarlo** — es el
aporte de capital de DMG al programa y vale como contraparte en
cualquier grant o convenio.

### b) Infraestructura (el costo chico)
Supabase Pro + Vercel Pro + dominio + email transaccional:
**~USD 70–120/mes** hasta miles de usuarios. Escala provincial:
USD 200–500/mes. La infraestructura NUNCA va a ser el problema — no
dejar que nadie del Estado crea que "el sistema" es el costo grande.

### c) Operación humana (el costo real que todos olvidan)
- **Coordinador/a de implementación** (onboarding presencial de profes,
  soporte por WhatsApp, seguimiento de la constancia de carga):
  part-time en piloto (~USD 400–700/mes eq.), full-time a escala
  provincial. **Este rol es el programa.** Si se financia una sola
  cosa, es esta.
- Mantenimiento evolutivo del software: 20–40 hs/mes de DMG.
- Viáticos a clubes del interior (Cerrillos, Valle de Lerma…).

### d) Instrumental de medición (detalle que enamora sponsors)
Medir requiere: cronómetros, cinta métrica, conos, balanza, tallímetro.
**Kit por club: USD 150–300.** Tangible, fotografiable, con logo — el
producto perfecto para RSE local (ver §4).

## 2. Números por fase (órdenes de magnitud)

| Fase | Alcance | Costo cash/año (sin in-kind DMG) | Quién lo pone |
|---|---|---|---|
| **0 · Piloto CJA** | 1 club, 1-2 categorías, 8-12 semanas | **USD 2.000–4.000** (infra + kit + viáticos + coordinación mínima) | DMG + Fundación |
| **1 · Piloto interclubes** | 3-5 clubes, 12 meses, ~800-1.000 chicos | **USD 10.000–15.000** | Grants + RSE + Fundación |
| **2 · Programa provincial** | 30-50 clubes, ~5.000-7.500 chicos | **USD 40.000–70.000** (coordinación full-time + soporte + kits + infra + viáticos) | Convenio Secretaría/Liga + mix |

**El ancla de oro para el pitch:** el programa provincial cuesta
**~USD 7–10 por chico por año** — *menos de un dólar por mes por
deportista registrado con su historia completa*. Contra cualquier obra
o programa deportivo, es invisible de barato. Ese es el número que se
tira primero, no el total.

## 3. Beneficios monetarios (honestos: quién gana qué)

- **Los clubes NO van a pagar** (ni deben, en esta etapa): su beneficio
  es memoria y orden, no plata. No construir el modelo sobre cuotas de
  clubes de barrio.
- **La Fundación**: impacto medible → acceso a grants más grandes y
  reputación. Es el vehículo receptor natural de fondos.
- **DMG (el upside real del proyecto)**: Salta como caso de referencia
  → **replicar/licenciar a otras provincias, ligas y federaciones** es
  el negocio. Además: reputación en sector público deportivo y
  servicios profesionales derivados (reportes, integraciones). El
  retorno de DMG no está en Salta: está en lo que Salta demuestra.
- **A futuro (no ahora)**: servicios premium a clubes profesionales /
  scouting con consentimiento explícito de mayores. **Nunca, bajo
  ningún modelo, venta de datos** — un solo titular de "venden datos de
  chicos" mata el proyecto y a las dos organizaciones.

## 4. Cómo se pide, a quién, y en qué orden

### Fase 0-1: NO pedirle al Estado. Pedirle a:
1. **Grants**: Google.org / Google for Nonprofits (ya hay relación),
   programas nacionales de deporte y de transformación digital,
   fundaciones deportivas internacionales (FIFA Foundation tiene
   líneas de community football). Monto objetivo: USD 10-20k.
2. **RSE local (sponsors)**: el producto de venta es el **"kit de
   medición + un año de plataforma para un club" = USD 500-800 por
   club apadrinado**. Empresa salteña elige el club, hay foto, hay
   placa institucional. Diez empresas = piloto interclubes pagado.
   ⚠ Límite ético innegociable: reconocimiento institucional (web,
   eventos, informes), **jamás publicidad dentro de la app** — los
   usuarios finales ven datos de menores.
3. **Aporte propio valuado**: el desarrollo de DMG (USD 15-25k) y las
   horas de la Fundación entran como contraparte formal. Todo grant lo
   pide y fortalece el pedido.

### Fase 2: recién acá, Secretaría/Liga — y así:
- **No es "cómprenme un software": es "financien la operación de un
  programa provincial de desarrollo deportivo"** que ya funciona en N
  clubes, con datos de M chicos, y estos resultados de constancia de
  carga. El software va incluido; lo que se financia es coordinación,
  kits, soporte y expansión.
- **Instrumento**: convenio marco Fundación ↔ Secretaría con
  entregables anuales (clubes incorporados, deportistas con
  trayectoria, informes del observatorio) y renovación anual. La
  Fundación como firmante le da transparencia y esquiva la compra
  pública de software (lenta y abre licitación a cualquiera).
- **Negociación**: el número lo tirás vos (el primero ancla), pero en
  **tres escalones** — ampliar piloto (USD ~15k) / 30 clubes
  (USD ~45k) / provincial completo (USD ~70k) — con estructura de
  costos abierta. Contra un menú, el funcionario elige; contra un
  número único, regatea.
- **Plan B siempre visible**: si el convenio no sale, el programa sigue
  a ritmo de grants + RSE. Negociás distinto cuando pueden ver que no
  te morís sin ellos — y es la mitigación real del riesgo político.

## 5. "Gente que se sume" (Fundación + DMG como imanes)

- **Universidades** (UBA ya aliada): estudiantes de datos/deporte
  analizando el dataset agregado = I+D gratis + legitimidad académica +
  papers que abren puertas. Pedir a cambio: informes para los clubes.
- **Profes referentes** ("embajadores") con estipendio chico: el par
  que le enseña al par vale más que cualquier manual.
- **Voluntariado profesional** (diseño, legales, comunicación) vía
  Fundación.
- ⚠ Regla dura: los voluntarios suman en los bordes, pero **el rol de
  coordinación de implementación se paga**. Si el rol crítico depende
  de voluntad, el programa se cae en el mes tres.

## 6. Reglas de oro del dinero (no negociables)

1. **Cajas separadas** (ya está en el doc madre §11): la Fundación
   recibe fondos de impacto; DMG factura desarrollo/operación bajo
   contrato transparente y auditable. Nunca DMG cobrando "en negro"
   dentro de un programa con menores y Estado.
2. **Nunca vender datos. Nunca publicidad a menores en la app.**
3. **Todo aporte in-kind se valúa y se registra** — es contraparte y
   es la prueba de compromiso propio cuando pidas afuera.
4. **El costo por chico por año es EL número del proyecto**: mantenerlo
   visible, actualizado y bajo. El día que ese número se vuelva caro,
   el proyecto perdió su historia.
