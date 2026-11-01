// Novedades de cada actualización. Para publicar una nueva, añade una entrada AL PRINCIPIO con otra
// `version`: la ventana volverá a salir una vez en cada dispositivo.
// highlights = lo que se ve al abrir; details = lo que aparece al pulsar "Mostrar más".
export const CHANGELOG = [
  {
    version: "2026-11-02",
    title: "Adiós a los duplicados",
    highlights: [
      "🔁 Los recurrentes ya no se cobran dos veces si los pasaste a mano.",
      "⚠️ Si vas a añadir algo repetido, la app te pide confirmación.",
      "🎃 Pantalla de carga de Halloween con música, hasta el 2 de noviembre."
    ],
    details: [
      "Un recurrente se da por pagado si hay un movimiento con el mismo concepto, sobre, tipo e importe a 14 días o menos de su fecha de cobro.",
      "Dos reglas iguales solo cobran una vez al mes.",
      "La confirmación de duplicados aparece en movimientos, nóminas, traspasos, ajustes, sobres, fuentes y reglas recurrentes.",
      "Corregido un error de envío de notificaciones: las suscripciones antiguas que ya no funcionan se borran solas.",
      "Halloween: unicornio con sombrero de bruja, luna, murciélagos y calabazas. Si el móvil bloquea el sonido, toca la pantalla para activar la música."
    ]
  }
];

const SEEN_KEY = "mj_seen_version";
export const LATEST = CHANGELOG[0];

export const hasUnseenUpdate = () => {
  try { return localStorage.getItem(SEEN_KEY) !== LATEST.version; } catch { return false; }
};
export const markUpdateSeen = () => {
  try { localStorage.setItem(SEEN_KEY, LATEST.version); } catch { /* sin almacenamiento */ }
};
