import { uid } from "./format.js";

// Identificador de este móvil/navegador (para no notificarse a sí mismo)
export const DEVICE_ID = (() => {
  try {
    let id = localStorage.getItem("mj_device_id");
    if (!id) {
      id = uid();
      localStorage.setItem("mj_device_id", id);
    }
    return id;
  } catch {
    return uid();
  }
})();

// Nombre de quien usa este móvil (aparece en las notificaciones: "M&J · Meli")
const USER_NAME_KEY = "mj_user_name";
export const readUserName = () => { try { return localStorage.getItem(USER_NAME_KEY) || ""; } catch { return ""; } };
export const writeUserName = (n) => { try { localStorage.setItem(USER_NAME_KEY, n); } catch { /* sin almacenamiento */ } };
