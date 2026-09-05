import React, { useState, useMemo, useEffect } from "react";
import {
  PawPrint, UtensilsCrossed, AlertTriangle, Home, Car, ShoppingBag,
  Plane, Gift, Heart, Wallet, Plus, Banknote, PiggyBank, Coins, 
  Lock, ArrowRightLeft, Landmark, Sparkles, Umbrella, GraduationCap, 
  Dumbbell, Baby, Shirt, Smartphone, Trash2, X, Edit2
} from "lucide-react";

const API_URL = "/api/data";

const CAT_ICONS = {
  paw: PawPrint, food: UtensilsCrossed, alert: AlertTriangle, home: Home,
  car: Car, bag: ShoppingBag, plane: Plane, gift: Gift, heart: Heart, wallet: Wallet, coins: Coins,
  piggy: PiggyBank, bank: Landmark, sparkle: Sparkles, umbrella: Umbrella,
  study: GraduationCap, gym: Dumbbell, baby: Baby, clothes: Shirt, phone: Smartphone
};

const PRESET_COLORS = ["#EC4899", "#8B5CF6", "#6366F1", "#3B82F6", "#0EA5E9", "#10B981", "#84CC16", "#EAB308", "#F97316", "#EF4444"];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const todayISO = () => new Date().toISOString().slice(0, 10);
const currentMonthYear = () => new Date().toISOString().slice(0, 7);
const hashPin = (pin) => (pin ? btoa(pin.trim()) : "");
const money = (n) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Math.round(((n || 0) + Number.EPSILON) * 100) / 100);

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unlockedCats, setUnlockedCats] = useState({});
  const [toast, setToast] = useState(null);

  // Modales
  const [modalType, setModalType] = useState(null); // 'tx' | 'transfer' | 'pin' | 'cat' | 'source' | 'view_cat'
  const [viewingCategory, setViewingCategory] = useState(null);
  const [pinTarget, setPinTarget] = useState(null);
  const [pinInput, setPinInput] = useState("");

  // Formularios
  const [txForm, setTxForm] = useState({ id: null, concept: "", categoryId: "", type: "expense", amount: "", date: todayISO() });
  const [catForm, setCatForm] = useState({ id: null, name: "", icon: "wallet", color: PRESET_COLORS[0], hasPin: false, pin: "" });
  const [sourceForm, setSourceForm] = useState({ id: null, name: "", amount: "" });
  const [transferForm, setTransferForm] = useState({ from: "", to: "", amount: "" });

  const notify = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  // 1. Cargar Base de Datos
  useEffect(() => {
    fetch(API_URL)
      .then((res) => res.json())
      .then((loadedData) => {
        const d = loadedData || { sources: [], categories: [], transactions: [], recurrents: [] };
        setData(d);
        setLoading(false);
        autoProcessRecurrents(d);
      })
      .catch(() => setLoading(false));
  }, []);

  const saveData = (newData) => {
    setData(newData);
    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newData)
    });
  };

  // 2. Procesar Recurrentes Automáticamente
  const autoProcessRecurrents = (currentData) => {
    const { recurrents = [], transactions = [] } = currentData;
    if (!recurrents.length) return;
    const currentYM = currentMonthYear();
    let added = 0;
    const newTxs = [...transactions];

    recurrents.forEach((rec) => {
      const exists = transactions.some((t) => t.recurrentId === rec.id && t.date.startsWith(currentYM));
      if (!exists) {
        newTxs.unshift({
          id: uid(),
          recurrentId: rec.id,
          concept: `[Auto] ${rec.concept}`,
          categoryId: rec.categoryId,
          type: rec.type,
          amount: rec.amount,
          date: `${currentYM}-${String(rec.day).padStart(2, "0")}`
        });
        added++;
      }
    });

    if (added > 0) {
      const updated = { ...currentData, transactions: newTxs };
      saveData(updated);
      notify(`Se cargaron ${added} recurrentes del mes.`);
    }
  };

  const sources = data?.sources || [];
  const categories = data?.categories || [];
  const transactions = data?.transactions || [];

  // 3. Cálculos en Tiempo Real
  const { globalUnallocated, categoryBalances, totalIncome } = useMemo(() => {
    let payrolls = 0, assigned = 0;
    const balances = {};
    categories.forEach((c) => (balances[c.id] = { income: 0, expense: 0, balance: 0 }));

    transactions.forEach((t) => {
      const amt = parseFloat(t.amount) || 0;
      if (t.type === "payroll_income") payrolls += amt;
      else if (t.categoryId && balances[t.categoryId]) {
        if (t.type === "income" || t.type === "transfer_income") {
          balances[t.categoryId].income += amt;
          if (t.type === "income") assigned += amt;
        } else if (t.type === "expense" || t.type === "transfer_expense") {
          balances[t.categoryId].expense += amt;
        }
      }
    });

    Object.keys(balances).forEach((id) => {
      balances[id].balance = balances[id].income - balances[id].expense;
    });

    return { totalIncome: payrolls, globalUnallocated: payrolls - assigned, categoryBalances: balances };
  }, [categories, transactions]);

  // 4. Seguridad PIN
  const requirePin = (catId, action) => {
    const cat = categories.find((c) => c.id === catId);
    if (cat?.hasPin && !unlockedCats[catId]) {
      setPinTarget({ cat, action });
      setPinInput("");
      setModalType("pin");
    } else action();
  };

  const handlePinSubmit = () => {
    if (hashPin(pinInput) === pinTarget.cat.pinHash || pinInput === pinTarget.cat.pin) {
      setUnlockedCats((prev) => ({ ...prev, [pinTarget.cat.id]: true }));
      const act = pinTarget.action;
      setModalType(null);
      if (act) act();
    } else notify("PIN Incorrecto");
  };

  // 5. Guardado de Formularios
  const handleSaveTx = () => {
    const amt = parseFloat(txForm.amount);
    if (!txForm.concept || isNaN(amt) || amt <= 0 || !txForm.categoryId) return notify("Datos incompletos.");
    if (txForm.type === "income" && globalUnallocated < amt) return notify("Fondo General insuficiente.");

    const newTx = { ...txForm, id: txForm.id || uid(), amount: amt };
    const newTxs = txForm.id ? transactions.map((t) => (t.id === txForm.id ? newTx : t)) : [newTx, ...transactions];
    
    saveData({ ...data, transactions: newTxs });
    notify("Movimiento guardado");
    setModalType(null);
  };

  const handleSaveCategory = () => {
    if (!catForm.name) return notify("Nombre requerido");
    const newCat = {
      id: catForm.id || uid(),
      name: catForm.name,
      icon: catForm.icon,
      color: catForm.color,
      hasPin: catForm.hasPin,
      pinHash: catForm.hasPin ? hashPin(catForm.pin) : null
    };

    const newCats = catForm.id ? categories.map((c) => (c.id === catForm.id ? newCat : c)) : [...categories, newCat];
    saveData({ ...data, categories: newCats });
    notify("Sobre guardado");
    setModalType(null);
  };

  const handleSaveSource = () => {
    const amt = parseFloat(sourceForm.amount);
    if (!sourceForm.name || isNaN(amt)) return notify("Completa el origen de nómina");
    const newSource = { id: sourceForm.id || uid(), name: sourceForm.name, amount: amt };
    const newSources = sourceForm.id ? sources.map((s) => (s.id === sourceForm.id ? newSource : s)) : [...sources, newSource];
    saveData({ ...data, sources: newSources });
    notify("Nómina guardada");
    setModalType(null);
  };

  const handleConfirmSalary = (source) => {
    const amt = parseFloat(source.amount);
    if (!amt) return;
    const newTx = { id: uid(), concept: `Nómina: ${source.name}`, categoryId: null, type: "payroll_income", amount: amt, date: todayISO() };
    saveData({ ...data, transactions: [newTx, ...transactions] });
    notify(`Ingresados ${money(amt)} al Fondo General.`);
  };

  const handleTransfer = () => {
    const { from, to, amount } = transferForm;
    const amt = parseFloat(amount);
    if (!from || !to || from === to || isNaN(amt) || amt <= 0) return notify("Error en el traspaso");

    const t1 = { id: uid(), concept: "Traspaso enviado", categoryId: from, type: "transfer_expense", amount: amt, date: todayISO() };
    const t2 = { id: uid(), concept: "Traspaso recibido", categoryId: to, type: "transfer_income", amount: amt, date: todayISO() };

    saveData({ ...data, transactions: [t1, t2, ...transactions] });
    notify("Traspaso exitoso");
    setModalType(null);
  };

  const deleteTx = (id) => {
    saveData({ ...data, transactions: transactions.filter((t) => t.id !== id) });
    notify("Eliminado");
  };

  if (loading) return <div style={{ color: "white", padding: 40, textAlign: "center" }}>Cargando datos...</div>;

  return (
    <div className="app">
      <style>{`
        :root { --bg: #0F172A; --card: #1E293B; --accent: #EC4899; --text: #F8FAFC; --muted: #94A3B8; --border: rgba(255,255,255,0.08); --red: #EF4444; --green: #10B981; }
        * { box-sizing: border-box; font-family: system-ui, sans-serif; }
        body { background: var(--bg); color: var(--text); margin: 0; padding-bottom: 80px; }
        .app { max-width: 800px; margin: 0 auto; padding: 16px; }
        .balance-card { background: linear-gradient(135deg, #1E293B, #0F172A); border: 1px solid var(--border); border-radius: 16px; padding: 20px; text-align: center; margin-bottom: 20px; }
        .balance-val { font-size: 36px; font-weight: 800; color: ${globalUnallocated < 0 ? 'var(--red)' : 'var(--text)'}; }
        .section-title { font-size: 15px; font-weight: 700; margin: 20px 0 10px; display: flex; justify-content: space-between; align-items: center; }
        .cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
        .cat-card { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 16px; cursor: pointer; }
        .cat-card:hover { border-color: rgba(255,255,255,0.2); }
        .tx-item { background: var(--card); border-bottom: 1px solid var(--border); padding: 12px; display: flex; justify-content: space-between; align-items: center; }
        .fab { position: fixed; bottom: 24px; right: 24px; background: var(--accent); color: white; border: none; width: 56px; height: 56px; border-radius: 28px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 20px rgba(0,0,0,0.3); cursor: pointer; z-index: 99; }
        .modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 16px; }
        .modal { background: var(--card); width: 100%; max-width: 400px; border-radius: 20px; padding: 20px; border: 1px solid var(--border); }
        .field { margin-bottom: 12px; }
        .field label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 4px; font-weight: 600; }
        input, select { width: 100%; background: #0F172A; border: 1px solid var(--border); color: white; padding: 10px; border-radius: 8px; font-size: 14px; }
        .btn { width: 100%; background: var(--accent); color: white; border: none; padding: 12px; border-radius: 10px; font-weight: 700; cursor: pointer; margin-top: 8px; }
        .btn-sub { background: transparent; color: var(--muted); border: 1px solid var(--border); padding: 6px 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 12px; }
        .toast { position: fixed; top: 16px; right: 16px; background: var(--green); color: white; padding: 10px 16px; border-radius: 8px; font-weight: 600; font-size: 13px; z-index: 200; }
      `}</style>

      {toast && <div className="toast">{toast}</div>}

      {/* Menú Superior */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Gestión Financiera</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-sub" onClick={() => setModalType("transfer")}><ArrowRightLeft size={14} /> Traspaso</button>
          <button className="btn-sub" onClick={() => { setSourceForm({ id: null, name: "", amount: "" }); setModalType("source"); }}><Plus size={14} /> Nómina</button>
        </div>
      </div>

      {/* Estado Global */}
      <div className="balance-card">
        <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }}>FONDO GENERAL DISPONIBLE</span>
        <div className="balance-val">{money(globalUnallocated)}</div>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>Total Nóminas Ingresadas: {money(totalIncome)}</span>
      </div>

      {/* Fuentes de Ingreso / Nóminas */}
      {sources.length > 0 && (
        <>
          <div className="section-title">Ingreso Rápido de Nómina</div>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8 }}>
            {sources.map((s) => (
              <div key={s.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, minWidth: 160, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{money(s.amount)}</div>
                </div>
                <button className="btn-sub" style={{ padding: "4px 8px" }} onClick={() => handleConfirmSalary(s)}><Plus size={14} /></button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Sobres / Categorías */}
      <div className="section-title">
        <span>Sobres de Gastos</span>
        <button className="btn-sub" onClick={() => { setCatForm({ id: null, name: "", icon: "wallet", color: PRESET_COLORS[0], hasPin: false, pin: "" }); setModalType("cat"); }}><Plus size={14} /> Crear Sobre</button>
      </div>

      <div className="cat-grid">
        {categories.map((cat) => {
          const Icon = CAT_ICONS[cat.icon] || Wallet;
          const bal = categoryBalances[cat.id]?.balance || 0;
          const isLocked = cat.hasPin && !unlockedCats[cat.id];

          return (
            <div className="cat-card" key={cat.id} onClick={() => requirePin(cat.id, () => { setViewingCategory(cat); setModalType("view_cat"); })}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: cat.color, display: "flex", alignItems: "center", justifyCenter: "center", color: "white", padding: 6 }}>
                  <Icon size={20} />
                </div>
                <button className="btn-sub" onClick={(e) => { e.stopPropagation(); requirePin(cat.id, () => { setTxForm({ id: null, concept: "", categoryId: cat.id, type: "expense", amount: "", date: todayISO() }); setModalType("tx"); }); }}>
                  <Plus size={12} /> Gasto
                </button>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, margin: "10px 0 4px" }}>{isLocked ? "••••" : money(bal)}</div>
              <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                {cat.name} {cat.hasPin && <Lock size={12} color="var(--muted)" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Últimas Transacciones */}
      <div className="section-title">Historial de Transacciones</div>
      <div>
        {transactions.slice(0, 10).map((t) => {
          const cat = categories.find((c) => c.id === t.categoryId);
          const isExpense = t.type === "expense" || t.type === "transfer_expense";

          return (
            <div className="tx-item" key={t.id}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{t.concept}</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>{cat?.name || "Fondo General"} • {t.date}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontWeight: 800, color: isExpense ? "var(--red)" : "var(--green)" }}>
                  {isExpense ? "-" : "+"}{money(t.amount)}
                </span>
                <button className="btn-sub" style={{ padding: 4 }} onClick={() => deleteTx(t.id)}><Trash2 size={12} /></button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Botón Flotante */}
      <button className="fab" onClick={() => { setTxForm({ id: null, concept: "", categoryId: "", type: "expense", amount: "", date: todayISO() }); setModalType("tx"); }}>
        <Plus size={24} />
      </button>

      {/* MODAL TRANSACCIÓN */}
      {modalType === "tx" && (
        <div className="modal-bg" onClick={() => setModalType(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 16px" }}>Registrar Movimiento</h3>
            <div className="field">
              <label>Tipo</label>
              <select value={txForm.type} onChange={(e) => setTxForm({ ...txForm, type: e.target.value })}>
                <option value="expense">Gasto de Sobre (-)</option>
                <option value="income">Asignar de Fondo General a Sobre (+)</option>
              </select>
            </div>
            <div className="field">
              <label>Sobre / Categoría</label>
              <select value={txForm.categoryId} onChange={(e) => setTxForm({ ...txForm, categoryId: e.target.value })}>
                <option value="">Selecciona un sobre...</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Concepto</label>
              <input type="text" value={txForm.concept} onChange={(e) => setTxForm({ ...txForm, concept: e.target.value })} placeholder="Ej. Compra semanal" />
            </div>
            <div className="field">
              <label>Importe (€)</label>
              <input type="number" step="0.01" value={txForm.amount} onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })} autoFocus />
            </div>
            <button className="btn" onClick={handleSaveTx}>Guardar Movimiento</button>
          </div>
        </div>
      )}

      {/* MODAL TRASPASO */}
      {modalType === "transfer" && (
        <div className="modal-bg" onClick={() => setModalType(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 16px" }}>Traspasar Fondos</h3>
            <div className="field">
              <label>Desde (Origen)</label>
              <select onChange={(e) => setTransferForm({ ...transferForm, from: e.target.value })}>
                <option value="">Selecciona un sobre...</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Hacia (Destino)</label>
              <select onChange={(e) => setTransferForm({ ...transferForm, to: e.target.value })}>
                <option value="">Selecciona un sobre...</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Importe (€)</label>
              <input type="number" step="0.01" onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })} />
            </div>
            <button className="btn" onClick={handleTransfer}>Efectuar Traspaso</button>
          </div>
        </div>
      )}

      {/* MODAL CREAR/EDITAR CATEGORÍA */}
      {modalType === "cat" && (
        <div className="modal-bg" onClick={() => setModalType(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 16px" }}>Configurar Sobre</h3>
            <div className="field">
              <label>Nombre del Sobre</label>
              <input type="text" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} placeholder="Ej. Ocio" />
            </div>
            <div className="field">
              <label>Color</label>
              <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
                {PRESET_COLORS.map((color) => (
                  <div key={color} onClick={() => setCatForm({ ...catForm, color })} style={{ width: 24, height: 24, borderRadius: "50%", background: color, cursor: "pointer", border: catForm.color === color ? "2px solid white" : "none" }} />
                ))}
              </div>
            </div>
            <div className="field" style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0" }}>
              <input type="checkbox" id="pin" checked={catForm.hasPin} onChange={(e) => setCatForm({ ...catForm, hasPin: e.target.checked })} style={{ width: "auto" }} />
              <label htmlFor="pin" style={{ margin: 0 }}>Proteger con PIN</label>
            </div>
            {catForm.hasPin && (
              <div className="field">
                <label>PIN Clave</label>
                <input type="password" value={catForm.pin} onChange={(e) => setCatForm({ ...catForm, pin: e.target.value })} placeholder="••••" />
              </div>
            )}
            <button className="btn" onClick={handleSaveCategory}>Guardar Sobre</button>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURAR NÓMINA */}
      {modalType === "source" && (
        <div className="modal-bg" onClick={() => setModalType(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 16px" }}>Añadir Plantilla de Nómina</h3>
            <div className="field">
              <label>Nombre (Ej. Empresa X)</label>
              <input type="text" value={sourceForm.name} onChange={(e) => setSourceForm({ ...sourceForm, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Importe Habitual (€)</label>
              <input type="number" step="0.01" value={sourceForm.amount} onChange={(e) => setSourceForm({ ...sourceForm, amount: e.target.value })} />
            </div>
            <button className="btn" onClick={handleSaveSource}>Guardar Nómina</button>
          </div>
        </div>
      )}

      {/* MODAL PIN */}
      {modalType === "pin" && (
        <div className="modal-bg" onClick={() => setModalType(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>🔒 Introducir PIN</h3>
            <div className="field">
              <input type="password" value={pinInput} onChange={(e) => setPinInput(e.target.value)} autoFocus />
            </div>
            <button className="btn" onClick={handlePinSubmit}>Desbloquear</button>
          </div>
        </div>
      )}

      {/* MODAL DETALLE DE CATEGORÍA */}
      {modalType === "view_cat" && viewingCategory && (
        <div className="modal-bg" onClick={() => setModalType(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3>{viewingCategory.name}</h3>
              <button className="btn-sub" style={{ padding: 4 }} onClick={() => setModalType(null)}><X size={16} /></button>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, margin: "12px 0" }}>
              {money(categoryBalances[viewingCategory.id]?.balance)}
            </div>
            <div style={{ maxHeight: 200, overflowY: "auto" }}>
              {transactions.filter((t) => t.categoryId === viewingCategory.id).map((t) => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{t.concept}</div>
                    <div style={{ color: "var(--muted)", fontSize: 10 }}>{t.date}</div>
                  </div>
                  <span style={{ fontWeight: 700 }}>{money(t.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}