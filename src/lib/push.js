import { DEVICE_ID } from "./device.js";

// Debe coincidir con la VAPID_PUBLIC_KEY configurada en Vercel
const VAPID_PUBLIC_KEY = "BOH05ykgs-MQZRuk7mCpNVF7jbYhyix_BKAFoLRSIGxyIZQFM2YU1ttNkjwTgKUoOgcoKeVSEy-9q8PefNe0bpw";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

export const pushSupported = () =>
  typeof Notification !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

// Registra el Service Worker y suscribe este dispositivo a notificaciones push reales
// (funcionan con la app cerrada, siempre que el navegador lo permita).
export async function subscribeToPush() {
  try {
    if (!pushSupported()) return false;

    await navigator.serviceWorker.register("/sw.js");
    const reg = await navigator.serviceWorker.ready;
    const appKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

    let sub = await reg.pushManager.getSubscription();
    // Si la suscripción se creó con otra clave VAPID, el servidor no puede usarla: la renovamos
    const oldKey = sub?.options?.applicationServerKey;
    if (sub && oldKey && new Uint8Array(oldKey).toString() !== appKey.toString()) {
      await sub.unsubscribe();
      sub = null;
    }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });

    const res = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON(), deviceId: DEVICE_ID })
    });
    return res.ok;
  } catch (err) {
    console.error("Error activando notificaciones push:", err);
    return false;
  }
}

// En Android "new Notification()" lanza error: hay que usar el Service Worker
export function showLocalNotification(title, body) {
  navigator.serviceWorker?.ready
    .then((reg) => reg.showNotification(title, { body, tag: "mj-local", icon: "/icon-192.png", badge: "/badge-96.png" }))
    .catch(() => {});
}

// Pide al servidor un aviso de prueba para este móvil (llega a los 10 s)
export async function sendTestPush() {
  const res = await fetch("/api/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ test: true, deviceId: DEVICE_ID })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
}

export function clearAppBadge() {
  try { navigator.clearAppBadge?.(); } catch { /* no soportado */ }
  navigator.serviceWorker?.controller?.postMessage({ type: "mj-clear-badge" });
}
