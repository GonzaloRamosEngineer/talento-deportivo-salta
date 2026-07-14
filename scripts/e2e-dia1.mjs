// E2E del paquete "Día 1 en el club": import de plantel por planilla,
// borrador local de la jornada de medición y compartir informe por
// WhatsApp. Corre contra el dev server local con el usuario demo profe
// y verifica/limpia en la base con service role.
//
//   npm i --no-save puppeteer-core && node scripts/e2e-dia1.mjs   (desde el root)
//
// Requiere: dev server en :3210, puppeteer-core instalado (--no-save),
// Chrome del sistema, .env.local con SUPABASE_SECRET_KEY.

import puppeteer from "puppeteer-core";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const BASE = "http://localhost:3210";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);

let fallos = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "✅" : "❌"} ${msg}`);
  if (!cond) fallos++;
};
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// setter nativo + evento input: los inputs controlados de React no ven
// page.type en date/textarea (gotcha del repo)
async function setValor(page, selector, valor) {
  await page.evaluate(
    (sel, val) => {
      const el = document.querySelector(sel);
      if (!el) throw new Error(`No existe ${sel}`);
      const proto =
        el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, val);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    },
    selector,
    valor,
  );
}

const clickPorTexto = (page, texto, selector = "button") =>
  page.evaluate(
    (t, sel) => {
      const el = [...document.querySelectorAll(sel)].find((b) =>
        b.innerText.trim().toUpperCase().includes(t.toUpperCase()),
      );
      if (!el) return false;
      el.scrollIntoView({ block: "center" });
      el.click();
      return true;
    },
    texto,
    selector,
  );

const esperarTexto = (page, texto, timeout = 20000) =>
  page.waitForFunction(
    (t) => document.body.innerText.toUpperCase().includes(t.toUpperCase()),
    { timeout },
    texto,
  );

async function limpiar() {
  // El borrado de deportista cascadea tutor/consentimiento/medicion
  const { data } = await admin
    .from("deportista")
    .delete()
    .eq("apellido", "Pruebaimport")
    .select("id");
  return data?.length ?? 0;
}

const previos = await limpiar();
if (previos) console.log(`(limpieza previa: ${previos} residuales)`);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: false });

try {
  /* ---------- login profe ---------- */
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
  await setValor(page, "#email", "profe@demo.talento.ar");
  await setValor(page, "#password", "TalentoDemo26");
  await clickPorTexto(page, "Ingresar", "button[type=submit]");
  await page.waitForFunction(() => location.pathname === "/panel", { timeout: 25000 });
  ok(true, "login profe → /panel");

  /* ---------- 1 · import de plantel ---------- */
  await page.goto(`${BASE}/deportistas/importar`, { waitUntil: "networkidle2" });
  await page.waitForSelector("#imp-texto", { timeout: 20000 });

  const tsv = [
    "Apellido y nombre\tFecha de nacimiento\tCategoría\tTel del tutor",
    "Pruebaimport, Zoe\t05/03/2013\t9ª División\t387 555 0101",
    "Pruebaimport, Ciro\t22/08/2016\t\t",
    "Guaymás, Thiago\t01/01/2013\t9ª División\t",
    "Pruebaimport, Mal\t99/99/2099\t9ª División\t",
  ].join("\n");
  await setValor(page, "#imp-texto", tsv);
  await esperarTexto(page, "3 · Revisar");

  const cuerpo = await page.evaluate(() => document.body.innerText);
  ok(cuerpo.includes("Detectamos los títulos"), "import: encabezados detectados");
  ok(/Pruebaimport, Zoe/.test(cuerpo), "import: fila Zoe en la preview");
  ok(
    cuerpo.includes("Escuelita 2016"),
    "import: Ciro sin categoría resuelto por cohorte 2016",
  );
  ok(cuerpo.toUpperCase().includes("YA ESTÁ EN EL PLANTEL"), "import: duplicado marcado (Guaymás)");
  ok(cuerpo.includes("No se entiende la fecha"), "import: fecha inválida marcada");
  ok(/Importar 2 deportistas/i.test(cuerpo), "import: botón cuenta 2 filas listas");

  await clickPorTexto(page, "Importar 2 deportistas");
  await esperarTexto(page, "2 deportistas dados de alta");
  await esperarTexto(page, "consentimiento del tutor PENDIENTE");
  ok(true, "import: pantalla de éxito con aviso de consentimiento");

  const { data: importados } = await admin
    .from("deportista")
    .select("id, nombre, fecha_nacimiento, categoria:categoria_id(nombre), tutor(telefono)")
    .eq("apellido", "Pruebaimport")
    .order("nombre");
  ok(importados?.length === 2, `DB: 2 deportistas importados (hay ${importados?.length})`);
  const ciro = importados?.find((d) => d.nombre === "Ciro");
  const zoe = importados?.find((d) => d.nombre === "Zoe");
  ok(zoe?.categoria?.nombre === "9ª División", "DB: Zoe en 9ª División (por nombre)");
  ok(ciro?.categoria?.nombre === "Escuelita 2016", "DB: Ciro en Escuelita 2016 (por cohorte)");
  ok(ciro?.fecha_nacimiento === "2016-08-22", "DB: fecha DD/MM/YYYY bien parseada");
  ok(zoe?.tutor?.[0]?.telefono === "387 555 0101", "DB: tutor de Zoe con teléfono");
  const { data: consZoe } = await admin
    .from("consentimiento")
    .select("id")
    .eq("deportista_id", zoe.id);
  ok((consZoe?.length ?? 0) === 0, "DB: sin consentimiento (queda pendiente)");

  /* ---------- 2 · compartir informe por WhatsApp ---------- */
  // Zoe necesita al menos una medición para que haya algo que compartir
  const [{ data: atr }, { data: memb }] = await Promise.all([
    admin.from("atributo").select("id").eq("nombre", "Velocidad 30m").single(),
    admin.from("membresia").select("id").eq("email", "profe@demo.talento.ar").single(),
  ]);
  const { error: eMed } = await admin.from("medicion").insert({
    deportista_id: zoe.id,
    atributo_id: atr.id,
    valor: 5.2,
    fecha: new Date().toISOString().slice(0, 10),
    registrado_por: memb.id,
  });
  ok(!eMed, `DB: medición demo para Zoe${eMed ? ` (${eMed.message})` : ""}`);

  await page.goto(`${BASE}/deportistas/${zoe.id}`, { waitUntil: "networkidle2" });
  await esperarTexto(page, "Zoe Pruebaimport");
  await page.waitForSelector('a[aria-label="Enviar el informe por WhatsApp al tutor"]', {
    timeout: 15000,
  });
  const hrefTutor = await page.$eval(
    'a[aria-label="Enviar el informe por WhatsApp al tutor"]',
    (a) => a.href,
  );
  ok(
    hrefTutor.includes("wa.me/5493875550101"),
    `WhatsApp: chat directo al tutor (387 555 0101 → 5493875550101)`,
  );
  const textoWa = decodeURIComponent(hrefTutor.split("text=")[1] ?? "");
  ok(textoWa.includes("Zoe Pruebaimport"), "WhatsApp: el texto lleva el nombre");
  ok(textoWa.includes("Velocidad 30m"), "WhatsApp: el texto lleva la medición");
  ok(/maduración/.test(textoWa), "WhatsApp: framing honesto en el texto");
  ok(/no reenviar/i.test(textoWa), "WhatsApp: aviso de datos de menor");

  // Guaymás no tiene tutor cargado → compartir genérico
  const { data: guaymas } = await admin
    .from("deportista")
    .select("id")
    .eq("apellido", "Guaymás")
    .eq("nombre", "Thiago")
    .single();
  await page.goto(`${BASE}/deportistas/${guaymas.id}`, { waitUntil: "networkidle2" });
  await page.waitForSelector('a[aria-label="Compartir el informe por WhatsApp"]', {
    timeout: 15000,
  });
  const hrefGenerico = await page.$eval(
    'a[aria-label="Compartir el informe por WhatsApp"]',
    (a) => a.href,
  );
  ok(hrefGenerico.includes("wa.me/?text="), "WhatsApp: sin teléfono cae al compartir genérico");

  await page.goto(`${BASE}/deportistas/${guaymas.id}/informe`, { waitUntil: "networkidle2" });
  await esperarTexto(page, "Informe de evolución deportiva");
  const enInforme = await page.evaluate(
    () => !!document.querySelector('a[href^="https://wa.me"]'),
  );
  ok(enInforme, "WhatsApp: botón también en el informe imprimible");

  /* ---------- 3 · borrador local en /medicion ---------- */
  await page.goto(`${BASE}/medicion`, { waitUntil: "networkidle2" });
  await esperarTexto(page, "Jornada de medición");
  ok(await clickPorTexto(page, "Velocidad 30m"), "medición: atributo elegido");
  ok(await clickPorTexto(page, "9ª División"), "medición: categoría elegida");
  const selCardozo = 'input[aria-label="Velocidad 30m de Lautaro Cardozo"]';
  await page.waitForSelector(selCardozo, { timeout: 15000 });
  await setValor(page, selCardozo, "4,5");
  await dormir(500); // que el efecto persista el borrador

  await page.reload({ waitUntil: "networkidle2" });
  await esperarTexto(page, "Recuperamos la jornada");
  ok(true, "borrador: aviso de recuperación tras recargar");
  await page.waitForSelector(selCardozo, { timeout: 15000 });
  const restaurado = await page.$eval(selCardozo, (i) => i.value);
  ok(restaurado === "4,5", `borrador: valor restaurado ("${restaurado}")`);
  const atributoRestaurado = await page.evaluate(() =>
    document.body.innerText.toUpperCase().includes("3 · CARGAR VELOCIDAD 30M".toUpperCase()),
  );
  ok(atributoRestaurado, "borrador: atributo y categoría restaurados solos");

  await clickPorTexto(page, "Descartar");
  await dormir(300);
  const trasDescartar = await page.evaluate(() => ({
    banner: document.body.innerText.includes("Recuperamos la jornada"),
    clave: window.localStorage.getItem("tds-borrador-medicion"),
    valor: document.querySelector('input[aria-label="Velocidad 30m de Lautaro Cardozo"]')?.value,
  }));
  ok(
    !trasDescartar.banner && !trasDescartar.clave && trasDescartar.valor === "",
    "borrador: descartar limpia banner, valores y localStorage",
  );
} finally {
  await browser.close();
  const borrados = await limpiar();
  console.log(`(limpieza final: ${borrados} deportistas de prueba borrados)`);
}

console.log(fallos ? `\n${fallos} FALLOS` : "\nTodo verde ✔");
process.exit(fallos ? 1 : 0);
