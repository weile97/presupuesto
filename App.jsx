import React, { useState, useMemo, useEffect } from "react";
import {
  PawPrint, UtensilsCrossed, AlertTriangle, Home, Car, ShoppingBag,
  Plane, Gift, Heart, Wallet, Plus, Trash2, Pencil, Check, X,
  ArrowUpRight, ArrowDownRight, Banknote, PiggyBank, Sparkles, Wand2,
  Download, Upload, Star
} from "lucide-react";

const CAT_ICONS = {
  paw: PawPrint, food: UtensilsCrossed, alert: AlertTriangle, home: Home,
  car: Car, bag: ShoppingBag, plane: Plane, gift: Gift, heart: Heart, wallet: Wallet,
};
const CAT_ICON_ORDER = ["paw", "food", "alert", "home", "car", "bag", "plane", "gift", "heart", "wallet"];

const SRC_ICONS = { banknote: Banknote, piggy: PiggyBank, wallet: Wallet, gift: Gift };

// Paleta bonita en tonos rosa y magenta de alto contraste
const CAT_PALETTE = ["#D81B60", "#E91E63", "#8E24AA", "#D84315", "#0277BD", "#00695C"];
const SRC_PALETTE = ["#C2185B", "#7B1FA2"];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const todayISO = () => new Date().toISOString().slice(0, 10);
const money = (n) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(
    Math.round((n + Number.EPSILON) * 100) / 100
  );

// Nóminas por defecto configuradas para Josna y Meli
const INITIAL_SOURCES = [
  { id: "src-josna", name: "Nómina Josna", icon: "banknote", color: SRC_PALETTE[0], amount: 1500 },
  { id: "src-meli", name: "Nómina Meli", icon: "piggy", color: SRC_PALETTE[1], amount: 1400 },
];

const INITIAL_CATEGORIES = [
  { id: "cat-mascotas", name: "Mascotas", icon: "paw", color: CAT_PALETTE[0] },
  { id: "cat-comida", name: "Comida", icon: "food", color: CAT_PALETTE[1] },
  { id: "cat-imprevistos", name: "Imprevistos", icon: "alert", color: CAT_PALETTE[2] },
];

const INITIAL_TRANSACTIONS = [
  { id: uid(), concept: "Aportación Nómina Meli", categoryId: "cat-comida", sourceId: "src-meli", type: "income", amount: 300, date: todayISO() },
  { id: uid(), concept: "Aportación Nómina Josna", categoryId: "cat-mascotas", sourceId: "src-josna", type: "income", amount: 100, date: todayISO() },
  { id: uid(), concept: "Compra semanal", categoryId: "cat-comida", sourceId: null, type: "expense", amount: 62.4, date: todayISO() },
  { id: uid(), concept: "Veterinario", categoryId: "cat-mascotas", sourceId: null, type: "expense", amount: 45.0, date: todayISO() },
];

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
            aria-label={key}
          >
            <Ico size={16} />
          </button>
        );
      })}
    </div>
  );
}

