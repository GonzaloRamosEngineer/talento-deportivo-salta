/**
 * E2E del circuito de trayectoria (deportista_hito):
 *   1. alta con fecha de ingreso retroactiva → timeline + métrica
 *   2. mover de categoría → hito de promoción con snapshots
 *   3. hito manual "Debut en Primera"
 *   4. baja por pase → hito + activo=false + categoría intacta
 *   5. plataforma ve pases_12m en el observatorio
 * Corre contra localhost:3210 con las cuentas demo. Auto-limpia.
 *   node scripts/e2e-trayectoria.mjs
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer-core";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const BASE = "http://localhost:3210";
const APELLIDO = "Pruebatrayectoria";
let fallos = 0;
const ok = (c, m) => { console.log(`${c ? "✓" : "✗"} ${m}`); if (!c) fallos++; };
const setValor = (sel, v) => async (page) => page.evaluate(({ sel, v }) => {
  const i = document.querySelector(sel);
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  set.call(i, v);
  i.dispatchEvent(new Event("input", { bubbles: true }));
}, { sel, v });

const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 420, height: 1400, isMobile: true, deviceScaleFactor: 2 });
const login = async (email) => {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle0" });
  if (!(await page.$("input#email"))) {
    await page.evaluate(() => { [...document.querySelectorAll("button,a")].find((b) => b.getAttribute("aria-label")?.toLowerCase().includes("salir") || b.innerText === "Salir")?.click(); });
    await new Promise((r) => setTimeout(r, 1500));
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle0" });
  }
  await page.type("#email", email);
  await page.type("#password", "TalentoDemo26");
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0", timeout: 30000 }), page.click("button[type=submit]")]);
};
const texto = () => page.evaluate(() => document.body.innerText.toLowerCase());

// ---- 1. alta con ingreso retroactivo (admin: alcanza todas las categorías) ----
await login("admin@demo.talento.ar");
await page.goto(`${BASE}/deportistas/nuevo`, { waitUntil: "networkidle0" });
await page.waitForSelector("#dep-nombre", { timeout: 20000 });
await page.type("#dep-nombre", "Valentín");
await page.type("#dep-apellido", APELLIDO);
await (setValor("#dep-nacimiento", "2013-05-10"))(page);
await page.evaluate(() => { const s = document.querySelector("#dep-categoria"); const o = [...s.options].find((x) => x.text.includes("9ª")); s.value = o.value; s.dispatchEvent(new Event("change", { bubbles: true })); });
await (setValor("#dep-ingreso", "2024-03-01"))(page);
await page.evaluate(() => { [...document.querySelectorAll("button[type=submit]")].find((b) => b.innerText.toLowerCase().includes("dar de alta"))?.click(); });
await page.waitForFunction((ap) => document.body.innerText.includes(ap), { timeout: 20000 }, APELLIDO);
const { data: dep } = await admin.from("deportista").select("id, categoria_id").eq("apellido", APELLIDO).single();
ok(Boolean(dep), "alta guardada");
const { data: hIng } = await admin.from("deportista_hito").select("tipo, fecha").eq("deportista_id", dep.id);
ok(hIng.some((h) => h.tipo === "ingreso" && h.fecha === "2024-03-01"), "hito de ingreso con fecha retroactiva");

// timeline en la ficha (tab Ficha)
await page.goto(`${BASE}/deportistas/${dep.id}`, { waitUntil: "networkidle0" });
await page.waitForFunction(() => document.body.innerText.toLowerCase().includes("ficha"), { timeout: 20000 });
await page.evaluate(() => { [...document.querySelectorAll("button")].find((b) => b.innerText.trim().toLowerCase() === "ficha")?.click(); });
await page.waitForFunction(() => document.body.innerText.toLowerCase().includes("trayectoria en el club"), { timeout: 15000 });
const t1 = await texto();
ok(t1.includes("ingresó al club"), "timeline muestra el ingreso");
ok(t1.includes("en el club: 2 años"), `métrica "en el club" calculada (${t1.match(/en el club: [^\n]*/)?.[0] ?? "no encontrada"})`);

// ---- 2. mover de categoría → promoción ----
await page.goto(`${BASE}/deportistas/${dep.id}/editar`, { waitUntil: "networkidle0" });
await page.waitForSelector("#ed-categoria", { timeout: 20000 });
await page.evaluate(() => { const s = document.querySelector("#ed-categoria"); const o = [...s.options].find((x) => x.text.includes("8ª")); s.value = o.value; s.dispatchEvent(new Event("change", { bubbles: true })); });
await page.evaluate(() => { [...document.querySelectorAll("button")].find((b) => b.innerText.toLowerCase().includes("guardar cambios"))?.click(); });
await page.waitForFunction(() => location.pathname.match(/deportistas\/[0-9a-f-]+$/), { timeout: 20000 });
const { data: hProm } = await admin.from("deportista_hito").select("tipo, categoria_origen_nombre, categoria_destino_nombre").eq("deportista_id", dep.id).eq("tipo", "promocion");
ok(hProm.length === 1 && hProm[0].categoria_origen_nombre?.includes("9ª") && hProm[0].categoria_destino_nombre?.includes("8ª"), `promoción con snapshots (${hProm[0]?.categoria_origen_nombre} → ${hProm[0]?.categoria_destino_nombre})`);

// ---- 3. hito manual: debut en Primera ----
await page.goto(`${BASE}/deportistas/${dep.id}`, { waitUntil: "networkidle0" });
await page.evaluate(() => { [...document.querySelectorAll("button")].find((b) => b.innerText.trim().toLowerCase() === "ficha")?.click(); });
await page.waitForFunction(() => document.body.innerText.toLowerCase().includes("agregar hito"), { timeout: 15000 });
await page.evaluate(() => { [...document.querySelectorAll("button")].find((b) => b.innerText.toLowerCase().includes("agregar hito"))?.click(); });
await page.waitForFunction(() => document.body.innerText.toLowerCase().includes("debut en primera"), { timeout: 10000 });
await page.evaluate(() => { [...document.querySelectorAll("button")].find((b) => b.innerText.toLowerCase().includes("debut en primera"))?.click(); });
await page.evaluate(() => { [...document.querySelectorAll("button")].find((b) => b.innerText.toLowerCase().includes("guardar hito"))?.click(); });
await page.waitForFunction(() => document.body.innerText.toLowerCase().split("debut en primera").length > 2, { timeout: 15000 }).catch(() => {});
const { data: hDeb } = await admin.from("deportista_hito").select("tipo").eq("deportista_id", dep.id).eq("tipo", "debut_primera");
ok(hDeb.length === 1, "hito manual de debut guardado");

// ---- 4. baja por pase ----
await page.goto(`${BASE}/deportistas/${dep.id}/editar`, { waitUntil: "networkidle0" });
await page.waitForFunction(() => document.body.innerText.toLowerCase().includes("registrar pase"), { timeout: 20000 });
await page.evaluate(() => { [...document.querySelectorAll("button")].find((b) => b.innerText.toLowerCase().includes("registrar pase"))?.click(); });
await page.waitForSelector("input[placeholder*='Club de destino']", { timeout: 10000 });
await page.type("input[placeholder*='Club de destino']", "Club E2E Destino");
await page.evaluate(() => { [...document.querySelectorAll("button")].find((b) => b.innerText.toLowerCase().includes("confirmar el pase"))?.click(); });
await page.waitForFunction(() => location.pathname === "/deportistas", { timeout: 20000 });
const { data: depFinal } = await admin.from("deportista").select("activo, categoria_id").eq("id", dep.id).single();
const { data: hPase } = await admin.from("deportista_hito").select("club_destino_nombre").eq("deportista_id", dep.id).eq("tipo", "pase_salida");
ok(depFinal.activo === false && depFinal.categoria_id !== null, "baja por pase: activo=false, categoría intacta");
ok(hPase.length === 1 && hPase[0].club_destino_nombre === "Club E2E Destino", "hito de pase con destino en texto");
const t4 = await texto();
ok(!t4.includes(APELLIDO.toLowerCase()), "ya no aparece en la lista de deportistas");

// ---- 5. plataforma ve pases_12m ----
await login("plataforma@demo.talento.ar");
await page.goto(`${BASE}/observatorio`, { waitUntil: "networkidle0" });
await page.waitForFunction(() => document.body.innerText.toLowerCase().includes("pases 12 m"), { timeout: 20000 });
const pases = await page.evaluate(() => {
  const el = [...document.querySelectorAll("span")].find((s) => s.innerText.trim().toLowerCase() === "pases 12 m");
  return el?.parentElement?.querySelector("span")?.innerText ?? "?";
});
ok(Number(pases) >= 4, `observatorio muestra pases 12m = ${pases} (3 vitrina + 1 e2e)`);

await browser.close();
// limpieza total (cascada borra hitos)
await admin.from("deportista").delete().eq("id", dep.id);
const { data: resid } = await admin.from("deportista_hito").select("id").eq("deportista_id", dep.id);
ok(resid.length === 0, "limpieza: deportista y hitos de prueba borrados");
console.log(fallos ? `\n✗ ${fallos} fallos` : "\n✅ Trayectoria e2e OK de punta a punta");
process.exit(fallos ? 1 : 0);
