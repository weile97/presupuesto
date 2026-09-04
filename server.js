import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

// Definición de __dirname para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json());

const INITIAL_STATE = {
  lastActiveMonth: new Date().toISOString().slice(0, 7),
  sources: [
    { id: "src-josna", name: "Nómina Josna", icon: "banknote", color: "#3B82F6", amount: 1500 },
    { id: "src-meli", name: "Nómina Meli", icon: "piggy", color: "#EC4899", amount: 1400 },
    { id: "src-propinas", name: "Propinas Meli 🍸", icon: "coins", color: "#F59E0B", amount: 0 }
  ],
  categories: [
    { id: "cat-mascotas", name: "Mascotas", icon: "paw", color: "#10B981", hasPin: false, pin: "", initialBalance: 0 },
    { id: "cat-comida", name: "Alimentación", icon: "food", color: "#F59E0B", hasPin: false, pin: "", initialBalance: 0 },
    { id: "cat-propinas", name: "Ocio & Extras", icon: "coins", color: "#8B5CF6", hasPin: false, pin: "", initialBalance: 0 },
    { id: "cat-imprevistos", name: "Fondo Emergencia", icon: "alert", color: "#EF4444", hasPin: true, pin: "1234", initialBalance: 0 }
  ],
  transactions: []
};

app.get('/api/data', (req, res) => {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(INITIAL_STATE, null, 2));
    return res.json(INITIAL_STATE);
  }
  try {
    const rawData = fs.readFileSync(DATA_FILE, 'utf-8');
    res.json(JSON.parse(rawData));
  } catch (error) {
    res.status(500).json({ error: "Error leyendo data.json" });
  }
});

app.post('/api/data', (req, res) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Error guardando en data.json" });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor activo en http://localhost:${PORT}`);
});