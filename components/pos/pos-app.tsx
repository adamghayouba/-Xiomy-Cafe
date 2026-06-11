"use client";

import {
  BadgeDollarSign,
  Download,
  FileSpreadsheet,
  PencilLine,
  PlusCircle,
  Search,
  ShoppingCart,
  ShieldCheck,
  Users,
  Wallet,
  X
} from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  beverageSubcategories,
  paymentMethods,
  type BeverageSubcategory,
  type PaymentMethod,
  type Product,
  topLevelCategories,
  type TopLevelCategory
} from "@/lib/pos-data";
import {
  clientPricingTypes,
  emptyClientForm,
  emptyDailySummary,
  emptyProductForm,
  getClientPricingLabel,
  getOrderItemEstimatedCost,
  getOrderTotal,
  getSaleAdjustments,
  getSaleStatusLabel,
  getSettlementTypeLabel,
  isProductLowStock,
  isProductOutOfStock
} from "@/lib/pos-domain";
import {
  formatProfileIdentity,
  getRolePermissions,
  type PosPermission
} from "@/lib/pos-permissions";
import type {
  CashCloseoutRecord,
  CashCloseoutSnapshot,
  ClientFormState,
  ClientTabAccount,
  ClientTabAccountSummary,
  ClientTabAccountsResponse,
  ClientReportPeriod,
  ClientUsageReport,
  DailySummary,
  OrderItem,
  PosBootstrapData,
  PosClient,
  ProductFormState,
  SalesReport,
  SalesReportPeriod,
  SaleCancellationRequest,
  SaleHistoryEntry
} from "@/lib/pos-types";
import { formatCop, formatSaleTime, getTodayKey } from "@/lib/pos-utils";
import { downloadLowStockPdf } from "@/lib/stock-pdf";
import {
  downloadSalesReportCsv,
  downloadSalesReportPdf
} from "@/lib/sales-report-export";

type PosAppProps = {
  initialData: PosBootstrapData;
};

type JefaSection = "ventas" | "productos" | "clientes";
type JefaProductSection = "catalogo" | "stock";
type JefaClientSection = "lista" | "consumo";
type AlcoholType = "Cerveza" | "Aguardiente" | "Ron" | "Whisky" | "Otros";
type AlcoholPresentation =
  | "Shot"
  | "Vaso"
  | "1/4"
  | "1/2"
  | "Botella"
  | "Garrafa"
  | "Litro"
  | "375ml"
  | "500ml"
  | "700ml"
  | "Otros";

function getAlcoholType(product: Product): AlcoholType {
  const name = product.name.toLowerCase();

  if (
    name.includes("club colombia") ||
    name.includes("aguila") ||
    name.includes("pilsen") ||
    name.includes("corona") ||
    name.includes("coronita") ||
    name.includes("michelada")
  ) {
    return "Cerveza";
  }

  if (name.includes("aguardiente")) {
    return "Aguardiente";
  }

  if (name.includes("ron")) {
    return "Ron";
  }

  if (
    name.includes("whisky") ||
    name.includes("buchanas") ||
    name.includes("bucanas") ||
    name.includes("old par")
  ) {
    return "Whisky";
  }

  return "Otros";
}

function getAlcoholPresentation(product: Product): AlcoholPresentation | null {
  const name = product.name.toLowerCase();

  if (name.includes("shot")) return "Shot";
  if (name.includes("vaso")) return "Vaso";
  if (name.includes("1/4")) return "1/4";
  if (name.includes("1/2")) return "1/2";
  if (name.includes("garrafa")) return "Garrafa";
  if (name.includes("litro")) return "Litro";
  if (name.includes("botella")) return "Botella";
  if (name.includes("375ml")) return "375ml";
  if (name.includes("500ml")) return "500ml";
  if (name.includes("700ml")) return "700ml";

  return getAlcoholType(product) === "Cerveza" ? null : "Otros";
}

function renderProductBadge(product: Product) {
  const name = product.name.toLowerCase();

  if (name.includes("aguardiente verde")) {
    return (
      <span
        className="block h-7 w-7 rounded-xl ring-1 ring-emerald-300"
        style={{ backgroundColor: "#22c55e" }}
      />
    );
  }

  if (name.includes("aguardiente rojo") || name.includes("aguardiente roja")) {
    return (
      <span
        className="block h-7 w-7 rounded-xl ring-1 ring-rose-300"
        style={{ backgroundColor: "#ef4444" }}
      />
    );
  }

  if (name.includes("aguardiente azul")) {
    return (
      <span
        className="block h-7 w-7 rounded-xl ring-1 ring-sky-300"
        style={{ backgroundColor: "#3b82f6" }}
      />
    );
  }

  if (name.includes("shot")) {
    return "🥃";
  }

  if (
    name.includes("botella") ||
    name.includes("garrafa") ||
    name.includes("litro") ||
    name.includes("375ml") ||
    name.includes("500ml") ||
    name.includes("700ml")
  ) {
    return "🍾";
  }

  return product.image || "🍽️";
}

