#!/usr/bin/env node
/**
 * Smoke end-to-end en navegador: las 4 demos + la cuenta de Secretaría.
 *
 * Complementa a `verificar-aislamiento-evaluaciones.sql`, que prueba el RLS
 * en la base. Esto prueba lo otro: que la app efectivamente renderice, que
 * la compuerta de Evaluaciones responda 403 CUENTA_DEMO a las demos, y que
 * la cuenta privada pueda leer Y escribir.
 *
 * Requiere Playwright (no es dependencia del proyecto):
 *   npm i -D playwright && npx playwright install chrome
 *
 * Uso:
 *   BASE_URL=http://localhost:3000 \
 *   SECRETARIA_EMAIL=... SECRETARIA_PASSWORD=... \
 *   [DEPORTISTA_ID=... GRUPO=... DISCIPLINA=... INSTITUCION=...] \
 *   node scripts/verificar-navegador.mjs
 *
 * Sin las variables de escritura, saltea la prueba de registrar medición.
 */
import { chromium } from "playwright";
import { randomUUID } from "node:crypto";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.SECRETARIA_EMAIL;
const PASS = process.env.SECRETARIA_PASSWORD;

const r = [];
const chk = (n, esperado, obtenido) => {
  const ok = String(obtenido) === String(esperado);
  r.push({ ok, n, esperado, obtenido });
  console.log(`${ok ? "✅" : "❌"} ${n} → ${obtenido}${ok ? "" : ` (esperaba ${esperado})`}`);
};

const browser = await chromium.launch({ channel: "chrome" });
const abrir = async () => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log(`   ⚠ error JS: ${e.message.slice(0, 90)}`));
  return { ctx, p };
};
// El panel se arma en cliente (useDatos). Medir apenas cambia la URL da un
// body casi vacío: la prueba fallaría por impaciente, no por rota.
const esperarContenido = (p, min = 400) =>
  p.waitForFunction((m) => document.body.innerText.length > m, min, { timeout: 20000 }).catch(() => {});

// ---------- Demo 4: observatorio anónimo (sin cuenta) ----------
{
  const { ctx, p } = await abrir();
  await p.goto(`${BASE}/observatorio?perfil=super_admin`, { waitUntil: "networkidle" });
  await esperarContenido(p, 200);
  const t = await p.locator("body").innerText();
  chk("demo 4 · observatorio anónimo carga", true, t.length > 200 && !/no pudimos/i.test(t));
  chk("demo 4 · muestra clubes de ejemplo", true, /club/i.test(t));
  await ctx.close();
}

// ---------- Demos 1-3: cuentas de la vitrina ----------
for (const [etiqueta, boton] of [["profe", /profe/i], ["admin", /admin/i], ["comisión", /comisi/i]]) {
  const { ctx, p } = await abrir();
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const b = p.getByRole("button", { name: boton }).first();
  if (await b.count() === 0) { chk(`demo · botón ${etiqueta}`, "existe", "ausente"); await ctx.close(); continue; }
  await b.click();
  await p.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 }).catch(() => {});
  chk(`demo · ${etiqueta} entra`, true, !p.url().includes("/login"));
  await esperarContenido(p);
  const t = await p.locator("body").innerText();
  chk(`demo · ${etiqueta} ve su panel`, true, t.length > 400);
  chk(`demo · ${etiqueta} NO ve Secretaría`, false, /espacio secretar/i.test(t));
  const res = await p.evaluate(async (b) => {
    const x = await fetch(`${b}/api/secretaria/resumen`);
    return { s: x.status, t: await x.text() };
  }, BASE);
  chk(`demo · ${etiqueta} API de Secretaría`, 403, res.s);
  chk(`demo · ${etiqueta} motivo`, true, /CUENTA_DEMO/.test(res.t));
  await ctx.close();
}

// ---------- Cuenta privada ----------
if (!EMAIL || !PASS) {
  console.log("\n(sin SECRETARIA_EMAIL/PASSWORD: salteo las pruebas de la cuenta privada)");
} else {
  const { ctx, p } = await abrir();
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await p.locator('input[type="email"]').first().fill(EMAIL);
  await p.locator('input[type="password"]').first().fill(PASS);
  await p.getByRole("button", { name: /entrar|ingresar|iniciar/i }).first().click();
  await p.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 25000 }).catch(() => {});
  chk("secretaría · login", true, !p.url().includes("/login"));

  const resumen = await p.evaluate(async (b) => (await fetch(`${b}/api/secretaria/resumen`)).status, BASE);
  chk("secretaría · API de Secretaría", 200, resumen);

  for (const [ruta, espera] of [
    ["/secretaria/planillas", /planilla/i], ["/secretaria/deportistas", /deportista|persona/i],
    ["/secretaria/grupos", /grupo|plantel|instituc/i], ["/secretaria/medir", /medir|medici/i],
    ["/secretaria/disciplinas", /disciplina/i],
  ]) {
    await p.goto(`${BASE}${ruta}`, { waitUntil: "networkidle" });
    await esperarContenido(p, 200);
    const t = await p.locator("body").innerText();
    chk(`secretaría · ${ruta}`, true, espera.test(t) && !/algo salió mal|application error/i.test(t));
  }

  if (process.env.DEPORTISTA_ID) {
    // idempotencyKey es UUID, no texto libre: con un string suelto la API
    // devuelve 422 JORNADA_NO_GUARDADA sin decir cuál es el problema.
    const clave = randomUUID();
    const cuerpo = {
      contexto: {
        fecha: new Date().toISOString().slice(0, 10),
        evaluadoPor: "Smoke de despliegue",
        disciplina: process.env.DISCIPLINA ?? "Fútbol",
        institucionOrigen: process.env.INSTITUCION,
        grupo: process.env.GRUPO,
        protocolo: process.env.PROTOCOLO ?? "CMJ",
      },
      mediciones: [{ deportistaId: process.env.DEPORTISTA_ID, atributoCodigo: process.env.ATRIBUTO ?? "altura_salto", valor: 31.5 }],
      idempotencyKey: clave,
    };
    const post = async () => p.evaluate(async ([b, c]) => {
      const x = await fetch(`${b}/api/secretaria/medir`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(c) });
      return { s: x.status, j: await x.text() };
    }, [BASE, cuerpo]);
    const a = await post();
    chk("secretaría · registrar medición", 200, a.s);
    const bis = await post();
    chk("secretaría · repetir es idempotente", a.j, bis.j);
  }
  await ctx.close();
}

await browser.close();
const malas = r.filter((x) => !x.ok);
console.log(`\n${r.length - malas.length}/${r.length} pruebas de navegador OK`);
if (malas.length) process.exit(1);
