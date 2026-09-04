import React, { useState, useMemo, useEffect } from "react";
import {
  PawPrint, UtensilsCrossed, AlertTriangle, Home, Car, ShoppingBag,
  Plane, Gift, Heart, Wallet, Plus, Check, Banknote, PiggyBank,
  Coins, Lock, Eye, EyeOff, ArrowRightLeft, TrendingUp, CreditCard,
  PieChart, Download, Search, Trash2, X, Edit2, RefreshCw, Calendar
} from "lucide-react";

const API_URL = "/api/data";

const CAT_ICONS = {
  paw: PawPrint, food: UtensilsCrossed, alert: AlertTriangle, home: Home,
  car: Car, bag: ShoppingBag, plane: Plane, gift: Gift, heart: Heart, wallet: Wallet, coins: Coins
};
const CAT_ICON_ORDER = ["paw", "food", "alert", "home", "car", "bag", "plane", "gift", "heart", "wallet", "coins"];
const SRC_ICONS = { banknote: Banknote, piggy: PiggyBank, wallet: Wallet, gift: Gift, coins: Coins };

const PRESET_COLORS = [
  "#EC4899", "#8B5CF6", "#3B82F6", "#10B981",
  "#F59E0B", "#6366F1", "#064E3B", "#7C2D12"
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
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("wallet");
  const [newCatColor, setNewCatColor] = useState(PRESET_COLORS[0]);
  const [newCatHasPin, setNewCatHasPin] = useState(false);
  const [newCatPin, setNewCatPin] = useState("");
  const [newCatGoal, setNewCatGoal] = useState("");

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
      if (t.type === "income" || t.type === "transfer_income") map[t.categoryId].income += (t.amount || 0);
      if (t.type === "expense" || t.type === "transfer_expense") map[t.categoryId].expense += (t.amount || 0);
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

  function confirmAllSalariesDeposit() {
    if (sources.length === 0) {
      return showNotification("No hay fuentes de nómina configuradas.", "error");
    }

    const newTransactions = sources.map((src) => ({
      id: uid(),
      concept: `Nómina: ${src.name}`,
      categoryId: null,
      sourceId: src.id,
      type: "payroll_income",
      amount: parseFloat(src.amount) || 0,
      date: todayISO()
    }));

    const totalAdded = newTransactions.reduce((acc, t) => acc + t.amount, 0);

    updateDataAndSave({
      ...data,
      transactions: [...newTransactions, ...transactions]
    });

    showNotification(`Se han añadido ${money(totalAdded)} al Fondo General de las nóminas.`);
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
  function addCategory() {
    const name = newCatName.trim();
    if (!name) return showNotification("Ingresa un nombre para la categoría.", "error");
    if (newCatHasPin && !newCatPin.trim()) return showNotification("Asigna un PIN a la categoría.", "error");

    const goalParsed = parseFloat(newCatGoal.replace(",", "."));

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
    setNewCatName(""); setNewCatIcon("wallet"); setNewCatColor(PRESET_COLORS[0]); setNewCatHasPin(false); setNewCatPin(""); setNewCatGoal(""); setShowAddCategory(false);
    showNotification("Categoría creada con éxito.");
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
        .toast { position: fixed; bottom: 20px; right: 20px; padding: 12px 20px; border-radius: 12px; display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 700; color: white; z-index: 1000; animation: slideIn 0.2s ease; }
        .toast-success { background: #10B981; }
        .toast-error { background: #EF4444; }

        .color-badge { padding: 2px 8px; border-radius: 6px; font-weight: 700; display: inline-block; }
        .color-badge.income-contrast { background: rgba(16, 185, 129, 0.2); color: #34D399; }
        .color-badge.expense-contrast { background: rgba(239, 68, 68, 0.2); color: #FCA5A5; }
        .color-badge.light-bg-income { background: rgba(6, 95, 70, 0.15); color: #065F46; }
        .color-badge.light-bg-expense { background: rgba(153, 27, 27, 0.15); color: #991B1B; }

        .recurrent-tag { font-size: 10px; background: rgba(139, 92, 246, 0.2); color: var(--purple-accent); padding: 2px 6px; border-radius: 4px; font-weight: 700; margin-left: 6px; }

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
            <div className="section-title"><CreditCard size={18} color="var(--pink-primary)" /> Ingresos de Nómina</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-secondary" onClick={confirmAllSalariesDeposit}>
                <Plus size={15} /> Ingresar Ambas Nóminas
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
                <div className="field">
                  <label>Color</label>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    {PRESET_COLORS.map(c => (
                      <div 
                        key={c} 
                        onClick={() => setSourceColor(c)}
                        style={{ 
                          width: 24, height: 24, borderRadius: "50%", background: c, cursor: "pointer",
                          border: sourceColor === c ? "2px solid white" : "none"
                        }} 
                      />
                    ))}
                  </div>
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

          <div className="grid-3">
            {sources.map((s) => {
              const Icon = SRC_ICONS[s.icon] || Wallet;
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
                  <div style={{ marginBottom: 14, fontSize: 12, color: "var(--text-muted)" }}>
                    Estimado / Ref: <strong style={{ color: "white" }}>{money(s.amount)}</strong>
                  </div>
                  <button className="btn-secondary" style={{ width: "100%", justifyContent: "center" }} onClick={() => openSalaryModal(s)}>
                    <Plus size={15} /> Registrar Ingreso
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Categorías / Sobres */}
        <section>
          <div className="section-header">
            <div className="section-title"><PieChart size={18} color="var(--purple-accent)" /> Categorías de Presupuesto</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-secondary" onClick={() => setShowTransferModal(true)}><ArrowRightLeft size={15} /> Traspaso entre Sobres</button>
              <button className="btn-primary" onClick={() => setShowAddCategory(true)}><Plus size={15} /> Nueva Categoría</button>
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
              <h3 style={{ margin: "0 0 14px", fontSize: 15 }}>Crear Categoría con Presupuesto</h3>
              <div className="form-grid">
                <div className="field">
                  <label>Nombre</label>
                  <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} />
                </div>
                <div className="field">
                  <label>Color de Fondo</label>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    {PRESET_COLORS.map(c => (
                      <div 
                        key={c} 
                        onClick={() => setNewCatColor(c)}
                        style={{ 
                          width: 24, height: 24, borderRadius: "50%", background: c, cursor: "pointer",
                          border: newCatColor === c ? "2px solid white" : "none"
                        }} 
                      />
                    ))}
                  </div>
                </div>
                <div className="field">
                  <label>Icono</label>
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

              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-primary" onClick={addCategory}><Check size={15} /> Guardar</button>
                <button className="btn-secondary" onClick={() => setShowAddCategory(false)}>Cancelar</button>
              </div>
            </div>
          )}

          <div className="grid-3">
            {categories.map((cat) => {
              const Icon = CAT_ICONS[cat.icon] || Wallet;
              const stats = categoryBalances[cat.id] || { balance: 0, income: 0, expense: 0 };
              const isLocked = cat.hasPin && !unlockedCats[cat.id];
              const isSelected = selectedCatFilter === cat.id;
              
              const progressPct = cat.targetGoal > 0 ? Math.min(100, (stats.balance / cat.targetGoal) * 100) : 0;
              
              let progressColor = "var(--green)";
              if (progressPct >= 100) progressColor = "var(--red)";
              else if (progressPct >= 75) progressColor = "var(--yellow)";

              const catColor = cat.color || "#151C28";
              const isBgLight = isLightColor(catColor);

              return (
                <div
                  className={`card card-interactive ${isSelected ? "active" : ""}`}
                  key={cat.id}
                  style={{ backgroundColor: catColor, color: isBgLight ? "#0F172A" : "var(--text-main)" }}
                  onClick={() => setSelectedCatFilter(isSelected ? null : cat.id)}
                >
                  <div className="card-top">
                    <div className="card-icon"><Icon size={18} /></div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {cat.hasPin && (
                        <button className="btn-action" onClick={(e) => toggleUnlockCategory(cat, e)}>
                          {isLocked ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                      )}
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
                </div>
              );
            })}
          </div>
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
                const isExpense = t.type === "expense" || t.type === "transfer_expense";

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
    </div>
  );
}