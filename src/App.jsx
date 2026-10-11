import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  PawPrint, UtensilsCrossed, AlertTriangle, Home, Car, ShoppingBag,
  Plane, Gift, Heart, Wallet, Plus, Check, Banknote, PiggyBank,
  Coins, Lock, Eye, EyeOff, ArrowRightLeft, TrendingUp, CreditCard,
  PieChart, Download, Search, Trash2, X, Edit2, RefreshCw, Calendar,
  Landmark, GripVertical, Sparkles, Umbrella, GraduationCap,
  Dumbbell, Baby, Shirt, Smartphone, LayoutGrid, Layers, Settings2,
  History, BellRing
} from "lucide-react";
import { todayLocal, currentCycle, computeFund, isAllocation, isExpenseType, runAutomations, describeChanges } from "./shared.js";

const API_URL = "/api/data";
const EMPTY = Object.freeze([]);
// En pantallas táctiles el arrastre HTML5 captura el gesto y bloquea el scroll
const CAN_DRAG = typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches; // referencia estable para no invalidar los useMemo en cada render

const CAT_ICONS = {
  paw: PawPrint, food: UtensilsCrossed, alert: AlertTriangle, home: Home,
  car: Car, bag: ShoppingBag, plane: Plane, gift: Gift, heart: Heart, wallet: Wallet, coins: Coins,
  piggy: PiggyBank, bank: Landmark, sparkle: Sparkles, umbrella: Umbrella,
  study: GraduationCap, gym: Dumbbell, baby: Baby, clothes: Shirt, phone: Smartphone
};
const CAT_ICON_ORDER = [
  "paw", "food", "alert", "home", "car", "bag", "plane", "gift", "heart", "wallet", "coins",
  "piggy", "bank", "sparkle", "umbrella", "study", "gym", "baby", "clothes", "phone"
];
const SRC_ICONS = { banknote: Banknote, piggy: PiggyBank, wallet: Wallet, gift: Gift, coins: Coins, bank: Landmark };

const PRESET_COLORS = [
  "#F472B6", "#EC4899", "#DB2777", "#F9A8D4", "#FBCFE8", "#E879F9",
  "#D946EF", "#C084FC", "#A855F7", "#8B5CF6", "#7C3AED", "#818CF8",
  "#6366F1", "#4F46E5", "#3B82F6", "#2563EB", "#60A5FA", "#38BDF8",
  "#0EA5E9", "#22D3EE", "#2DD4BF", "#14B8A6", "#10B981", "#059669",
  "#34D399", "#A3E635", "#84CC16", "#BEF264", "#FACC15", "#EAB308",
  "#F59E0B", "#FB923C", "#F97316", "#EA580C", "#F87171", "#EF4444",
  "#DC2626", "#7C2D12", "#78350F", "#64748B"
];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
// Fechas en hora de España (toISOString usa UTC y entre las 00:00 y las 02:00 daba el día anterior)
const todayISO = () => todayLocal();

const fmtDay = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

// Importes: acepta "12,50" o "12.50" (el teclado español usa coma)
const parseAmount = (v) => parseFloat(String(v ?? "").trim().replace(/\s/g, "").replace(",", "."));

const USER_NAME_KEY = "mj_user_name";
const readUserName = () => { try { return localStorage.getItem(USER_NAME_KEY) || ""; } catch { return ""; } };

const TX_PAGE = 40;

