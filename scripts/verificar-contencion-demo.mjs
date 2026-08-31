/**
 * T-001 del plan CTO — verificación de la contención, contra el BACKEND
 * (no mirando si la UI esconde botones).
 *
 *   node scripts/verificar-contencion-demo.mjs
 *
 * Usa la clave PUBLISHABLE, igual que el navegador de un visitante: lo
 * que este script no puede hacer, tampoco puede hacerlo un atacante con
 * la clave demo. Los asserts que dependen de service role se hacen
 * aparte y están marcados.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

const anon = () =>
  createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

let ok = 0;
let fallos = 0;
let omitidos = 0;
const assert = (cond, titulo, detalle = "") => {
  if (cond) {
    ok++;
    console.log(`✓ ${titulo}`);
  } else {
    fallos++;
    console.log(`✗ ${titulo}${detalle ? ` — ${detalle}` : ""}`);
  }
};

const omitir = (titulo, motivo) => {
  omitidos++;
  console.log(`~ ${titulo} — OMITIDO: ${motivo}`);
};

const password = env.DEMO_PASSWORD;
if (!password) throw new Error("Falta DEMO_PASSWORD en .env.local");

/**
 * La clave vieja del bundle NO va literal acá: el repo es público y un
 * literal con forma de contraseña dispara el escáner de secretos en
 * cada push (GitGuardian, 2026-08-30). Está revocada desde el
 * 2026-08-02, así que no es un secreto vivo, pero es ruido evitable.
 * Vive en `DEMO_PASSWORD_ANTERIOR` de `.env.local`; sin esa variable los
 * dos asserts que la usan quedan OMITIDOS, nunca en verde silencioso.
 */
const passwordVieja = env.DEMO_PASSWORD_ANTERIOR;

// ---------- 1. La cuenta de plataforma demo no entra ----------
{
  const c = anon();
  const { data, error } = await c.auth.signInWithPassword({
    email: "plataforma@demo.talento.ar",
    password,
  });
  assert(
    !!error && !data?.session,
    "plataforma@demo.talento.ar no puede iniciar sesión",
    error ? "" : "¡ENTRÓ!",
  );
}

// ---------- 2. La clave vieja quedó fuera de servicio ----------
if (!passwordVieja) {
  omitir(
    "La clave publicada en el bundle ya no sirve",
    "falta DEMO_PASSWORD_ANTERIOR en .env.local",
  );
} else {
  const c = anon();
  const { data, error } = await c.auth.signInWithPassword({
    email: "admin@demo.talento.ar",
    password: passwordVieja,
  });
  assert(
    !!error && !data?.session,
    "La clave publicada en el bundle ya no sirve",
    error ? "" : "¡SIGUE ENTRANDO!",
  );
}

// ---------- 3. La cuenta admin demo entra, pero está marcada ----------
let sesionAdmin = null;
{
  const c = anon();
  const { data, error } = await c.auth.signInWithPassword({
    email: "admin@demo.talento.ar",
    password,
  });
  assert(!error && !!data?.session, "admin@demo.talento.ar entra con la clave nueva", error?.message);
  if (data?.session) {
    sesionAdmin = c;
    assert(
      data.user.app_metadata?.demo === true,
      "admin@demo.talento.ar tiene app_metadata.demo = true (lo que bloquea las actions)",
    );
    assert(
      data.user.app_metadata?.plataforma !== true,
      "admin@demo.talento.ar NO tiene app_metadata.plataforma",
    );
  }
}

// ---------- 4. Ninguna sesión demo alcanza el observatorio ----------
if (sesionAdmin) {
  const { data, error } = await sesionAdmin.rpc("observatorio_clubes");
  const vacio = !!error || !data || data.length === 0;
  assert(
    vacio,
    "La sesión demo no obtiene filas de observatorio_clubes() (gate es_plataforma)",
    vacio ? "" : `devolvió ${data.length} clubes`,
  );
}

// ---------- 5. Un visitante anónimo no ve datos de menores ----------
{
  const c = anon();
  const { data, error } = await c.from("deportista").select("id, nombre").limit(1);
  assert(
    !!error || !data || data.length === 0,
    "Un anónimo no lee `deportista` (RLS)",
    data?.length ? `devolvió ${data.length} filas` : "",
  );
}

// ---------- 6. Ninguna clave demo viaja en el bundle ----------
// Se miran SOLO los artefactos que produce `next build` y se sirven:
// .next/static (lo que baja el navegador) y .next/server. `.next/dev`
// es caché de turbopack de sesiones de `next dev` y no se despliega.
{
  const { execSync } = await import("node:child_process");
  const cwd = new URL("..", import.meta.url).pathname;
  const buscar = (aguja) => {
    try {
      return execSync(
        `grep -rl -- ${JSON.stringify(aguja)} .next/static .next/server 2>/dev/null || true`,
        { cwd, encoding: "utf8" },
      ).trim();
    } catch {
      return "";
    }
  };
  if (!passwordVieja) {
    omitir(
      "La clave vieja no está en .next/static ni .next/server",
      "falta DEMO_PASSWORD_ANTERIOR en .env.local",
    );
  }
  for (const [aguja, titulo] of [
    ...(passwordVieja
      ? [[passwordVieja, "La clave vieja no está en .next/static ni .next/server"]]
      : []),
    [password, "La clave demo NUEVA tampoco está en el bundle"],
  ]) {
    const hits = buscar(aguja);
    if (hits) console.log(`   archivos: ${hits.split("\n").slice(0, 3).join(", ")}`);
    assert(!hits, `${titulo} (correr npm run build antes)`);
  }
}

console.log(
  `\n${ok} OK · ${fallos} fallos${omitidos ? ` · ${omitidos} omitidos` : ""}\n`,
);
process.exit(fallos > 0 ? 1 : 0);