export function PosApp({ initialData }: PosAppProps) {
  const permissions = useMemo(
    () => getRolePermissions(initialData.profile.role),
    [initialData.profile.role]
  );
  const identityLabel = useMemo(
    () => formatProfileIdentity(initialData.profile.role, initialData.profile.fullName),
    [initialData.profile.fullName, initialData.profile.role]
  );
  const [selectedCategory, setSelectedCategory] = useState<TopLevelCategory>("Bebidas");
  const [selectedBeverageSubcategory, setSelectedBeverageSubcategory] =
    useState<BeverageSubcategory>("Calientes");
  const [selectedAlcoholType, setSelectedAlcoholType] = useState<AlcoholType>("Cerveza");
  const [selectedAlcoholPresentation, setSelectedAlcoholPresentation] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [menuProducts, setMenuProducts] = useState<Product[]>(initialData.products);
  const [clients, setClients] = useState<PosClient[]>(initialData.clients);
  const [currentOrder, setCurrentOrder] = useState<OrderItem[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod | null>(null);
  const [cashReceived, setCashReceived] = useState("");
  const [dailySummary, setDailySummary] = useState<DailySummary>(
    initialData.dailySummary ?? emptyDailySummary()
  );
  const [recentSales, setRecentSales] = useState<SaleHistoryEntry[]>(initialData.recentSales);
  const [productForm, setProductForm] = useState<ProductFormState>(emptyProductForm);
  const [clientForm, setClientForm] = useState<ClientFormState>(emptyClientForm);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [salesMessage, setSalesMessage] = useState<string | null>(null);
  const [productMessage, setProductMessage] = useState<string | null>(null);
  const [clientMessage, setClientMessage] = useState<string | null>(null);
  const [jefaSection, setJefaSection] = useState<JefaSection>("ventas");
  const [jefaProductSection, setJefaProductSection] = useState<JefaProductSection>("catalogo");
  const [jefaClientSection, setJefaClientSection] = useState<JefaClientSection>("lista");
  const [clientReport, setClientReport] = useState<ClientUsageReport | null>(null);
  const [salesReport, setSalesReport] = useState<SalesReport | null>(null);
  const [tabAccounts, setTabAccounts] = useState<ClientTabAccountSummary[]>([]);
  const [selectedTabClientId, setSelectedTabClientId] = useState<string>("");
  const [fatherTabAccount, setFatherTabAccount] = useState<ClientTabAccount | null>(null);
  const [reportPeriod, setReportPeriod] = useState<ClientReportPeriod>("month");
  const [reportStartDate, setReportStartDate] = useState(getTodayKey());
  const [reportEndDate, setReportEndDate] = useState(getTodayKey());
  const [reportError, setReportError] = useState<string | null>(null);
  const [salesReportPeriod, setSalesReportPeriod] = useState<SalesReportPeriod>("day");
  const [salesReportStartDate, setSalesReportStartDate] = useState(getTodayKey());
  const [salesReportEndDate, setSalesReportEndDate] = useState(getTodayKey());
  const [salesReportError, setSalesReportError] = useState<string | null>(null);
  const [fatherTabError, setFatherTabError] = useState<string | null>(null);
  const [isFiadoOpen, setIsFiadoOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Efectivo");
  const [paymentPaidByName, setPaymentPaidByName] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [pendingCancellationRequests, setPendingCancellationRequests] = useState<
    SaleCancellationRequest[]
  >([]);
  const [cancellationSale, setCancellationSale] = useState<SaleHistoryEntry | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancellationMessage, setCancellationMessage] = useState<string | null>(null);
  const [isCloseoutOpen, setIsCloseoutOpen] = useState(false);
  const [closeoutMessage, setCloseoutMessage] = useState<string | null>(null);
  const [countedCash, setCountedCash] = useState("");
  const [closeoutNotes, setCloseoutNotes] = useState("");
  const [closeoutSnapshot, setCloseoutSnapshot] = useState<CashCloseoutSnapshot | null>(null);
  const [closeoutHistory, setCloseoutHistory] = useState<CashCloseoutRecord[]>([]);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [isSavingSale, startSaleTransition] = useTransition();
  const [isSavingProduct, startProductTransition] = useTransition();
  const [isSavingClient, startClientTransition] = useTransition();
  const [isLoadingReport, startReportTransition] = useTransition();
  const [isLoadingSalesReport, startSalesReportTransition] = useTransition();
  const [isLoadingFatherTab, startFatherTabTransition] = useTransition();
  const [isSavingPayment, startPaymentTransition] = useTransition();
  const [isLoadingCancellationRequests, startCancellationRequestsTransition] =
    useTransition();
  const [isSubmittingCancellationRequest, startCancellationRequestTransition] =
    useTransition();
  const [isResolvingCancellation, startCancellationResolveTransition] = useTransition();
  const [isLoadingCloseout, startCloseoutTransition] = useTransition();
  const [isSavingCloseout, startCloseoutSaveTransition] = useTransition();

  function can(permission: PosPermission) {
    return permissions[permission];
  }

  const activeClients = useMemo(
    () => clients.filter((client) => client.active),
    [clients]
  );

  const selectedClient = useMemo(
    () => activeClients.find((client) => client.id === selectedClientId) ?? null,
    [activeClients, selectedClientId]
  );

  const alcoholProducts = useMemo(
    () =>
      menuProducts.filter(
        (product) =>
          product.active &&
          product.category === "Bebidas" &&
          product.subcategory === "Alcohol"
      ),
    [menuProducts]
  );

  const alcoholTypes = useMemo(() => {
    const order: AlcoholType[] = ["Cerveza", "Aguardiente", "Ron", "Whisky", "Otros"];
    return order.filter((type) =>
      alcoholProducts.some((product) => getAlcoholType(product) === type)
    );
  }, [alcoholProducts]);

  const alcoholPresentationOptions = useMemo(() => {
    const options = new Set<string>();

    alcoholProducts.forEach((product) => {
      if (getAlcoholType(product) !== selectedAlcoholType) {
        return;
      }

      const presentation = getAlcoholPresentation(product);

      if (presentation) {
        options.add(presentation);
      }
    });

    const orderedOptions: AlcoholPresentation[] = [
      "Shot",
      "Vaso",
      "1/4",
      "1/2",
      "Botella",
      "Garrafa",
      "Litro",
      "375ml",
      "500ml",
      "700ml",
      "Otros"
    ];

    return orderedOptions.filter((option) => options.has(option));
  }, [alcoholProducts, selectedAlcoholType]);

  const visibleProducts = useMemo(() => {
    return menuProducts.filter((product) => {
      if (!product.active) {
        return false;
      }

      if (product.category !== selectedCategory) {
        return false;
      }

      if (
        selectedCategory === "Bebidas" &&
        product.subcategory !== selectedBeverageSubcategory
      ) {
        return false;
      }

      if (
        selectedCategory === "Bebidas" &&
        selectedBeverageSubcategory === "Alcohol"
      ) {
        if (getAlcoholType(product) !== selectedAlcoholType) {
          return false;
        }

        if (selectedAlcoholPresentation !== "all") {
          return getAlcoholPresentation(product) === selectedAlcoholPresentation;
        }
      }

      return product.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
    });
  }, [
    menuProducts,
    searchQuery,
    selectedAlcoholPresentation,
    selectedAlcoholType,
    selectedBeverageSubcategory,
    selectedCategory
  ]);

  const orderTotal = useMemo(() => getOrderTotal(currentOrder), [currentOrder]);
  const checkoutTotals = useMemo(
    () => getSaleAdjustments(currentOrder, selectedClient?.pricingType),
    [currentOrder, selectedClient?.pricingType]
  );
  const currentOrderCount = useMemo(
    () => currentOrder.reduce((total, item) => total + item.quantity, 0),
    [currentOrder]
  );
  const sortedProducts = useMemo(
    () => [...menuProducts].sort((left, right) => left.name.localeCompare(right.name)),
    [menuProducts]
  );
  const stockTrackedProducts = useMemo(() => {
    return [...menuProducts]
      .filter((product) => product.trackStock && product.active)
      .sort((left, right) => {
        const leftOut = isProductOutOfStock(left) ? 0 : isProductLowStock(left) ? 1 : 2;
        const rightOut = isProductOutOfStock(right) ? 0 : isProductLowStock(right) ? 1 : 2;

        if (leftOut !== rightOut) {
          return leftOut - rightOut;
        }

        return (left.stockQuantity ?? 0) - (right.stockQuantity ?? 0) || left.name.localeCompare(right.name);
      });
  }, [menuProducts]);
  const sortedClients = useMemo(
    () => [...clients].sort((left, right) => left.fullName.localeCompare(right.fullName)),
    [clients]
  );
  const requiresPaymentMethod =
    checkoutTotals.saleStatus === "paid" && checkoutTotals.netTotal > 0;
  const isJefaView = initialData.profile.role === "jefa";
  const roleHeroLabel = initialData.profile.role === "jefa" ? "Administración activa" : "Caja activa";
  const paymentAmountNumber = Number(paymentAmount);
  const cashReceivedNumber = Number(cashReceived);
  const countedCashNumber = Number(countedCash);
  const outOfStockCount = useMemo(
    () => stockTrackedProducts.filter((product) => isProductOutOfStock(product)).length,
    [stockTrackedProducts]
  );
  const lowStockCount = useMemo(
    () =>
      stockTrackedProducts.filter(
        (product) => !isProductOutOfStock(product) && isProductLowStock(product)
      ).length,
    [stockTrackedProducts]
  );
  const availableStockCount = useMemo(
    () =>
      stockTrackedProducts.filter(
        (product) => !isProductOutOfStock(product) && !isProductLowStock(product)
      ).length,
    [stockTrackedProducts]
  );
  const pendingCancellationCount = pendingCancellationRequests.filter(
    (request) => request.status === "pending"
  ).length;
  const latestCloseoutAt = closeoutHistory[0]?.createdAt ?? null;
  const todayKey = getTodayKey(new Date(nowTick));
  const closeoutDifference =
    closeoutSnapshot && Number.isFinite(countedCashNumber)
      ? countedCashNumber - closeoutSnapshot.expectedCash
      : null;
  const isCashCheckout = requiresPaymentMethod && selectedPaymentMethod === "Efectivo";
  const cashChangeDue =
    isCashCheckout && Number.isFinite(cashReceivedNumber)
      ? cashReceivedNumber - checkoutTotals.netTotal
      : null;
  const visibleRecentSales = useMemo(() => {
    if (isJefaView) {
      return recentSales;
    }

    return recentSales.filter((sale) => {
      const createdAt = new Date(sale.createdAt).getTime();
      const lastCloseoutTime = latestCloseoutAt ? new Date(latestCloseoutAt).getTime() : null;
      const saleDayKey = getTodayKey(new Date(sale.createdAt));

      return (
        Number.isFinite(createdAt) &&
        saleDayKey === todayKey &&
        nowTick - createdAt <= 30 * 60 * 1000 &&
        (!Number.isFinite(lastCloseoutTime ?? NaN) || createdAt > (lastCloseoutTime ?? 0))
      );
    });
  }, [isJefaView, latestCloseoutAt, nowTick, recentSales, todayKey]);
  const latestRecentSaleId = visibleRecentSales[0]?.id ?? null;
  const shortCloseoutAmount =
    closeoutSnapshot && Number.isFinite(countedCashNumber) && countedCashNumber < closeoutSnapshot.expectedCash
      ? closeoutSnapshot.expectedCash - countedCashNumber
      : 0;
  const shortCloseoutAlerts = closeoutHistory.filter((closeout) => closeout.difference < 0);

  useEffect(() => {
    if (isJefaView) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNowTick(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isJefaView]);

  useEffect(() => {
    if (
      selectedCategory === "Bebidas" &&
      selectedBeverageSubcategory === "Alcohol" &&
      alcoholTypes.length &&
      !alcoholTypes.includes(selectedAlcoholType)
    ) {
      setSelectedAlcoholType(alcoholTypes[0]);
    }
  }, [alcoholTypes, selectedAlcoholType, selectedBeverageSubcategory, selectedCategory]);

  useEffect(() => {
    if (
      selectedCategory === "Bebidas" &&
      selectedBeverageSubcategory === "Alcohol" &&
      selectedAlcoholPresentation !== "all" &&
      !alcoholPresentationOptions.includes(selectedAlcoholPresentation as AlcoholPresentation)
    ) {
      setSelectedAlcoholPresentation("all");
    }
  }, [
    alcoholPresentationOptions,
    selectedAlcoholPresentation,
    selectedBeverageSubcategory,
    selectedCategory
  ]);

  function addProductToOrder(product: Product) {
    if (!can("sales.view")) {
      return;
    }

    if (product.price <= 0) {
      setSalesMessage(`Completa el precio de venta de ${product.name} antes de venderlo.`);
      return;
    }

    if (isProductOutOfStock(product)) {
      setSalesMessage(`${product.name} está sin stock.`);
      return;
    }

    setSalesMessage(null);
    setCurrentOrder((items) => {
      const existingItem = items.find((item) => item.product.id === product.id);

      if (existingItem) {
        if (
          product.trackStock &&
          existingItem.quantity + 1 > (product.stockQuantity ?? 0)
        ) {
          setSalesMessage(`No hay más unidades disponibles de ${product.name}.`);
          return items;
        }

        return items.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...items, { product, quantity: 1 }];
    });
  }

  function updateQuantity(productId: string, change: number) {
    if (!can("sales.view")) {
      return;
    }

    setCurrentOrder((items) => {
      return items
        .map((item) => {
          if (item.product.id !== productId) {
            return item;
          }

          const nextQuantity = item.quantity + change;

          if (
            change > 0 &&
            item.product.trackStock &&
            nextQuantity > (item.product.stockQuantity ?? 0)
          ) {
            setSalesMessage(`No hay más unidades disponibles de ${item.product.name}.`);
            return item;
          }

          return { ...item, quantity: nextQuantity };
        })
        .filter((item) => item.quantity > 0);
    });
  }

  function removeOrderItem(productId: string) {
    if (!can("sales.view")) {
      return;
    }

    setCurrentOrder((items) => items.filter((item) => item.product.id !== productId));
  }

  function clearCurrentOrder() {
    if (!can("sales.view")) {
      return;
    }

    setCurrentOrder([]);
    setSelectedClientId("");
    setSelectedPaymentMethod(null);
    setCashReceived("");
    setSalesMessage(null);
  }

  function handleClientSelection(clientId: string) {
    setSelectedClientId(clientId);
    setSalesMessage(null);

    const client = activeClients.find((item) => item.id === clientId);

    if (!client || client.pricingType !== "normal") {
      setSelectedPaymentMethod(null);
      setCashReceived("");
    }
  }

  function updateProductForm<K extends keyof ProductFormState>(
    key: K,
    value: ProductFormState[K]
  ) {
    if (!can("products.admin")) {
      return;
    }

    setProductForm((currentForm) => {
      if (key === "trackStock" && value === false) {
        return {
          ...currentForm,
          trackStock: false,
          stockQuantity: "",
          lowStockThreshold: ""
        };
      }

      if (key === "category" && value !== "Bebidas") {
        return {
          ...currentForm,
          [key]: value,
          subcategory: ""
        };
      }

      if (key === "category" && value === "Bebidas" && !currentForm.subcategory) {
        return {
          ...currentForm,
          [key]: value,
          subcategory: "Calientes"
        };
      }

      return {
        ...currentForm,
        [key]: value
      };
    });
  }

  function resetProductForm() {
    setProductForm(emptyProductForm);
    setEditingProductId(null);
    setProductMessage(null);
  }

  function startEditingProduct(product: Product) {
    if (!can("products.edit")) {
      return;
    }

    setEditingProductId(product.id);
    setProductMessage(null);
    setProductForm({
      id: product.id,
      name: product.name,
      category: product.category,
      subcategory: product.subcategory ?? "",
      price: product.price.toString(),
      cost: product.cost?.toString() ?? "",
      image: product.image ?? "",
      active: product.active,
      trackStock: product.trackStock,
      stockQuantity:
        typeof product.stockQuantity === "number" ? product.stockQuantity.toString() : "",
      lowStockThreshold:
        typeof product.lowStockThreshold === "number"
          ? product.lowStockThreshold.toString()
          : ""
    });
  }

  function updateClientForm<K extends keyof ClientFormState>(
    key: K,
    value: ClientFormState[K]
  ) {
    if (!can("products.admin")) {
      return;
    }

    setClientForm((currentForm) => ({
      ...currentForm,
      [key]: value
    }));
  }

  function resetClientForm() {
    setClientForm(emptyClientForm);
    setEditingClientId(null);
    setClientMessage(null);
  }

  function startEditingClient(client: PosClient) {
    if (!can("products.admin")) {
      return;
    }

    setEditingClientId(client.id);
    setClientMessage(null);
    setClientForm({
      id: client.id,
      fullName: client.fullName,
      pricingType: client.pricingType,
      notes: client.notes ?? "",
      active: client.active
    });
  }

  function completeSale() {
    if (!can("sales.complete") || !currentOrder.length) {
      return;
    }

    if (requiresPaymentMethod && !selectedPaymentMethod) {
      return;
    }

    const shouldRefreshFatherTab = selectedClient?.pricingType === "fiado";

    setSalesMessage(null);
    startSaleTransition(async () => {
      const response = await fetch("/api/sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          paymentMethod: requiresPaymentMethod ? selectedPaymentMethod : null,
          settlementType: checkoutTotals.settlementType,
          clientId: selectedClient?.id ?? null,
          items: currentOrder.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity
          }))
        })
      });

      const result = await response.json();

      if (!response.ok) {
        setSalesMessage(result.error ?? "No fue posible registrar la venta.");
        return;
      }

      setDailySummary(result.dailySummary);
      setMenuProducts((currentProducts) =>
        currentProducts.map((product) => {
          const soldItem = currentOrder.find((item) => item.product.id === product.id);

          if (!soldItem || !product.trackStock) {
            return product;
          }

          return {
            ...product,
            stockQuantity: Math.max((product.stockQuantity ?? 0) - soldItem.quantity, 0)
          };
        })
      );
      setCurrentOrder([]);
      setSelectedClientId("");
      setSelectedPaymentMethod(null);
      setCashReceived("");
      setSalesMessage("Venta registrada correctamente.");

      if ((can("sales.history") || can("sales.cancel.request")) && result.sale) {
        setRecentSales((previousSales) => [result.sale, ...previousSales].slice(0, 10));
      }

      if (isCloseoutOpen && can("cash.closeout")) {
        loadCloseoutData();
      }

      if (shouldRefreshFatherTab) {
        loadFatherTabAccount(selectedClient?.id);

        if (can("finance.viewAdvanced")) {
          loadClientReport();
        }
      }
    });
  }

  function saveProduct() {
    if (!can(editingProductId ? "products.edit" : "products.create")) {
      return;
    }

    startProductTransition(async () => {
      setProductMessage(null);

      const endpoint = editingProductId
        ? `/api/products/${editingProductId}`
        : "/api/products";
      const method = editingProductId ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: productForm.name,
          category: productForm.category,
          subcategory: productForm.subcategory,
          price: Number(productForm.price),
          cost: productForm.cost.trim().length ? Number(productForm.cost) : null,
          image: productForm.image,
          active: productForm.active,
          trackStock: productForm.trackStock,
          stockQuantity: productForm.trackStock ? Number(productForm.stockQuantity) : null,
          lowStockThreshold:
            productForm.trackStock && productForm.lowStockThreshold.trim().length
              ? Number(productForm.lowStockThreshold)
              : null
        })
      });

      const result = await response.json();

      if (!response.ok) {
        setProductMessage(result.error ?? "No fue posible guardar el producto.");
        return;
      }

      const nextProduct = result.product as Product;

      setMenuProducts((currentProducts) => {
        if (editingProductId) {
          return currentProducts.map((product) =>
            product.id === editingProductId ? nextProduct : product
          );
        }

        return [nextProduct, ...currentProducts];
      });

      setProductMessage(editingProductId ? "Producto actualizado." : "Producto creado.");
      setEditingProductId(null);
      setProductForm(emptyProductForm);
    });
  }

  function toggleProductActive(product: Product) {
    if (!can("products.toggleActive")) {
      return;
    }

    setProductMessage(null);
    startProductTransition(async () => {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: product.name,
          category: product.category,
          subcategory: product.subcategory ?? "",
          price: product.price,
          cost: product.cost ?? null,
          image: product.image ?? "",
          active: !product.active,
          trackStock: product.trackStock,
          stockQuantity: product.trackStock ? product.stockQuantity ?? 0 : null,
          lowStockThreshold: product.trackStock ? product.lowStockThreshold ?? null : null
        })
      });

      const result = await response.json();

      if (!response.ok) {
        setProductMessage(result.error ?? "No fue posible actualizar el estado.");
        return;
      }

      const nextProduct = result.product as Product;

      setMenuProducts((currentProducts) =>
        currentProducts.map((item) => (item.id === nextProduct.id ? nextProduct : item))
      );
      setProductMessage("Estado del producto actualizado.");
    });
  }

  function deleteProduct(product: Product) {
    if (!can("products.delete")) {
      return;
    }

    setProductMessage(null);
    startProductTransition(async () => {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "DELETE"
      });

      const result = await response.json();

      if (!response.ok) {
        setProductMessage(result.error ?? "No fue posible eliminar el producto.");
        return;
      }

      setMenuProducts((currentProducts) =>
        currentProducts.filter((item) => item.id !== product.id)
      );
      setProductMessage("Producto retirado del catálogo activo.");

      if (editingProductId === product.id) {
        setEditingProductId(null);
        setProductForm(emptyProductForm);
      }
    });
  }

  function saveClient() {
    if (!can("products.admin")) {
      return;
    }

    startClientTransition(async () => {
      setClientMessage(null);

      const endpoint = editingClientId ? `/api/clients/${editingClientId}` : "/api/clients";
      const method = editingClientId ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fullName: clientForm.fullName,
          pricingType: clientForm.pricingType,
          notes: clientForm.notes,
          active: clientForm.active
        })
      });

      const result = await response.json();

      if (!response.ok) {
        setClientMessage(result.error ?? "No fue posible guardar el cliente.");
        return;
      }

      const nextClient = result.client as PosClient;

      setClients((currentClients) => {
        if (editingClientId) {
          return currentClients.map((client) =>
            client.id === editingClientId ? nextClient : client
          );
        }

        return [nextClient, ...currentClients];
      });

      setClientMessage(editingClientId ? "Cliente actualizado." : "Cliente creado.");
      setEditingClientId(null);
      setClientForm(emptyClientForm);
    });
  }

  function loadClientReport(clientId?: string | null) {
    if (!can("finance.viewAdvanced")) {
      return;
    }

    startReportTransition(async () => {
      setReportError(null);

      const query = new URLSearchParams({
        period: reportPeriod
      });

      const nextClientId =
        typeof clientId === "string" ? clientId : clientReport?.selectedClientId ?? "";

      if (nextClientId) {
        query.set("clientId", nextClientId);
      }

      if (reportPeriod === "custom") {
        query.set("startDate", reportStartDate);
        query.set("endDate", reportEndDate);
      }

      const response = await fetch(`/api/reports/clients?${query.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        setReportError(result.error ?? "No fue posible cargar el reporte de clientes.");
        return;
      }

      setClientReport(result as ClientUsageReport);
    });
  }

  function loadSalesReport() {
    if (!can("finance.viewAdvanced")) {
      return;
    }

    startSalesReportTransition(async () => {
      setSalesReportError(null);

      const query = new URLSearchParams({
        period: salesReportPeriod
      });

      if (salesReportPeriod === "custom") {
        query.set("startDate", salesReportStartDate);
        query.set("endDate", salesReportEndDate);
      }

      const response = await fetch(`/api/reports/sales?${query.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        setSalesReportError(result.error ?? "No fue posible cargar el resumen de ventas.");
        return;
      }

      setSalesReport(result as SalesReport);
    });
  }

  function loadFatherTabAccount(clientId?: string) {
    if (!can("accounts.fatherTab")) {
      return;
    }

    startFatherTabTransition(async () => {
      setFatherTabError(null);

      const query = new URLSearchParams();
      const nextClientId = clientId ?? selectedTabClientId;

      if (nextClientId) {
        query.set("clientId", nextClientId);
      }

      const response = await fetch(
        `/api/tab-account${query.toString() ? `?${query.toString()}` : ""}`
      );
      const result = await response.json();

      if (!response.ok) {
        setFatherTabError(result.error ?? "No fue posible cargar las cuentas pendientes.");
        return;
      }

      const payload = result as ClientTabAccountsResponse;

      setTabAccounts(payload.accounts ?? []);
      setSelectedTabClientId(payload.selectedClientId ?? "");
      setFatherTabAccount(payload.account ?? null);
    });
  }

  function saveClientPayment(amountOverride?: number) {
    const activeTabAccount = fatherTabAccount ?? clientReport?.tabAccount ?? null;

    if (!can("accounts.fatherTab") || !activeTabAccount) {
      return;
    }

    const tabAccountClientId = activeTabAccount.clientId;

    const resolvedAmount =
      typeof amountOverride === "number" ? amountOverride : Number(paymentAmount);

    if (Number.isNaN(resolvedAmount) || resolvedAmount <= 0) {
      setPaymentMessage("Ingresa un monto válido para el abono.");
      return;
    }

    startPaymentTransition(async () => {
      setPaymentMessage(null);

      const response = await fetch("/api/client-payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          clientId: tabAccountClientId,
          amount: resolvedAmount,
          paymentMethod,
          paidByName: paymentPaidByName,
          notes: paymentNotes
        })
      });

      const result = await response.json();

      if (!response.ok) {
        setPaymentMessage(result.error ?? "No fue posible registrar el abono.");
        return;
      }

      setPaymentAmount("");
      setPaymentNotes("");
      setPaymentPaidByName("");
      setPaymentMethod("Efectivo");
      setPaymentMessage("Abono registrado correctamente.");
      loadFatherTabAccount(tabAccountClientId);

      if (isCloseoutOpen && can("cash.closeout")) {
        loadCloseoutData();
      }

      if (can("finance.viewAdvanced")) {
        loadClientReport(tabAccountClientId);
      }
    });
  }

  function canRequestCancellationForSale(sale: SaleHistoryEntry) {
    if (!can("sales.cancel.request")) {
      return false;
    }

    if (sale.id !== latestRecentSaleId) {
      return false;
    }

    if (sale.isCancelled || sale.cancellationRequestStatus === "pending") {
      return false;
    }

    const createdAt = new Date(sale.createdAt).getTime();
    const sameBusinessDay = getTodayKey(new Date(sale.createdAt)) === getTodayKey(new Date(nowTick));

    return sameBusinessDay && Number.isFinite(createdAt) && nowTick - createdAt <= 30 * 60 * 1000;
  }

  function updateRecentSale(nextSale: SaleHistoryEntry) {
    setRecentSales((previousSales) =>
      previousSales.map((sale) => (sale.id === nextSale.id ? nextSale : sale))
    );
  }

  function loadPendingCancellationRequests() {
    if (!can("sales.cancel.approve")) {
      return;
    }

    startCancellationRequestsTransition(async () => {
      const response = await fetch("/api/sales/cancellation-requests");
      const result = await response.json();

      if (!response.ok) {
        setCancellationMessage(
          result.error ?? "No fue posible cargar las anulaciones pendientes."
        );
        return;
      }

      setPendingCancellationRequests(result.requests ?? []);
    });
  }

  function submitCancellationRequest() {
    if (!cancellationSale || !can("sales.cancel.request")) {
      return;
    }

    startCancellationRequestTransition(async () => {
      const response = await fetch("/api/sales/cancellation-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          saleId: cancellationSale.id,
          reason: cancellationReason
        })
      });

      const result = await response.json();

      if (!response.ok) {
        setCancellationMessage(
          result.error ?? "No fue posible enviar la solicitud de anulación."
        );
        return;
      }

      if (result.sale) {
        updateRecentSale(result.sale as SaleHistoryEntry);
      }

      setCancellationSale(null);
      setCancellationReason("");
      setCancellationMessage("Solicitud de anulación enviada a jefa.");
      loadPendingCancellationRequests();
    });
  }

  function resolveCancellationRequest(requestId: string, action: "approve" | "reject") {
    if (!can("sales.cancel.approve")) {
      return;
    }

    startCancellationResolveTransition(async () => {
      const response = await fetch(`/api/sales/cancellation-requests/${requestId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action
        })
      });
      const result = await response.json();

      if (!response.ok) {
        setCancellationMessage(
          result.error ?? "No fue posible resolver la solicitud de anulación."
        );
        return;
      }

      setCancellationMessage(
        action === "approve" ? "Venta anulada correctamente." : "Solicitud rechazada."
      );

      if (result.sale) {
        updateRecentSale(result.sale as SaleHistoryEntry);
      }

      setPendingCancellationRequests((currentRequests) =>
        currentRequests.filter((request) => request.id !== requestId)
      );

      if (result.dailySummary) {
        setDailySummary(result.dailySummary as DailySummary);
      }

      if (can("cash.closeout")) {
        loadCloseoutData();
      }

      loadSalesReport();
      loadClientReport();
      loadFatherTabAccount(selectedTabClientId);
    });
  }

  function loadCloseoutData() {
    if (!can("cash.closeout")) {
      return;
    }

    startCloseoutTransition(async () => {
      const query = new URLSearchParams({
        startingCash: "0"
      });

      const response = await fetch(`/api/closeouts?${query.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        setCloseoutMessage(result.error ?? "No fue posible cargar el cierre de caja.");
        return;
      }

      setCloseoutSnapshot(result.snapshot as CashCloseoutSnapshot);
      setCloseoutHistory((result.history ?? []) as CashCloseoutRecord[]);
    });
  }

  function saveCashCloseout() {
    if (!can("cash.closeout")) {
      return;
    }

    if (!Number.isFinite(countedCashNumber) || countedCashNumber < 0) {
      setCloseoutMessage("Ingresa un efectivo contado válido.");
      return;
    }

    if (shortCloseoutAmount > 0) {
      const shouldContinue = window.confirm(
        `La caja se está cerrando con un faltante de ${formatCop(shortCloseoutAmount)}. ¿Deseas continuar?`
      );

      if (!shouldContinue) {
        return;
      }
    }

    startCloseoutSaveTransition(async () => {
      const response = await fetch("/api/closeouts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          startingCash: 0,
          countedCash: countedCashNumber,
          notes: closeoutNotes
        })
      });
      const result = await response.json();

      if (!response.ok) {
        setCloseoutMessage(result.error ?? "No fue posible guardar el cierre.");
        return;
      }

      setCloseoutMessage("Exito");
      setCloseoutSnapshot(result.snapshot as CashCloseoutSnapshot);
      setCloseoutHistory((currentHistory) => [
        result.closeout as CashCloseoutRecord,
        ...currentHistory
      ]);
      if (!isJefaView) {
        setRecentSales([]);
      }
      setIsCloseoutOpen(false);
      setCountedCash("");
      setCloseoutNotes("");
    });
  }

  useEffect(() => {
    if (!can("accounts.fatherTab")) {
      return;
    }

    loadFatherTabAccount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData.profile.role]);

  useEffect(() => {
    if (!can("accounts.fatherTab")) {
      return;
    }

    const handleOpenFiados = () => {
      setIsFiadoOpen(true);
    };

    window.addEventListener("open-fiados", handleOpenFiados);

    return () => {
      window.removeEventListener("open-fiados", handleOpenFiados);
    };
  }, [initialData.profile.role]);

  useEffect(() => {
    if (!can("sales.cancel.approve")) {
      return;
    }

    loadPendingCancellationRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData.profile.role]);

  useEffect(() => {
    if (!can("cash.closeout.review")) {
      return;
    }

    loadCloseoutData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData.profile.role]);

  useEffect(() => {
    if (!isCloseoutOpen || !can("cash.closeout")) {
      return;
    }

    loadCloseoutData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCloseoutOpen, initialData.profile.role]);

  useEffect(() => {
    if (!can("finance.viewAdvanced")) {
      return;
    }

    if (reportPeriod === "custom") {
      return;
    }

    loadClientReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportPeriod, initialData.profile.role]);

  useEffect(() => {
    if (!can("finance.viewAdvanced")) {
      return;
    }

    if (salesReportPeriod === "custom") {
      return;
    }

    loadSalesReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salesReportPeriod, initialData.profile.role]);

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <div className="grid gap-6 px-5 py-6 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="pill">{roleHeroLabel}</span>
              <span className="pill">
                <ShieldCheck className="mr-2 h-3.5 w-3.5" />
                {identityLabel}
              </span>
            </div>
            <div className="space-y-3">
              <h1
                className="headline text-3xl sm:text-4xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {initialData.profile.role === "jefa"
                  ? `Panel operativo de ${identityLabel}`
                  : "Caja rápida para el día a día"}
              </h1>
              <p className="max-w-2xl text-sm leading-6 subtle sm:text-base">
                {initialData.profile.role === "jefa"
                  ? "Monitorea ventas, descuentos familiares y clientes sin perder la base del menú para la siguiente etapa."
                  : "Registra pedidos rápido, selecciona cliente si aplica y completa el cobro sin pasos innecesarios."}
              </p>
            </div>
          </div>

          {!isJefaView ? (
            <div
              className={`grid gap-3 ${
                can("finance.viewAdvanced") ? "sm:grid-cols-2 xl:grid-cols-5" : "sm:grid-cols-2"
              }`}
            >
              <SummaryCard
                title="Ventas hoy"
                value={`${dailySummary.salesCount}`}
                note="Transacciones registradas"
                icon={<Wallet className="h-5 w-5" />}
              />
              <SummaryCard
                title={can("finance.viewAdvanced") ? "Venta bruta" : "Cobrado hoy"}
                value={formatCop(
                  can("finance.viewAdvanced") ? dailySummary.grossSales : dailySummary.netRevenue
                )}
                note={
                  can("finance.viewAdvanced")
                    ? "Antes de descuentos"
                    : "Monto neto recibido"
                }
                icon={<ShoppingCart className="h-5 w-5" />}
              />
              {can("finance.viewAdvanced") ? (
                <>
                  <SummaryCard
                    title="Descuentos"
                    value={formatCop(dailySummary.discountTotal)}
                    note="Incluye familia"
                    icon={<Users className="h-5 w-5" />}
                  />
                  <SummaryCard
                    title="Neto"
                    value={formatCop(dailySummary.netRevenue)}
                    note="Cobro real del día"
                    icon={<Wallet className="h-5 w-5" />}
                  />
                  <SummaryCard
                    title="Ganancia"
                    value={formatCop(dailySummary.grossProfit)}
                    note="Neto menos costo estimado"
                    icon={<BadgeDollarSign className="h-5 w-5" />}
                  />
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {cancellationMessage ? (
        <div className="panel px-5 py-4 text-sm ring-1 ring-[var(--border)]">
          {cancellationMessage}
        </div>
      ) : null}

      {closeoutMessage ? (
        <div className="panel px-5 py-4 text-sm ring-1 ring-[var(--border)]">
          {closeoutMessage}
        </div>
      ) : null}

      {isJefaView ? (
        <section className="panel p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-lg font-semibold">Resumen diario</p>
              <p className="mt-1 text-sm subtle">
                Monitorea venta bruta, descuentos, neto y ganancia desde una vista administrativa.
              </p>
            </div>
            <span className="pill">{getTodayKey().split("-").reverse().join("/")}</span>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricTile label="Número de ventas" value={`${dailySummary.salesCount}`} />
            <MetricTile label="Venta bruta" value={formatCop(dailySummary.grossSales)} />
            <MetricTile label="Descuentos" value={formatCop(dailySummary.discountTotal)} />
            <MetricTile label="Neto" value={formatCop(dailySummary.netRevenue)} />
            <MetricTile label="Ganancia" value={formatCop(dailySummary.grossProfit)} />
          </div>
        </section>
      ) : null}

      {isJefaView && pendingCancellationCount ? (
        <section className="panel p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-semibold">Anulaciones pendientes</p>
              <p className="mt-1 text-sm subtle">
                La cajera solicitó revisión para {pendingCancellationCount} venta
                {pendingCancellationCount === 1 ? "" : "s"} dentro de la ventana operativa.
              </p>
            </div>
            <span className="pill">{pendingCancellationCount} pendientes</span>
          </div>

          <div className="mt-4 grid gap-3">
            {pendingCancellationRequests.slice(0, 4).map((request) => (
              <div
                key={request.id}
                className="rounded-3xl bg-white p-4 ring-1 ring-[var(--border)]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold">
                      Venta {request.saleId.slice(0, 8)} · {formatCop(request.saleGrossTotal)}
                    </p>
                    <p className="mt-1 text-sm subtle">
                      {request.requestedByLabel} · {formatSaleTime(request.requestedAt)}
                    </p>
                    {request.reason ? (
                      <p className="mt-2 text-sm subtle">Motivo: {request.reason}</p>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => resolveCancellationRequest(request.id, "reject")}
                      disabled={isResolvingCancellation}
                      className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold ring-1 ring-[var(--border)] transition hover:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Rechazar
                    </button>
                    <button
                      type="button"
                      onClick={() => resolveCancellationRequest(request.id, "approve")}
                      disabled={isResolvingCancellation}
                      className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Aprobar anulación
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {isJefaView && shortCloseoutAlerts.length ? (
        <section className="panel p-5 sm:p-6 ring-1 ring-rose-200">
          <div className="rounded-3xl bg-rose-50 p-5 ring-1 ring-rose-200">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-lg font-semibold text-rose-700">Alerta de caja</p>
                <p className="mt-1 text-sm text-rose-700">
                  La caja fue cerrada con un faltante de{" "}
                  {formatCop(Math.abs(shortCloseoutAlerts[0].difference))}.
                </p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
                {shortCloseoutAlerts.length} cierre{shortCloseoutAlerts.length === 1 ? "" : "s"} con faltante
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {shortCloseoutAlerts.slice(0, 3).map((closeout) => (
                <div
                  key={closeout.id}
                  className="rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-rose-100"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-rose-700">
                        {closeout.cashierLabel} · Faltante {formatCop(Math.abs(closeout.difference))}
                      </p>
                      <p className="mt-1 subtle">
                        Esperado: {formatCop(closeout.expectedCash)} · Contado: {formatCop(closeout.countedCash)}
                      </p>
                    </div>
                    <span className="text-xs subtle">
                      {closeout.businessDate.split("-").reverse().join("/")} · {formatSaleTime(closeout.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {isJefaView ? (
        <section className="panel p-4 sm:p-5">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setJefaSection("ventas")}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                jefaSection === "ventas"
                  ? "bg-ink text-white"
                  : "bg-white text-[var(--foreground)] ring-1 ring-[var(--border)] hover:ring-[var(--accent)]"
              }`}
            >
              Ventas
            </button>
            <button
              type="button"
              onClick={() => setJefaSection("productos")}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                jefaSection === "productos"
                  ? "bg-ink text-white"
                  : "bg-white text-[var(--foreground)] ring-1 ring-[var(--border)] hover:ring-[var(--accent)]"
              }`}
            >
              Productos
            </button>
            <button
              type="button"
              onClick={() => setJefaSection("clientes")}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                jefaSection === "clientes"
                  ? "bg-ink text-white"
                  : "bg-white text-[var(--foreground)] ring-1 ring-[var(--border)] hover:ring-[var(--accent)]"
              }`}
            >
              Clientes
            </button>
          </div>
        </section>
      ) : null}

      <div className={isJefaView ? "space-y-6" : "grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.9fr)]"}>
        <section className="space-y-5">
          {!isJefaView ? (
          <div className="panel p-4 sm:p-5">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {topLevelCategories.map((category) => {
                  const isActive = category === selectedCategory;

                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(category);

                        if (category !== "Bebidas") {
                          setSelectedAlcoholPresentation("all");
                        }
                      }}
                      className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                        isActive
                          ? "bg-ink text-white"
                          : "bg-white text-[var(--foreground)] ring-1 ring-[var(--border)] hover:ring-[var(--accent)]"
                      }`}
                    >
                      {category}
                    </button>
                  );
                })}
              </div>

              {selectedCategory === "Bebidas" ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {beverageSubcategories.map((subcategory) => {
                      const isActive = subcategory === selectedBeverageSubcategory;

                      return (
                        <button
                          key={subcategory}
                          type="button"
                          onClick={() => {
                            setSelectedBeverageSubcategory(subcategory);
                            setSelectedAlcoholPresentation("all");
                          }}
                          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                            isActive
                              ? "bg-[var(--accent)] text-ink"
                              : "bg-[var(--accent-soft)] text-[var(--foreground)] hover:bg-[rgba(205,168,92,0.24)]"
                          }`}
                        >
                          {subcategory}
                        </button>
                      );
                    })}
                  </div>

                  {selectedBeverageSubcategory === "Alcohol" ? (
                    <div className="space-y-3 rounded-3xl bg-white p-4 ring-1 ring-[var(--border)]">
                      <div className="flex flex-wrap gap-2">
                        {alcoholTypes.map((type) => {
                          const isActive = type === selectedAlcoholType;

                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => {
                                setSelectedAlcoholType(type);
                                setSelectedAlcoholPresentation("all");
                              }}
                              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                                isActive
                                  ? "bg-ink text-white"
                                  : "bg-[var(--surface)] text-[var(--foreground)] ring-1 ring-[var(--border)] hover:ring-[var(--accent)]"
                              }`}
                            >
                              {type}
                            </button>
                          );
                        })}
                      </div>

                      {selectedAlcoholType !== "Cerveza" && alcoholPresentationOptions.length > 1 ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedAlcoholPresentation("all")}
                            className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                              selectedAlcoholPresentation === "all"
                                ? "bg-[var(--accent)] text-ink"
                                : "bg-[var(--accent-soft)] text-[var(--foreground)] hover:bg-[rgba(205,168,92,0.24)]"
                            }`}
                          >
                            Todas
                          </button>
                          {alcoholPresentationOptions.map((presentation) => {
                            const isActive =
                              presentation === selectedAlcoholPresentation;

                            return (
                              <button
                                key={presentation}
                                type="button"
                                onClick={() => setSelectedAlcoholPresentation(presentation)}
                                className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                                  isActive
                                    ? "bg-[var(--accent)] text-ink"
                                    : "bg-[var(--accent-soft)] text-[var(--foreground)] hover:bg-[rgba(205,168,92,0.24)]"
                                }`}
                              >
                                {presentation}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <label className="relative block">
                <span className="sr-only">Buscar producto</span>
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Buscar por nombre del producto"
                  className="w-full rounded-2xl border border-[var(--border)] bg-white py-3 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-[var(--accent)]"
                />
              </label>
            </div>
          </div>
          ) : null}

          {!isJefaView ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleProducts.map((product) => {
              const outOfStock = isProductOutOfStock(product);
              const lowStock = isProductLowStock(product);
              const missingPrice = product.price <= 0;
              const isUnavailable = outOfStock || missingPrice;

              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addProductToOrder(product)}
                  disabled={isUnavailable}
                  className={`panel-strong flex min-h-44 flex-col justify-between p-4 text-left transition ${
                    isUnavailable
                      ? "cursor-not-allowed opacity-55"
                      : "hover:-translate-y-0.5 hover:shadow-xl"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-xl">
                          {renderProductBadge(product)}
                        </span>
                        <div>
                          <p className="text-lg font-semibold leading-6">{product.name}</p>
                          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] subtle">
                            {product.category}
                            {product.subcategory ? ` · ${product.subcategory}` : ""}
                          </p>
                        </div>
                      </div>
                      <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold">
                        {missingPrice ? "Precio pendiente" : formatCop(product.price)}
                      </span>
                    </div>

                    <p className="text-sm leading-6 subtle">{product.description}</p>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] subtle">
                      {missingPrice
                        ? "Completar precio"
                        : product.trackStock
                        ? outOfStock
                          ? "Sin stock"
                          : lowStock
                            ? `Stock bajo: ${product.stockQuantity ?? 0}`
                            : `Stock: ${product.stockQuantity ?? 0}`
                        : "Sin control de stock"}
                    </p>
                  </div>

                  <span
                    className={`mt-4 inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      isUnavailable
                        ? "bg-slate-200 text-slate-500"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {missingPrice
                      ? "Precio pendiente"
                      : outOfStock
                        ? "Sin stock"
                        : "Agregar al pedido"}
                  </span>
                </button>
              );
            })}
          </div>
          ) : null}

          {!isJefaView && !visibleProducts.length ? (
            <div className="panel p-6 text-sm subtle">
              No hay productos que coincidan con la búsqueda actual.
            </div>
          ) : null}

          {!isJefaView ? (
          <section className="panel p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-lg font-semibold">Resumen diario</p>
                <p className="mt-1 text-sm subtle">
                  {can("finance.viewAdvanced")
                    ? "Monitorea venta bruta, descuentos, neto y ganancia."
                    : "Vista operativa del día para caja."}
                </p>
              </div>
              <span className="pill">{getTodayKey().split("-").reverse().join("/")}</span>
            </div>

            <div
              className={`mt-5 grid gap-4 ${
                can("finance.viewAdvanced") ? "sm:grid-cols-2 xl:grid-cols-5" : "sm:grid-cols-2"
              }`}
            >
              <MetricTile label="Número de ventas" value={`${dailySummary.salesCount}`} />
              {can("finance.viewAdvanced") ? (
                <>
                  <MetricTile label="Venta bruta" value={formatCop(dailySummary.grossSales)} />
                  <MetricTile label="Descuentos" value={formatCop(dailySummary.discountTotal)} />
                  <MetricTile label="Neto" value={formatCop(dailySummary.netRevenue)} />
                  <MetricTile label="Ganancia" value={formatCop(dailySummary.grossProfit)} />
                </>
              ) : (
                <MetricTile label="Cobrado hoy" value={formatCop(dailySummary.netRevenue)} />
              )}
            </div>
          </section>
          ) : null}

          {isJefaView && jefaSection === "ventas" ? (
            <section className="panel p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-lg font-semibold">Ventas</p>
                  <p className="mt-1 text-sm subtle">
                    Vista administrativa para seguir cobros, descuentos, fiados y movimiento comercial.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={salesReportPeriod}
                    onChange={(event) => setSalesReportPeriod(event.target.value as SalesReportPeriod)}
                    className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                  >
                    <option value="day">Día</option>
                    <option value="week">Semana</option>
                    <option value="month">Mes</option>
                    <option value="year">Año</option>
                    <option value="custom">Rango personalizado</option>
                  </select>
                  {salesReportPeriod === "custom" ? (
                    <>
                      <input
                        type="date"
                        value={salesReportStartDate}
                        onChange={(event) => setSalesReportStartDate(event.target.value)}
                        className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                      />
                      <input
                        type="date"
                        value={salesReportEndDate}
                        onChange={(event) => setSalesReportEndDate(event.target.value)}
                        className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                      />
                    </>
                  ) : null}
                  <button
                    type="button"
                    onClick={loadSalesReport}
                    disabled={
                      isLoadingSalesReport ||
                      (salesReportPeriod === "custom" &&
                        (!salesReportStartDate || !salesReportEndDate))
                    }
                    className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isLoadingSalesReport ? "Cargando..." : "Actualizar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => salesReport && downloadSalesReportPdf(salesReport)}
                    disabled={!salesReport || isLoadingSalesReport}
                    className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold ring-1 ring-[var(--border)] transition hover:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Download className="h-4 w-4" />
                    Descargar PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => salesReport && downloadSalesReportCsv(salesReport)}
                    disabled={!salesReport || isLoadingSalesReport}
                    className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold ring-1 ring-[var(--border)] transition hover:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Exportar CSV
                  </button>
                </div>
              </div>

              {salesReportError ? (
                <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
                  {salesReportError}
                </div>
              ) : null}

              {salesReport ? (
                <>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <MetricTile label="Ventas totales" value={formatCop(salesReport.grossSales)} />
                    <MetricTile label="Cobrado" value={formatCop(salesReport.netCollected)} />
                    <MetricTile label="Descuentos" value={formatCop(salesReport.discountTotal)} />
                    <MetricTile label="Cuentas pendientes" value={formatCop(salesReport.outstandingFiado)} />
                    <MetricTile label="Número de transacciones" value={`${salesReport.transactionsCount}`} />
                    <MetricTile label="Productos vendidos" value={`${salesReport.productsSoldCount}`} />
                  </div>

                  {pendingCancellationCount ? (
                    <div className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-[var(--border)]">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">Anulaciones pendientes</p>
                        <span className="pill">{pendingCancellationCount}</span>
                      </div>
                      <div className="mt-4 space-y-3">
                        {pendingCancellationRequests.map((request) => (
                          <div
                            key={request.id}
                            className="rounded-2xl bg-[var(--surface)] px-4 py-3 ring-1 ring-[var(--border)]"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="font-semibold">
                                  Venta {request.saleId.slice(0, 8)} · {formatCop(request.saleGrossTotal)}
                                </p>
                                <p className="mt-1 text-sm subtle">
                                  {request.requestedByLabel} · {formatSaleTime(request.requestedAt)}
                                </p>
                                {request.reason ? (
                                  <p className="mt-1 text-sm subtle">Motivo: {request.reason}</p>
                                ) : null}
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => resolveCancellationRequest(request.id, "reject")}
                                  disabled={isResolvingCancellation}
                                  className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold ring-1 ring-[var(--border)] transition hover:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  Rechazar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => resolveCancellationRequest(request.id, "approve")}
                                  disabled={isResolvingCancellation}
                                  className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  Aprobar anulación
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                    <div className="rounded-3xl bg-white p-5 ring-1 ring-[var(--border)]">
                      <p className="text-sm font-semibold">Desglose comercial</p>
                      <div className="mt-4 space-y-3 text-sm">
                        <div className="flex items-center justify-between rounded-2xl bg-[var(--surface)] px-4 py-3 ring-1 ring-[var(--border)]">
                          <span>Ventas normales</span>
                          <span className="font-semibold">{formatCop(salesReport.normalSalesGross)}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl bg-[var(--surface)] px-4 py-3 ring-1 ring-[var(--border)]">
                          <span>Consumo familiar</span>
                          <span className="font-semibold">{formatCop(salesReport.familyConsumptionGross)}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl bg-[var(--surface)] px-4 py-3 ring-1 ring-[var(--border)]">
                          <span>Fiados</span>
                          <span className="font-semibold">{formatCop(salesReport.fiadoGross)}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl bg-[var(--surface)] px-4 py-3 ring-1 ring-[var(--border)]">
                          <span>Abonos</span>
                          <span className="font-semibold">{formatCop(salesReport.repaymentsTotal)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-3xl bg-white p-5 ring-1 ring-[var(--border)]">
                      <p className="text-sm font-semibold">Cobrado por método</p>
                      <div className="mt-4 space-y-3">
                        {salesReport.paymentBreakdown.length ? (
                          salesReport.paymentBreakdown.map((entry) => (
                            <div
                              key={entry.method}
                              className="flex items-center justify-between rounded-2xl bg-[var(--surface)] px-4 py-3 text-sm ring-1 ring-[var(--border)]"
                            >
                              <span>{entry.method}</span>
                              <span className="font-semibold">{formatCop(entry.total)}</span>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-3xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm subtle">
                            No hay cobros registrados por método en este periodo.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                    <div className="rounded-3xl bg-white p-5 ring-1 ring-[var(--border)]">
                      <p className="text-sm font-semibold">Productos más vendidos</p>
                      <div className="mt-4 space-y-3">
                        {salesReport.topProducts.length ? (
                          salesReport.topProducts.map((product) => (
                            <div
                              key={`${product.productId}-${product.productName}`}
                              className="flex items-center justify-between rounded-2xl bg-[var(--surface)] px-4 py-3 text-sm ring-1 ring-[var(--border)]"
                            >
                              <div>
                                <p className="font-semibold">{product.productName}</p>
                                <p className="mt-1 subtle">{product.quantity} vendidos</p>
                              </div>
                              <span className="font-semibold">{formatCop(product.grossTotal)}</span>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-3xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm subtle">
                            No hay productos vendidos en este periodo.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-[var(--border)]">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">Consumo por cliente</p>
                      <span className="text-xs subtle">Resumen del periodo</span>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {salesReport.topClients.length ? (
                        salesReport.topClients.map((client) => (
                          <div
                            key={client.clientId}
                            className="rounded-3xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]"
                          >
                            <p className="font-semibold">{client.clientName}</p>
                            <p className="mt-2 text-sm subtle">
                              {client.transactionsCount} transacciones
                            </p>
                            <p className="mt-2 text-lg font-semibold">
                              {formatCop(client.grossTotal)}
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-3xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm subtle md:col-span-2 xl:col-span-3">
                          No hay consumo por cliente para este periodo.
                        </div>
                      )}
                    </div>
                  </div>

                  {can("cash.closeout.review") ? (
                    <div className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-[var(--border)]">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">Historial de cierres de caja</p>
                        <span className="text-xs subtle">
                          {closeoutHistory.length} registro{closeoutHistory.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="mt-4 space-y-3">
                        {closeoutHistory.length ? (
                          closeoutHistory.map((closeout) => (
                            <div
                              key={closeout.id}
                              className="rounded-2xl bg-[var(--surface)] px-4 py-3 text-sm ring-1 ring-[var(--border)]"
                            >
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <p className="font-semibold">
                                    {closeout.cashierLabel} · {closeout.businessDate.split("-").reverse().join("/")}
                                  </p>
                                  <p className="mt-1 subtle">
                                    Esperado: {formatCop(closeout.expectedCash)} · Contado: {formatCop(closeout.countedCash)}
                                  </p>
                                  <p className="mt-1 subtle">
                                    Diferencia: {formatCop(closeout.difference)}
                                  </p>
                                </div>
                                <span className="text-xs subtle">
                                  {formatSaleTime(closeout.createdAt)}
                                </span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-3xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm subtle">
                            Aún no hay cierres de caja registrados.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : !isLoadingSalesReport ? (
                <div className="mt-5 rounded-3xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm subtle">
                  No hay datos de ventas para este periodo.
                </div>
              ) : null}
            </section>
          ) : null}

          {isJefaView && jefaSection === "clientes" ? (
            <section className="panel p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setJefaClientSection("lista")}
                  className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                    jefaClientSection === "lista"
                      ? "bg-[var(--accent)] text-ink"
                      : "bg-[var(--accent-soft)] text-[var(--foreground)] ring-1 ring-transparent hover:ring-[var(--accent)]"
                  }`}
                >
                  Clientes
                </button>
                <button
                  type="button"
                  onClick={() => setJefaClientSection("consumo")}
                  className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                    jefaClientSection === "consumo"
                      ? "bg-[var(--accent)] text-ink"
                      : "bg-[var(--accent-soft)] text-[var(--foreground)] ring-1 ring-transparent hover:ring-[var(--accent)]"
                  }`}
                >
                  Consumo por cliente
                </button>
                <button
                  type="button"
                  onClick={() => setIsFiadoOpen(true)}
                  className="rounded-full bg-[var(--accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] ring-1 ring-transparent transition hover:ring-[var(--accent)]"
                >
                  Cuentas pendientes
                </button>
              </div>
            </section>
          ) : null}

          {can("products.admin") && (!isJefaView || (jefaSection === "clientes" && jefaClientSection === "lista")) ? (
            <section className="panel p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-lg font-semibold">Clientes y descuentos</p>
                  <p className="mt-1 text-sm subtle">
                    Base inicial para clientes normales, familia y futuras cuentas pendientes.
                  </p>
                </div>
                {editingClientId ? (
                  <button
                    type="button"
                    onClick={resetClientForm}
                    className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold ring-1 ring-[var(--border)] transition hover:ring-[var(--accent)]"
                  >
                    Cancelar edición
                  </button>
                ) : null}
              </div>

              {clientMessage ? (
                <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-[var(--border)]">
                  {clientMessage}
                </div>
              ) : null}

              <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Clientes registrados</p>
                  <div className="grid gap-3">
                    {sortedClients.map((client) => (
                      <div
                        key={client.id}
                        className="rounded-3xl bg-white p-4 ring-1 ring-[var(--border)]"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="font-semibold">{client.fullName}</p>
                            <p className="mt-1 text-sm subtle">
                              {client.notes ?? "Sin observaciones"}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                client.active
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-slate-200 text-slate-600"
                              }`}
                            >
                              {client.active ? "Activo" : "Inactivo"}
                            </span>
                            <button
                              type="button"
                              onClick={() => startEditingClient(client)}
                              className="inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-semibold ring-1 ring-[var(--border)] transition hover:ring-[var(--accent)]"
                            >
                              <PencilLine className="h-4 w-4" />
                              Editar
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl bg-white p-4 ring-1 ring-[var(--border)] sm:p-5">
                  <div className="flex items-center gap-2">
                    {editingClientId ? (
                      <PencilLine className="h-5 w-5 text-[var(--accent)]" />
                    ) : (
                      <PlusCircle className="h-5 w-5 text-[var(--accent)]" />
                    )}
                    <p className="text-sm font-semibold">
                      {editingClientId ? "Editar cliente" : "Nuevo cliente"}
                    </p>
                  </div>

                  <div className="mt-4 grid gap-4">
                    <label className="grid gap-2">
                      <span className="text-sm font-medium">Nombre</span>
                      <input
                        type="text"
                        value={clientForm.fullName}
                        onChange={(event) => updateClientForm("fullName", event.target.value)}
                        placeholder="Ej. Carmelita"
                        className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-sm font-medium">Tipo</span>
                      <select
                        value={clientForm.pricingType}
                        onChange={(event) =>
                          updateClientForm("pricingType", event.target.value as ClientFormState["pricingType"])
                        }
                        className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                      >
                        {clientPricingTypes.map((pricingType) => (
                          <option key={pricingType} value={pricingType}>
                            {getClientPricingLabel(pricingType)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-2">
                      <span className="text-sm font-medium">Notas</span>
                      <textarea
                        value={clientForm.notes}
                        onChange={(event) => updateClientForm("notes", event.target.value)}
                        placeholder="Observaciones internas"
                        rows={3}
                        className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-sm font-medium">Estado</span>
                      <select
                        value={clientForm.active ? "active" : "inactive"}
                        onChange={(event) =>
                          updateClientForm("active", event.target.value === "active")
                        }
                        className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                      >
                        <option value="active">Activo</option>
                        <option value="inactive">Inactivo</option>
                      </select>
                    </label>

                    <button
                      type="button"
                      onClick={saveClient}
                      disabled={isSavingClient || !clientForm.fullName.trim()}
                      className="mt-2 w-full rounded-2xl bg-ink px-4 py-4 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isSavingClient
                        ? "Guardando..."
                        : editingClientId
                          ? "Guardar cliente"
                          : "Crear cliente"}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {can("accounts.fatherTab") ? (
            <>
              {isFiadoOpen ? (
                <div className="fixed inset-0 z-50 flex items-end bg-[var(--background)] sm:items-center sm:justify-center">
                  <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-[2rem] bg-[var(--surface)] p-5 shadow-2xl ring-1 ring-black/5 sm:max-w-6xl sm:rounded-[2rem] sm:p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-lg font-semibold">Cuentas pendientes</p>
                        <p className="mt-1 text-sm subtle">
                          Consulta saldos, consumos fiados y registra abonos sin editar balances manualmente.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsFiadoOpen(false)}
                        className="inline-flex items-center justify-center self-start rounded-2xl bg-white px-4 py-3 text-sm font-semibold ring-1 ring-[var(--border)] transition hover:ring-[var(--accent)]"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {fatherTabError ? (
                      <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
                        {fatherTabError}
                      </div>
                    ) : null}

                    {tabAccounts.length ? (
                      <div className="mt-5 flex flex-wrap gap-3">
                        {tabAccounts.map((account) => {
                          const isActive = account.clientId === selectedTabClientId;

                          return (
                            <button
                              key={account.clientId}
                              type="button"
                              onClick={() => loadFatherTabAccount(account.clientId)}
                              className={`rounded-3xl px-4 py-3 text-left ring-1 transition ${
                                isActive
                                  ? "bg-[var(--accent-soft)] ring-[var(--accent)]"
                                  : "bg-white ring-[var(--border)] hover:ring-[var(--accent)]"
                              }`}
                            >
                              <p className="font-semibold">{account.clientName}</p>
                              <p className="mt-1 text-sm subtle">
                                Saldo: {formatCop(account.outstandingBalance)}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}

                    {paymentMessage ? (
                      <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-[var(--border)]">
                        {paymentMessage}
                      </div>
                    ) : null}

                    {fatherTabAccount ? (
                      <div className="mt-5 space-y-5">
                        <div className={`grid gap-3 ${isJefaView ? "sm:grid-cols-3" : "sm:grid-cols-1"}`}>
                          <div className="rounded-3xl bg-white px-4 py-4 ring-1 ring-[var(--border)]">
                            <p className="text-sm subtle">Saldo actual</p>
                            <p className="mt-1 text-xl font-semibold">
                              {formatCop(fatherTabAccount.outstandingBalance)}
                            </p>
                          </div>
                          {isJefaView ? (
                            <>
                              <div className="rounded-3xl bg-white px-4 py-4 ring-1 ring-[var(--border)]">
                                <p className="text-sm subtle">Total consumido en cuenta</p>
                                <p className="mt-1 text-xl font-semibold">
                                  {formatCop(fatherTabAccount.totalTabSales)}
                                </p>
                              </div>
                              <div className="rounded-3xl bg-white px-4 py-4 ring-1 ring-[var(--border)]">
                                <p className="text-sm subtle">Total abonado</p>
                                <p className="mt-1 text-xl font-semibold">
                                  {formatCop(fatherTabAccount.totalRepayments)}
                                </p>
                              </div>
                            </>
                          ) : null}
                        </div>

                        <div className={`grid gap-5 ${isJefaView ? "lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]" : "lg:grid-cols-1"}`}>
                          {isJefaView ? (
                            <div className="rounded-3xl bg-white p-4 ring-1 ring-[var(--border)] sm:p-5">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-semibold">Historial de abonos</p>
                                  <span className="text-xs subtle">
                                    {fatherTabAccount.payments.length} pagos
                                  </span>
                                </div>
                                <div className="mt-4 space-y-3">
                                  {fatherTabAccount.payments.length ? (
                                    fatherTabAccount.payments.map((payment) => (
                                      <div
                                        key={payment.id}
                                        className="rounded-3xl bg-[var(--surface)] px-4 py-3 ring-1 ring-[var(--border)]"
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div>
                                            <p className="font-semibold">{formatCop(payment.amount)}</p>
                                            <p className="mt-1 text-sm subtle">
                                              {payment.paymentMethod}
                                              {payment.paidByName ? ` · Pagó: ${payment.paidByName}` : ""}
                                              {payment.notes ? ` · ${payment.notes}` : ""}
                                            </p>
                                          </div>
                                          <span className="text-sm subtle">
                                            {formatSaleTime(payment.createdAt)}
                                          </span>
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="rounded-3xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm subtle">
                                      Aún no hay abonos registrados para esta cuenta.
                                    </div>
                                  )}
                                </div>
                            </div>
                          ) : null}

                          <div className="rounded-3xl bg-white p-4 ring-1 ring-[var(--border)] sm:p-5">
                            <p className="text-sm font-semibold">Registrar pago</p>
                            <p className="mt-1 text-sm subtle">
                              La cajera y la jefa pueden registrar abonos. El saldo se recalcula automáticamente desde ventas y pagos.
                            </p>

                            <div className="mt-4 grid gap-4">
                              <label className="grid gap-2">
                                <span className="text-sm font-medium">Monto</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="100"
                                  value={paymentAmount}
                                  onChange={(event) => setPaymentAmount(event.target.value)}
                                  placeholder="Ej. 100000"
                                  className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                                />
                              </label>

                              <label className="grid gap-2">
                                <span className="text-sm font-medium">Método de pago</span>
                                <select
                                  value={paymentMethod}
                                  onChange={(event) =>
                                    setPaymentMethod(event.target.value as PaymentMethod)
                                  }
                                  className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                                >
                                  {paymentMethods.map((method) => (
                                    <option key={method} value={method}>
                                      {method}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <div className="grid gap-3 sm:grid-cols-2">
                                <button
                                  type="button"
                                  onClick={() => saveClientPayment()}
                                  disabled={isSavingPayment}
                                  className="rounded-2xl bg-ink px-4 py-4 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  {isSavingPayment ? "Guardando..." : "Abonar a cuenta"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => saveClientPayment(fatherTabAccount.outstandingBalance)}
                                  disabled={
                                    isSavingPayment ||
                                    fatherTabAccount.outstandingBalance <= 0 ||
                                    Number.isNaN(paymentAmountNumber) ||
                                    paymentAmountNumber < fatherTabAccount.outstandingBalance
                                  }
                                  className="rounded-2xl bg-[var(--success)] px-4 py-4 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:opacity-100"
                                >
                                  {isSavingPayment ? "Guardando..." : "Pagar saldo completo"}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : !isLoadingFatherTab ? (
                      <div className="mt-5 rounded-3xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm subtle">
                        No se encontraron clientes activos con cuenta fiado.
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {cancellationSale ? (
            <div className="fixed inset-0 z-50 flex items-end bg-[var(--background)] sm:items-center sm:justify-center">
              <div className="w-full rounded-t-[2rem] bg-[var(--surface)] p-5 shadow-2xl ring-1 ring-black/5 sm:max-w-2xl sm:rounded-[2rem] sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">Solicitar anulación</p>
                    <p className="mt-1 text-sm subtle">
                      Esta solicitud deberá ser aprobada por una jefa en los próximos 30 minutos.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCancellationSale(null);
                      setCancellationReason("");
                    }}
                    className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold ring-1 ring-[var(--border)] transition hover:ring-[var(--accent)]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-5 rounded-3xl bg-white p-4 ring-1 ring-[var(--border)]">
                  <p className="font-semibold">
                    Venta {cancellationSale.id.slice(0, 8)} · {formatCop(cancellationSale.netTotal)}
                  </p>
                  <p className="mt-1 text-sm subtle">
                    Hora: {formatSaleTime(cancellationSale.createdAt)}
                  </p>
                </div>

                <label className="mt-5 grid gap-2">
                  <span className="text-sm font-medium">Motivo opcional</span>
                  <textarea
                    value={cancellationReason}
                    onChange={(event) => setCancellationReason(event.target.value)}
                    placeholder="Ej. error en cantidad o cliente equivocado"
                    className="min-h-28 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                  />
                </label>

                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCancellationSale(null);
                      setCancellationReason("");
                    }}
                    className="w-full rounded-2xl bg-white px-4 py-4 text-sm font-semibold ring-1 ring-[var(--border)] transition hover:ring-[var(--accent)]"
                  >
                    Volver
                  </button>
                  <button
                    type="button"
                    onClick={submitCancellationRequest}
                    disabled={isSubmittingCancellationRequest}
                    className="w-full rounded-2xl bg-rose-600 px-4 py-4 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isSubmittingCancellationRequest
                      ? "Enviando..."
                      : "Confirmar solicitud"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {isCloseoutOpen ? (
            <div className="fixed inset-0 z-50 flex items-end bg-[var(--background)] sm:items-center sm:justify-center">
              <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-[2rem] bg-[var(--surface)] p-5 shadow-2xl ring-1 ring-black/5 sm:max-w-3xl sm:rounded-[2rem] sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">Cierre de caja</p>
                    <p className="mt-1 text-sm subtle">
                      Revisa el resumen, cuenta el efectivo y confirma el cierre en un segundo paso.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCloseoutOpen(false)}
                    className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold ring-1 ring-[var(--border)] transition hover:ring-[var(--accent)]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-1">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium">Efectivo contado</span>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={countedCash}
                      onChange={(event) => setCountedCash(event.target.value)}
                      placeholder="Ej. 150000"
                      className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                    />
                  </label>
                </div>

                {closeoutSnapshot ? (
                  <div className="mt-5 space-y-4">
                    <div className="rounded-[2rem] bg-[var(--accent-soft)] px-5 py-5 ring-1 ring-[var(--accent)]">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-700">
                        Efectivo esperado
                      </p>
                      <p className="mt-3 text-4xl font-semibold text-ink sm:text-5xl">
                        {formatCop(closeoutSnapshot.expectedCash)}
                      </p>
                      <p className="mt-2 text-sm text-slate-700">
                        Este es el número principal que la cajera debe contar en efectivo antes de confirmar el cierre.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricTile label="Ventas en efectivo" value={formatCop(closeoutSnapshot.cashSales)} />
                    <MetricTile label="Ventas por transferencia" value={formatCop(closeoutSnapshot.transferSales)} />
                    <MetricTile label="Fiados generados" value={formatCop(closeoutSnapshot.fiadoGenerated)} />
                    <MetricTile label="Consumo familiar" value={formatCop(closeoutSnapshot.familyConsumption)} />
                    <MetricTile label="Abonos recibidos" value={formatCop(closeoutSnapshot.repaymentsReceived)} />
                    <MetricTile label="Ventas anuladas" value={formatCop(closeoutSnapshot.cancelledSales)} />
                    </div>
                  </div>
                ) : !isLoadingCloseout ? (
                  <div className="mt-5 rounded-3xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm subtle">
                    No fue posible calcular el cierre de caja todavía.
                  </div>
                ) : null}

                {closeoutSnapshot && closeoutDifference !== null ? (
                  <div
                    className={`mt-5 rounded-3xl p-5 ring-1 ${
                      closeoutDifference === 0
                        ? "bg-emerald-50 ring-emerald-200"
                        : closeoutDifference < 0
                          ? "bg-rose-50 ring-rose-200"
                          : "bg-amber-50 ring-amber-200"
                    }`}
                  >
                    <p
                      className={`text-sm ${
                        closeoutDifference === 0
                          ? "text-emerald-700"
                          : closeoutDifference < 0
                            ? "text-rose-700"
                            : "text-amber-700"
                      }`}
                    >
                      Diferencia
                    </p>
                    <p
                      className={`mt-2 text-2xl font-semibold ${
                        closeoutDifference === 0
                          ? "text-emerald-700"
                          : closeoutDifference < 0
                            ? "text-rose-700"
                            : "text-amber-700"
                      }`}
                    >
                      {formatCop(closeoutDifference)}
                    </p>
                    <p
                      className={`mt-2 text-sm ${
                        closeoutDifference === 0
                          ? "text-emerald-700"
                          : closeoutDifference < 0
                            ? "text-rose-700"
                            : "text-amber-700"
                      }`}
                    >
                      {closeoutDifference === 0
                        ? "Caja cuadrada"
                        : closeoutDifference > 0
                          ? "Diferencia detectada · Sobrante"
                          : "Diferencia detectada · Faltante"}
                    </p>
                  </div>
                ) : null}

                <label className="mt-5 grid gap-2">
                  <span className="text-sm font-medium">Notas opcionales</span>
                  <textarea
                    value={closeoutNotes}
                    onChange={(event) => setCloseoutNotes(event.target.value)}
                    placeholder="Observaciones del cierre"
                    className="min-h-24 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                  />
                </label>

                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCloseoutOpen(false)}
                    className="w-full rounded-2xl bg-white px-4 py-4 text-sm font-semibold ring-1 ring-[var(--border)] transition hover:ring-[var(--accent)]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={saveCashCloseout}
                    disabled={isSavingCloseout || !Number.isFinite(countedCashNumber) || countedCashNumber < 0}
                    className="w-full rounded-2xl bg-ink px-4 py-4 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isSavingCloseout ? "Guardando..." : "Confirmar cierre de caja"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {can("finance.viewAdvanced") && (!isJefaView || (jefaSection === "clientes" && jefaClientSection === "consumo")) ? (
            <section className="panel p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-lg font-semibold">Consumo por cliente</p>
                  <p className="mt-1 text-sm subtle">
                    Revisa transacciones, descuentos y cobro real por persona.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={reportPeriod}
                    onChange={(event) => setReportPeriod(event.target.value as ClientReportPeriod)}
                    className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                  >
                    <option value="today">Hoy</option>
                    <option value="week">Esta semana</option>
                    <option value="month">Este mes</option>
                    <option value="custom">Rango personalizado</option>
                  </select>
                  {reportPeriod === "custom" ? (
                    <>
                      <input
                        type="date"
                        value={reportStartDate}
                        onChange={(event) => setReportStartDate(event.target.value)}
                        className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                      />
                      <input
                        type="date"
                        value={reportEndDate}
                        onChange={(event) => setReportEndDate(event.target.value)}
                        className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                      />
                    </>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => loadClientReport()}
                    disabled={isLoadingReport || (reportPeriod === "custom" && (!reportStartDate || !reportEndDate))}
                    className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isLoadingReport ? "Cargando..." : "Actualizar"}
                  </button>
                </div>
              </div>

              {reportError ? (
                <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
                  {reportError}
                </div>
              ) : null}

              {clientReport?.summaries.length ? (
                <>
                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {clientReport.summaries.map((summary) => {
                      const isSelected = summary.clientId === clientReport.selectedClientId;

                      return (
                        <button
                          key={summary.clientId}
                          type="button"
                          onClick={() => loadClientReport(summary.clientId)}
                          className={`rounded-3xl p-4 text-left ring-1 transition ${
                            isSelected
                              ? "bg-[var(--accent-soft)] ring-[var(--accent)]"
                              : "bg-white ring-[var(--border)] hover:ring-[var(--accent)]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold">{summary.clientName}</p>
                              <p className="mt-1 text-sm subtle">
                                {getClientPricingLabel(summary.pricingType)}
                              </p>
                            </div>
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold ring-1 ring-[var(--border)]">
                              {summary.transactionsCount} transacciones
                            </span>
                          </div>
                          <div className="mt-4 grid gap-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="subtle">Bruto</span>
                              <span className="font-semibold">{formatCop(summary.grossTotal)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="subtle">Descuentos</span>
                              <span className="font-semibold">{formatCop(summary.discountTotal)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="subtle">Cobrado</span>
                              <span className="font-semibold">{formatCop(summary.netCollected)}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-6 rounded-3xl bg-white p-4 ring-1 ring-[var(--border)] sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">Historial del cliente</p>
                        <p className="mt-1 text-sm subtle">
                          {clientReport.summaries.find(
                            (summary) => summary.clientId === clientReport.selectedClientId
                          )?.clientName ?? "Selecciona un cliente"}
                        </p>
                      </div>
                      <span className="pill">
                        {clientReport.period === "today"
                          ? "Hoy"
                          : clientReport.period === "week"
                            ? "Esta semana"
                            : clientReport.period === "month"
                              ? "Este mes"
                              : "Rango personalizado"}
                      </span>
                    </div>

                    <div className="mt-4 space-y-3">
                      {clientReport.transactions.length ? (
                        clientReport.transactions.map((transaction) => (
                          <div
                            key={transaction.id}
                            className="rounded-3xl bg-slate-50 p-4 ring-1 ring-[var(--border)]"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="font-semibold">
                                  {formatSaleTime(transaction.createdAt)} · {getSaleStatusLabel(transaction.saleStatus)}
                                </p>
                                <p className="mt-1 text-sm subtle">
                                  {transaction.paymentMethod ?? getSettlementTypeLabel(transaction.settlementType)}
                                </p>
                              </div>
                              <span className="text-sm subtle">{new Date(transaction.createdAt).toLocaleDateString("es-CO", { timeZone: "America/Bogota" })}</span>
                            </div>

                            <div className="mt-4 grid gap-2 text-sm">
                              {transaction.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2 ring-1 ring-[var(--border)]"
                                >
                                  <span>
                                    {item.quantity} x {item.productName}
                                  </span>
                                  <span className="font-semibold">{formatCop(item.lineTotal)}</span>
                                </div>
                              ))}
                            </div>

                            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                              <div className="rounded-2xl bg-white px-3 py-3 ring-1 ring-[var(--border)]">
                                <p className="subtle">Bruto</p>
                                <p className="mt-1 font-semibold">{formatCop(transaction.grossTotal)}</p>
                              </div>
                              <div className="rounded-2xl bg-white px-3 py-3 ring-1 ring-[var(--border)]">
                                <p className="subtle">Descuento</p>
                                <p className="mt-1 font-semibold">{formatCop(transaction.discountTotal)}</p>
                              </div>
                              <div className="rounded-2xl bg-white px-3 py-3 ring-1 ring-[var(--border)]">
                                <p className="subtle">Cobrado</p>
                                <p className="mt-1 font-semibold">{formatCop(transaction.netTotal)}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-3xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm subtle">
                          No hay transacciones para este cliente en el periodo seleccionado.
                        </div>
                      )}
                    </div>

                    {clientReport.tabAccount ? (
                      <div className="mt-6 space-y-4 rounded-3xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)] sm:p-5">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold">Cuenta de {clientReport.tabAccount.clientName}</p>
                            <p className="mt-1 text-sm subtle">
                              El consumo fiado se registra al momento de vender y el efectivo entra solo cuando se abona.
                            </p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold ring-1 ring-[var(--border)]">
                            Saldo actual: {formatCop(clientReport.tabAccount.outstandingBalance)}
                          </span>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl bg-white px-4 py-4 ring-1 ring-[var(--border)]">
                            <p className="text-sm subtle">Total fiado</p>
                            <p className="mt-1 text-lg font-semibold">
                              {formatCop(clientReport.tabAccount.totalTabSales)}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-white px-4 py-4 ring-1 ring-[var(--border)]">
                            <p className="text-sm subtle">Abonos registrados</p>
                            <p className="mt-1 text-lg font-semibold">
                              {formatCop(clientReport.tabAccount.totalRepayments)}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-white px-4 py-4 ring-1 ring-[var(--border)]">
                            <p className="text-sm subtle">Saldo pendiente</p>
                            <p className="mt-1 text-lg font-semibold">
                              {formatCop(clientReport.tabAccount.outstandingBalance)}
                            </p>
                          </div>
                        </div>

                        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold">Transacciones fiadas</p>
                              <span className="text-xs subtle">
                                {clientReport.tabAccount.transactions.length} movimientos
                              </span>
                            </div>
                            {clientReport.tabAccount.transactions.length ? (
                              clientReport.tabAccount.transactions.map((transaction) => (
                                <div
                                  key={transaction.id}
                                  className="rounded-3xl bg-white p-4 ring-1 ring-[var(--border)]"
                                >
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                      <p className="font-semibold">
                                        {formatSaleTime(transaction.createdAt)} · {formatCop(transaction.grossTotal)}
                                      </p>
                                      <p className="mt-1 text-sm subtle">
                                        {transaction.items.map((item) => `${item.quantity} x ${item.productName}`).join(" · ")}
                                      </p>
                                    </div>
                                    <span className="text-sm subtle">
                                      {new Date(transaction.createdAt).toLocaleDateString("es-CO", {
                                        timeZone: "America/Bogota"
                                      })}
                                    </span>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="rounded-3xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm subtle">
                                No hay ventas fiadas registradas para esta cuenta.
                              </div>
                            )}
                          </div>

                          <div className="space-y-4 rounded-3xl bg-white p-4 ring-1 ring-[var(--border)] sm:p-5">
                            <div>
                              <p className="text-sm font-semibold">Registrar pago</p>
                              <p className="mt-1 text-sm subtle">
                                Usa abonos parciales o liquida el saldo completo cuando este cliente pague.
                              </p>
                            </div>

                            {paymentMessage ? (
                              <div className="rounded-2xl bg-[var(--surface)] px-4 py-3 text-sm ring-1 ring-[var(--border)]">
                                {paymentMessage}
                              </div>
                            ) : null}

                            <label className="grid gap-2">
                              <span className="text-sm font-medium">Monto</span>
                              <input
                                type="number"
                                min="0"
                                step="100"
                                value={paymentAmount}
                                onChange={(event) => setPaymentAmount(event.target.value)}
                                placeholder="Ej. 10000"
                                className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                              />
                            </label>

                            <label className="grid gap-2">
                              <span className="text-sm font-medium">Método de pago</span>
                              <select
                                value={paymentMethod}
                                onChange={(event) =>
                                  setPaymentMethod(event.target.value as PaymentMethod)
                                }
                                className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                              >
                                {paymentMethods.map((method) => (
                                  <option key={method} value={method}>
                                    {method}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="grid gap-2">
                              <span className="text-sm font-medium">Pagó</span>
                              <input
                                type="text"
                                value={paymentPaidByName}
                                onChange={(event) => setPaymentPaidByName(event.target.value)}
                                placeholder="Ej. Bernardo"
                                className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                              />
                            </label>

                            <label className="grid gap-2">
                              <span className="text-sm font-medium">Nota</span>
                              <textarea
                                value={paymentNotes}
                                onChange={(event) => setPaymentNotes(event.target.value)}
                                rows={3}
                                placeholder="Observación del abono"
                                className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                              />
                            </label>

                            <div className="grid gap-3 sm:grid-cols-2">
                              <button
                                type="button"
                                onClick={() => saveClientPayment()}
                                disabled={isSavingPayment}
                                className="rounded-2xl bg-ink px-4 py-4 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {isSavingPayment ? "Guardando..." : "Abonar a cuenta"}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  saveClientPayment(clientReport.tabAccount?.outstandingBalance ?? 0)
                                }
                                disabled={
                                  isSavingPayment || clientReport.tabAccount.outstandingBalance <= 0
                                }
                                className="rounded-2xl bg-[var(--success)] px-4 py-4 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {isSavingPayment ? "Guardando..." : "Pagar saldo completo"}
                              </button>
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold">Historial de abonos</p>
                                <span className="text-xs subtle">
                                  {clientReport.tabAccount.payments.length} pagos
                                </span>
                              </div>
                              {clientReport.tabAccount.payments.length ? (
                                clientReport.tabAccount.payments.map((payment) => (
                                  <div
                                    key={payment.id}
                                    className="rounded-2xl bg-[var(--surface)] px-4 py-3 ring-1 ring-[var(--border)]"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="font-semibold">{formatCop(payment.amount)}</p>
                                        <p className="mt-1 text-sm subtle">
                                          {payment.paymentMethod}
                                          {payment.paidByName ? ` · Pagó: ${payment.paidByName}` : ""}
                                          {payment.notes ? ` · ${payment.notes}` : ""}
                                        </p>
                                      </div>
                                      <span className="text-sm subtle">
                                        {formatSaleTime(payment.createdAt)}
                                      </span>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="rounded-3xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm subtle">
                                  Aún no hay abonos registrados para esta cuenta.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : !isLoadingReport ? (
                <div className="mt-5 rounded-3xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm subtle">
                  No hay consumo registrado por cliente en este periodo.
                </div>
              ) : null}
            </section>
          ) : null}

          {can("products.admin") && (!isJefaView || jefaSection === "productos") ? (
            <section className="panel p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-lg font-semibold">Productos</p>
                  <p className="mt-1 text-sm subtle">
                    Ajusta precios, disponibilidad y estructura del menú desde una vista administrativa.
                  </p>
                </div>
                {editingProductId ? (
                  <button
                    type="button"
                    onClick={resetProductForm}
                    className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold ring-1 ring-[var(--border)] transition hover:ring-[var(--accent)]"
                  >
                    Cancelar edición
                  </button>
                ) : null}
              </div>

              {productMessage ? (
                <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-[var(--border)]">
                  {productMessage}
                </div>
              ) : null}

              {isJefaView ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setJefaProductSection("catalogo")}
                    className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                      jefaProductSection === "catalogo"
                        ? "bg-[var(--accent)] text-ink"
                        : "bg-[var(--accent-soft)] text-[var(--foreground)] ring-1 ring-transparent hover:ring-[var(--accent)]"
                    }`}
                  >
                    Catálogo
                  </button>
                  <button
                    type="button"
                    onClick={() => setJefaProductSection("stock")}
                    className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                      jefaProductSection === "stock"
                        ? "bg-[var(--accent)] text-ink"
                        : "bg-[var(--accent-soft)] text-[var(--foreground)] ring-1 ring-transparent hover:ring-[var(--accent)]"
                    }`}
                  >
                    Niveles de stock
                  </button>
                </div>
              ) : null}

              {jefaProductSection === "stock" ? (
                <div className="mt-5 space-y-5">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <MetricTile label="Sin stock" value={`${outOfStockCount}`} />
                    <MetricTile label="Stock bajo" value={`${lowStockCount}`} />
                    <MetricTile label="Disponible" value={`${availableStockCount}`} />
                  </div>

                  <div className="rounded-3xl bg-white p-4 ring-1 ring-[var(--border)] sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">Resumen de stock</p>
                        <p className="mt-1 text-sm subtle">
                          Vista rápida para compras y reposición de productos con control de stock.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <span className="rounded-full bg-[var(--surface)] px-3 py-1 text-xs font-semibold ring-1 ring-[var(--border)]">
                          {stockTrackedProducts.length} productos
                        </span>
                        <button
                          type="button"
                          onClick={() => downloadLowStockPdf(stockTrackedProducts)}
                          className="inline-flex items-center gap-2 rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95"
                        >
                          <Download className="h-4 w-4" />
                          Descargar PDF
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3">
                      {stockTrackedProducts.length ? (
                        stockTrackedProducts.map((product) => {
                          const outOfStock = isProductOutOfStock(product);
                          const lowStock = isProductLowStock(product);
                          const statusLabel = outOfStock
                            ? "Sin stock"
                            : lowStock
                              ? "Stock bajo"
                              : "Disponible";

                          return (
                            <div
                              key={product.id}
                              className={`rounded-3xl p-4 ring-1 ${
                                outOfStock
                                  ? "bg-rose-50 ring-rose-200"
                                  : lowStock
                                    ? "bg-amber-50 ring-amber-200"
                                    : "bg-white ring-[var(--border)]"
                              }`}
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <p className="font-semibold">{product.name}</p>
                                  <p className="mt-1 text-sm subtle">
                                    {product.category}
                                    {product.subcategory ? ` · ${product.subcategory}` : ""}
                                  </p>
                                </div>
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                    outOfStock
                                      ? "bg-rose-100 text-rose-800"
                                      : lowStock
                                        ? "bg-amber-100 text-amber-800"
                                        : "bg-emerald-100 text-emerald-800"
                                  }`}
                                >
                                  {statusLabel}
                                </span>
                              </div>

                              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                <div className="rounded-2xl bg-[var(--surface)] px-4 py-3 ring-1 ring-[var(--border)]">
                                  <p className="text-xs font-semibold uppercase tracking-[0.16em] subtle">
                                    Stock actual
                                  </p>
                                  <p className="mt-1 text-lg font-semibold">
                                    {product.stockQuantity ?? 0}
                                  </p>
                                </div>
                                <div className="rounded-2xl bg-[var(--surface)] px-4 py-3 ring-1 ring-[var(--border)]">
                                  <p className="text-xs font-semibold uppercase tracking-[0.16em] subtle">
                                    Stock mínimo
                                  </p>
                                  <p className="mt-1 text-lg font-semibold">
                                    {product.lowStockThreshold ?? 0}
                                  </p>
                                </div>
                                <div className="rounded-2xl bg-[var(--surface)] px-4 py-3 ring-1 ring-[var(--border)]">
                                  <p className="text-xs font-semibold uppercase tracking-[0.16em] subtle">
                                    Estado
                                  </p>
                                  <p className="mt-1 text-lg font-semibold">{statusLabel}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-3xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm subtle">
                          No hay productos activos con control de stock.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">Productos registrados</p>
                    <div className="grid gap-3">
                      {sortedProducts.map((product) => (
                        <div
                          key={product.id}
                          className="rounded-3xl bg-white p-4 ring-1 ring-[var(--border)]"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex items-start gap-3">
                              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-xl">
                                {renderProductBadge(product)}
                              </span>
                              <div>
                                <p className="font-semibold">{product.name}</p>
                                <p className="mt-1 text-sm subtle">
                                  {product.category}
                                  {product.subcategory ? ` · ${product.subcategory}` : ""}
                                </p>
                                <p className="mt-1 text-sm subtle">
                                  Precio: {product.price > 0 ? formatCop(product.price) : "Pendiente"}
                                  {typeof product.cost === "number"
                                    ? ` · Costo: ${formatCop(product.cost)}`
                                    : ""}
                                </p>
                                <p className="mt-1 text-sm subtle">
                                  {product.trackStock
                                    ? `Stock actual: ${product.stockQuantity ?? 0}${
                                        typeof product.lowStockThreshold === "number"
                                          ? ` · Stock mínimo: ${product.lowStockThreshold}`
                                          : ""
                                      }`
                                    : "Sin control de stock"}
                                </p>
                                <p className="mt-1 text-sm subtle">
                                  Ganancia:{" "}
                                  {typeof product.cost === "number"
                                    ? formatCop(product.price - product.cost)
                                    : "Pendiente por costo"}
                                </p>
                                <p className="mt-1 text-sm subtle">
                                  Stock:{" "}
                                  {product.trackStock
                                    ? isProductOutOfStock(product)
                                      ? "Agotado"
                                      : isProductLowStock(product)
                                        ? "Bajo"
                                        : "Disponible"
                                    : "Sin control"}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                  product.price <= 0
                                    ? "bg-slate-200 text-slate-700"
                                    : product.trackStock && isProductOutOfStock(product)
                                    ? "bg-rose-100 text-rose-800"
                                    : product.trackStock && isProductLowStock(product)
                                      ? "bg-amber-100 text-amber-800"
                                      : product.active
                                        ? "bg-emerald-100 text-emerald-800"
                                        : "bg-slate-200 text-slate-600"
                                }`}
                              >
                                {product.price <= 0
                                  ? "Precio pendiente"
                                  : product.trackStock
                                  ? isProductOutOfStock(product)
                                    ? "Agotado"
                                    : isProductLowStock(product)
                                      ? "Stock bajo"
                                      : "Con stock"
                                  : product.active
                                    ? "Sin control"
                                    : "Inactivo"}
                              </span>
                              <button
                                type="button"
                                onClick={() => startEditingProduct(product)}
                                className="inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-semibold ring-1 ring-[var(--border)] transition hover:ring-[var(--accent)]"
                              >
                                <PencilLine className="h-4 w-4" />
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleProductActive(product)}
                                className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                              >
                                {product.active ? "Desactivar" : "Activar"}
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteProduct(product)}
                                className="rounded-2xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                              >
                                Eliminar
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl bg-white p-4 ring-1 ring-[var(--border)] sm:p-5">
                    <div className="flex items-center gap-2">
                      {editingProductId ? (
                        <PencilLine className="h-5 w-5 text-[var(--accent)]" />
                      ) : (
                        <PlusCircle className="h-5 w-5 text-[var(--accent)]" />
                      )}
                      <p className="text-sm font-semibold">
                        {editingProductId ? "Editar producto" : "Nuevo producto"}
                      </p>
                    </div>

                    <div className="mt-4 grid gap-4">
                    <label className="grid gap-2">
                      <span className="text-sm font-medium">Nombre</span>
                      <input
                        type="text"
                        value={productForm.name}
                        onChange={(event) => updateProductForm("name", event.target.value)}
                        placeholder="Ej. Aromática de frutos rojos"
                        className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                      />
                    </label>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="grid gap-2">
                        <span className="text-sm font-medium">Categoría</span>
                        <select
                          value={productForm.category}
                          onChange={(event) =>
                            updateProductForm(
                              "category",
                              event.target.value as TopLevelCategory
                            )
                          }
                          className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                        >
                          {topLevelCategories.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="grid gap-2">
                        <span className="text-sm font-medium">Subcategoría</span>
                        <select
                          value={productForm.category === "Bebidas" ? productForm.subcategory : ""}
                          onChange={(event) =>
                            updateProductForm(
                              "subcategory",
                              event.target.value as BeverageSubcategory
                            )
                          }
                          disabled={productForm.category !== "Bebidas"}
                          className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:bg-slate-100"
                        >
                          {productForm.category !== "Bebidas" ? (
                            <option value="">No aplica</option>
                          ) : null}
                          {beverageSubcategories.map((subcategory) => (
                            <option key={subcategory} value={subcategory}>
                              {subcategory}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="grid gap-2">
                        <span className="text-sm font-medium">Precio (COP)</span>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={productForm.price}
                          onChange={(event) => updateProductForm("price", event.target.value)}
                          placeholder="0"
                          className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                        />
                      </label>

                      <label className="grid gap-2">
                        <span className="text-sm font-medium">Costo (opcional)</span>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={productForm.cost}
                          onChange={(event) => updateProductForm("cost", event.target.value)}
                          placeholder="0"
                          className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                        />
                      </label>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
                      <label className="grid gap-2">
                        <span className="text-sm font-medium">Icono o emoji</span>
                        <input
                          type="text"
                          value={productForm.image}
                          onChange={(event) => updateProductForm("image", event.target.value)}
                          placeholder="☕"
                          className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                        />
                      </label>

                      <label className="grid gap-2">
                        <span className="text-sm font-medium">Estado</span>
                        <select
                          value={productForm.active ? "active" : "inactive"}
                          onChange={(event) =>
                            updateProductForm("active", event.target.value === "active")
                          }
                          className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                        >
                          <option value="active">Activo</option>
                          <option value="inactive">Inactivo</option>
                        </select>
                      </label>
                    </div>

                    <div className="grid gap-4 rounded-3xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]">
                      <label className="grid gap-2">
                        <span className="text-sm font-medium">Controlar stock</span>
                        <select
                          value={productForm.trackStock ? "yes" : "no"}
                          onChange={(event) =>
                            updateProductForm("trackStock", event.target.value === "yes")
                          }
                          className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                        >
                          <option value="no">No</option>
                          <option value="yes">Sí</option>
                        </select>
                      </label>

                      {productForm.trackStock ? (
                        <div className="grid gap-4 sm:grid-cols-2">
                          <label className="grid gap-2">
                            <span className="text-sm font-medium">Cantidad actual</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={productForm.stockQuantity}
                              onChange={(event) =>
                                updateProductForm("stockQuantity", event.target.value)
                              }
                              placeholder="0"
                              className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                            />
                          </label>

                          <label className="grid gap-2">
                            <span className="text-sm font-medium">Stock mínimo</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={productForm.lowStockThreshold}
                              onChange={(event) =>
                                updateProductForm("lowStockThreshold", event.target.value)
                              }
                              placeholder="Opcional"
                              className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                            />
                          </label>
                        </div>
                      ) : (
                        <p className="text-sm subtle">
                          Este producto no descontará unidades automáticamente al venderse.
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={saveProduct}
                      disabled={
                        isSavingProduct || !productForm.name.trim() || !productForm.price.trim()
                      }
                      className="mt-2 w-full rounded-2xl bg-ink px-4 py-4 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isSavingProduct
                        ? "Guardando..."
                        : editingProductId
                          ? "Guardar cambios"
                          : "Crear producto"}
                    </button>
                  </div>
                </div>
              </div>
              )}
            </section>
          ) : null}
        </section>

        {!isJefaView ? (
        <aside className="panel-strong h-fit p-4 sm:p-5 xl:sticky xl:top-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold">Pedido actual</p>
            </div>
            <div className="rounded-2xl bg-slate-100 p-3 text-slate-600">
              <ShoppingCart className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-5 rounded-3xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]">
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Cliente</span>
              <select
                value={selectedClientId}
                onChange={(event) => handleClientSelection(event.target.value)}
                className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
              >
                <option value="">Cliente ocasional</option>
                {activeClients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.fullName}
                  </option>
                ))}
              </select>
            </label>

            {selectedClient ? (
              <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-[var(--border)]">
                <p className="font-semibold">{selectedClient.fullName}</p>
                <p className="mt-1 subtle">
                  Tipo: {getClientPricingLabel(selectedClient.pricingType)}
                </p>
                {selectedClient.pricingType === "familia" ? (
                  <p className="mt-2 text-emerald-700">
                    Se aplicará descuento familiar del 100%.
                  </p>
                ) : null}
                {selectedClient.pricingType === "fiado" ? (
                  <p className="mt-2 text-amber-700">
                    Esta venta quedará registrada como fiado pendiente para la cuenta de este cliente.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="mt-5 space-y-3">
            {currentOrder.length ? (
              currentOrder.map((item) => (
                <div
                  key={item.product.id}
                  className="rounded-3xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.product.name}</p>
                      <p className="mt-1 text-sm subtle">
                        Unitario: {formatCop(item.product.price)}
                      </p>
                      <p className="mt-1 text-sm subtle">Cantidad: {item.quantity}</p>
                      <p className="mt-1 text-sm subtle">
                        Total línea: {formatCop(item.product.price * item.quantity)}
                      </p>
                      {can("products.viewCost") ? (
                        <p className="mt-1 text-sm subtle">
                          Costo est.: {formatCop(getOrderItemEstimatedCost(item))}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex min-w-28 flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.product.id, -1)}
                          className="h-11 w-11 rounded-2xl bg-white text-lg font-semibold ring-1 ring-[var(--border)] transition hover:ring-[var(--accent)]"
                          aria-label={`Disminuir ${item.product.name}`}
                        >
                          -
                        </button>
                        <span className="min-w-8 text-center text-sm font-semibold">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.product.id, 1)}
                          disabled={
                            item.product.trackStock &&
                            item.quantity >= (item.product.stockQuantity ?? 0)
                          }
                          className="h-11 w-11 rounded-2xl bg-white text-lg font-semibold ring-1 ring-[var(--border)] transition hover:ring-[var(--accent)] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:hover:ring-[var(--border)]"
                          aria-label={`Aumentar ${item.product.name}`}
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeOrderItem(item.product.id)}
                        className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm subtle">
                Aún no hay productos en la orden.
              </div>
            )}
          </div>

          <div className="mt-6 space-y-3 border-t border-[var(--border)] pt-5">
            <div className="flex items-center justify-between text-sm subtle">
              <span>Items</span>
              <span>{currentOrderCount}</span>
            </div>
            <div className="flex items-center justify-between text-sm subtle">
              <span>Venta bruta</span>
              <span>{formatCop(checkoutTotals.grossTotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm subtle">
              <span>Descuento</span>
              <span>{formatCop(checkoutTotals.discountTotal)}</span>
            </div>
            <div className="flex items-center justify-between text-base font-semibold">
              <span>Total a cobrar</span>
              <span>{formatCop(checkoutTotals.netTotal)}</span>
            </div>
            {can("products.viewCost") ? (
              <div className="flex items-center justify-between text-sm subtle">
                <span>Costo</span>
                <span>{formatCop(currentOrder.reduce((total, item) => total + getOrderItemEstimatedCost(item), 0))}</span>
              </div>
            ) : null}
          </div>

          {requiresPaymentMethod ? (
            <div className="mt-6">
              <p className="text-sm font-semibold">Método de pago</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {paymentMethods.map((method) => {
                  const isActive = method === selectedPaymentMethod;

                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => {
                        setSelectedPaymentMethod(method);

                        if (method !== "Efectivo") {
                          setCashReceived("");
                        }
                      }}
                      className={`rounded-2xl px-3 py-3 text-sm font-semibold transition ${
                        isActive
                          ? "bg-ink text-white"
                          : "bg-white text-[var(--foreground)] ring-1 ring-[var(--border)] hover:ring-[var(--accent)]"
                      }`}
                    >
                      {method}
                    </button>
                  );
                })}
              </div>

              {selectedPaymentMethod === "Efectivo" ? (
                <div className="mt-4 rounded-3xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]">
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold">Dinero recibido</span>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={cashReceived}
                      onChange={(event) => setCashReceived(event.target.value)}
                      placeholder="Ej. 20000"
                      className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
                    />
                  </label>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-[var(--border)]">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] subtle">
                        Total a cobrar
                      </p>
                      <p className="mt-1 text-lg font-semibold">
                        {formatCop(checkoutTotals.netTotal)}
                      </p>
                    </div>
                    <div
                      className={`rounded-2xl px-4 py-3 ring-1 ${
                        cashChangeDue === null
                          ? "bg-white ring-[var(--border)]"
                          : cashChangeDue < 0
                            ? "bg-rose-50 ring-rose-200"
                            : "bg-emerald-50 ring-emerald-200"
                      }`}
                    >
                      <p
                        className={`text-xs font-semibold uppercase tracking-[0.16em] ${
                          cashChangeDue === null
                            ? "subtle"
                            : cashChangeDue < 0
                              ? "text-rose-700"
                              : "text-emerald-700"
                        }`}
                      >
                        {cashChangeDue !== null && cashChangeDue < 0 ? "Falta recibir" : "Cambio"}
                      </p>
                      <p
                        className={`mt-1 text-lg font-semibold ${
                          cashChangeDue === null
                            ? ""
                            : cashChangeDue < 0
                              ? "text-rose-700"
                              : "text-emerald-700"
                        }`}
                      >
                        {cashChangeDue === null
                          ? formatCop(0)
                          : formatCop(Math.abs(cashChangeDue))}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-6 rounded-3xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]">
              <p className="text-sm font-semibold">Cobro automático</p>
              <p className="mt-2 text-sm subtle">
                {checkoutTotals.saleStatus === "discounted"
                  ? "La venta se guardará con descuento familiar del 100% y pago final en 0."
                  : checkoutTotals.saleStatus === "pending"
                    ? "La venta se guardará como fiado, con saldo pendiente y cobro actual en 0."
                    : "Selecciona el método para registrar el cobro actual."}
              </p>
            </div>
          )}

          {salesMessage ? (
            <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-[var(--border)]">
              {salesMessage}
            </div>
          ) : null}

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={clearCurrentOrder}
              disabled={!currentOrder.length && !selectedClientId && !selectedPaymentMethod}
              className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold ring-1 ring-[var(--border)] transition hover:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Vaciar
            </button>
            <button
              type="button"
              onClick={completeSale}
              disabled={
                isSavingSale ||
                !currentOrder.length ||
                (requiresPaymentMethod && !selectedPaymentMethod) ||
                (isCashCheckout && (cashChangeDue === null || cashChangeDue < 0))
              }
              className="w-full rounded-2xl bg-[var(--success)] px-4 py-4 text-base font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSavingSale ? "Guardando..." : "Completar venta"}
            </button>
          </div>

          <p className="mt-3 text-xs leading-5 subtle">
            Estado de la venta: {getSaleStatusLabel(checkoutTotals.saleStatus)}.
          </p>

          {(can("sales.history") || can("sales.cancel.request")) && visibleRecentSales.length ? (
            <div className="mt-6 border-t border-[var(--border)] pt-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">
                  {can("sales.history") ? "Historial reciente" : "Ventas recientes"}
                </p>
                <span className="text-xs subtle">
                  {isJefaView ? `Últimas ${can("sales.history") ? "10" : "8"}` : "Últimos 30 min"}
                </span>
              </div>
              <div className="mt-3 space-y-3">
                {visibleRecentSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="rounded-2xl bg-slate-50 px-4 py-3 text-sm ring-1 ring-[var(--border)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">Neto: {formatCop(sale.netTotal)}</p>
                        <p className="mt-1 subtle">Bruto: {formatCop(sale.grossTotal)}</p>
                        <p className="mt-1 subtle">Descuento: {formatCop(sale.discountTotal)}</p>
                        <p className="mt-1 subtle">
                          {sale.clientName
                            ? `${sale.clientName} · ${sale.clientPricingType ? getClientPricingLabel(sale.clientPricingType) : "Cliente"}`
                            : "Cliente ocasional"}
                        </p>
                        <p className="mt-1 subtle">
                          {sale.paymentMethod ?? "Sin cobro"} · {getSaleStatusLabel(sale.saleStatus)}
                        </p>
                        {can("products.viewProfit") ? (
                          <p className="mt-1 subtle">
                            Ganancia: {formatCop(sale.grossProfit)}
                          </p>
                        ) : null}
                      </div>
                      <span className="text-right text-xs subtle">
                        {formatSaleTime(sale.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 subtle">{sale.itemsCount} productos</p>
                    {sale.isCancelled ? (
                      <p className="mt-2 text-xs font-semibold text-rose-700">Venta anulada</p>
                    ) : sale.cancellationRequestStatus === "pending" ? (
                      <p className="mt-2 text-xs font-semibold text-amber-700">
                        Anulación pendiente de aprobación
                      </p>
                    ) : sale.cancellationRequestStatus === "rejected" ? (
                      <p className="mt-2 text-xs font-semibold text-slate-600">
                        Solicitud de anulación rechazada
                      </p>
                    ) : null}
                    {canRequestCancellationForSale(sale) ? (
                      <button
                        type="button"
                        onClick={() => {
                          setCancellationSale(sale);
                          setCancellationReason(sale.cancellationReason ?? "");
                          setCancellationMessage(null);
                        }}
                        className="mt-3 rounded-2xl bg-white px-4 py-3 text-xs font-semibold ring-1 ring-[var(--border)] transition hover:ring-[var(--accent)]"
                      >
                        Solicitar anulación
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {can("cash.closeout") ? (
            <div className="mt-6 border-t border-[var(--border)] pt-5">
              <button
                type="button"
                onClick={() => {
                  setIsCloseoutOpen(true);
                  setCloseoutMessage(null);
                }}
                className="w-full rounded-2xl bg-white px-4 py-4 text-sm font-semibold ring-1 ring-[var(--border)] transition hover:ring-[var(--accent)]"
              >
                Cierre de caja
              </button>
            </div>
          ) : null}
        </aside>
        ) : null}
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  note,
  icon
}: {
  title: string;
  value: string;
  note: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl bg-white p-4 ring-1 ring-[var(--border)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm subtle">{title}</p>
          <p className="mt-2 text-2xl font-semibold">{value}</p>
        </div>
        <div className="rounded-2xl bg-[var(--accent-soft)] p-3 text-[var(--foreground)]">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-sm subtle">{note}</p>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white p-5 ring-1 ring-[var(--border)]">
      <p className="text-sm subtle">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  );
}