export default function App() {
  const [sources, setSources] = useState(() => {
    const saved = localStorage.getItem("budget_db_sources");
    return saved ? JSON.parse(saved) : INITIAL_SOURCES;
  });
  const [categories, setCategories] = useState(() => {
    const saved = localStorage.getItem("budget_db_categories");
    return saved ? JSON.parse(saved) : INITIAL_CATEGORIES;
  });
  const [transactions, setTransactions] = useState(() => {
    const saved = localStorage.getItem("budget_db_transactions");
    return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
  });

  useEffect(() => {
    localStorage.setItem("budget_db_sources", JSON.stringify(sources));
  }, [sources]);

  useEffect(() => {
    localStorage.setItem("budget_db_categories", JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem("budget_db_transactions", JSON.stringify(transactions));
  }, [transactions]);

  const [renamingSrcId, setRenamingSrcId] = useState(null);
  const [renameSrcDraft, setRenameSrcDraft] = useState("");

  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("wallet");
  const [renamingCatId, setRenamingCatId] = useState(null);
  const [renameCatDraft, setRenameCatDraft] = useState("");

  const [showAddTx, setShowAddTx] = useState(false);
  const [txConcept, setTxConcept] = useState("");
  const [txCategory, setTxCategory] = useState(categories[0]?.id || "");
  const [txSource, setTxSource] = useState(sources[0]?.id || "");
  const [txType, setTxType] = useState("expense");
  const [txAmount, setTxAmount] = useState("");
  const [txDate, setTxDate] = useState(todayISO());
  const [txError, setTxError] = useState("");

  const exportJSON = () => {
    const data = { sources, categories, transactions };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `presupuesto_unicornio_${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (e) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (parsed.sources && parsed.categories && parsed.transactions) {
            setSources(parsed.sources);
            setCategories(parsed.categories);
            setTransactions(parsed.transactions);
            alert("Base de datos importada con éxito.");
          } else {
            alert("El archivo JSON no coincide con la estructura requerida.");
          }
        } catch (err) {
          alert("Error al parsear el archivo JSON.");
        }
      };
    }
  };

  const bySource = useMemo(() => {
    const map = {};
    for (const s of sources) map[s.id] = { base: s.amount || 0, income: 0 };
    for (const t of transactions) {
      if (t.type === "income" && t.sourceId && map[t.sourceId]) {
        map[t.sourceId].income += t.amount;
      }
    }
    return map;
  }, [sources, transactions]);

  const categoryBalances = useMemo(() => {
    const map = {};
    for (const c of categories) map[c.id] = { income: 0, expense: 0, balance: 0 };
    for (const t of transactions) {
      if (!map[t.categoryId]) continue;
      if (t.type === "income") {
        map[t.categoryId].income += t.amount;
      } else if (t.type === "expense") {
        map[t.categoryId].expense += t.amount;
      }
    }
    for (const c of categories) {
      if (map[c.id]) {
        map[c.id].balance = map[c.id].income - map[c.id].expense;
      }
    }
    return map;
  }, [categories, transactions]);

  const totalIncomeAll = useMemo(() => {
    return transactions.reduce((sum, t) => (t.type === "income" ? sum + t.amount : sum), 0);
  }, [transactions]);

  const totalExpenseAll = useMemo(() => {
    return transactions.reduce((sum, t) => (t.type === "expense" ? sum + t.amount : sum), 0);
  }, [transactions]);

  function updateSourceAmount(id, value) {
    const parsed = parseFloat(value.replace(",", "."));
    setSources((ss) => ss.map((s) => (s.id === id ? { ...s, amount: isNaN(parsed) ? 0 : parsed } : s)));
  }

  function startRenameSrc(s) { setRenamingSrcId(s.id); setRenameSrcDraft(s.name); }
  function commitRenameSrc(id) {
    const name = renameSrcDraft.trim();
    if (name) setSources((ss) => ss.map((s) => (s.id === id ? { ...s, name } : s)));
    setRenamingSrcId(null);
  }

  function addCategory() {
    const name = newCatName.trim();
    if (!name) return;
    const color = CAT_PALETTE[categories.length % CAT_PALETTE.length];
    setCategories((cs) => [...cs, { id: uid(), name, icon: newCatIcon, color }]);
    setNewCatName("");
    setNewCatIcon("wallet");
    setShowAddCategory(false);
  }

  function deleteCategory(id) {
    setCategories((cs) => cs.filter((c) => c.id !== id));
    setTransactions((ts) => ts.filter((t) => t.categoryId !== id));
  }

  function startRenameCat(c) { setRenamingCatId(c.id); setRenameCatDraft(c.name); }
  function commitRenameCat(id) {
    const name = renameCatDraft.trim();
    if (name) setCategories((cs) => cs.map((c) => (c.id === id ? { ...c, name } : c)));
    setRenamingCatId(null);
  }

  function resetTxForm() {
    setTxConcept("");
    setTxAmount("");
    setTxType("expense");
    setTxDate(todayISO());
    setTxCategory(categories[0]?.id || "");
    setTxSource(sources[0]?.id || "");
    setTxError("");
  }

  function addTransaction() {
    const amt = parseFloat(txAmount.replace(",", "."));
    if (!txConcept.trim()) { setTxError("Introduce un concepto mñagico."); return; }
    if (isNaN(amt) || amt <= 0) { setTxError("Introduce un importe válido."); return; }
    if (!txCategory) { setTxError("Selecciona una categoría."); return; }

    if (txType === "income" && !txSource) {
      setTxError("Selecciona la nómina de origen del ingreso.");
      return;
    }

    setTransactions((ts) => [
      {
        id: uid(),
        concept: txConcept.trim(),
        categoryId: txCategory,
        sourceId: txType === "income" ? txSource : null,
        type: txType,
        amount: amt,
        date: txDate,
      },
      ...ts,
    ]);
    resetTxForm();
    setShowAddTx(false);
  }

  function deleteTransaction(id) { setTransactions((ts) => ts.filter((t) => t.id !== id)); }

  const catById = (id) => categories.find((c) => c.id === id);
  const srcById = (id) => sources.find((s) => s.id === id);
  const sortedTx = [...transactions].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Quicksand:wght@500;600;700&display=swap');

        * { box-sizing: border-box; }
        body { margin: 0; background-color: #FFF2F7; }
        
        .app {
          font-family: 'Quicksand', sans-serif;
          background: #FFF2F7;
          color: #4A1525;
          min-height: 100vh;
          padding-bottom: 64px;
        }

        /* Encabezado Mágico Rosa y Unicornio */
        .hero {
          background: linear-gradient(135deg, #FF6EA7 0%, #D81B60 50%, #8E24AA 100%);
          color: #FFFFFF;
          padding: 38px 20px 54px;
          border-bottom-left-radius: 32px;
          border-bottom-right-radius: 32px;
          box-shadow: 0 10px 30px rgba(216, 27, 96, 0.25);
          position: relative;
          overflow: hidden;
        }

        .hero::before {
          content: "✨ 🦄 💖 ✨";
          position: absolute;
          right: 20px;
          bottom: 10px;
          font-size: 42px;
          opacity: 0.15;
          user-select: none;
        }

        .hero-inner { 
          max-width: 860px; 
          margin: 0 auto; 
          display: flex; 
          justify-content: space-between; 
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
        }

        .hero-title-row { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
        .hero-title-row h1 {
          font-family: 'Fredoka', sans-serif;
          font-weight: 700;
          font-size: 32px;
          margin: 0;
          color: #FFFFFF;
          letter-spacing: 0.5px;
          text-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }

        .unicorn-badge {
          background: rgba(255, 255, 255, 0.25);
          backdrop-filter: blur(8px);
          border-radius: 50%;
          width: 46px;
          height: 46px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .hero p { margin: 0; color: #FFE0ED; font-size: 15px; font-weight: 600; }

        .json-actions { display: flex; gap: 10px; }
        .btn-json {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(255, 255, 255, 0.2); color: #FFFFFF; 
          border: 1.5px solid rgba(255, 255, 255, 0.4);
          backdrop-filter: blur(6px);
          padding: 10px 16px; border-radius: 16px; font-weight: 700;
          font-size: 13px; cursor: pointer; transition: all 0.2s;
        }
        .btn-json:hover { background: rgba(255, 255, 255, 0.35); transform: translateY(-1px); }

        .container { max-width: 860px; margin: -26px auto 0; padding: 0 20px; }

        .source-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }
        .source-card {
          background: #FFFFFF;
          border-radius: 22px;
          box-shadow: 0 6px 20px rgba(216, 27, 96, 0.08);
          padding: 20px;
          border-top: 5px solid var(--src-color);
          border-left: 1px solid #FFE4EE;
          border-right: 1px solid #FFE4EE;
          border-bottom: 1px solid #FFE4EE;
        }
        .source-top { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
        .source-icon {
          width: 40px; height: 40px; border-radius: 12px;
          background: var(--src-color); color: #FFFFFF;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
          box-shadow: 0 4px 10px rgba(0,0,0,0.1);
        }
        .source-name { font-weight: 700; font-size: 18px; flex: 1; font-family: 'Fredoka', sans-serif; color: #4A1525; }
        .source-name-input {
          font-family: 'Fredoka', sans-serif; font-weight: 700; font-size: 17px;
          border: none; border-bottom: 2px solid #D81B60; background: transparent; width: 100%; outline: none; color: #4A1525;
        }
        .source-balance {
          font-family: 'Fredoka', sans-serif;
          font-weight: 700;
          font-size: 28px;
          color: #4A1525;
          margin: 10px 0 6px;
        }
        .source-sub { font-size: 13px; color: #2E7D32; font-weight: 700; display: flex; gap: 10px; }

        .totals-row { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 32px; }
        .total-chip {
          background: #FFFFFF; border-radius: 20px; padding: 18px 20px; flex: 1; min-width: 180px;
          box-shadow: 0 6px 20px rgba(216, 27, 96, 0.06); border: 1px solid #FFE4EE;
        }
        .total-chip .label { font-size: 13px; color: #8C4A60; font-weight: 700; margin-bottom: 4px; }
        .total-chip .value { font-family: 'Fredoka', sans-serif; font-weight: 700; font-size: 24px; color: #4A1525; }

        section { margin-bottom: 36px; }
        .section-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; gap: 12px; flex-wrap: wrap; }
        .section-head h2 { font-family: 'Fredoka', sans-serif; font-size: 22px; font-weight: 700; margin: 0; color: #4A1525; display: flex; align-items: center; gap: 8px; }
        .section-head .hint { font-size: 13px; color: #8C4A60; font-weight: 600; }

        .btn {
          display: inline-flex; align-items: center; gap: 8px;
          font-family: 'Quicksand', sans-serif; font-size: 14px; font-weight: 700;
          padding: 10px 20px; border-radius: 999px; border: none;
          background: linear-gradient(135deg, #E91E63 0%, #D81B60 100%);
          color: #FFFFFF; cursor: pointer; transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(216, 27, 96, 0.25);
        }
        .btn.ghost { background: transparent; color: #D81B60; border: 2px solid #D81B60; box-shadow: none; }
        .btn:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(216, 27, 96, 0.35); }
        .btn.ghost:hover { background: #FFE4EE; }

        .cat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
        .cat-card {
          background: #FFFFFF; border-radius: 22px;
          box-shadow: 0 6px 20px rgba(216, 27, 96, 0.06);
          padding: 18px; border-left: 6px solid var(--cat-color);
          border-top: 1px solid #FFE4EE; border-right: 1px solid #FFE4EE; border-bottom: 1px solid #FFE4EE;
        }
        .cat-top { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
        .cat-icon { width: 36px; height: 36px; border-radius: 10px; background: var(--cat-color); color: #FFFFFF; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .cat-name { font-weight: 700; font-size: 17px; flex: 1; font-family: 'Fredoka', sans-serif; color: #4A1525; }
        .cat-name-input { font-family: 'Fredoka', sans-serif; font-weight: 700; font-size: 17px; border: none; border-bottom: 2px solid #D81B60; background: transparent; width: 100%; outline: none; color: #4A1525; }
        .cat-actions { display: flex; gap: 6px; }
        .icon-btn { background: none; border: none; cursor: pointer; color: #8C4A60; padding: 4px; border-radius: 6px; display: flex; transition: background 0.2s; }
        .icon-btn:hover { color: #4A1525; background: #FFE4EE; }

        .cat-balance-box { margin-top: 8px; }
        .cat-balance-label { font-size: 12px; font-weight: 700; color: #8C4A60; }
        .cat-balance-value { font-family: 'Fredoka', sans-serif; font-size: 26px; font-weight: 700; margin-top: 2px; }
        .cat-balance-value.positive { color: #2E7D32; }
        .cat-balance-value.negative { color: #C62828; }

        .cat-details { margin-top: 10px; padding-top: 10px; border-top: 1px solid #FFE4EE; display: flex; justify-content: space-between; font-size: 12px; color: #8C4A60; font-weight: 700; }

        .add-cat-card { border: 2px dashed #F48FB1; border-radius: 22px; padding: 18px; background: transparent; }
        .icon-pick { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
        .icon-pick button {
          width: 36px; height: 36px; border-radius: 10px; border: 1.5px solid #F48FB1; background: #FFFFFF;
          display: flex; align-items: center; justify-content: center; cursor: pointer; color: #8C4A60;
        }
        .icon-pick button.active { border-color: #D81B60; color: #FFFFFF; background: #D81B60; }

        input[type="text"], input[type="number"], input[type="date"], select {
          font-family: 'Quicksand', sans-serif; font-size: 14px; font-weight: 700;
          border: 1.5px solid #F48FB1; border-radius: 12px; padding: 10px 12px;
          background: #FFFFFF; color: #4A1525; outline: none; transition: border-color 0.2s;
        }
        input[type="text"]:focus, input[type="number"]:focus, select:focus, input[type="date"]:focus { border-color: #D81B60; }

        .tx-form { background: #FFFFFF; border-radius: 22px; box-shadow: 0 6px 20px rgba(216, 27, 96, 0.08); padding: 20px; margin-bottom: 20px; border: 1px solid #FFE4EE; }
        .tx-form-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
        @media (min-width: 620px) { .tx-form-grid { grid-template-columns: 1fr 1fr; } }
        .field label { display: block; font-size: 13px; font-weight: 700; color: #4A1525; margin-bottom: 6px; }
        .field input, .field select { width: 100%; }
        .type-toggle { display: flex; gap: 8px; }
        .type-toggle button {
          flex: 1; padding: 10px; border-radius: 999px; border: 2px solid #F48FB1; background: #FFFFFF;
          cursor: pointer; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px; color: #8C4A60;
        }
        .type-toggle button.active.expense { background: #C62828; border-color: #C62828; color: #FFFFFF; }
        .type-toggle button.active.income { background: #2E7D32; border-color: #2E7D32; color: #FFFFFF; }
        .tx-error { color: #C62828; font-size: 13px; font-weight: 700; margin-top: 6px; }
        .tx-form-actions { display: flex; gap: 10px; margin-top: 14px; grid-column: 1 / -1; }

        .tx-list { display: flex; flex-direction: column; gap: 10px; }
        .tx-row { display: flex; align-items: center; gap: 14px; background: #FFFFFF; border-radius: 18px; box-shadow: 0 4px 12px rgba(216, 27, 96, 0.04); padding: 14px 16px; border: 1px solid #FFE4EE; }
        .tx-cat-dot { width: 36px; height: 36px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #FFFFFF; flex-shrink: 0; }
        .tx-info { flex: 1; min-width: 0; }
        .tx-concept { font-weight: 700; font-size: 15px; color: #4A1525; }
        .tx-meta { font-size: 13px; color: #8C4A60; font-weight: 600; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 2px; }
        .tx-src-tag { display: inline-flex; align-items: center; gap: 4px; font-weight: 700; color: #4A1525; }
        .tx-src-tag .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
        .tx-amount { font-family: 'Fredoka', sans-serif; font-weight: 700; font-size: 16px; display: flex; align-items: center; gap: 4px; white-space: nowrap; }
        .tx-amount.income { color: #2E7D32; }
        .tx-amount.expense { color: #C62828; }
        .empty-state { text-align: center; padding: 36px 16px; color: #8C4A60; border: 2px dashed #F48FB1; border-radius: 22px; font-size: 15px; font-weight: 700; background: #FFFFFF; }
      `}</style>

      {/* Hero / Encabezado Temático */}
      <div className="hero">
        <div className="hero-inner">
          <div>
            <div className="hero-title-row">
              <div className="unicorn-badge">🦄</div>
              <h1>Presupuesto Mágico</h1>
            </div>
            <p>Control de gastos e ingresos de Josna & Meli 💖</p>
          </div>
          <div className="json-actions">
            <button className="btn-json" onClick={exportJSON}>
              <Download size={16} /> Exportar DB
            </button>
            <label className="btn-json" style={{ cursor: "pointer" }}>
              <Upload size={16} /> Importar DB
              <input type="file" accept=".json" onChange={importJSON} style={{ display: "none" }} />
            </label>
          </div>
        </div>
      </div>

      <div className="container">
        <section style={{ marginTop: 8 }}>
          <div className="section-head">
            <h2><Sparkles size={20} style={{ color: "#D81B60" }} /> Origen de Nóminas</h2>
            <span className="hint">Bases salariales asignadas</span>
          </div>
          <div className="source-grid">
            {sources.map((s) => {
              const Icon = SRC_ICONS[s.icon] || Wallet;
              const stats = bySource[s.id] || { base: 0, income: 0 };
              return (
                <div className="source-card" key={s.id} style={{ "--src-color": s.color }}>
                  <div className="source-top">
                    <div className="source-icon"><Icon size={18} /></div>
                    {renamingSrcId === s.id ? (
                      <input
                        className="source-name-input"
                        autoFocus
                        value={renameSrcDraft}
                        onChange={(e) => setRenameSrcDraft(e.target.value)}
                        onBlur={() => commitRenameSrc(s.id)}
                        onKeyDown={(e) => e.key === "Enter" && commitRenameSrc(s.id)}
                      />
                    ) : (
                      <div className="source-name">{s.name}</div>
                    )}
                    <div className="cat-actions">
                      <button className="icon-btn" onClick={() => startRenameSrc(s)} aria-label="Renombrar"><Pencil size={15} /></button>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "12px 0 6px" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#8C4A60" }}>Base estimada:</span>
                    <input
                      style={{ width: 100, textAlign: "right" }}
                      type="number"
                      value={s.amount}
                      onChange={(e) => updateSourceAmount(s.id, e.target.value)}
                    />
                  </div>
                  <div className="source-balance">{money(stats.income)}</div>
                  <div className="source-sub">
                    <span>Aportado por esta nómina</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="totals-row">
          <div className="total-chip">
            <div className="label">Total Ingresado ✨</div>
            <div className="value" style={{ color: "#2E7D32" }}>+{money(totalIncomeAll)}</div>
          </div>
          <div className="total-chip">
            <div className="label">Total Gastado 🛍️</div>
            <div className="value" style={{ color: "#C62828" }}>-{money(totalExpenseAll)}</div>
          </div>
          <div className="total-chip">
            <div className="label">Balance Restante 💖</div>
            <div className="value" style={{ color: (totalIncomeAll - totalExpenseAll) < 0 ? "#C62828" : "#4A1525" }}>
              {money(totalIncomeAll - totalExpenseAll)}
            </div>
          </div>
        </div>

        <section>
          <div className="section-head">
            <h2>Categorías</h2>
            <span className="hint">Saldos actualizados por tus movimientos</span>
          </div>
          <div className="cat-grid">
            {categories.map((cat) => {
              const Icon = CAT_ICONS[cat.icon] || Wallet;
              const stats = categoryBalances[cat.id] || { income: 0, expense: 0, balance: 0 };

              return (
                <div className="cat-card" key={cat.id} style={{ "--cat-color": cat.color }}>
                  <div className="cat-top">
                    <div className="cat-icon"><Icon size={18} /></div>
                    {renamingCatId === cat.id ? (
                      <input
                        className="cat-name-input"
                        autoFocus
                        value={renameCatDraft}
                        onChange={(e) => setRenameCatDraft(e.target.value)}
                        onBlur={() => commitRenameCat(cat.id)}
                        onKeyDown={(e) => e.key === "Enter" && commitRenameCat(cat.id)}
                      />
                    ) : (
                      <div className="cat-name">{cat.name}</div>
                    )}
                    <div className="cat-actions">
                      <button className="icon-btn" onClick={() => startRenameCat(cat)} aria-label="Renombrar"><Pencil size={15} /></button>
                      <button className="icon-btn" onClick={() => deleteCategory(cat.id)} aria-label="Eliminar"><Trash2 size={15} /></button>
                    </div>
                  </div>

                  <div className="cat-balance-box">
                    <div className="cat-balance-label">Saldo Disponible</div>
                    <div className={`cat-balance-value ${stats.balance >= 0 ? "positive" : "negative"}`}>
                      {money(stats.balance)}
                    </div>
                  </div>

                  <div className="cat-details">
                    <span style={{ color: "#2E7D32" }}>+ {money(stats.income)} (Ingresos)</span>
                    <span style={{ color: "#C62828" }}>- {money(stats.expense)} (Gastos)</span>
                  </div>
                </div>
              );
            })}

            {showAddCategory ? (
              <div className="add-cat-card">
                <input type="text" placeholder="Nombre de categoría" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} style={{ width: "100%" }} autoFocus />
                <IconPicker icons={CAT_ICONS} order={CAT_ICON_ORDER} value={newCatIcon} onChange={setNewCatIcon} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn" onClick={addCategory}><Check size={16} /> Crear</button>
                  <button className="btn ghost" onClick={() => { setShowAddCategory(false); setNewCatName(""); }}><X size={16} /> Cancelar</button>
                </div>
              </div>
            ) : (
              <div className="add-cat-card" style={{ display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", minHeight: 140 }} onClick={() => setShowAddCategory(true)}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, color: "#D81B60", fontSize: 16, fontWeight: 700 }}><Plus size={18} /> Nueva categoría</span>
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="section-head">
            <h2>Registro de Movimientos</h2>
            {!showAddTx && <button className="btn" onClick={() => setShowAddTx(true)}><Plus size={16} /> Añadir Movimiento</button>}
          </div>

          {showAddTx && (
            <div className="tx-form">
              <div className="tx-form-grid">
                <div className="field">
                  <label>Tipo de movimiento</label>
                  <div className="type-toggle">
                    <button type="button" className={txType === "expense" ? "active expense" : ""} onClick={() => setTxType("expense")}><ArrowDownRight size={16} /> Gasto</button>
                    <button type="button" className={txType === "income" ? "active income" : ""} onClick={() => setTxType("income")}><ArrowUpRight size={16} /> Ingreso</button>
                  </div>
                </div>
                <div className="field">
                  <label>Concepto</label>
                  <input type="text" placeholder={txType === "expense" ? "Ej. Ropa, Maquillaje o Veterinario" : "Ej. Aportación Nómina"} value={txConcept} onChange={(e) => setTxConcept(e.target.value)} />
                </div>
                <div className="field">
                  <label>Categoría destino</label>
                  <select value={txCategory} onChange={(e) => setTxCategory(e.target.value)}>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                {txType === "income" && (
                  <div className="field">
                    <label>Nómina de origen</label>
                    <select value={txSource} onChange={(e) => setTxSource(e.target.value)}>
                      {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}

                <div className="field">
                  <label>Importe (€)</label>
                  <input type="number" placeholder="0,00" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} />
                </div>
                <div className="field">
                  <label>Fecha</label>
                  <input type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} />
                </div>
                {txError && <div className="tx-error" style={{ gridColumn: "1 / -1" }}>{txError}</div>}
                <div className="tx-form-actions">
                  <button className="btn" onClick={addTransaction}><Check size={16} /> Guardar Movimiento</button>
                  <button className="btn ghost" onClick={() => { setShowAddTx(false); resetTxForm(); }}><X size={16} /> Cancelar</button>
                </div>
              </div>
            </div>
          )}

          {sortedTx.length === 0 ? (
            <div className="empty-state">No hay movimientos registrados. ¡Empieza a añadir tus primeros gastos e ingresos! 🦄</div>
          ) : (
            <div className="tx-list">
              {sortedTx.map((t) => {
                const cat = catById(t.categoryId);
                const src = t.sourceId ? srcById(t.sourceId) : null;
                const Icon = cat ? (CAT_ICONS[cat.icon] || Wallet) : Wallet;

                return (
                  <div className="tx-row" key={t.id}>
                    <div className="tx-cat-dot" style={{ background: cat ? cat.color : "#8C4A60" }}>
                      <Icon size={16} />
                    </div>
                    <div className="tx-info">
                      <div className="tx-concept">{t.concept}</div>
                      <div className="tx-meta">
                        <span>Categoría: <b>{cat ? cat.name : "General"}</b></span>
                        <span>•</span>
                        {t.type === "income" && src && (
                          <>
                            <span className="tx-src-tag">
                              Nómina: <span className="dot" style={{ background: src.color }} />
                              {src.name}
                            </span>
                            <span>•</span>
                          </>
                        )}
                        <span>{t.date}</span>
                      </div>
                    </div>
                    <div className={`tx-amount ${t.type}`}>
                      {t.type === "income" ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                      {money(t.amount)}
                    </div>
                    <button className="icon-btn" onClick={() => deleteTransaction(t.id)} aria-label="Eliminar movimiento"><Trash2 size={16} /></button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}