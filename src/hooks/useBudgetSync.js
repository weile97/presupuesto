import { useState, useEffect, useRef, useCallback } from "react";
import { API_URL } from "../lib/constants.js";
import { DEVICE_ID } from "../lib/device.js";
import { mergeData, splitRemote } from "../lib/merge.js";
import { clearAppBadge } from "../lib/push.js";
import { runAutomations, describeChanges } from "../shared.js";

const POLL_MS = 15000;

/**
 * Datos compartidos con el servidor (Vercel + Redis):
 * - Carga inicial, guardado con control de versión y fusión si los dos móviles editan a la vez.
 * - Refresco al volver a la app, al recuperar conexión, al llegar un push y cada 15 s (solo visible).
 * - Automatizaciones (cambio de ciclo del día 29 y recurrentes).
 * Los avisos (errores, cambios de la pareja) se comunican mediante `onMessage(text, type)`.
 */
export function useBudgetSync({ userName, onMessage }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const revRef = useRef("0");        // versión del servidor sobre la que trabajamos
  const baseRef = useRef(null);      // último estado confirmado por el servidor
  const dataRef = useRef(null);      // estado local más reciente
  const pendingRef = useRef(false);  // hay cambios locales sin guardar
  const busyRef = useRef(false);     // hay un guardado en curso
  const saveChainRef = useRef(Promise.resolve());

  // Refs para usar siempre el valor actual sin recrear callbacks
  const userNameRef = useRef(userName);
  const onMessageRef = useRef(onMessage);
  useEffect(() => { userNameRef.current = userName; onMessageRef.current = onMessage; });

  const applyRemote = useCallback((remote) => {
    const [remoteData, rev] = splitRemote(remote);
    revRef.current = rev;
    baseRef.current = remoteData;
    dataRef.current = remoteData;
    setData(remoteData);
    return remoteData;
  }, []);

  const flushSave = useCallback(() => {
    saveChainRef.current = saveChainRef.current.then(async () => {
      if (!pendingRef.current) return;
      pendingRef.current = false;
      busyRef.current = true;
      try {
        for (let attempt = 0; attempt < 4; attempt++) {
          const toSend = dataRef.current;
          const res = await fetch(API_URL, {
            method: "POST",
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: toSend, baseRev: revRef.current })
          });
          const body = await res.json().catch(() => ({}));

          if (res.ok) {
            revRef.current = String(body._rev ?? revRef.current);
            baseRef.current = toSend;
            return;
          }
          if (res.status === 409 && body.data) {
            // La otra persona guardó antes: fusionamos sus cambios con los míos y reintentamos
            const [remoteData, rev] = splitRemote({ ...body.data, _rev: body._rev });
            const merged = mergeData(baseRef.current, dataRef.current, remoteData);
            baseRef.current = remoteData;
            revRef.current = rev;
            dataRef.current = merged;
            setData(merged);
            continue;
          }
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        throw new Error("Demasiados conflictos seguidos");
      } catch (err) {
        console.error("Error guardando datos:", err);
        pendingRef.current = true; // se reintentará al volver la conexión / en el siguiente sondeo
        onMessageRef.current?.("No se pudo guardar. Se reintentará automáticamente.", "error");
      } finally {
        busyRef.current = false;
      }
    });
    return saveChainRef.current;
  }, []);

  // Guarda un nuevo estado completo (actualiza la pantalla al instante y sincroniza en segundo plano)
  const save = useCallback((newData) => {
    const stamped = {
      ...newData,
      lastEditedBy: DEVICE_ID,
      lastEditedName: userNameRef.current || null,
      lastEditedAt: Date.now()
    };
    dataRef.current = stamped;
    pendingRef.current = true;
    setData(stamped);
    flushSave();
  }, [flushSave]);

  const refreshFromServer = useCallback(async () => {
    if (pendingRef.current) return flushSave();
    if (busyRef.current) return;
    try {
      const res = await fetch(API_URL, { cache: "no-store" });
      if (!res.ok) return;
      const remote = await res.json();
      // Si mientras tanto hubo cambios locales o la versión no cambió, no tocamos nada
      if (pendingRef.current || busyRef.current || String(remote._rev ?? "0") === revRef.current) return;
      const prev = dataRef.current;
      const next = applyRemote(remote);
      if (prev && next.lastEditedBy !== DEVICE_ID) {
        const { title, body } = describeChanges(prev, next);
        onMessageRef.current?.(`${title.replace("M&J 🦄 · ", "")}: ${body.split("\n")[0]}`, "success");
      }
    } catch {
      // sin conexión: se intentará en el siguiente ciclo
    }
  }, [applyRemote, flushSave]);

  // Cambio de ciclo del día 29 y recurrentes: si toca, se hace solo al abrir la app
  // (el cron de Vercel también lo hace aunque nadie la abra).
  const runPendingAutomations = useCallback(() => {
    if (pendingRef.current || busyRef.current || !dataRef.current) return;
    const result = runAutomations(dataRef.current);
    if (!result) return;
    save(result.data);
    if (result.messages.length) onMessageRef.current?.(result.messages.join(" "), "success");
  }, [save]);

  // Carga inicial
  useEffect(() => {
    fetch(API_URL, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((remote) => applyRemote(remote))
      .catch((err) => {
        console.error("Error cargando base de datos:", err);
        // No ponemos datos vacíos: mostramos un aviso en vez de aparentar que se ha borrado todo
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, [applyRemote]);

  // Sondeo solo con la app visible (ahorra batería) + refresco inmediato en eventos
  useEffect(() => {
    if (loading) return;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      clearAppBadge();
      refreshFromServer().then(runPendingAutomations);
    };
    const onSwMessage = (e) => { if (e.data?.type === "mj-data-changed") refreshFromServer(); };
    const onBeforeUnload = (e) => { if (pendingRef.current || busyRef.current) e.preventDefault(); };

    tick();
    const interval = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("online", tick);
    window.addEventListener("beforeunload", onBeforeUnload);
    navigator.serviceWorker?.addEventListener("message", onSwMessage);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("online", tick);
      window.removeEventListener("beforeunload", onBeforeUnload);
      navigator.serviceWorker?.removeEventListener("message", onSwMessage);
    };
  }, [loading, refreshFromServer, runPendingAutomations]);

  return { data, loading, loadError, save };
}