const DEVICE_ID = (() => {
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

// Debe coincidir con la VAPID_PUBLIC_KEY configurada en el servidor (api/data.js / api/subscribe.js)
const VAPID_PUBLIC_KEY = "BK4VbfG3I9gIpwvZTVv7oyhZbizLyDtsBqV23D4gc_FqtNtc1zV1CCaCifMpLZtIq-86r6CLJ_eoM-sZ__d1VMM";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// Registra el Service Worker y suscribe este dispositivo a notificaciones push reales
// (funcionan incluso con la app cerrada, siempre que el navegador lo permita).
async function subscribeToPush() {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

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
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
    }

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

// --- Fusión de cambios (cuando los dos móviles editan a la vez) ---------
// base = último estado confirmado por el servidor, local = mis cambios, remote = lo que hay ahora en el servidor.
// Se aplican sobre "remote" solo los elementos que YO he añadido, modificado o borrado respecto a "base".
function mergeById(baseArr = [], localArr = [], remoteArr = []) {
  if (![...baseArr, ...localArr, ...remoteArr].every((x) => x && x.id != null)) return localArr;
  const b = new Map(baseArr.map((x) => [x.id, x]));
  const l = new Map(localArr.map((x) => [x.id, x]));
  const result = new Map(remoteArr.map((x) => [x.id, x]));
  for (const id of b.keys()) if (!l.has(id)) result.delete(id);
  for (const [id, item] of l) {
    const old = b.get(id);
    if (!old || JSON.stringify(old) !== JSON.stringify(item)) result.set(id, item);
  }
  const sameOrder = (x, y) => x.length === y.length && x.every((it, i) => it.id === y[i].id);
  const orderSrc = sameOrder(baseArr, localArr) ? remoteArr : localArr;
  const ordered = orderSrc.filter((x) => result.has(x.id)).map((x) => result.get(x.id));
  const seen = new Set(ordered.map((x) => x.id));
  for (const [id, item] of result) if (!seen.has(id)) ordered.push(item);
  return ordered;
}

function mergeData(base, local, remote) {
  if (!base) return local;
  const merged = { ...remote, ...local };
  for (const k of ["sources", "categories", "transactions", "recurrents"]) {
    merged[k] = mergeById(base[k], local[k], remote[k]);
  }
  for (const k of ["lastActiveMonth", "payrollCycle"]) {
    if (local[k] === base[k]) merged[k] = remote[k];
  }
  return merged;
}

const splitRemote = (remote) => {
  const { _rev, ...rest } = remote || {};
  return [rest, String(_rev ?? "0")];
};

const hashPin =(pin) => (pin ? btoa(pin.trim()) : "");

const isLightColor = (hex) => {
  if (!hex || typeof hex !== "string" || !hex.startsWith("#")) return false;
  const c = hex.substring(1);
  const rgb = parseInt(c.length === 3 ? c.split("").map(x => x + x).join("") : c, 16);
  if (isNaN(rgb)) return false;
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = (rgb >> 0) & 0xff;
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luma > 128;
};

const money = (n) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(
    Math.round(((n || 0) + Number.EPSILON) * 100) / 100
  );

function IconPicker({ icons, order, value, onChange }) {
  return (
    <div className="icon-pick">
      {order.map((key) => {
        const Ico = icons[key];
        return (
          <button
            key={key}
            type="button"
            className={value === key ? "active" : ""}
            onClick={() => onChange(key)}
          >
            <Ico size={16} />
          </button>
        );
      })}
    </div>
  );
}

function ColorPicker({ value, onChange }) {
  return (
    <div className="color-grid">
      {PRESET_COLORS.map((c) => (
        <div
          key={c}
          onClick={() => onChange(c)}
          className={`color-swatch ${value === c ? "active" : ""}`}
          style={{ background: c }}
          title={c}
        />
      ))}
    </div>
  );
}

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`toast toast-${type}`}>
      {type === "success" ? <Check size={16} /> : <AlertTriangle size={16} />}
      <span>{message}</span>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [unlockedCats, setUnlockedCats] = useState({});
  const [selectedCatFilter, setSelectedCatFilter] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRangeFilter, setDateRangeFilter] = useState("all");
  const [toast, setToast] = useState(null);

  const [depositSourceModal, setDepositSourceModal] = useState(null);
  const [customSalaryAmount, setCustomSalaryAmount] = useState("");

  const [showAddSourceModal, setShowAddSourceModal] = useState(false);
  const [editingSourceId, setEditingSourceId] = useState(null);
  const [sourceName, setSourceName] = useState("");
  const [sourceAmount, setSourceAmount] = useState("");
  const [sourceIcon, setSourceIcon] = useState("banknote");
  const [sourceColor, setSourceColor] = useState(PRESET_COLORS[0]);

  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("wallet");
  const [newCatColor, setNewCatColor] = useState(PRESET_COLORS[0]);
  const [newCatHasPin, setNewCatHasPin] = useState(false);
  const [newCatPin, setNewCatPin] = useState("");
  const [newCatGoal, setNewCatGoal] = useState("");
  const [catAdjustAmount, setCatAdjustAmount] = useState("");

  const [viewingCategoryId, setViewingCategoryId] = useState(null);
  const [dragCatId, setDragCatId] = useState(null);
  const [dragOverCatId, setDragOverCatId] = useState(null);
  const [catViewMode, setCatViewMode] = useState("stack"); // "grid" | "stack"
  const [stackEditMode, setStackEditMode] = useState(false);

  const [showBulkPayroll, setShowBulkPayroll] = useState(false);
  const [bulkAmounts, setBulkAmounts] = useState({});

  const [showAddTx, setShowAddTx] = useState(false);
  const [editingTxId, setEditingTxId] = useState(null);
  const [txConcept, setTxConcept] = useState("");
  const [txCategory, setTxCategory] = useState("");
  const [txType, setTxType] = useState("income");
  const [txAmount, setTxAmount] = useState("");
  const [txDate, setTxDate] = useState(todayISO());

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [fromCategory, setFromCategory] = useState("");
  const [toCategory, setToCategory] = useState("");
  const [transferAmount, setTransferAmount] = useState("");

  const [showRecurrentModal, setShowRecurrentModal] = useState(false);
  const [recConcept, setRecConcept] = useState("");
  const [recCategory, setRecCategory] = useState("");
  const [recType, setRecType] = useState("expense");
  const [recAmount, setRecAmount] = useState("");
  const [recDay, setRecDay] = useState("1");

  const showNotification = (message, type = "success") => {
    setToast({ message, type });
  };
  // Estable entre renders: si no, el temporizador del toast se reinicia en cada render y no se cierra
  const closeToast = useCallback(() => setToast(null), []);

  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );

  // Nombre de quien usa este móvil (aparece en las notificaciones: "M&J · Meli")
  const [userName, setUserName] = useState(readUserName);
  const [showNameSheet, setShowNameSheet] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const userNameRef = useRef(userName);
  useEffect(() => { userNameRef.current = userName; }, [userName]);

  function saveUserName() {
    const n = nameDraft.trim().slice(0, 24);
    if (!n) return showNotification("Escribe tu nombre.", "error");
    try { localStorage.setItem(USER_NAME_KEY, n); } catch { /* sin almacenamiento */ }
    setUserName(n);
    setShowNameSheet(false);
    showNotification(`¡Hola, ${n}! 👋`);
  }

  const [txPaging, setTxPaging] = useState({ key: "", n: TX_PAGE });

  // Solo un formulario abierto a la vez (se muestran como hoja inferior en el móvil)
  function closeForms() {
    setShowAddSourceModal(false); setEditingSourceId(null);
    setDepositSourceModal(null);
    setShowBulkPayroll(false);
    setShowTransferModal(false);
    setShowAddCategory(false); setEditingCategoryId(null);
    setShowRecurrentModal(false);
    setShowAddTx(false); setEditingTxId(null);
    setShowNameSheet(false);
  }

  function enableNotifications() {
    if (!userNameRef.current) {
      setNameDraft("");
      setShowNameSheet(true);
    }
    if (typeof Notification === "undefined" || !("serviceWorker" in navigator)) {
      // En iPhone solo funcionan si la app está añadida a la pantalla de inicio
      return showNotification("Para recibir avisos en iPhone: Compartir → Añadir a pantalla de inicio y abre la app desde ahí.", "error");
    }
    Notification.requestPermission().then(async (perm) => {
      setNotifPermission(perm);
      if (perm === "granted") {
        const ok = await subscribeToPush();
        showNotification(ok ? "Notificaciones activadas 🔔" : "Permiso concedido, pero no se pudo completar la suscripción push.", ok ? "success" : "error");
        // En Android "new Notification()" lanza error: hay que usar el Service Worker
        navigator.serviceWorker.ready
          .then((reg) => reg.showNotification("M&J 🦄", { body: "¡Notificaciones activadas! Os avisaremos de cada cambio.", tag: "mj-welcome", icon: "/icon-192.png", badge: "/badge-96.png" }))
          .catch(() => {});
      } else {
        showNotification("No se han activado las notificaciones.", "error");
      }
    });
  }

  // Si ya se había concedido permiso en una sesión anterior, renovamos la suscripción push silenciosamente.
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      subscribeToPush();
    }
  }, []);

  const [loadError, setLoadError] = useState(false);

  // --- Sincronización con el servidor ---------------------------------
  const revRef = useRef("0");        // versión del servidor sobre la que trabajamos
  const baseRef = useRef(null);      // último estado confirmado por el servidor
  const dataRef = useRef(null);      // estado local más reciente
  const pendingRef = useRef(false);  // hay cambios locales sin guardar
  const busyRef = useRef(false);     // hay un guardado en curso
  const saveChainRef = useRef(Promise.resolve());

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
        setToast({ message: "No se pudo guardar. Se reintentará automáticamente.", type: "error" });
      } finally {
        busyRef.current = false;
      }
    });
    return saveChainRef.current;
  }, []);

  const refreshFromServer = useCallback(async (notify = true) => {
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
      if (notify && prev && next.lastEditedBy !== DEVICE_ID) {
        const { title, body } = describeChanges(prev, next);
        setToast({ message: `${title.replace("M&J 🦄 · ", "")}: ${body.split("\n")[0]}`, type: "success" });
      }
    } catch {
      // sin conexión: se intentará en el siguiente ciclo
    }
  }, [applyRemote, flushSave]);

  useEffect(() => {
    fetch(API_URL, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((remote) => {
        applyRemote(remote);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error cargando base de datos:", err);
        // Importante: NO ponemos data en un objeto vacío. Si el servidor falla,
        // mostramos un aviso claro en vez de dar la impresión de que se han borrado los datos.
        setLoadError(true);
        setLoading(false);
      });
  }, [applyRemote]);

  useEffect(() => {
    const activeUnlocked = Object.keys(unlockedCats).filter((id) => unlockedCats[id]);
    if (activeUnlocked.length === 0) return;

    const timer = setTimeout(() => {
      setUnlockedCats({});
      showNotification("Protección activada: Categorías bloqueadas.", "error");
    }, 60000);

    return () => clearTimeout(timer);
  }, [unlockedCats]);

  const updateDataAndSave = useCallback((newData) => {
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

  // Cambio de ciclo del día 29 y recurrentes: si toca, se hace solo al abrir la app
  // (el cron de Vercel lo hace también aunque nadie la abra).
  const runPendingAutomations = useCallback(() => {
    if (pendingRef.current || busyRef.current || !dataRef.current) return;
    const result = runAutomations(dataRef.current);
    if (!result) return;
    updateDataAndSave(result.data);
    if (result.messages.length) setToast({ message: result.messages.join(" "), type: "success" });
  }, [updateDataAndSave]);

  // Sondeo: solo con la app visible (ahorra batería); al volver a primer plano, al recuperar
  // conexión o al llegar un push, se refresca al instante.
  useEffect(() => {
    if (loading) return;
    const clearBadge = () => {
      try { navigator.clearAppBadge?.(); } catch { /* no soportado */ }
      navigator.serviceWorker?.controller?.postMessage({ type: "mj-clear-badge" });
    };
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      clearBadge();
      refreshFromServer().then(runPendingAutomations);
    };
    tick();
    const interval = setInterval(tick, 15000);
    const onSwMessage = (e) => { if (e.data?.type === "mj-data-changed") refreshFromServer(); };
    const onBeforeUnload = (e) => { if (pendingRef.current || busyRef.current) e.preventDefault(); };

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

  // Bloquea el scroll de la página mientras hay una hoja/modal abierta
  const anySheetOpen = !!(showAddSourceModal || depositSourceModal || showBulkPayroll || showTransferModal ||
    showAddCategory || showRecurrentModal || showAddTx || showNameSheet);
  useEffect(() => {
    const locked = anySheetOpen || !!viewingCategoryId;
    document.body.style.overflow = locked ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [anySheetOpen, viewingCategoryId]);

  const sources = data?.sources || EMPTY;
  const categories = data?.categories || EMPTY;
  const transactions = data?.transactions || EMPTY;
  const recurrents = data?.recurrents || EMPTY;
  const cycle = currentCycle();

  // Balances del ciclo actual (desde el día 29)
  const fund = useMemo(() => computeFund(transactions), [transactions]);
  const totalBaseIncome = fund.income;
  const totalAssignedToCategories = fund.assigned;
  const globalUnallocated = fund.available;
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const categoryBalances = useMemo(() => {
    const map = {};
    for (const c of categories) {
      map[c.id] = { income: 0, expense: 0, balance: c.initialBalance || 0 };
    }
    for (const t of transactions) {
      if (!t.categoryId || !map[t.categoryId]) continue;
      if (t.type === "income" || t.type === "transfer_income" || t.type === "adjustment_income") map[t.categoryId].income += (t.amount || 0);
      if (t.type === "expense" || t.type === "transfer_expense" || t.type === "adjustment_expense") map[t.categoryId].expense += (t.amount || 0);
    }
    for (const c of categories) {
      if (map[c.id]) {
        map[c.id].balance += map[c.id].income - map[c.id].expense;
      }
    }
    return map;
  }, [categories, transactions]);

  // Funciones de Nómina / Fuentes de Ingreso
  function openSalaryModal(src) {
    closeForms();
    setDepositSourceModal(src);
    setCustomSalaryAmount(src.amount ? src.amount.toString() : "");
  }

  function confirmSalaryDeposit() {
    if (!depositSourceModal) return;

    const amt = parseAmount(customSalaryAmount);
    if (isNaN(amt) || amt <= 0) {
      return showNotification("Ingresa un importe de nómina válido.", "error");
    }

    const newTx = {
      id: uid(),
      concept: `Nómina: ${depositSourceModal.name}`,
      categoryId: null,
      sourceId: depositSourceModal.id,
      type: "payroll_income",
      amount: amt,
      date: todayISO()
    };

    updateDataAndSave({
      ...data,
      transactions: [newTx, ...transactions]
    });

    showNotification(`Se han añadido ${money(amt)} al Fondo General.`);
    setDepositSourceModal(null);
    setCustomSalaryAmount("");
  }

  function openBulkPayrollModal() {
    closeForms();
    if (sources.length === 0) {
      return showNotification("No hay fuentes de nómina configuradas.", "error");
    }
    const initial = {};
    sources.forEach((s) => { initial[s.id] = s.amount ? s.amount.toString() : ""; });
    setBulkAmounts(initial);
    setShowBulkPayroll(true);
  }

  function lastPayrollFor(sourceId) {
    const txs = transactions
      .filter((t) => t.type === "payroll_income" && t.sourceId === sourceId)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    return txs[0] || null;
  }

  function confirmBulkPayroll() {
    const newTransactions = [];
    for (const src of sources) {
      const amt = parseAmount(bulkAmounts[src.id]);
      if (!isNaN(amt) && amt > 0) {
        newTransactions.push({
          id: uid(),
          concept: `Nómina: ${src.name}`,
          categoryId: null,
          sourceId: src.id,
          type: "payroll_income",
          amount: amt,
          date: todayISO()
        });
      }
    }

    if (newTransactions.length === 0) {
      return showNotification("Introduce al menos un importe válido para registrar.", "error");
    }

    const totalAdded = newTransactions.reduce((acc, t) => acc + t.amount, 0);

    updateDataAndSave({
      ...data,
      transactions: [...newTransactions, ...transactions]
    });

    showNotification(`Se han añadido ${money(totalAdded)} al Fondo General.`);
    setShowBulkPayroll(false);
    setBulkAmounts({});
  }

  function openAddSourceModal() {
    closeForms();
    setEditingSourceId(null);
    setSourceName("");
    setSourceAmount("");
    setSourceIcon("banknote");
    setSourceColor(PRESET_COLORS[0]);
    setShowAddSourceModal(true);
  }

  function openEditSourceModal(src, e) {
    closeForms();
    e.stopPropagation();
    setEditingSourceId(src.id);
    setSourceName(src.name);
    setSourceAmount(src.amount ? src.amount.toString() : "");
    setSourceIcon(src.icon || "banknote");
    setSourceColor(src.color || PRESET_COLORS[0]);
    setShowAddSourceModal(true);
  }

  function saveSource() {
    const name = sourceName.trim();
    const amt = parseAmount(sourceAmount);
    if (!name || isNaN(amt) || amt < 0) {
      return showNotification("Ingresa un nombre e importe de referencia válidos.", "error");
    }

    if (editingSourceId) {
      const updatedSources = sources.map((s) =>
        s.id === editingSourceId
          ? { ...s, name, amount: amt, icon: sourceIcon, color: sourceColor }
          : s
      );
      updateDataAndSave({ ...data, sources: updatedSources });
      showNotification("Fuente de nómina actualizada.");
    } else {
      const newSource = {
        id: uid(),
        name,
        amount: amt,
        icon: sourceIcon,
        color: sourceColor
      };
      updateDataAndSave({ ...data, sources: [...sources, newSource] });
      showNotification("Fuente de nómina añadida.");
    }

    setShowAddSourceModal(false);
    setEditingSourceId(null);
  }

  function deleteSource(srcId, e) {
    e.stopPropagation();
    if (window.confirm("¿Eliminar esta fuente de nómina?")) {
      updateDataAndSave({
        ...data,
        sources: sources.filter((s) => s.id !== srcId)
      });
      showNotification("Fuente de nómina eliminada.");
    }
  }

  // Funciones de Categorías
  function openAddCategoryModal() {
    closeForms();
    setEditingCategoryId(null);
    setNewCatName(""); setNewCatIcon("wallet"); setNewCatColor(PRESET_COLORS[0]);
    setNewCatHasPin(false); setNewCatPin(""); setNewCatGoal("");
    setCatAdjustAmount("");
    setShowAddCategory(true);
  }

  function openEditCategoryModal(cat, e) {
    if (e) e.stopPropagation();
    if (cat?.hasPin && !unlockedCats[cat.id]) {
      const pinEntered = prompt(`PIN requerido para editar "${cat.name}":`);
      if (!pinEntered || (hashPin(pinEntered) !== cat.pinHash && pinEntered !== cat.pin)) {
        return showNotification("Contraseña incorrecta.", "error");
      }
    }
    closeForms();
    setEditingCategoryId(cat.id);
    setNewCatName(cat.name);
    setNewCatIcon(cat.icon || "wallet");
    setNewCatColor(cat.color || PRESET_COLORS[0]);
    setNewCatHasPin(!!cat.hasPin);
    setNewCatPin(cat.pin || "");
    setNewCatGoal(cat.targetGoal ? cat.targetGoal.toString() : "");
    setCatAdjustAmount("");
    setShowAddCategory(true);
  }

  function saveCategory() {
    const name = newCatName.trim();
    if (!name) return showNotification("Ingresa un nombre para la categoría.", "error");
    if (newCatHasPin && !newCatPin.trim()) return showNotification("Asigna un PIN a la categoría.", "error");

    const goalParsed = parseAmount(newCatGoal);

    if (editingCategoryId) {
      const updatedCats = categories.map((c) =>
        c.id === editingCategoryId
          ? {
              ...c,
              name,
              icon: newCatIcon,
              color: newCatColor,
              hasPin: newCatHasPin,
              pinHash: newCatHasPin ? hashPin(newCatPin) : "",
              pin: newCatHasPin ? newCatPin.trim() : "",
              targetGoal: isNaN(goalParsed) ? 0 : goalParsed
            }
          : c
      );
      updateDataAndSave({ ...data, categories: updatedCats });
      showNotification("Sobre actualizado.");
    } else {
      const newCat = {
        id: uid(),
        name,
        icon: newCatIcon,
        color: newCatColor,
        hasPin: newCatHasPin,
        pinHash: newCatHasPin ? hashPin(newCatPin) : "",
        pin: newCatHasPin ? newCatPin.trim() : "",
        targetGoal: isNaN(goalParsed) ? 0 : goalParsed,
        initialBalance: 0
      };
      updateDataAndSave({ ...data, categories: [...categories, newCat] });
      showNotification("Categoría creada con éxito.");
    }

    setNewCatName(""); setNewCatIcon("wallet"); setNewCatColor(PRESET_COLORS[0]); setNewCatHasPin(false); setNewCatPin(""); setNewCatGoal("");
    setShowAddCategory(false); setEditingCategoryId(null); setCatAdjustAmount("");
  }

  function applyCategoryAdjustment(catId) {
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;
    const amt = parseAmount(catAdjustAmount);
    if (isNaN(amt) || amt === 0) {
      return showNotification("Ingresa una cantidad válida para el ajuste (positiva o negativa).", "error");
    }

    const newTx = {
      id: uid(),
      concept: `Ajuste manual de saldo: ${cat.name}`,
      categoryId: catId,
      sourceId: null,
      type: amt > 0 ? "adjustment_income" : "adjustment_expense",
      amount: Math.abs(amt),
      date: todayISO()
    };

    updateDataAndSave({ ...data, transactions: [newTx, ...transactions] });
    setCatAdjustAmount("");
    showNotification(`Saldo de "${cat.name}" ajustado en ${amt > 0 ? "+" : ""}${money(amt)}. No afecta al Fondo General.`);
  }

  function moveCategory(dragId, targetId) {
    if (!dragId || dragId === targetId) return;
    const fromIdx = categories.findIndex((c) => c.id === dragId);
    const toIdx = categories.findIndex((c) => c.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const reordered = [...categories];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    updateDataAndSave({ ...data, categories: reordered });
  }

  function deleteCategory(id, e) {
    e.stopPropagation();
    const cat = categories.find((c) => c.id === id);
    if (cat?.hasPin && prompt(`Contraseña para eliminar "${cat.name}":`) !== cat.pin) {
      return showNotification("Contraseña incorrecta.", "error");
    }
    if (!window.confirm(`¿Seguro que quieres eliminar el sobre "${cat?.name}"? Se borrará también su historial de movimientos. Esta acción no se puede deshacer.`)) {
      return;
    }
    if (selectedCatFilter === id) setSelectedCatFilter(null);

    updateDataAndSave({
      ...data,
      categories: categories.filter((c) => c.id !== id),
      transactions: transactions.filter((t) => t.categoryId !== id)
    });
    showNotification("Categoría eliminada.");
  }

  function clearCategoryTransactions(catId, e) {
    e.stopPropagation();
    const cat = categories.find((c) => c.id === catId);
    if (cat?.hasPin && prompt(`PIN para vaciar "${cat.name}":`) !== cat.pin) {
      return showNotification("Contraseña incorrecta.", "error");
    }

    if (window.confirm(`¿Vaciar historial de "${cat.name}"?`)) {
      updateDataAndSave({
        ...data,
        transactions: transactions.filter((t) => t.categoryId !== catId)
      });
      showNotification("Historial de categoría limpiado.");
    }
  }

  function clearAllTransactions() {
    if (window.confirm("⚠️ ¿Vaciar todo el historial de movimientos del proyecto?")) {
      updateDataAndSave({ ...data, transactions: [] });
      showNotification("Historial global vaciado.");
    }
  }

  function toggleUnlockCategory(cat, e) {
    e.stopPropagation();
    if (unlockedCats[cat.id]) {
      setUnlockedCats((prev) => ({ ...prev, [cat.id]: false }));
    } else {
      const pinEntered = prompt(`Contraseña para "${cat.name}":`);
      if (pinEntered && (hashPin(pinEntered) === cat.pinHash || pinEntered === cat.pin)) {
        setUnlockedCats((prev) => ({ ...prev, [cat.id]: true }));
        showNotification(`Categoría "${cat.name}" desbloqueada.`);
      } else if (pinEntered !== null) {
        showNotification("Contraseña incorrecta.", "error");
      }
    }
  }

  // Funciones de Transacciones
  // preset: { type, categoryId } para abrir el formulario ya rellenado (botón +, accesos de un sobre)
  function openAddTxModal(preset = {}) {
    closeForms();
    setViewingCategoryId(null);
    setEditingTxId(null);
    setTxConcept("");
    setTxCategory(preset.categoryId || "");
    setTxType(preset.type || "expense");
    setTxAmount("");
    setTxDate(todayISO());
    setShowAddTx(true);
  }

  function openEditTxModal(t, e) {
    e.stopPropagation();
    const cat = categories.find((c) => c.id === t.categoryId);
    if (cat?.hasPin && !unlockedCats[cat.id]) {
      const pinEntered = prompt(`PIN requerido para modificar este movimiento de "${cat.name}":`);
      if (!pinEntered || (hashPin(pinEntered) !== cat.pinHash && pinEntered !== cat.pin)) {
        return showNotification("Contraseña incorrecta.", "error");
      }
    }

    closeForms();
    setEditingTxId(t.id);
    setTxConcept(t.concept);
    setTxCategory(t.categoryId || "");
    setTxType(t.type);
    setTxAmount(t.amount.toString());
    setTxDate(t.date || todayISO());
    setShowAddTx(true);
  }

  function deleteSingleTransaction(tId, e) {
    e.stopPropagation();
    const t = transactions.find((item) => item.id === tId);
    if (!t) return;

    const cat = categories.find((c) => c.id === t.categoryId);
    if (cat?.hasPin && !unlockedCats[cat.id]) {
      const pinEntered = prompt(`PIN requerido para eliminar este movimiento de "${cat.name}":`);
      if (!pinEntered || (hashPin(pinEntered) !== cat.pinHash && pinEntered !== cat.pin)) {
        return showNotification("Contraseña incorrecta.", "error");
      }
    }

    if (window.confirm(`¿Eliminar la transacción "${t.concept}"?`)) {
      updateDataAndSave({
        ...data,
        transactions: transactions.filter((item) => item.id !== tId)
      });
      showNotification("Movimiento eliminado.");
    }
  }

  function saveTransaction() {
    const amt = parseAmount(txAmount);

    if (!txConcept.trim() || isNaN(amt) || amt <= 0 || !txCategory) {
      return showNotification("Completa todos los campos correctamente.", "error");
    }

    const selectedCat = categories.find((c) => c.id === txCategory);

    if (selectedCat?.hasPin && !unlockedCats[selectedCat.id]) {
      const pinEntered = prompt(`PIN requerido para "${selectedCat.name}":`);
      if (!pinEntered || (hashPin(pinEntered) !== selectedCat.pinHash && pinEntered !== selectedCat.pin)) {
        return showNotification("Contraseña incorrecta.", "error");
      }
    }

    if (txType === "income") {
      // Lo asignado en ciclos anteriores (settled) ya no cuenta en el Fondo General de este ciclo
      const editing = editingTxId ? transactions.find((t) => t.id === editingTxId) : null;
      const previousAmount = editing && isAllocation(editing) && !editing.settled ? editing.amount || 0 : 0;
      if (globalUnallocated + previousAmount < amt) {
        return showNotification("Saldo insuficiente en el Fondo General para asignar.", "error");
      }
    }

    if (editingTxId) {
      const updatedTxs = transactions.map((t) => {
        if (t.id === editingTxId) {
          return {
            ...t,
            concept: txConcept.trim(),
            categoryId: txCategory,
            type: txType,
            amount: amt,
            date: txDate || todayISO()
          };
        }
        return t;
      });
      updateDataAndSave({ ...data, transactions: updatedTxs });
      showNotification("Movimiento actualizado.");
    } else {
      const newTx = {
        id: uid(),
        concept: txConcept.trim(),
        categoryId: txCategory,
        sourceId: null,
        type: txType,
        amount: amt,
        date: txDate || todayISO()
      };
      updateDataAndSave({ ...data, transactions: [newTx, ...transactions] });
      showNotification("Movimiento registrado correctamente.");
    }

    setShowAddTx(false);
    setEditingTxId(null);
    setTxConcept("");
    setTxAmount("");
  }

  // Recurrentes
  function addRecurrentRule() {
    const amt = parseAmount(recAmount);
    const day = parseInt(recDay, 10);

    if (!recConcept.trim() || isNaN(amt) || amt <= 0 || !recCategory || isNaN(day) || day < 1 || day > 31) {
      return showNotification("Ingresa datos válidos para la regla recurrente.", "error");
    }

    const newRec = {
      id: uid(),
      concept: recConcept.trim(),
      categoryId: recCategory,
      type: recType,
      amount: amt,
      day,
      // Si el día de este mes ya pasó, empieza a aplicarse el mes que viene
      startMonth: (() => {
        const t = todayISO();
        const [y, m, d] = t.split("-").map(Number);
        if (day >= d) return t.slice(0, 7);
        return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
      })()
    };

    updateDataAndSave({
      ...data,
      recurrents: [...recurrents, newRec]
    });

    setRecConcept("");
    setRecAmount("");
    setRecCategory("");
    setShowRecurrentModal(false);
    showNotification(`Regla programada: se aplicará sola el día ${day} de cada mes.`);
  }

  function deleteRecurrentRule(id) {
    if (!window.confirm("¿Eliminar esta regla recurrente?")) return;
    updateDataAndSave({
      ...data,
      recurrents: recurrents.filter((r) => r.id !== id)
    });
    showNotification("Regla recurrente eliminada.");
  }

  function processMonthlyRecurrents() {
    if (recurrents.length === 0) {
      return showNotification("No hay automatizaciones recurrentes configuradas.", "error");
    }

    const currentYearMonth = todayISO().slice(0, 7);
    let appliedCount = 0;
    const newTransactions = [...transactions];

    for (const rec of recurrents) {
      const dateStr = `${currentYearMonth}-${String(rec.day).padStart(2, "0")}`;
      const alreadyApplied = transactions.some(
        (t) => t.recurrentId === rec.id && (t.date || "").startsWith(currentYearMonth)
      );

      if (!alreadyApplied) {
        newTransactions.unshift({
          // Mismo id que usa la automatización: nunca se aplica dos veces el mismo mes
          id: `rec-${rec.id}-${currentYearMonth}`,
          recurrentId: rec.id,
          concept: rec.concept,
          categoryId: rec.categoryId,
          sourceId: null,
          type: rec.type,
          amount: rec.amount,
          date: dateStr
        });
        appliedCount++;
      }
    }

    if (appliedCount === 0) {
      return showNotification("Todos los recurrentes de este mes ya fueron aplicados.", "error");
    }

    updateDataAndSave({ ...data, transactions: newTransactions });
    showNotification(`Se aplicaron ${appliedCount} cargos/ingresos recurrentes.`);
  }

  // Traspasos entre categorías
  function handleTransferBetweenCategories() {
    const amt = parseAmount(transferAmount);
    if (!fromCategory || !toCategory || isNaN(amt) || amt <= 0) {
      return showNotification("Completa los datos de traspaso.", "error");
    }
    if (fromCategory === toCategory) {
      return showNotification("Selecciona dos categorías diferentes.", "error");
    }

    const fromCat = categories.find((c) => c.id === fromCategory);
    const toCat = categories.find((c) => c.id === toCategory);

    if (fromCat?.hasPin && !unlockedCats[fromCat.id]) {
      const pin = prompt(`PIN para debitar de "${fromCat.name}":`);
      if (!pin || (hashPin(pin) !== fromCat.pinHash && pin !== fromCat.pin)) return showNotification("PIN incorrecto.", "error");
    }

    if (toCat?.hasPin && !unlockedCats[toCat.id]) {
      const pin = prompt(`PIN para acreditar en "${toCat.name}":`);
      if (!pin || (hashPin(pin) !== toCat.pinHash && pin !== toCat.pin)) return showNotification("PIN incorrecto.", "error");
    }

    const fromStats = categoryBalances[fromCategory] || { balance: 0 };
    if (fromStats.balance < amt) {
      return showNotification(`Saldo insuficiente en "${fromCat.name}".`, "error");
    }

    const transferTx1 = {
      id: uid(),
      concept: `Traspaso ➔ ${toCat.name}`,
      categoryId: fromCategory,
      sourceId: null,
      type: "transfer_expense",
      amount: amt,
      date: todayISO()
    };

    const transferTx2 = {
      id: uid(),
      concept: `Traspaso desde ${fromCat.name}`,
      categoryId: toCategory,
      sourceId: null,
      type: "transfer_income",
      amount: amt,
      date: todayISO()
    };

    updateDataAndSave({
      ...data,
      transactions: [transferTx1, transferTx2, ...transactions]
    });

    setShowTransferModal(false); setTransferAmount("");
    showNotification(`Traspaso de ${money(amt)} completado.`);
  }

  function exportCSV() {
    const publicTxs = transactions.filter((t) => {
      const cat = categories.find((c) => c.id === t.categoryId);
      return !cat || !cat.hasPin;
    });

    if (publicTxs.length === 0) return showNotification("No hay movimientos públicos para exportar.", "error");

    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    // ";" y BOM para que Excel en español lo abra bien; Blob en vez de data: URI (fallaba con "#" y en móviles)
    let csv = "﻿Fecha;Concepto;Tipo;Importe;Sobre\n";
    publicTxs.forEach((t) => {
      const cat = catById.get(t.categoryId);
      csv += [t.date, esc(t.concept), t.type, String(t.amount).replace(".", ","), esc(cat ? cat.name : "Fondo General")].join(";") + "\n";
    });

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `presupuesto_${todayISO()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const filteredTx = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const from = currentCycle().start;
    return transactions
      .filter((t) => {
        const cat = catById.get(t.categoryId);
        if (cat && cat.hasPin && !unlockedCats[cat.id]) return false;
        if (selectedCatFilter && t.categoryId !== selectedCatFilter) return false;
        if (q && !(t.concept || "").toLowerCase().includes(q)) return false;
        if (dateRangeFilter === "current" && (t.date || "") < from) return false;
        if (dateRangeFilter === "expenses" && !isExpenseType(t.type)) return false;
        return true;
      })
      // Más recientes primero
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [transactions, catById, unlockedCats, selectedCatFilter, searchQuery, dateRangeFilter]);

  // Paginación: al cambiar los filtros se vuelve a la primera página
  const filterKey = `${selectedCatFilter}|${searchQuery}|${dateRangeFilter}`;
  const txLimit = txPaging.key === filterKey ? txPaging.n : TX_PAGE;
  const showMoreTx = () => setTxPaging({ key: filterKey, n: txLimit + TX_PAGE });

  if (loading) return <div className="loading-screen">Cargando datos...</div>;

  if (loadError && !data) {
    return (
      <div className="loading-screen">
        ⚠️ No se han podido cargar los datos del servidor.
        <br />
        <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>
          Esto normalmente es un problema temporal de conexión o del servidor — tus datos guardados no se han borrado.
        </span>
        <br /><br />
        <button className="btn-primary" style={{ margin: "0 auto" }} onClick={() => window.location.reload()}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="app-container">

      {toast && <Toast key={toast.message + toast.type} message={toast.message} type={toast.type} onClose={closeToast} />}

      <header className="header">
        <div className="header-inner">
          <div className="brand">
            <div className="brand-logo">🦄</div>
            <div>
              <div className="brand-title">M&amp;J</div>
              <div className="brand-sub">Ciclo: {fmtDay(cycle.start)} – {fmtDay(cycle.nextStart)}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {notifPermission !== "granted" && (
              <button className="btn-icon-square bell-pulse" onClick={enableNotifications} title="Activar notificaciones">
                <BellRing size={17} />
                <span className="btn-label"> Activar avisos</span>
              </button>
            )}
            <button
              className="btn-icon-square"
              onClick={() => { closeForms(); setNameDraft(userName); setShowNameSheet(true); }}
              title="¿Quién usa este móvil?"
            >
              {userName ? <span className="user-chip">{userName.slice(0, 1).toUpperCase()}</span> : <Heart size={17} />}
            </button>
            <button className="btn-icon-square" onClick={exportCSV} title="Exportar CSV"><Download size={17} /><span className="btn-label"> CSV</span></button>
          </div>
        </div>
      </header>

      <main className="main-content">
        {/* Aviso de ciclo nuevo sin nóminas registradas */}
        {sources.length > 0 && totalBaseIncome === 0 && (
          <div className="cycle-banner">
            <div>
              <div style={{ fontWeight: 800 }}>🗓️ Nuevo ciclo desde el {fmtDay(cycle.start)}</div>
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>Aún no hay nóminas registradas en este ciclo.</div>
            </div>
            <button className="btn-primary" onClick={openBulkPayrollModal}><Plus size={15} /> Registrar nóminas</button>
          </div>
        )}

        {/* Resumen Métricas */}
        <div className="summary-grid">
          <div className="summary-card highlight">
            <div className="summary-label">Fondo General Disponible</div>
            <div className="summary-val" style={{ color: globalUnallocated >= 0 ? "var(--text-main)" : "var(--red)" }}>
              {money(globalUnallocated)}
            </div>
            <div className="summary-sub">
              Sin asignar a sobres{fund.carry !== 0 ? ` · incluye ${money(fund.carry)} del ciclo anterior` : ""}
            </div>
          </div>
          <div className="summary-row">
            <div className="summary-card">
              <div className="summary-label">Nóminas del ciclo</div>
              <div className="summary-val" style={{ color: "var(--green)" }}>{money(totalBaseIncome)}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Asignado a sobres</div>
              <div className="summary-val" style={{ color: "var(--purple-accent)" }}>{money(totalAssignedToCategories)}</div>
            </div>
          </div>
        </div>

        {/* Ingresos de Nómina */}
        <section>
          <div className="section-header">
            <div>
              <div className="section-title"><CreditCard size={18} color="var(--pink-primary)" /> Ingresos de Nómina</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                Registra aquí lo que cobráis cada uno para sumarlo al Fondo General.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-secondary" onClick={openBulkPayrollModal}>
                <RefreshCw size={15} /> Registrar Cobro de Nóminas
              </button>
              <button className="btn-primary" onClick={openAddSourceModal}>
                <Plus size={15} /> Nueva Fuente de Nómina
              </button>
            </div>
          </div>

          {showAddSourceModal && (
            <div className="form-box">
              <h3 style={{ margin: "0 0 14px", fontSize: 15 }}>
                {editingSourceId ? "Editar Fuente de Nómina" : "Añadir Fuente de Nómina"}
              </h3>
              <div className="form-grid">
                <div className="field">
                  <label>Nombre / Concepto</label>
                  <input type="text" value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder="Ej. Empresa X, Trabajo Freelance" />
                </div>
                <div className="field">
                  <label>Importe de Ref. (€)</label>
                  <input type="text" inputMode="decimal" value={sourceAmount} onChange={(e) => setSourceAmount(e.target.value)} placeholder="Ej. 1800" />
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label>Color</label>
                  <ColorPicker value={sourceColor} onChange={setSourceColor} />
                </div>
                <div className="field">
                  <label>Icono</label>
                  <IconPicker icons={SRC_ICONS} order={Object.keys(SRC_ICONS)} value={sourceIcon} onChange={setSourceIcon} />
                </div>
              </div>
              <div className="form-actions">
                <button className="btn-primary" onClick={saveSource}><Check size={15} /> Guardar Fuente</button>
                <button className="btn-secondary" onClick={() => setShowAddSourceModal(false)}>Cancelar</button>
              </div>
            </div>
          )}

          {depositSourceModal && (
            <div className="form-box">
              <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>
                Ingresar Nómina: {depositSourceModal.name}
              </h3>
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 14px" }}>
                Introduce la cantidad exacta cobrada en este periodo:
              </p>
              <div className="form-grid">
                <div className="field">
                  <label>Importe Cobrado (€)</label>
                  <input
                    type="text" inputMode="decimal"
                    value={customSalaryAmount}
                    onChange={(e) => setCustomSalaryAmount(e.target.value)}
                    placeholder="Ej. 1850.50"
                    autoFocus
                  />
                </div>
              </div>
              <div className="form-actions">
                <button className="btn-primary" onClick={confirmSalaryDeposit}><Check size={15} /> Añadir al Fondo General</button>
                <button className="btn-secondary" onClick={() => setDepositSourceModal(null)}>Cancelar</button>
              </div>
            </div>
          )}

          {showBulkPayroll && (
            <div className="form-box">
              <h3 style={{ margin: "0 0 6px", fontSize: 15 }}>Registrar Cobro de Nóminas</h3>
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 16px" }}>
                Revisa o ajusta el importe de cada nómina antes de confirmar. Deja en blanco o en 0 la que no quieras añadir ahora.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {sources.map((s) => {
                  const Icon = SRC_ICONS[s.icon] || Wallet;
                  return (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px" }}>
                      <div className="card-icon" style={{ background: s.color, flexShrink: 0 }}><Icon size={16} /></div>
                      <div style={{ flex: 1, minWidth: 120, fontWeight: 700, fontSize: 13 }}>{s.name}</div>
                      <input
                        type="text" inputMode="decimal"
                        value={bulkAmounts[s.id] ?? ""}
                        onChange={(e) => setBulkAmounts((prev) => ({ ...prev, [s.id]: e.target.value }))}
                        placeholder="0.00"
                        style={{ maxWidth: 140 }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="form-actions">
                <button className="btn-primary" onClick={confirmBulkPayroll}><Check size={15} /> Confirmar Ingresos</button>
                <button className="btn-secondary" onClick={() => setShowBulkPayroll(false)}>Cancelar</button>
              </div>
            </div>
          )}

          {sources.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "30px 20px", color: "var(--text-muted)", fontSize: 13 }}>
              Aún no has añadido ninguna fuente de nómina. Pulsa "Nueva Fuente de Nómina" para empezar.
            </div>
          ) : (
            <div className="grid-3">
              {sources.map((s) => {
                const Icon = SRC_ICONS[s.icon] || Wallet;
                const last = lastPayrollFor(s.id);
                return (
                  <div className="card" key={s.id}>
                    <div className="card-top">
                      <div className="card-icon" style={{ background: s.color }}><Icon size={18} /></div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn-icon" onClick={(e) => openEditSourceModal(s, e)}><Edit2 size={14} /></button>
                        <button className="btn-icon" onClick={(e) => deleteSource(s.id, e)}><X size={14} /></button>
                      </div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{s.name}</div>
                    <div style={{ marginBottom: 6, fontSize: 12, color: "var(--text-muted)" }}>
                      Estimado / Ref: <strong style={{ color: "white" }}>{money(s.amount)}</strong>
                    </div>
                    <div style={{ marginBottom: 14, fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 5 }}>
                      <History size={12} />
                      {last ? `Última: ${money(last.amount)} · ${last.date}` : "Sin nóminas registradas aún"}
                    </div>
                    <button className="btn-secondary" style={{ width: "100%", justifyContent: "center" }} onClick={() => openSalaryModal(s)}>
                      <Plus size={15} /> Registrar Ingreso Individual
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Categorías / Sobres */}
        <section>
          <div className="section-header">
            <div className="section-title">
              {catViewMode === "stack" ? <Layers size={18} color="var(--purple-accent)" /> : <PieChart size={18} color="var(--purple-accent)" />}
              {catViewMode === "stack" ? "Tarjetero de Sobres" : "Categorías de Presupuesto"}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div className="view-toggle">
                <button className={catViewMode === "grid" ? "active" : ""} onClick={() => setCatViewMode("grid")}>
                  <LayoutGrid size={14} /> Cuadrícula
                </button>
                <button className={catViewMode === "stack" ? "active" : ""} onClick={() => setCatViewMode("stack")}>
                  <Layers size={14} /> Tarjetero
                </button>
              </div>
              {catViewMode === "stack" && (
                <button className={`stack-edit-btn ${stackEditMode ? "on" : ""}`} onClick={() => setStackEditMode((v) => !v)}>
                  <Settings2 size={14} /> {stackEditMode ? "Terminar Edición" : "Habilitar Edición"}
                </button>
              )}
              <button className="btn-secondary" onClick={() => { closeForms(); setShowTransferModal(true); }}><ArrowRightLeft size={15} /> Traspaso entre Sobres</button>
              <button className="btn-primary" onClick={openAddCategoryModal}><Plus size={15} /> {catViewMode === "stack" ? "Crear Sobre" : "Nueva Categoría"}</button>
            </div>
          </div>

          {showTransferModal && (
            <div className="form-box">
              <h3 style={{ margin: "0 0 14px", fontSize: 15 }}>Traspasar Fondos Entre Sobres</h3>
              <div className="form-grid">
                <div className="field">
                  <label>Desde Categoría (Origen)</label>
                  <select value={fromCategory} onChange={(e) => setFromCategory(e.target.value)}>
                    <option value="">Selecciona origen...</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name} {c.hasPin ? "🔒" : ""}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Hacia Categoría (Destino)</label>
                  <select value={toCategory} onChange={(e) => setToCategory(e.target.value)}>
                    <option value="">Selecciona destino...</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name} {c.hasPin ? "🔒" : ""}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Importe (€)</label>
                  <input type="text" inputMode="decimal" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} />
                </div>
              </div>
              <div className="form-actions">
                <button className="btn-primary" onClick={handleTransferBetweenCategories}><Check size={15} /> Confirmar Traspaso</button>
                <button className="btn-secondary" onClick={() => setShowTransferModal(false)}>Cancelar</button>
              </div>
            </div>
          )}

          {showAddCategory && (
            <div className="form-box">
              <h3 style={{ margin: "0 0 14px", fontSize: 15 }}>
                {editingCategoryId ? `Editar Sobre: ${categories.find(c => c.id === editingCategoryId)?.name || ""}` : "Crear Categoría con Presupuesto"}
              </h3>
              <div className="form-grid">
                <div className="field">
                  <label>Nombre</label>
                  <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Puedes renombrar el sobre cuando quieras" />
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label>Color de Fondo</label>
                  <ColorPicker value={newCatColor} onChange={setNewCatColor} />
                </div>
                <div className="field">
                  <label>Icono / Sticker</label>
                  <IconPicker icons={CAT_ICONS} order={CAT_ICON_ORDER} value={newCatIcon} onChange={setNewCatIcon} />
                </div>
                <div className="field">
                  <label>Meta / Presupuesto (€)</label>
                  <input type="text" inputMode="decimal" value={newCatGoal} onChange={(e) => setNewCatGoal(e.target.value)} placeholder="Ej. 1000" />
                </div>
              </div>

              <div style={{ margin: "14px 0", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                <input type="checkbox" id="pinCheck" checked={newCatHasPin} onChange={(e) => setNewCatHasPin(e.target.checked)} />
                <label htmlFor="pinCheck" style={{ fontSize: 13, fontWeight: 600 }}>🔒 Proteger con PIN (Oculta del historial y búsquedas)</label>
              </div>

              {newCatHasPin && (
                <div className="field" style={{ maxWidth: 220, marginBottom: 14 }}>
                  <label>Contraseña</label>
                  <input type="password" value={newCatPin} onChange={(e) => setNewCatPin(e.target.value)} />
                </div>
              )}

              {editingCategoryId && (
                <div className="field" style={{ maxWidth: 320, margin: "6px 0 16px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 12, padding: 12 }}>
                  <label style={{ color: "var(--yellow)" }}>Ajustar saldo del sobre (no afecta al Fondo General)</label>
                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    <input
                      type="text" inputMode="decimal"
                      value={catAdjustAmount}
                      onChange={(e) => setCatAdjustAmount(e.target.value)}
                      placeholder="Ej. 50 o -20"
                    />
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ whiteSpace: "nowrap" }}
                      onClick={() => applyCategoryAdjustment(editingCategoryId)}
                    >
                      Aplicar
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                    Usa un número positivo para sumar o negativo (Ej. -20) para restar directamente del saldo de este sobre.
                  </div>
                </div>
              )}

              <div className="form-actions">
                <button className="btn-primary" onClick={saveCategory}><Check size={15} /> {editingCategoryId ? "Guardar Cambios" : "Guardar"}</button>
                <button className="btn-secondary" onClick={() => { setShowAddCategory(false); setEditingCategoryId(null); }}>Cancelar</button>
              </div>
            </div>
          )}

          {categories.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "30px 20px", color: "var(--text-muted)", fontSize: 13 }}>
              Aún no tienes ningún sobre. Pulsa "{catViewMode === "stack" ? "Crear Sobre" : "Nueva Categoría"}" para crear el primero.
            </div>
          ) : catViewMode === "grid" ? (
          <div className="grid-3">
            {categories.map((cat) => {
              const Icon = CAT_ICONS[cat.icon] || Wallet;
              const stats = categoryBalances[cat.id] || { balance: 0, income: 0, expense: 0 };
              const isLocked = cat.hasPin && !unlockedCats[cat.id];
              const isSelected = selectedCatFilter === cat.id;
              const isDragOver = dragOverCatId === cat.id;
              
              const progressPct = cat.targetGoal > 0 ? Math.min(100, (stats.balance / cat.targetGoal) * 100) : 0;
              
              let progressColor = "var(--green)";
              if (progressPct >= 100) progressColor = "var(--red)";
              else if (progressPct >= 75) progressColor = "var(--yellow)";

              const catColor = cat.color || "#151C28";
              const isBgLight = isLightColor(catColor);

              return (
                <div
                  className={`card card-interactive ${isSelected ? "active" : ""} ${isDragOver ? "drag-over" : ""}`}
                  key={cat.id}
                  style={{ backgroundColor: catColor, color: isBgLight ? "#0F172A" : "var(--text-main)" }}
                  onClick={() => setViewingCategoryId(cat.id)}
                  draggable={CAN_DRAG}
                  onDragStart={(e) => { e.stopPropagation(); setDragCatId(cat.id); }}
                  onDragOver={(e) => { e.preventDefault(); if (dragOverCatId !== cat.id) setDragOverCatId(cat.id); }}
                  onDragLeave={() => setDragOverCatId((prev) => (prev === cat.id ? null : prev))}
                  onDrop={(e) => { e.preventDefault(); e.stopPropagation(); moveCategory(dragCatId, cat.id); setDragCatId(null); setDragOverCatId(null); }}
                  onDragEnd={() => { setDragCatId(null); setDragOverCatId(null); }}
                >
                  <div className="card-top">
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="drag-handle" title="Arrastra para reordenar" onClick={(e) => e.stopPropagation()}>
                        <GripVertical size={16} />
                      </span>
                      <div className="card-icon"><Icon size={18} /></div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {cat.hasPin && (
                        <button className="btn-action" onClick={(e) => toggleUnlockCategory(cat, e)}>
                          {isLocked ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                      )}
                      <button className="btn-action" onClick={(e) => openEditCategoryModal(cat, e)} title="Editar sobre">
                        <Edit2 size={14} />
                      </button>
                      <button className="btn-action" onClick={(e) => clearCategoryTransactions(cat.id, e)} title="Limpiar historial">
                        <Trash2 size={14} />
                      </button>
                      <button className="btn-action" onClick={(e) => deleteCategory(cat.id, e)}>
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  <div style={{ fontSize: 16, fontWeight: 800 }}>
                    {cat.name} {cat.hasPin && <Lock size={12} />}
                  </div>

                  <div style={{ marginTop: 10, fontSize: 28, fontWeight: 800 }}>
                    {isLocked ? "••••••" : money(stats.balance)}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 12, fontWeight: 700 }}>
                    <span className={`color-badge ${isBgLight ? "light-bg-income" : "income-contrast"}`}>
                      + {isLocked ? "•••" : money(stats.income)}
                    </span>
                    <span className={`color-badge ${isBgLight ? "light-bg-expense" : "expense-contrast"}`}>
                      - {isLocked ? "•••" : money(stats.expense)}
                    </span>
                  </div>

                  {cat.targetGoal > 0 && !isLocked && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginTop: 10, opacity: 0.85, fontWeight: 600 }}>
                        <span>Presupuesto: {money(cat.targetGoal)}</span>
                        <span>{Math.round(progressPct)}%</span>
                      </div>
                      <div className="progress-bar-bg">
                        <div className="progress-bar-fill" style={{ width: `${progressPct}%`, backgroundColor: progressColor }} />
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: 12, fontSize: 11, opacity: 0.7, fontWeight: 600 }}>
                    Toca para ver movimientos ➔
                  </div>
                </div>
              );
            })}
          </div>
          ) : (
          <div className={`stack-wrap ${stackEditMode ? "editing" : ""}`}>
            {categories.map((cat) => {
              const Icon = CAT_ICONS[cat.icon] || Wallet;
              const stats = categoryBalances[cat.id] || { balance: 0, income: 0, expense: 0 };
              const isLocked = cat.hasPin && !unlockedCats[cat.id];
              const isDragOver = dragOverCatId === cat.id;
              const catColor = cat.color || "#151C28";
              const isBgLight = isLightColor(catColor);

              return (
                <div
                  className={`stack-card ${isDragOver ? "drag-over" : ""}`}
                  key={cat.id}
                  style={{ backgroundColor: catColor, color: isBgLight ? "#0F172A" : "var(--text-main)", zIndex: 1 }}
                  onClick={() => { if (!stackEditMode) setViewingCategoryId(cat.id); }}
                  draggable={stackEditMode}
                  onDragStart={(e) => { e.stopPropagation(); setDragCatId(cat.id); }}
                  onDragOver={(e) => { if (stackEditMode) { e.preventDefault(); if (dragOverCatId !== cat.id) setDragOverCatId(cat.id); } }}
                  onDragLeave={() => setDragOverCatId((prev) => (prev === cat.id ? null : prev))}
                  onDrop={(e) => { if (stackEditMode) { e.preventDefault(); e.stopPropagation(); moveCategory(dragCatId, cat.id); setDragCatId(null); setDragOverCatId(null); } }}
                  onDragEnd={() => { setDragCatId(null); setDragOverCatId(null); }}
                >
                  <div className="stack-card-top">
                    <div className="stack-card-left">
                      {stackEditMode && (
                        <span className="drag-handle" title="Arrastra para reordenar" onClick={(e) => e.stopPropagation()}>
                          <GripVertical size={18} />
                        </span>
                      )}
                      <div className="card-icon"><Icon size={18} /></div>
                      <div>
                        <div className="stack-card-name">
                          {cat.name} {cat.hasPin && <Lock size={12} />}
                        </div>
                        {!stackEditMode && <div className="stack-card-hint">▼ Pulsa para ver tarjeta y movimientos</div>}
                        {stackEditMode && cat.targetGoal > 0 && (
                          <div className="stack-card-hint">Presupuesto: {money(cat.targetGoal)}</div>
                        )}
                      </div>
                    </div>
                    <div className="stack-card-actions">
                      {stackEditMode && cat.hasPin && (
                        <button className="btn-action" onClick={(e) => toggleUnlockCategory(cat, e)}>
                          {isLocked ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                      )}
                      {stackEditMode && (
                        <button className="btn-action" onClick={(e) => openEditCategoryModal(cat, e)} title="Editar sobre">
                          <Edit2 size={14} />
                        </button>
                      )}
                      <button className="btn-action" onClick={(e) => deleteCategory(cat.id, e)} title="Eliminar sobre">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="stack-saldo-label">SALDO DISPONIBLE</div>
                  <div className="stack-saldo-val">{isLocked ? "••••••" : money(stats.balance)}</div>
                </div>
              );
            })}
          </div>
          )}
        </section>

        {/* Sección de Gastos / Ingresos Recurrentes Mensuales */}
        <section>
          <div className="section-header">
            <div className="section-title"><Calendar size={18} color="var(--yellow)" /> Automatización Recurrente Mensual</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-secondary" onClick={processMonthlyRecurrents}><RefreshCw size={15} /> Cargar Recurrentes de Este Mes</button>
              <button className="btn-primary" onClick={() => { closeForms(); setShowRecurrentModal(true); }}><Plus size={15} /> Nueva Regla Recurrente</button>
            </div>
          </div>

          {showRecurrentModal && (
            <div className="form-box">
              <h3 style={{ margin: "0 0 14px", fontSize: 15 }}>Nueva Regla de Cargo/Ingreso Recurrente</h3>
              <div className="form-grid">
                <div className="field">
                  <label>Concepto</label>
                  <input type="text" value={recConcept} onChange={(e) => setRecConcept(e.target.value)} placeholder="Ej. Alquiler, Netflix, Gimnasio" />
                </div>
                <div className="field">
                  <label>Categoría Afectada</label>
                  <select value={recCategory} onChange={(e) => setRecCategory(e.target.value)}>
                    <option value="">Selecciona...</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name} {c.hasPin ? "🔒" : ""}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Tipo</label>
                  <select value={recType} onChange={(e) => setRecType(e.target.value)}>
                    <option value="expense">Gasto Automático (-)</option>
                    <option value="income">Asignación Automática (+)</option>
                  </select>
                </div>
                <div className="field">
                  <label>Importe (€)</label>
                  <input type="text" inputMode="decimal" value={recAmount} onChange={(e) => setRecAmount(e.target.value)} placeholder="Ej. 450" />
                </div>
                <div className="field">
                  <label>Día de cobro mensual (1 - 31)</label>
                  <input type="text" inputMode="numeric" value={recDay} onChange={(e) => setRecDay(e.target.value)} />
                </div>
              </div>
              <div className="form-actions">
                <button className="btn-primary" onClick={addRecurrentRule}><Check size={15} /> Guardar Regla</button>
                <button className="btn-secondary" onClick={() => setShowRecurrentModal(false)}>Cancelar</button>
              </div>
            </div>
          )}

          {recurrents.length > 0 && (
            <div className="grid-3" style={{ marginBottom: 32 }}>
              {recurrents.map((r) => {
                const cat = catById.get(r.categoryId);
                const month = todayISO().slice(0, 7);
                const appliedThisMonth = transactions.some((t) => t.recurrentId === r.id && (t.date || "").startsWith(month));
                return (
                  <div className="card" key={r.id} style={{ padding: "16px" }}>
                    <div className="card-top" style={{ marginBottom: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{r.concept}</span>
                      <button className="btn-icon" onClick={() => deleteRecurrentRule(r.id)}><X size={14} /></button>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
                      Día {r.day} de cada mes • Categoría: <strong style={{ color: "white" }}>{cat ? cat.name : "N/A"}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: r.type === "expense" ? "var(--red)" : "var(--green)" }}>
                        {r.type === "expense" ? "-" : "+"}{money(r.amount)}
                      </div>
                      <span className={`status-pill ${appliedThisMonth ? "done" : ""}`}>
                        {appliedThisMonth ? "✓ Aplicado este mes" : r.startMonth && month < r.startMonth ? "Empieza el mes que viene" : `Automático el día ${r.day}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Historial de Movimientos */}
        <section>
          <div className="section-header">
            <div className="section-title"><TrendingUp size={18} color="var(--green)" /> Historial de Movimientos</div>
            <div style={{ display: "flex", gap: 8 }}>
              {transactions.length > 0 && (
                <button className="btn-action" onClick={clearAllTransactions} style={{ color: "var(--red)" }}>
                  <Trash2 size={14} /> Vaciar Movimientos
                </button>
              )}
              <button className="btn-primary" onClick={() => openAddTxModal()}><Plus size={15} /> Nuevo Registro</button>
            </div>
          </div>

          {selectedCatFilter && (
            <div className="filter-chip">
              Filtrando por: {categories.find((c) => c.id === selectedCatFilter)?.name || "Sobre eliminado"}
              <button onClick={() => setSelectedCatFilter(null)} title="Quitar filtro"><X size={14} /></button>
            </div>
          )}

          <div className="search-bar">
            <div className="search-input-wrapper">
              <Search className="search-icon" size={16} />
              <input
                type="text"
                placeholder="Buscar por concepto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select style={{ maxWidth: 180 }} value={dateRangeFilter} onChange={(e) => setDateRangeFilter(e.target.value)}>
              <option value="all">Todo</option>
              <option value="current">Este ciclo</option>
              <option value="expenses">Solo gastos</option>
            </select>
          </div>

          {showAddTx && (
            <div className="form-box">
              <h3 style={{ margin: "0 0 14px", fontSize: 15 }}>
                {editingTxId ? "Editar Operación" : "Registrar Operación"}
              </h3>
              <div className="form-grid">
                <div className="field">
                  <label>Tipo</label>
                  <select value={txType} onChange={(e) => setTxType(e.target.value)}>
                    <option value="income">Asignar Fondo General ➔ Categoría (+)</option>
                    <option value="expense">Gasto de Categoría (-)</option>
                  </select>
                </div>
                <div className="field">
                  <label>Categoría</label>
                  <select value={txCategory} onChange={(e) => setTxCategory(e.target.value)}>
                    <option value="">Selecciona...</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name} {c.hasPin ? "🔒" : ""}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Concepto</label>
                  <input type="text" value={txConcept} onChange={(e) => setTxConcept(e.target.value)} placeholder="Ej. Compra semanal" />
                </div>
                <div className="field">
                  <label>Monto (€)</label>
                  <input type="text" inputMode="decimal" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} placeholder="0,00" autoFocus={!editingTxId} />
                </div>
                <div className="field">
                  <label>Fecha</label>
                  <input type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} />
                </div>
              </div>

              <div className="form-actions">
                <button className="btn-primary" onClick={saveTransaction}><Check size={15} /> Guardar</button>
                <button className="btn-secondary" onClick={() => { setShowAddTx(false); setEditingTxId(null); }}>Cancelar</button>
              </div>
            </div>
          )}

          <div className="tx-list">
            {filteredTx.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-muted)", fontSize: 13 }}>
                No se encontraron registros.
              </div>
            ) : (
              filteredTx.slice(0, txLimit).map((t) => {
                const cat = catById.get(t.categoryId);
                const Icon = cat ? (CAT_ICONS[cat.icon] || Wallet) : t.type === "payroll_income" ? Banknote : Wallet;
                const catBgColor = cat?.color || (t.type === "payroll_income" ? "#059669" : "#1E293B");
                const isExpense = isExpenseType(t.type) || (t.type === "carryover" && t.amount < 0);
                const isAdjustment = t.type === "adjustment_income" || t.type === "adjustment_expense";

                return (
                  <div className="tx-item" key={t.id}>
                    <div className="tx-left">
                      <div className="tx-badge" style={{ backgroundColor: catBgColor }}>
                        <Icon size={20} />
                      </div>
                      <div>
                        <div className="tx-title">
                          {t.concept}
                          {t.recurrentId && <span className="recurrent-tag">Recurrente</span>}
                          {isAdjustment && <span className="adjust-tag">Ajuste</span>}
                        </div>
                        <div className="tx-sub">{cat ? cat.name : "Fondo General"} • {t.date ? fmtDay(t.date) : ""}</div>
                      </div>
                    </div>
                    <div className="tx-right">
                      <div className={`tx-amount ${isExpense ? "expense" : "income"}`}>
                        {isExpense ? "-" : "+"}{money(Math.abs(t.amount))}
                      </div>
                      <button className="btn-icon" onClick={(e) => openEditTxModal(t, e)} title="Editar movimiento">
                        <Edit2 size={15} />
                      </button>
                      <button className="btn-icon" onClick={(e) => deleteSingleTransaction(t.id, e)} title="Eliminar movimiento">
                        <Trash2 size={15} style={{ color: "var(--red)" }} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
            {filteredTx.length > txLimit && (
              <button className="btn-secondary" style={{ width: "100%" }} onClick={showMoreTx}>
                Ver más ({filteredTx.length - txLimit} restantes)
              </button>
            )}
          </div>
        </section>
      </main>

      {/* Botón flotante: apuntar un gasto en 2 toques */}
      {!anySheetOpen && !viewingCategoryId && (
        <button className="fab" onClick={() => openAddTxModal({ type: "expense" })} aria-label="Nuevo gasto">
          <Plus size={26} />
        </button>
      )}

      {/* Fondo oscuro detrás de los formularios: tocar fuera cierra */}
      {anySheetOpen && <div className="sheet-backdrop" onClick={closeForms} />}

      {showNameSheet && (
        <div className="form-box">
          <h3 style={{ margin: "0 0 6px", fontSize: 15 }}>¿Quién usa este móvil?</h3>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 14px" }}>
            Tu nombre aparecerá en las notificaciones de tu pareja: "M&amp;J · {nameDraft.trim() || "Tu nombre"}".
          </p>
          <div className="field">
            <label>Tu nombre</label>
            <input type="text" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} placeholder="Ej. Meli" maxLength={24} autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") saveUserName(); }} />
          </div>
          <div className="form-actions">
            <button className="btn-primary" onClick={saveUserName}><Check size={15} /> Guardar</button>
            <button className="btn-secondary" onClick={() => setShowNameSheet(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {viewingCategoryId && (() => {
        const cat = categories.find((c) => c.id === viewingCategoryId);
        if (!cat) return null;
        const Icon = CAT_ICONS[cat.icon] || Wallet;
        const stats = categoryBalances[cat.id] || { balance: 0, income: 0, expense: 0 };
        const isLocked = cat.hasPin && !unlockedCats[cat.id];
        const catColor = cat.color || "#151C28";
        const isBgLight = isLightColor(catColor);
        const catTxs = transactions
          .filter((t) => t.categoryId === cat.id)
          .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

        return (
          <div className="modal-overlay" onClick={() => setViewingCategoryId(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header" style={{ backgroundColor: catColor, color: isBgLight ? "#0F172A" : "white" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div className="card-icon"><Icon size={20} /></div>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
                      {cat.name} {cat.hasPin && <Lock size={13} />}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.85 }}>
                      {isLocked ? "Categoría bloqueada" : `${catTxs.length} movimiento${catTxs.length === 1 ? "" : "s"}`}
                    </div>
                  </div>
                </div>
                <button className="btn-icon" style={{ color: isBgLight ? "#0F172A" : "white" }} onClick={() => setViewingCategoryId(null)}>
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body">
                <div className="modal-balance">{isLocked ? "••••••" : money(stats.balance)}</div>

                <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                  <span className="color-badge income-contrast">+ {isLocked ? "•••" : money(stats.income)}</span>
                  <span className="color-badge expense-contrast">- {isLocked ? "•••" : money(stats.expense)}</span>
                </div>

                {cat.targetGoal > 0 && !isLocked && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6, color: "var(--text-muted)", fontWeight: 600 }}>
                      <span>Presupuesto: {money(cat.targetGoal)}</span>
                      <span>{Math.round(Math.min(100, (stats.balance / cat.targetGoal) * 100))}%</span>
                    </div>
                    <div className="progress-bar-bg">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${Math.min(100, (stats.balance / cat.targetGoal) * 100)}%`,
                          backgroundColor: "var(--pink-primary)"
                        }}
                      />
                    </div>
                  </div>
                )}

                {!isLocked && (
                  <div className="quick-actions">
                    <button className="btn-primary quick-expense" onClick={() => openAddTxModal({ type: "expense", categoryId: cat.id })}>
                      <Plus size={16} /> Apuntar gasto
                    </button>
                    <button className="btn-secondary" onClick={() => openAddTxModal({ type: "income", categoryId: cat.id })}>
                      <Wallet size={16} /> Meter dinero
                    </button>
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
                  <button className="btn-secondary" onClick={(e) => { openEditCategoryModal(cat, e); setViewingCategoryId(null); }}>
                    <Edit2 size={14} /> Editar sobre
                  </button>
                  {cat.hasPin && (
                    <button className="btn-secondary" onClick={(e) => toggleUnlockCategory(cat, e)}>
                      {isLocked ? <Eye size={14} /> : <EyeOff size={14} />} {isLocked ? "Desbloquear" : "Bloquear"}
                    </button>
                  )}
                  <button
                    className="btn-secondary"
                    onClick={() => { setSelectedCatFilter(cat.id); setViewingCategoryId(null); }}
                  >
                    <Search size={14} /> Ver en historial completo
                  </button>
                </div>

                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "var(--text-muted)" }}>
                  Movimientos de este sobre
                </div>

                <div className="modal-tx-list">
                  {isLocked ? (
                    <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-muted)", fontSize: 13 }}>
                      Desbloquea la categoría para ver sus movimientos.
                    </div>
                  ) : catTxs.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-muted)", fontSize: 13 }}>
                      Todavía no hay movimientos en este sobre.
                    </div>
                  ) : (
                    catTxs.map((t) => {
                      const isExpense = t.type === "expense" || t.type === "transfer_expense" || t.type === "adjustment_expense";
                      const isAdjustment = t.type === "adjustment_income" || t.type === "adjustment_expense";
                      return (
                        <div className="modal-tx-item" key={t.id}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>
                              {t.concept}
                              {t.recurrentId && <span className="recurrent-tag">Recurrente</span>}
                              {isAdjustment && <span className="adjust-tag">Ajuste</span>}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{t.date ? fmtDay(t.date) : ""}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div className={`tx-amount ${isExpense ? "expense" : "income"}`}>
                              {isExpense ? "-" : "+"}{money(t.amount)}
                            </div>
                            <button className="btn-icon" onClick={(e) => { openEditTxModal(t, e); setViewingCategoryId(null); }} title="Editar movimiento">
                              <Edit2 size={14} />
                            </button>
                            <button className="btn-icon" onClick={(e) => deleteSingleTransaction(t.id, e)} title="Eliminar movimiento">
                              <Trash2 size={14} style={{ color: "var(--red)" }} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
