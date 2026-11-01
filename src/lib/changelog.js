// Novedades de cada actualización. Para publicar una nueva, añade una entrada AL PRINCIPIO con otra
// `version`: la ventana volverá a salir una vez en cada dispositivo.
// highlights = lo que se ve al abrir; details = lo que aparece al pulsar "Mostrar más".
export const CHANGELOG = [
  {
    version: "2026-11-04",
    title: "Ya huele a Navidad",
    highlights: [
      "🎄 Del 1 de diciembre al 6 de enero, pantalla de carga navideña con música.",
      "🎃 Corregido: la pantalla de Halloween ya no sale fuera de sus fechas."
    ],
    details: [
      "Unicornio con gorro de Papá Noel, nieve, luces, árboles, regalos y Jingle Bells.",
      "Si el móvil bloquea el sonido, toca la pantalla para activar la música."
    ]
  },
  {
    version: "2026-11-03",
    title: "Más seguridad y menos trabajo",
    highlights: [
      "🔐 La app ahora pide un PIN de acceso, una sola vez en cada móvil.",
      "💸 Reparte la nómina entre sobres y apunta tus gastos habituales con un toque.",
      "📊 Nuevo gráfico del último año y quién debe a quién en el ciclo."
    ],
    details: [
      "Los PIN de los sobres se comprueban en el servidor, con límite de intentos.",
      "Además de las 50 últimas versiones, ahora se guarda una copia diaria durante 35 días.",
      "Al eliminar o vaciar un sobre, solo vuelve al Fondo General el dinero que quedaba sin gastar.",
      "Las reglas recurrentes ya se pueden editar y avisan si el sobre no tiene saldo suficiente.",
      "Desliza un movimiento a la izquierda para borrarlo o a la derecha para editarlo.",
      "Los sobres con meta pueden tener fecha: la app calcula cuánto meter al mes."
    ]
  },
  {
    version: "2026-11-02",
    title: "Adiós a los duplicados",
    highlights: [
      "🔁 Los recurrentes ya no se cobran dos veces si los pasaste a mano.",
      "⚠️ Si vas a añadir algo repetido, la app te pide confirmación."
    ],
    details: [
      "Un recurrente se da por pagado si hay un movimiento con el mismo concepto, sobre, tipo e importe a 14 días o menos de su fecha de cobro.",
      "Dos reglas iguales solo cobran una vez al mes.",
      "La confirmación de duplicados aparece en movimientos, nóminas, traspasos, ajustes, sobres, fuentes y reglas recurrentes.",
      "Corregido un error de envío de notificaciones: las suscripciones antiguas que ya no funcionan se borran solas."
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
