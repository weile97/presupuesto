import {
  PawPrint, UtensilsCrossed, AlertTriangle, Home, Car, ShoppingBag, Plane, Gift, Heart, Wallet,
  Banknote, PiggyBank, Coins, Landmark, Sparkles, Umbrella, GraduationCap, Dumbbell, Baby, Shirt, Smartphone
} from "lucide-react";

export const API_URL = "/api/data";
export const TX_PAGE = 40;
export const EMPTY = Object.freeze([]); // referencia estable para no invalidar los useMemo en cada render

// En pantallas táctiles el arrastre HTML5 captura el gesto y bloquea el scroll
export const CAN_DRAG = typeof window !== "undefined" && !!window.matchMedia?.("(pointer: fine)").matches;

export const CAT_ICONS = {
  paw: PawPrint, food: UtensilsCrossed, alert: AlertTriangle, home: Home,
  car: Car, bag: ShoppingBag, plane: Plane, gift: Gift, heart: Heart, wallet: Wallet, coins: Coins,
  piggy: PiggyBank, bank: Landmark, sparkle: Sparkles, umbrella: Umbrella,
  study: GraduationCap, gym: Dumbbell, baby: Baby, clothes: Shirt, phone: Smartphone
};
export const CAT_ICON_ORDER = Object.keys(CAT_ICONS);

export const SRC_ICONS = { banknote: Banknote, piggy: PiggyBank, wallet: Wallet, gift: Gift, coins: Coins, bank: Landmark };

export const PRESET_COLORS = [
  "#F472B6", "#EC4899", "#DB2777", "#F9A8D4", "#FBCFE8", "#E879F9",
  "#D946EF", "#C084FC", "#A855F7", "#8B5CF6", "#7C3AED", "#818CF8",
  "#6366F1", "#4F46E5", "#3B82F6", "#2563EB", "#60A5FA", "#38BDF8",
  "#0EA5E9", "#22D3EE", "#2DD4BF", "#14B8A6", "#10B981", "#059669",
  "#34D399", "#A3E635", "#84CC16", "#BEF264", "#FACC15", "#EAB308",
  "#F59E0B", "#FB923C", "#F97316", "#EA580C", "#F87171", "#EF4444",
  "#DC2626", "#7C2D12", "#78350F", "#64748B"
];
