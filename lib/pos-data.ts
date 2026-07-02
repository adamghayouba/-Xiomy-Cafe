export type TopLevelCategory = "Bebidas" | "Comidas" | "Almuerzos";
export type BeverageSubcategory = "Calientes" | "Frías" | "Alcohol";
export type PaymentMethod =
  | "Efectivo"
  | "Transferencia";

export type Product = {
  id: string;
  name: string;
  category: TopLevelCategory;
  subcategory?: BeverageSubcategory;
  price: number;
  description: string;
  cost?: number;
  image?: string;
  active: boolean;
  trackStock: boolean;
  stockQuantity?: number;
  lowStockThreshold?: number;
};

export const topLevelCategories: TopLevelCategory[] = [
  "Bebidas",
  "Comidas",
  "Almuerzos"
];

export const beverageSubcategories: BeverageSubcategory[] = [
  "Calientes",
  "Frías",
  "Alcohol"
];

export const paymentMethods: PaymentMethod[] = [
  "Efectivo",
  "Transferencia"
];

export function isPaymentMethod(value: string): value is PaymentMethod {
  return value === "Efectivo" || value === "Transferencia";
}

export function isTopLevelCategory(value: string): value is TopLevelCategory {
  return topLevelCategories.includes(value as TopLevelCategory);
}

export function isBeverageSubcategory(value: string): value is BeverageSubcategory {
  return beverageSubcategories.includes(value as BeverageSubcategory);
}

const trackedDefaults = {
  active: true,
  trackStock: true,
  stockQuantity: 0,
  lowStockThreshold: 0
} as const;

const untrackedDefaults = {
  active: true,
  trackStock: false
} as const;

const pendingPriceDescription =
  "Producto cargado desde la lista real; falta completar el precio de venta.";

export const lunchProducts: Product[] = [
  {
    id: "alm-001",
    name: "Almuerzo Completo",
    category: "Almuerzos",
    price: 15000,
    description: "Servicio completo del almuerzo del día.",
    cost: 0,
    image: "🍽️",
    ...untrackedDefaults
  },
  {
    id: "alm-002",
    name: "Almuerzo Economico",
    category: "Almuerzos",
    price: 12000,
    description: "Opción económica del almuerzo del día.",
    cost: 0,
    image: "🥘",
    ...untrackedDefaults
  },
  {
    id: "alm-003",
    name: "Sopa",
    category: "Almuerzos",
    price: 10000,
    description: "Sopa servida caliente.",
    cost: 0,
    image: "🍲",
    ...untrackedDefaults
  }
];

