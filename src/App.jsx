import React, { useState, useMemo, useEffect } from "react";
import {
  PawPrint, UtensilsCrossed, AlertTriangle, Home, Car, ShoppingBag,
  Plane, Gift, Heart, Wallet, Plus, Check, Banknote, PiggyBank,
  Coins, Lock, Eye, EyeOff, ArrowRightLeft, TrendingUp, CreditCard,
  PieChart, Download, Search, Trash2, X, Edit2, RefreshCw, Calendar,
  Landmark, GripVertical, Sparkles, Umbrella, GraduationCap,
  Dumbbell, Baby, Shirt, Smartphone, LayoutGrid, Layers, Settings2,
  History
} from "lucide-react";

const API_URL = "/api/data";

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
const todayISO = () => new Date().toISOString().slice(0, 10);
const currentMonthYear = () => new Date().toISOString().slice(0, 7);

const hashPin = (pin) => (pin ? btoa(pin.trim()) : "");

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

  useEffect(() => {
    fetch(API_URL)
      .then((res) => res.json())
      .then((dataFromFile) => {
        setData(dataFromFile || {});
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error cargando base de datos:", err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const activeUnlocked = Object.keys(unlockedCats).filter((id) => unlockedCats[id]);
    if (activeUnlocked.length === 0) return;

    const timer = setTimeout(() => {
      setUnlockedCats({});
      showNotification("Protección activada: Categorías bloqueadas.", "error");
    }, 60000);

    return () => clearTimeout(timer);
  }, [unlockedCats]);

  const updateDataAndSave = (newData) => {
    setData(newData);
    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newData)
    }).catch((err) => console.error("Error guardando datos:", err));
  };

  const sources = data?.sources || [];
  const categories = data?.categories || [];
  const transactions = data?.transactions || [];
  const recurrents = data?.recurrents || [];
  const lastActiveMonth = data?.lastActiveMonth || currentMonthYear();

  // Balances
  const totalBaseIncome = useMemo(() => {
    return transactions
      .filter((t) => t.type === "payroll_income")
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [transactions]);

  const totalAssignedToCategories = useMemo(() => {
    return transactions
      .filter((t) => t.categoryId && t.type === "income")
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [transactions]);

  const globalUnallocated = useMemo(() => {
    return totalBaseIncome - totalAssignedToCategories;
  }, [totalBaseIncome, totalAssignedToCategories]);

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
    setDepositSourceModal(src);
    setCustomSalaryAmount(src.amount ? src.amount.toString() : "");
  }

  function confirmSalaryDeposit() {
    if (!depositSourceModal) return;

    const amt = parseFloat(customSalaryAmount.replace(",", "."));
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
      const raw = (bulkAmounts[src.id] || "").toString().replace(",", ".");
      const amt = parseFloat(raw);
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
    setEditingSourceId(null);
    setSourceName("");
    setSourceAmount("");
    setSourceIcon("banknote");
    setSourceColor(PRESET_COLORS[0]);
    setShowAddSourceModal(true);
  }

  function openEditSourceModal(src, e) {
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
    const amt = parseFloat(sourceAmount.replace(",", "."));
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

    const goalParsed = parseFloat(newCatGoal.replace(",", "."));

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
    const amt = parseFloat(catAdjustAmount.replace(",", "."));
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
  function openAddTxModal() {
    setEditingTxId(null);
    setTxConcept("");
    setTxCategory("");
    setTxType("income");
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
    const amt = parseFloat(txAmount.replace(",", "."));

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
      const previousAmount = editingTxId
        ? transactions.find((t) => t.id === editingTxId)?.amount || 0
        : 0;
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
    const amt = parseFloat(recAmount.replace(",", "."));
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
      day
    };

    updateDataAndSave({
      ...data,
      recurrents: [...recurrents, newRec]
    });

    setRecConcept("");
    setRecAmount("");
    setRecCategory("");
    setShowRecurrentModal(false);
    showNotification("Regla recurrente programada.");
  }

  function deleteRecurrentRule(id) {
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

    const currentYearMonth = currentMonthYear();
    let appliedCount = 0;
    const newTransactions = [...transactions];

    for (const rec of recurrents) {
      const dateStr = `${currentYearMonth}-${String(rec.day).padStart(2, "0")}`;
      const alreadyApplied = transactions.some(
        (t) => t.recurrentId === rec.id && t.date.startsWith(currentYearMonth)
      );

      if (!alreadyApplied) {
        newTransactions.unshift({
          id: uid(),
          recurrentId: rec.id,
          concept: `[Recorrente] ${rec.concept}`,
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
    const amt = parseFloat(transferAmount.replace(",", "."));
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

    let csvContent = "data:text/csv;charset=utf-8,ID,Fecha,Concepto,Tipo,Importe,Categoria\n";
    publicTxs.forEach((t) => {
      const cat = categories.find((c) => c.id === t.categoryId);
      csvContent += `${t.id},${t.date},"${t.concept}",${t.type},${t.amount},"${cat ? cat.name : "Fondo General"}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `finanzas_historial_${todayISO()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const filteredTx = useMemo(() => {
    return transactions.filter((t) => {
      const cat = categories.find((c) => c.id === t.categoryId);
      if (cat && cat.hasPin && !unlockedCats[cat.id]) return false;

      const matchesCat = selectedCatFilter ? t.categoryId === selectedCatFilter : true;
      const matchesSearch = searchQuery === "" || t.concept.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesDate = true;
      const curM = currentMonthYear();
      if (dateRangeFilter === "current") matchesDate = t.date.startsWith(curM);

      return matchesCat && matchesSearch && matchesDate;
    });
  }, [transactions, categories, unlockedCats, selectedCatFilter, searchQuery, dateRangeFilter]);

  if (loading) return <div className="loading-screen">Cargando datos...</div>;

  return (
    <div className="app-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        :root {
          --bg-main: #0B0F17; --bg-card: #151C28; --border: rgba(255, 255, 255, 0.08);
          --border-accent: rgba(236, 72, 153, 0.3); --pink-primary: #EC4899;
          --purple-accent: #8B5CF6; --text-main: #F8FAFC; --text-muted: #94A3B8;
          --green: #10B981; --red: #EF4444; --yellow: #F59E0B;
        }
        * { box-sizing: border-box; }
        body { margin: 0; background-color: var(--bg-main); color: var(--text-main); font-family: 'Plus Jakarta Sans', sans-serif; }
        .app-container { min-height: 100vh; padding-bottom: 60px; }
        .loading-screen { color: #F8FAFC; padding: 60px; text-align: center; font-weight: 700; }
        .header { background: rgba(21, 28, 40, 0.7); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 100; padding: 16px 24px; }
        .header-inner { max-width: 1100px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
        .brand { display: flex; align-items: center; gap: 12px; }
        .brand-logo { width: 40px; height: 40px; border-radius: 12px; background: linear-gradient(135deg, var(--pink-primary), var(--purple-accent)); display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; }
        .brand-title { font-weight: 800; font-size: 18px; }
        .brand-sub { font-size: 12px; color: var(--text-muted); font-weight: 500; }
        .main-content { max-width: 1100px; margin: 28px auto 0; padding: 0 20px; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 28px; }
        .summary-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 18px; padding: 20px; }
        .summary-card.highlight { border-color: var(--border-accent); background: linear-gradient(135deg, rgba(236, 72, 153, 0.05), rgba(139, 92, 246, 0.05)); }
        .summary-label { font-size: 13px; color: var(--text-muted); font-weight: 600; margin-bottom: 6px; }
        .summary-val { font-size: 26px; font-weight: 800; }
        .summary-sub { font-size: 12px; color: var(--text-muted); margin-top: 6px; }
        .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px; }
        .section-title { font-size: 18px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
        .grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-bottom: 32px; }
        .card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 18px; padding: 20px; transition: transform 0.15s ease, border-color 0.15s ease; }
        .card-interactive { cursor: pointer; }
        .card-interactive.active { border-color: #FFFFFF !important; transform: translateY(-2px); }
        .card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        .card-icon { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; background: rgba(0, 0, 0, 0.25); }
        .btn-primary { background: var(--pink-primary); color: white; border: none; padding: 10px 18px; border-radius: 10px; font-weight: 700; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px; }
        .btn-secondary { background: #1E293B; color: var(--text-main); border: 1px solid var(--border); padding: 10px 18px; border-radius: 10px; font-weight: 600; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px; }
        .btn-action { background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.15); color: var(--text-main); padding: 8px 14px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; }
        .btn-icon { background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: 6px; border-radius: 6px; transition: color 0.15s; }
        .btn-icon:hover { color: white; background: rgba(255,255,255,0.1); }
        .form-box { background: var(--bg-card); border: 1px solid var(--border-accent); border-radius: 18px; padding: 22px; margin-bottom: 24px; }
        .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; }
        .field label { display: block; font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px; }
        input, select { width: 100%; background: #0B0F17; border: 1px solid var(--border); color: white; padding: 10px 12px; border-radius: 10px; font-size: 14px; font-weight: 600; outline: none; }
        .progress-bar-bg { background: rgba(0, 0, 0, 0.3); height: 8px; border-radius: 4px; overflow: hidden; margin-top: 10px; }
        .progress-bar-fill { height: 100%; transition: width 0.3s ease; }
        .search-bar { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
        .search-input-wrapper { flex: 1; min-width: 200px; position: relative; }
        .search-input-wrapper input { padding-left: 36px; }
        .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); }
        .tx-list { display: flex; flex-direction: column; gap: 10px; }
        .tx-item { background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; }
        .tx-left { display: flex; align-items: center; gap: 12px; }
        .tx-badge { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; }
        .tx-title { font-weight: 700; font-size: 14px; }
        .tx-sub { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
        .tx-right { display: flex; align-items: center; gap: 12px; }
        .tx-amount { font-weight: 800; font-size: 15px; }
        .tx-amount.income { color: var(--green); }
        .tx-amount.expense { color: var(--red); }
        .icon-pick { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
        .icon-pick button { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border); background: #0B0F17; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .icon-pick button.active { border-color: var(--pink-primary); color: white; background: var(--pink-primary); }

        .color-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(26px, 1fr)); gap: 8px; margin-top: 8px; max-width: 460px; }
        .color-swatch { width: 100%; aspect-ratio: 1; border-radius: 50%; cursor: pointer; border: 2px solid transparent; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.15); transition: transform 0.1s ease; }
        .color-swatch:hover { transform: scale(1.12); }
        .color-swatch.active { border-color: white; transform: scale(1.18); box-shadow: 0 0 0 2px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.3); }

        .view-toggle { display: flex; gap: 4px; background: #0B0F17; border: 1px solid var(--border); border-radius: 10px; padding: 3px; }
        .view-toggle button { background: transparent; border: none; color: var(--text-muted); padding: 7px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; }
        .view-toggle button.active { background: var(--pink-primary); color: white; }

        .stack-toolbar { display: flex; justify-content: flex-end; margin-bottom: 14px; }
        .stack-edit-btn { background: #1E293B; color: var(--text-muted); border: 1px solid var(--border); padding: 9px 16px; border-radius: 10px; font-weight: 700; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 6px; }
        .stack-edit-btn.on { background: rgba(236, 72, 153, 0.15); border-color: var(--border-accent); color: var(--pink-primary); }

        .stack-wrap { display: flex; flex-direction: column; padding-bottom: 8px; }
        .stack-card { border-radius: 22px; padding: 18px 20px 34px; margin-top: -22px; cursor: pointer; transition: transform 0.15s ease, margin-top 0.2s ease; box-shadow: 0 -10px 24px rgba(0,0,0,0.28); border: 1px solid rgba(255,255,255,0.12); }
        .stack-card:first-child { margin-top: 0; }
        .stack-card:hover { transform: translateY(-3px); }
        .stack-wrap.editing .stack-card { margin-top: 10px; cursor: default; box-shadow: none; }
        .stack-wrap.editing .stack-card:first-child { margin-top: 0; }
        .stack-card-top { display: flex; align-items: center; justify-content: space-between; }
        .stack-card-left { display: flex; align-items: center; gap: 12px; }
        .stack-card-name { font-size: 17px; font-weight: 800; display: flex; align-items: center; gap: 6px; }
        .stack-card-hint { font-size: 11px; font-weight: 700; opacity: 0.75; margin-top: 2px; }
        .stack-card-actions { display: flex; align-items: center; gap: 6px; }
        .stack-saldo-label { font-size: 10px; font-weight: 800; letter-spacing: 0.08em; opacity: 0.8; margin-top: 16px; }
        .stack-saldo-val { font-size: 20px; font-weight: 800; margin-top: 2px; }
        .toast { position: fixed; bottom: 20px; right: 20px; padding: 12px 20px; border-radius: 12px; display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 700; color: white; z-index: 1000; animation: slideIn 0.2s ease; }
        .toast-success { background: #10B981; }
        .toast-error { background: #EF4444; }

        .color-badge { padding: 2px 8px; border-radius: 6px; font-weight: 700; display: inline-block; }
        .color-badge.income-contrast { background: rgba(16, 185, 129, 0.2); color: #34D399; }
        .color-badge.expense-contrast { background: rgba(239, 68, 68, 0.2); color: #FCA5A5; }
        .color-badge.light-bg-income { background: rgba(6, 95, 70, 0.15); color: #065F46; }
        .color-badge.light-bg-expense { background: rgba(153, 27, 27, 0.15); color: #991B1B; }

        .recurrent-tag { font-size: 10px; background: rgba(139, 92, 246, 0.2); color: var(--purple-accent); padding: 2px 6px; border-radius: 4px; font-weight: 700; margin-left: 6px; }
        .adjust-tag { font-size: 10px; background: rgba(245, 158, 11, 0.2); color: var(--yellow); padding: 2px 6px; border-radius: 4px; font-weight: 700; margin-left: 6px; }

        .drag-handle { cursor: grab; display: flex; align-items: center; opacity: 0.6; }
        .drag-handle:active { cursor: grabbing; }
        .card-interactive.drag-over { outline: 2px dashed rgba(255,255,255,0.6); outline-offset: 3px; }

        .filter-chip { display: inline-flex; align-items: center; gap: 8px; background: rgba(236, 72, 153, 0.15); border: 1px solid var(--border-accent); color: var(--text-main); padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; margin-bottom: 14px; }
        .filter-chip button { background: none; border: none; color: var(--text-main); cursor: pointer; display: flex; align-items: center; }

        .modal-overlay { position: fixed; inset: 0; background: rgba(4, 6, 10, 0.72); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 500; padding: 20px; }
        .modal-content { width: 100%; max-width: 480px; max-height: 86vh; background: var(--bg-card); border-radius: 22px; overflow: hidden; display: flex; flex-direction: column; border: 1px solid var(--border); box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
        .modal-header { padding: 20px; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .modal-body { padding: 20px; overflow-y: auto; }
        .modal-balance { font-size: 32px; font-weight: 800; margin: 4px 0 12px; }
        .modal-tx-list { display: flex; flex-direction: column; gap: 8px; max-height: 320px; overflow-y: auto; }
        .modal-tx-item { background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 12px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; }

        @keyframes slideIn { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <header className="header">
        <div className="header-inner">
          <div className="brand">
            <div className="brand-logo">💎</div>
            <div>
              <div className="brand-title">Finanzas Pro</div>
              <div className="brand-sub">Periodo: {lastActiveMonth}</div>
            </div>
          </div>
          <button className="btn-secondary" onClick={exportCSV}><Download size={15} /> Exportar CSV</button>
        </div>
      </header>

      <main className="main-content">
        {/* Resumen Métricas */}
        <div className="summary-grid">
          <div className="summary-card highlight">
            <div className="summary-label">Fondo General Disponible</div>
            <div className="summary-val" style={{ color: globalUnallocated >= 0 ? "var(--text-main)" : "var(--red)" }}>
              {money(globalUnallocated)}
            </div>
            <div className="summary-sub">Nóminas sin asignar a categorías</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Nóminas Ingresadas</div>
            <div className="summary-val" style={{ color: "var(--green)" }}>{money(totalBaseIncome)}</div>
            <div className="summary-sub">Ingresos brutos percibidos</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Asignado a Categorías</div>
            <div className="summary-val" style={{ color: "var(--purple-accent)" }}>{money(totalAssignedToCategories)}</div>
            <div className="summary-sub">Presupuesto repartido</div>
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
                  <input type="number" value={sourceAmount} onChange={(e) => setSourceAmount(e.target.value)} placeholder="Ej. 1800" />
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
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
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
                    type="number"
                    value={customSalaryAmount}
                    onChange={(e) => setCustomSalaryAmount(e.target.value)}
                    placeholder="Ej. 1850.50"
                    autoFocus
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
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
                        type="number"
                        value={bulkAmounts[s.id] ?? ""}
                        onChange={(e) => setBulkAmounts((prev) => ({ ...prev, [s.id]: e.target.value }))}
                        placeholder="0.00"
                        style={{ maxWidth: 140 }}
                      />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
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
              <button className="btn-secondary" onClick={() => setShowTransferModal(true)}><ArrowRightLeft size={15} /> Traspaso entre Sobres</button>
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
                  <input type="number" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
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
                  <input type="number" value={newCatGoal} onChange={(e) => setNewCatGoal(e.target.value)} placeholder="Ej. 1000" />
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
                      type="number"
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

              <div style={{ display: "flex", gap: 8 }}>
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
                  draggable
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

                  <div style={{ display: "flex", justifyBetween: "space-between", fontSize: 12, marginTop: 12, fontWeight: 700 }}>
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
              <button className="btn-primary" onClick={() => setShowRecurrentModal(true)}><Plus size={15} /> Nueva Regla Recurrente</button>
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
                  <input type="number" value={recAmount} onChange={(e) => setRecAmount(e.target.value)} placeholder="Ej. 450" />
                </div>
                <div className="field">
                  <label>Día de cobro mensual (1 - 31)</label>
                  <input type="number" min="1" max="31" value={recDay} onChange={(e) => setRecDay(e.target.value)} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button className="btn-primary" onClick={addRecurrentRule}><Check size={15} /> Guardar Regla</button>
                <button className="btn-secondary" onClick={() => setShowRecurrentModal(false)}>Cancelar</button>
              </div>
            </div>
          )}

          {recurrents.length > 0 && (
            <div className="grid-3" style={{ marginBottom: 32 }}>
              {recurrents.map((r) => {
                const cat = categories.find((c) => c.id === r.categoryId);
                return (
                  <div className="card" key={r.id} style={{ padding: "16px" }}>
                    <div className="card-top" style={{ marginBottom: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{r.concept}</span>
                      <button className="btn-icon" onClick={() => deleteRecurrentRule(r.id)}><X size={14} /></button>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
                      Día {r.day} de cada mes • Categoría: <strong style={{ color: "white" }}>{cat ? cat.name : "N/A"}</strong>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: r.type === "expense" ? "var(--red)" : "var(--green)" }}>
                      {r.type === "expense" ? "-" : "+"}{money(r.amount)}
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
              <button className="btn-primary" onClick={openAddTxModal}><Plus size={15} /> Nuevo Registro</button>
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
              <option value="all">Todas las fechas</option>
              <option value="current">Este mes</option>
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
                  <input type="number" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} />
                </div>
                <div className="field">
                  <label>Fecha</label>
                  <input type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} />
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
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
              filteredTx.map((t) => {
                const cat = categories.find((c) => c.id === t.categoryId);
                const Icon = cat ? (CAT_ICONS[cat.icon] || Wallet) : Wallet;
                const catBgColor = cat?.color || "#1E293B";
                const isExpense = t.type === "expense" || t.type === "transfer_expense" || t.type === "adjustment_expense";
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
                          {t.recurrentId && <span className="recurrent-tag">Recorrente</span>}
                          {isAdjustment && <span className="adjust-tag">Ajuste</span>}
                        </div>
                        <div className="tx-sub">{cat ? cat.name : "Fondo General"} • {t.date}</div>
                      </div>
                    </div>
                    <div className="tx-right">
                      <div className={`tx-amount ${isExpense ? "expense" : "income"}`}>
                        {isExpense ? "-" : "+"}{money(t.amount)}
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
          </div>
        </section>
      </main>

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
          .filter((t) => searchQuery === "" || t.concept.toLowerCase().includes(searchQuery.toLowerCase()));

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
                              {t.recurrentId && <span className="recurrent-tag">Recorrente</span>}
                              {isAdjustment && <span className="adjust-tag">Ajuste</span>}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{t.date}</div>
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