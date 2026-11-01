// Llamadas a la API con el token de acceso guardado en este dispositivo
const TOKEN_KEY = "mj_access_token";
const readToken = () => { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; } };

export const AUTH_REQUIRED_EVENT = "mj-auth-required";

export async function apiFetch(url, options = {}) {
  const token = readToken();
  const headers = { ...(options.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
  return res;
}

const postJson = (url, body) =>
  apiFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

// Entrada a la app con el PIN compartido. Lanza un error con el motivo si falla.
export async function login(pin) {
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "login", pin })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.token) throw new Error(body.error || "No se pudo comprobar el PIN.");
  localStorage.setItem(TOKEN_KEY, body.token);
}

// PIN de los sobres: se comprueba y se guarda en el servidor
export async function verifyCategoryPin(categoryId, pin) {
  const res = await postJson("/api/auth", { action: "verify-pin", categoryId, pin });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "No se pudo comprobar el PIN.");
  return !!body.ok;
}

export async function setCategoryPin(categoryId, pin) {
  const res = await postJson("/api/auth", { action: "set-pin", categoryId, pin });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "No se pudo guardar el PIN.");
  }
}