export const products: Product[] = [
  {
    id: "beb-001",
    name: "Club Colombia",
    category: "Bebidas",
    subcategory: "Alcohol",
    price: 6000,
    description: "Cerveza nacional en botella.",
    cost: 0,
    image: "🍺",
    ...trackedDefaults
  },
  {
    id: "beb-002",
    name: "Aguila",
    category: "Bebidas",
    subcategory: "Alcohol",
    price: 4000,
    description: "Cerveza Aguila en botella.",
    cost: 2500,
    image: "🍺",
    ...trackedDefaults
  },
  {
    id: "beb-003",
    name: "Aguila Light",
    category: "Bebidas",
    subcategory: "Alcohol",
    price: 4000,
    description: "Cerveza Aguila Light en botella.",
    cost: 2600,
    image: "🍺",
    ...trackedDefaults
  },
  {
    id: "beb-004",
    name: "Pilsen",
    category: "Bebidas",
    subcategory: "Alcohol",
    price: 4000,
    description: "Cerveza Pilsen en botella.",
    cost: 2600,
    image: "🍺",
    ...trackedDefaults
  },
  {
    id: "beb-005",
    name: "Corona",
    category: "Bebidas",
    subcategory: "Alcohol",
    price: 0,
    description: pendingPriceDescription,
    cost: 0,
    image: "🍺",
    ...trackedDefaults
  },
  {
    id: "beb-006",
    name: "Coronita",
    category: "Bebidas",
    subcategory: "Alcohol",
    price: 0,
    description: pendingPriceDescription,
    cost: 0,
    image: "🍺",
    ...trackedDefaults
  },
  {
    id: "beb-007",
    name: "Agua",
    category: "Bebidas",
    subcategory: "Frías",
    price: 2000,
    description: "Agua embotellada.",
    cost: 0,
    image: "💧",
    ...trackedDefaults
  },
  {
    id: "beb-008",
    name: "Cocacola 400ml",
    category: "Bebidas",
    subcategory: "Frías",
    price: 3500,
    description: "Gaseosa Coca-Cola 400ml.",
    cost: 2500,
    image: "🥤",
    ...trackedDefaults
  },
  {
    id: "beb-009",
    name: "Cocacola mini",
    category: "Bebidas",
    subcategory: "Frías",
    price: 2500,
    description: "Gaseosa Coca-Cola mini.",
    cost: 1500,
    image: "🥤",
    ...trackedDefaults
  },
  {
    id: "beb-010",
    name: "Postobon Mini",
    category: "Bebidas",
    subcategory: "Frías",
    price: 2500,
    description: "Gaseosa Postobón mini.",
    cost: 1142,
    image: "🥤",
    ...trackedDefaults
  },
  {
    id: "beb-011",
    name: "Saviloe 320ml",
    category: "Bebidas",
    subcategory: "Frías",
    price: 3500,
    description: "Bebida Saviloe 320ml.",
    cost: 2030,
    image: "💧",
    ...trackedDefaults
  },
  {
    id: "beb-012",
    name: "Hydralite 640ml",
    category: "Bebidas",
    subcategory: "Frías",
    price: 5500,
    description: "Bebida Hydralite 640ml.",
    cost: 3400,
    image: "🍹",
    ...trackedDefaults
  },
  {
    id: "beb-013",
    name: "Bretaña",
    category: "Bebidas",
    subcategory: "Frías",
    price: 3000,
    description: "Bebida Bretaña.",
    cost: 1917,
    image: "🥤",
    ...trackedDefaults
  },
  {
    id: "beb-014",
    name: "Malta",
    category: "Bebidas",
    subcategory: "Frías",
    price: 3500,
    description: "Bebida malta.",
    cost: 2070,
    image: "🥤",
    ...trackedDefaults
  },
  {
    id: "beb-015",
    name: "Poni Malta",
    category: "Bebidas",
    subcategory: "Frías",
    price: 2000,
    description: "Poni Malta individual.",
    cost: 1100,
    image: "🥤",
    ...trackedDefaults
  },
  {
    id: "beb-016",
    name: "Vaso Michelada",
    category: "Bebidas",
    subcategory: "Alcohol",
    price: 2000,
    description: "Preparación de michelada en vaso.",
    cost: 0,
    image: "🍺",
    ...trackedDefaults
  },
  {
    id: "beb-017",
    name: "Tutti Frutti",
    category: "Bebidas",
    subcategory: "Frías",
    price: 3000,
    description: "Bebida Tutti Frutti.",
    cost: 1666,
    image: "🧃",
    ...trackedDefaults
  },
  {
    id: "beb-018",
    name: "Gaseosa Postobon",
    category: "Bebidas",
    subcategory: "Frías",
    price: 3500,
    description: "Gaseosa Postobón.",
    cost: 1666,
    image: "🥤",
    ...trackedDefaults
  },
  {
    id: "com-001",
    name: "Chuzos de Pollo",
    category: "Comidas",
    price: 15000,
    description: "Chuzos de pollo listos para servir.",
    cost: 7000,
    image: "🍢",
    ...trackedDefaults
  },
  {
    id: "com-002",
    name: "Salchipapa Sencilla",
    category: "Comidas",
    price: 5000,
    description: "Salchipapa sencilla.",
    cost: 0,
    image: "🍟",
    ...untrackedDefaults
  },
  {
    id: "com-003",
    name: "Salchipapa Chorizo",
    category: "Comidas",
    price: 8000,
    description: "Salchipapa con chorizo.",
    cost: 0,
    image: "🍟",
    ...untrackedDefaults
  },
  {
    id: "com-004",
    name: "Butifarra",
    category: "Comidas",
    price: 1000,
    description: "Butifarra individual.",
    cost: 338,
    image: "🥩",
    ...trackedDefaults
  },
  {
    id: "com-005",
    name: "Panceroti",
    category: "Comidas",
    price: 5000,
    description: "Panceroti listo para servir.",
    cost: 0,
    image: "🥟",
    ...trackedDefaults
  },
  {
    id: "com-006",
    name: "Palito de queso",
    category: "Comidas",
    price: 5000,
    description: "Palito de queso.",
    cost: 0,
    image: "🧀",
    ...trackedDefaults
  },
  {
    id: "com-007",
    name: "Porción Torta Red Velvet",
    category: "Comidas",
    price: 0,
    description: pendingPriceDescription,
    cost: 0,
    image: "🍰",
    ...trackedDefaults
  },
  {
    id: "com-008",
    name: "Porción Torta Zanahoria",
    category: "Comidas",
    price: 0,
    description: pendingPriceDescription,
    cost: 0,
    image: "🍰",
    ...trackedDefaults
  },
  {
    id: "alc-001",
    name: "Litro Aguardiente Verde",
    category: "Bebidas",
    subcategory: "Alcohol",
    price: 0,
    description: pendingPriceDescription,
    cost: 0,
    image: "🍾",
    ...trackedDefaults
  },
  {
    id: "alc-002",
    name: "Botella Aguardiente",
    category: "Bebidas",
    subcategory: "Alcohol",
    price: 0,
    description: pendingPriceDescription,
    cost: 0,
    image: "🍾",
    ...trackedDefaults
  },
  {
    id: "alc-003",
    name: "Bailys 700ml",
    category: "Bebidas",
    subcategory: "Alcohol",
    price: 0,
    description: pendingPriceDescription,
    cost: 0,
    image: "🥃",
    ...trackedDefaults
  },
  {
    id: "alc-004",
    name: "Jose Cuervo 375ml",
    category: "Bebidas",
    subcategory: "Alcohol",
    price: 0,
    description: pendingPriceDescription,
    cost: 0,
    image: "🥃",
    ...trackedDefaults
  },
  {
    id: "alc-005",
    name: "1/2 Aguardiente Azul",
    category: "Bebidas",
    subcategory: "Alcohol",
    price: 0,
    description: pendingPriceDescription,
    cost: 0,
    image: "🥃",
    ...trackedDefaults
  },
  {
    id: "alc-006",
    name: "1/2 Aguardiente Rojo",
    category: "Bebidas",
    subcategory: "Alcohol",
    price: 0,
    description: pendingPriceDescription,
    cost: 0,
    image: "🥃",
    ...trackedDefaults
  },
  {
    id: "alc-007",
    name: "1/2 Aguardiente Verde",
    category: "Bebidas",
    subcategory: "Alcohol",
    price: 0,
    description: pendingPriceDescription,
    cost: 0,
    image: "🥃",
    ...trackedDefaults
  },
  {
    id: "alc-008",
    name: "Garrafa Aguardiente Azul",
    category: "Bebidas",
    subcategory: "Alcohol",
    price: 0,
    description: pendingPriceDescription,
    cost: 0,
    image: "🥃",
    ...trackedDefaults
  },
  {
    id: "alc-009",
    name: "Garrafa Aguardiente Roja",
    category: "Bebidas",
    subcategory: "Alcohol",
    price: 0,
    description: pendingPriceDescription,
    cost: 0,
    image: "🥃",
    ...trackedDefaults
  },
  {
    id: "alc-010",
    name: "Garrafa Aguardiente Verde",
    category: "Bebidas",
    subcategory: "Alcohol",
    price: 0,
    description: pendingPriceDescription,
    cost: 0,
    image: "🥃",
    ...trackedDefaults
  },
  {
    id: "alc-011",
    name: "1/2 Ron Caldas",
    category: "Bebidas",
    subcategory: "Alcohol",
    price: 0,
    description: pendingPriceDescription,
    cost: 0,
    image: "🥃",
    ...trackedDefaults
  },
  {
    id: "alc-012",
    name: "Garrafa Ron Caldas",
    category: "Bebidas",
    subcategory: "Alcohol",
    price: 0,
    description: pendingPriceDescription,
    cost: 0,
    image: "🥃",
    ...trackedDefaults
  },
  {
    id: "alc-013",
    name: "Botella Ron Caldas",
    category: "Bebidas",
    subcategory: "Alcohol",
    price: 0,
    description: pendingPriceDescription,
    cost: 0,
    image: "🥃",
    ...trackedDefaults
  },
  {
    id: "alc-014",
    name: "Bucanas",
    category: "Bebidas",
    subcategory: "Alcohol",
    price: 0,
    description: pendingPriceDescription,
    cost: 0,
    image: "🥃",
    ...trackedDefaults
  },
  {
    id: "alc-015",
    name: "1/4 Aguardiente verde",
    category: "Bebidas",
    subcategory: "Alcohol",
    price: 20000,
    description: "Cuarto de aguardiente verde.",
    cost: 14700,
    image: "🥃",
    ...trackedDefaults
  },
  {
    id: "alc-016",
    name: "Buchanas 375ml",
    category: "Bebidas",
    subcategory: "Alcohol",
    price: 110000,
    description: "Whisky Buchanas 375ml.",
    cost: 86800,
    image: "🥃",
    ...trackedDefaults
  },
  {
    id: "alc-017",
    name: "Old Par 500ml",
    category: "Bebidas",
    subcategory: "Alcohol",
    price: 130000,
    description: "Whisky Old Par 500ml.",
    cost: 94000,
    image: "🥃",
    ...trackedDefaults
  },
  {
    id: "alc-018",
    name: "Shot Aguardiente",
    category: "Bebidas",
    subcategory: "Alcohol",
    price: 0,
    description: pendingPriceDescription,
    cost: 0,
    image: "🥃",
    ...untrackedDefaults
  },
  {
    id: "alc-019",
    name: "Shot Ron",
    category: "Bebidas",
    subcategory: "Alcohol",
    price: 0,
    description: pendingPriceDescription,
    cost: 0,
    image: "🥃",
    ...untrackedDefaults
  },
  {
    id: "alc-020",
    name: "Shot Whisky",
    category: "Bebidas",
    subcategory: "Alcohol",
    price: 0,
    description: pendingPriceDescription,
    cost: 0,
    image: "🥃",
    ...untrackedDefaults
  },
  {
    id: "cal-001",
    name: "Tinto",
    category: "Bebidas",
    subcategory: "Calientes",
    price: 1200,
    description: "Tinto servido al momento.",
    cost: 0,
    image: "☕",
    ...untrackedDefaults
  },
  {
    id: "cal-002",
    name: "Aromatica",
    category: "Bebidas",
    subcategory: "Calientes",
    price: 1000,
    description: "Aromática caliente.",
    cost: 0,
    image: "🍵",
    ...trackedDefaults
  },
  {
    id: "cal-003",
    name: "Aromatica Leche",
    category: "Bebidas",
    subcategory: "Calientes",
    price: 2000,
    description: "Aromática con leche.",
    cost: 0,
    image: "🍵",
    ...trackedDefaults
  },
  {
    id: "cal-004",
    name: "Café con leche",
    category: "Bebidas",
    subcategory: "Calientes",
    price: 2300,
    description: "Café con leche caliente.",
    cost: 0,
    image: "☕",
    ...untrackedDefaults
  },
  {
    id: "cal-005",
    name: "Milo",
    category: "Bebidas",
    subcategory: "Calientes",
    price: 0,
    description: pendingPriceDescription,
    cost: 0,
    image: "🍫",
    ...untrackedDefaults
  },
  ...lunchProducts
];
