import { useState, useEffect, useCallback } from "react";
import { pushSupported, subscribeToPush, showLocalNotification } from "../lib/push.js";

// Permiso de notificaciones + suscripción push de este móvil
export function usePushNotifications(notify) {
  const [permission, setPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );

  // Si ya se concedió permiso antes, renovamos la suscripción en silencio al abrir la app
  useEffect(() => {
    if (permission === "granted") subscribeToPush();
  }, [permission]);

  const enable = useCallback(async () => {
    if (!pushSupported()) {
      // En iPhone solo funcionan si la app está añadida a la pantalla de inicio
      notify("Para recibir avisos en iPhone: Compartir → Añadir a pantalla de inicio y abre la app desde ahí.", "error");
      return;
    }
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== "granted") return notify("No se han activado las notificaciones.", "error");
    const ok = await subscribeToPush();
    notify(ok ? "Notificaciones activadas 🔔" : "Permiso concedido, pero no se pudo completar la suscripción.", ok ? "success" : "error");
    if (ok) showLocalNotification("M&J 🦄", "¡Notificaciones activadas! Os avisaremos de cada cambio.");
  }, [notify]);

  return { permission, enable };
}
