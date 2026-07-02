import {
  isBeverageSubcategory,
  isPaymentMethod,
  isTopLevelCategory,
  type Product
} from "@/lib/pos-data";
import { isPosRole, type PosRole } from "@/lib/pos-permissions";
import type {
  CashCloseoutRecord,
  CashCloseoutSnapshot,
  CashWithdrawalScope,
  CashWithdrawalRecord,
  ClientPaymentEntry,
  ClientReportPeriod,
  ClientFormState,
  ClientPricingType,
  ClientTabAccount,
  ClientTabAccountSummary,
  ClientTransactionEntry,
  ClientUsageReport,
  ClientUsageSummary,
  DailySummary,
  OrderItem,
  PosClient,
  ProductFormState,
  SalesReport,
  SalesPaymentBreakdown,
  SalesReportPeriod,
  SalesTopClient,
  SalesTopProduct,
  StockMovementRecord,
  StockMovementType,
  SaleCancellationRequest,
  SaleCancellationRequestStatus,
  SaleStatus,
  SettlementType,
  SaleHistoryEntry
} from "@/lib/pos-types";

export const clientPricingTypes: ClientPricingType[] = ["normal", "familia", "fiado"];

export const clientPricingLabels: Record<ClientPricingType, string> = {
  normal: "Normal",
  familia: "Familia",
  fiado: "Fiado"
};

export const saleStatusLabels: Record<SaleStatus, string> = {
  paid: "Pagada",
  discounted: "Descontada",
  pending: "Pendiente"
};

export const saleCancellationRequestStatusLabels: Record<SaleCancellationRequestStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada"
};

export const settlementTypeLabels: Record<SettlementType, string> = {
  pago_normal: "Pago normal",
  consumo_familiar: "Consumo familiar",
  descuento_total: "Descuento total",
  cortesia: "Cortesia",
  fiado: "Fiado"
};

export const emptyProductForm: ProductFormState = {
  name: "",
  category: "Bebidas",
  subcategory: "Calientes",
  price: "",
  cost: "",
  image: "",
  active: true,
  trackStock: false,
  stockQuantity: "",
  lowStockThreshold: ""
};

export const emptyClientForm: ClientFormState = {
  fullName: "",
  pricingType: "normal",
  notes: "",
  active: true
};

export function normalizeProduct(product: Product): Product {
  return {
    ...product,
    active: product.active ?? true,
    image: product.image ?? "",
    cost: typeof product.cost === "number" ? product.cost : undefined,
    trackStock: product.trackStock ?? false,
    stockQuantity:
      typeof product.stockQuantity === "number" ? product.stockQuantity : undefined,
    lowStockThreshold:
      typeof product.lowStockThreshold === "number" ? product.lowStockThreshold : undefined
  };
}

export function isProductOutOfStock(product: Product) {
  return product.trackStock && (product.stockQuantity ?? 0) <= 0;
}

export function isProductLowStock(product: Product) {
  if (!product.trackStock) {
    return false;
  }

  const currentStock = product.stockQuantity ?? 0;
  const threshold = product.lowStockThreshold ?? 0;

  return currentStock > 0 && threshold >= 0 && currentStock <= threshold;
}

export function getOrderItemEstimatedCost(item: OrderItem) {
  return (item.product.cost ?? 0) * item.quantity;
}

export function getOrderItemHasMissingCost(item: OrderItem) {
  return typeof item.product.cost !== "number";
}

export function getSaleMetrics(items: OrderItem[], revenue: number) {
  const estimatedCost = items.reduce(
    (total, item) => total + getOrderItemEstimatedCost(item),
    0
  );
  const hasPartialCost = items.some(getOrderItemHasMissingCost);

  return {
    estimatedCost,
    grossProfit: revenue - estimatedCost,
    hasPartialCost
  };
}

export function getOrderTotal(items: OrderItem[]) {
  return items.reduce((total, item) => total + item.product.price * item.quantity, 0);
}

export function emptyDailySummary(): DailySummary {
  return {
    salesCount: 0,
    grossSales: 0,
    discountTotal: 0,
    netRevenue: 0,
    estimatedCost: 0,
    grossProfit: 0
  };
}

export function isClientPricingType(value: string): value is ClientPricingType {
  return clientPricingTypes.includes(value as ClientPricingType);
}

export function isSaleStatus(value: string): value is SaleStatus {
  return value === "paid" || value === "discounted" || value === "pending";
}

export function isSaleCancellationRequestStatus(
  value: string
): value is SaleCancellationRequestStatus {
  return value === "pending" || value === "approved" || value === "rejected";
}

export function getClientPricingLabel(pricingType: ClientPricingType) {
  return clientPricingLabels[pricingType];
}

export function getSaleStatusLabel(status: SaleStatus) {
  return saleStatusLabels[status];
}

export function getSaleCancellationRequestStatusLabel(
  status: SaleCancellationRequestStatus
) {
  return saleCancellationRequestStatusLabels[status];
}

export function isSettlementType(value: string): value is SettlementType {
  return (
    value === "pago_normal" ||
    value === "consumo_familiar" ||
    value === "descuento_total" ||
    value === "cortesia" ||
    value === "fiado"
  );
}

export function getSettlementTypeLabel(settlementType: SettlementType) {
  return settlementTypeLabels[settlementType];
}

export function getSaleAdjustments(
  items: OrderItem[],
  pricingType: ClientPricingType | null | undefined
) {
  const grossTotal = getOrderTotal(items);
  const discountTotal = pricingType === "familia" ? grossTotal : 0;
  const netTotal = Math.max(grossTotal - discountTotal, 0);
  const saleStatus: SaleStatus =
    pricingType === "familia"
      ? "discounted"
      : pricingType === "fiado"
        ? "pending"
        : "paid";
  const settlementType: SettlementType =
    pricingType === "familia"
      ? "consumo_familiar"
      : pricingType === "fiado"
        ? "fiado"
        : "pago_normal";

  return {
    grossTotal,
    discountTotal,
    netTotal,
    saleStatus,
    settlementType
  };
}

export function mapProductRecord(record: Record<string, unknown>): Product {
  const category = String(record.category);
  const subcategory = String(record.subcategory ?? "");

  return normalizeProduct({
    id: String(record.id),
    name: String(record.name),
    category: isTopLevelCategory(category) ? category : "Bebidas",
    subcategory: isBeverageSubcategory(subcategory)
      ? subcategory
      : undefined,
    price: Number(record.price ?? 0),
    description: String(record.description ?? ""),
    cost:
      typeof record.cost === "number" || typeof record.cost === "string"
        ? Number(record.cost)
        : undefined,
    image: String(record.image ?? ""),
    active: Boolean(record.active),
    trackStock: Boolean(record.track_stock),
    stockQuantity:
      typeof record.stock_quantity === "number" || typeof record.stock_quantity === "string"
        ? Number(record.stock_quantity)
        : undefined,
    lowStockThreshold:
      typeof record.low_stock_threshold === "number" ||
      typeof record.low_stock_threshold === "string"
        ? Number(record.low_stock_threshold)
        : undefined
  });
}

export function mapSaleRecord(record: Record<string, unknown>): SaleHistoryEntry {
  const paymentMethod = String(record.payment_method);
  const saleStatus = String(record.sale_status ?? "paid");
  const settlementType = String(record.settlement_type ?? "pago_normal");
  const client = record.client as Record<string, unknown> | null;
  const clientPricingType = String(client?.pricing_type ?? "");

  return {
    id: String(record.id),
    createdAt: String(record.created_at),
    paymentMethod: isPaymentMethod(paymentMethod)
      ? paymentMethod
      : null,
    settlementType: isSettlementType(settlementType) ? settlementType : "pago_normal",
    clientName: client?.full_name ? String(client.full_name) : null,
    clientPricingType: isClientPricingType(clientPricingType) ? clientPricingType : null,
    grossTotal: Number(record.gross_total ?? 0),
    discountTotal: Number(record.discount_total ?? 0),
    netTotal: Number(record.net_total ?? record.total ?? 0),
    estimatedCost: Number(record.estimated_cost ?? 0),
    grossProfit: Number(record.gross_profit ?? 0),
    itemsCount: Number(record.items_count ?? 0),
    saleStatus: isSaleStatus(saleStatus) ? saleStatus : "paid",
    isCancelled: Boolean(record.is_cancelled),
    cancellationRequestStatus: isSaleCancellationRequestStatus(
      String(record.cancellation_request_status ?? "")
    )
      ? (String(record.cancellation_request_status) as SaleCancellationRequestStatus)
      : null,
    cancellationReason: record.cancellation_reason ? String(record.cancellation_reason) : null,
    cancellationRequestedAt: record.cancellation_requested_at
      ? String(record.cancellation_requested_at)
      : null,
    cancellationApprovedAt: record.cancellation_approved_at
      ? String(record.cancellation_approved_at)
      : null
  };
}

export function mapSaleCancellationRequestRecord(
  record: Record<string, unknown>
): SaleCancellationRequest {
  const sale = record.sale as Record<string, unknown> | null;
  const status = String(record.status ?? "pending");

  return {
    id: String(record.id ?? ""),
    saleId: String(record.sale_id ?? sale?.id ?? ""),
    saleCreatedAt: String(record.sale_created_at ?? sale?.created_at ?? ""),
    saleGrossTotal: Number(record.sale_gross_total ?? sale?.gross_total ?? 0),
    saleNetTotal: Number(record.sale_net_total ?? sale?.net_total ?? sale?.total ?? 0),
    requestedByLabel: String(record.requested_by_label ?? "Cajera"),
    requestedByUserId: record.requested_by_user_id ? String(record.requested_by_user_id) : null,
    requestedAt: String(record.requested_at ?? ""),
    reason: record.reason ? String(record.reason) : null,
    status: isSaleCancellationRequestStatus(status) ? status : "pending",
    approvedByLabel: record.approved_by_label ? String(record.approved_by_label) : null,
    approvedByUserId: record.approved_by_user_id ? String(record.approved_by_user_id) : null,
    approvedAt: record.approved_at ? String(record.approved_at) : null,
    rejectedAt: record.rejected_at ? String(record.rejected_at) : null,
    resolutionNote: record.resolution_note ? String(record.resolution_note) : null
  };
}

export function mapSummaryRecord(record: Record<string, unknown> | null | undefined): DailySummary {
  if (!record) {
    return emptyDailySummary();
  }

  return {
    salesCount: Number(record.sales_count ?? 0),
    grossSales: Number(record.gross_sales ?? 0),
    discountTotal: Number(record.discount_total ?? 0),
    netRevenue: Number(record.net_revenue ?? record.revenue ?? 0),
    estimatedCost: Number(record.estimated_cost ?? 0),
    grossProfit: Number(record.gross_profit ?? 0)
  };
}

export function mapClientRecord(record: Record<string, unknown>): PosClient {
  const pricingType = String(record.pricing_type ?? "normal");

  return {
    id: String(record.id),
    fullName: String(record.full_name ?? ""),
    active: Boolean(record.active),
    pricingType: isClientPricingType(pricingType) ? pricingType : "normal",
    notes: record.notes ? String(record.notes) : null,
    createdAt: String(record.created_at ?? ""),
    updatedAt: String(record.updated_at ?? "")
  };
}

export function mapClientTransactionRecord(record: Record<string, unknown>): ClientTransactionEntry {
  const sale = mapSaleRecord(record);
  const saleItems = Array.isArray(record.sale_items) ? record.sale_items : [];

  return {
    ...sale,
    clientId: record.client_id ? String(record.client_id) : null,
    items: saleItems.map((item) => {
      const product = item.product as Record<string, unknown> | null;

      return {
        id: String(item.id ?? ""),
        productName: product?.name ? String(product.name) : "Producto",
        quantity: Number(item.quantity ?? 0),
        unitPrice: Number(item.unit_price ?? 0),
        lineTotal: Number(item.line_total ?? 0)
      };
    })
  };
}

export function mapClientPaymentRecord(record: Record<string, unknown>): ClientPaymentEntry {
  const paymentMethod = String(record.payment_method ?? "");

  return {
    id: String(record.id ?? ""),
    clientId: String(record.client_id ?? ""),
    amount: Number(record.amount ?? 0),
    paymentMethod: isPaymentMethod(paymentMethod) ? paymentMethod : "Efectivo",
    paidByName: record.paid_by_name ? String(record.paid_by_name) : null,
    notes: record.notes ? String(record.notes) : null,
    createdAt: String(record.created_at ?? "")
  };
}

export function mapCashCloseoutSnapshotRecord(
  record: Record<string, unknown> | null | undefined
): CashCloseoutSnapshot {
  return {
    businessDate: String(record?.business_date ?? ""),
    startingCash: Number(record?.starting_cash ?? 0),
    cashSales: Number(record?.cash_sales ?? 0),
    transferSales: Number(record?.transfer_sales ?? 0),
    fiadoGenerated: Number(record?.fiado_generated ?? 0),
    familyConsumption: Number(record?.family_consumption ?? 0),
    repaymentsReceived: Number(record?.repayments_received ?? 0),
    cashWithdrawals: Number(record?.cash_withdrawals ?? 0),
    cancelledSales: Number(record?.cancelled_sales ?? 0),
    expectedCash: Number(record?.expected_cash ?? 0),
    accumulatedCash: Number(record?.accumulated_cash ?? 0),
    totalAvailableCash: Number(record?.total_available_cash ?? 0)
  };
}

export function mapCashWithdrawalRecord(record: Record<string, unknown>): CashWithdrawalRecord {
  const scopeValue = String(record.scope ?? "shift");
  const scope: CashWithdrawalScope =
    scopeValue === "accumulated" ? "accumulated" : "shift";

  return {
    id: String(record.id ?? ""),
    businessDate: String(record.business_date ?? ""),
    amount: Number(record.amount ?? 0),
    scope,
    note: record.note ? String(record.note) : null,
    createdByLabel: String(record.created_by_label ?? "Caja"),
    createdAt: String(record.created_at ?? "")
  };
}

export function mapStockMovementRecord(record: Record<string, unknown>): StockMovementRecord {
  const movementTypeValue = String(record.movement_type ?? "restock");
  const movementType: StockMovementType =
    movementTypeValue === "adjustment_out" ? "adjustment_out" : "restock";

  return {
    id: String(record.id ?? ""),
    productId: String(record.product_id ?? ""),
    movementType,
    quantity: Number(record.quantity ?? 0),
    reason: record.reason ? (String(record.reason) as StockMovementRecord["reason"]) : null,
    note: record.note ? String(record.note) : null,
    createdByLabel: String(record.created_by_label ?? "Jefa"),
    createdAt: String(record.created_at ?? "")
  };
}

export function mapCashCloseoutRecord(record: Record<string, unknown>): CashCloseoutRecord {
  return {
    id: String(record.id ?? ""),
    businessDate: String(record.business_date ?? ""),
    startingCash: Number(record.starting_cash ?? 0),
    countedCash: Number(record.counted_cash ?? 0),
    expectedCash: Number(record.expected_cash ?? 0),
    difference: Number(record.difference ?? 0),
    notes: record.notes ? String(record.notes) : null,
    closedByLabel: String(record.closed_by_label ?? "Caja"),
    cashierLabel: String(record.cashier_label ?? "Caja"),
    createdAt: String(record.created_at ?? ""),
    reviewedByLabel: record.reviewed_by_label ? String(record.reviewed_by_label) : null,
    reviewedAt: record.reviewed_at ? String(record.reviewed_at) : null
  };
}

export function buildClientUsageReport(params: {
  clients: PosClient[];
  transactions: ClientTransactionEntry[];
  payments?: ClientPaymentEntry[];
  tabAccountTransactions?: ClientTransactionEntry[];
  tabAccountPayments?: ClientPaymentEntry[];
  period: ClientReportPeriod;
  startDate: string | null;
  endDate: string | null;
  selectedClientId: string | null;
}): ClientUsageReport {
  const activeTransactions = params.transactions.filter((transaction) => !transaction.isCancelled);
  const summaryByClient = new Map<string, ClientUsageSummary>();

  for (const client of params.clients) {
    summaryByClient.set(client.id, {
      clientId: client.id,
      clientName: client.fullName,
      pricingType: client.pricingType,
      transactionsCount: 0,
      grossTotal: 0,
      discountTotal: 0,
      netCollected: 0
    });
  }

  for (const transaction of activeTransactions) {
    if (!transaction.clientId) {
      continue;
    }

    const current = summaryByClient.get(transaction.clientId);

    if (!current) {
      continue;
    }

    current.transactionsCount += 1;
    current.grossTotal += transaction.grossTotal;
    current.discountTotal += transaction.discountTotal;
    current.netCollected += transaction.netTotal;
  }

  const summaries = [...summaryByClient.values()]
    .filter((summary) => summary.transactionsCount > 0)
    .sort((left, right) => left.clientName.localeCompare(right.clientName));

  const resolvedSelectedClientId =
    params.selectedClientId && summaries.some((summary) => summary.clientId === params.selectedClientId)
      ? params.selectedClientId
      : summaries[0]?.clientId ?? null;

  const transactions = activeTransactions
    .filter((transaction) => transaction.clientId === resolvedSelectedClientId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  const selectedClient =
    resolvedSelectedClientId
      ? params.clients.find((client) => client.id === resolvedSelectedClientId) ?? null
      : null;
  const payments = (params.payments ?? [])
    .filter((payment) => payment.clientId === resolvedSelectedClientId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const accountTransactionsSource =
    (params.tabAccountTransactions ?? params.transactions).filter(
      (transaction) => !transaction.isCancelled
    );
  const accountPaymentsSource = params.tabAccountPayments ?? params.payments ?? [];
  const tabTransactions =
    selectedClient?.pricingType === "fiado"
      ? accountTransactionsSource
          .filter(
            (transaction) =>
              transaction.clientId === resolvedSelectedClientId &&
              transaction.saleStatus === "pending"
          )
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      : [];
  const totalTabSales = tabTransactions.reduce(
    (total, transaction) => total + transaction.grossTotal,
    0
  );
  const accountPayments =
    selectedClient?.pricingType === "fiado"
      ? accountPaymentsSource
          .filter((payment) => payment.clientId === resolvedSelectedClientId)
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      : payments;
  const totalRepayments = accountPayments.reduce((total, payment) => total + payment.amount, 0);
  const tabAccount: ClientTabAccount | null =
    selectedClient?.pricingType === "fiado"
      ? {
          clientId: selectedClient.id,
          clientName: selectedClient.fullName,
          outstandingBalance: Math.max(totalTabSales - totalRepayments, 0),
          totalTabSales,
          totalRepayments,
          transactions: tabTransactions,
          payments: accountPayments
        }
      : null;

  return {
    period: params.period,
    startDate: params.startDate,
    endDate: params.endDate,
    summaries,
    selectedClientId: resolvedSelectedClientId,
    transactions,
    tabAccount
  };
}

export function buildClientTabAccount(params: {
  client: PosClient;
  transactions: ClientTransactionEntry[];
  payments: ClientPaymentEntry[];
}): ClientTabAccount {
  const chronologicalTransactions = params.transactions
    .filter((transaction) => !transaction.isCancelled)
    .sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt)
  );
  const payments = [...params.payments].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
  const totalTabSales = chronologicalTransactions.reduce(
    (total, transaction) => total + transaction.grossTotal,
    0
  );
  const totalRepayments = payments.reduce((total, payment) => total + payment.amount, 0);
  let remainingRepayments = totalRepayments;
  const outstandingTransactions = chronologicalTransactions.filter((transaction) => {
    if (remainingRepayments <= 0) {
      return true;
    }

    if (remainingRepayments >= transaction.grossTotal) {
      remainingRepayments -= transaction.grossTotal;
      return false;
    }

    remainingRepayments = 0;
    return true;
  });

  return {
    clientId: params.client.id,
    clientName: params.client.fullName,
    outstandingBalance: Math.max(totalTabSales - totalRepayments, 0),
    totalTabSales,
    totalRepayments,
    transactions: outstandingTransactions.sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    ),
    payments
  };
}

export function buildClientTabAccountSummary(account: ClientTabAccount): ClientTabAccountSummary {
  return {
    clientId: account.clientId,
    clientName: account.clientName,
    outstandingBalance: account.outstandingBalance
  };
}

export function buildSalesReport(params: {
  sales: ClientTransactionEntry[];
  payments: ClientPaymentEntry[];
  cashWithdrawals: CashWithdrawalRecord[];
  allFiadoSales: ClientTransactionEntry[];
  allFiadoPayments: ClientPaymentEntry[];
  accumulatedCashInBox: number;
  period: SalesReportPeriod;
  startDate: string | null;
  endDate: string | null;
}): SalesReport {
  const activeSales = params.sales.filter((sale) => !sale.isCancelled);
  const activeFiadoSales = params.allFiadoSales.filter((sale) => !sale.isCancelled);
  const sortedSales = [...activeSales].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
  const sortedPayments = [...params.payments].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
  const grossSales = activeSales.reduce((total, sale) => total + sale.grossTotal, 0);
  const discountTotal = activeSales.reduce((total, sale) => total + sale.discountTotal, 0);
  const salesCollected = activeSales.reduce((total, sale) => total + sale.netTotal, 0);
  const repaymentsTotal = params.payments.reduce((total, payment) => total + payment.amount, 0);
  const cashWithdrawalsTotal = params.cashWithdrawals.reduce(
    (total, withdrawal) => total + withdrawal.amount,
    0
  );
  const netCollected = salesCollected + repaymentsTotal;
  const transactionsCount = activeSales.length;
  const productsSoldCount = activeSales.reduce((total, sale) => total + sale.itemsCount, 0);
  const normalSalesGross = activeSales
    .filter((sale) => sale.saleStatus === "paid")
    .reduce((total, sale) => total + sale.grossTotal, 0);
  const familyConsumptionGross = activeSales
    .filter((sale) => sale.saleStatus === "discounted")
    .reduce((total, sale) => total + sale.grossTotal, 0);
  const fiadoGross = activeSales
    .filter((sale) => sale.saleStatus === "pending")
    .reduce((total, sale) => total + sale.grossTotal, 0);

  const totalOutstandingFiado = Math.max(
    activeFiadoSales.reduce((total, sale) => total + sale.grossTotal, 0) -
      params.allFiadoPayments.reduce((total, payment) => total + payment.amount, 0),
    0
  );

  const paymentMethodMap = new Map<string, number>();

  for (const sale of activeSales) {
    if (sale.paymentMethod && sale.netTotal > 0) {
      paymentMethodMap.set(
        sale.paymentMethod,
        (paymentMethodMap.get(sale.paymentMethod) ?? 0) + sale.netTotal
      );
    }
  }

  for (const payment of params.payments) {
    paymentMethodMap.set(
      payment.paymentMethod,
      (paymentMethodMap.get(payment.paymentMethod) ?? 0) + payment.amount
    );
  }

  const paymentBreakdown: SalesPaymentBreakdown[] = [...paymentMethodMap.entries()]
    .map(([method, total]) => ({
      method: method as SalesPaymentBreakdown["method"],
      total
    }))
    .sort((left, right) => right.total - left.total);

  const productMap = new Map<string, SalesTopProduct>();

  for (const sale of activeSales) {
    for (const item of sale.items) {
      const current = productMap.get(item.productName);

      if (current) {
        current.quantity += item.quantity;
        current.grossTotal += item.lineTotal;
        continue;
      }

      productMap.set(item.productName, {
        productId: item.id,
        productName: item.productName,
        quantity: item.quantity,
        grossTotal: item.lineTotal
      });
    }
  }

  const topProducts = [...productMap.values()]
    .sort((left, right) =>
      right.quantity === left.quantity
        ? right.grossTotal - left.grossTotal
        : right.quantity - left.quantity
    );

  const clientMap = new Map<string, SalesTopClient>();

  for (const sale of activeSales) {
    if (!sale.clientId || !sale.clientName) {
      continue;
    }

    const current = clientMap.get(sale.clientId);

    if (current) {
      current.transactionsCount += 1;
      current.grossTotal += sale.grossTotal;
      continue;
    }

    clientMap.set(sale.clientId, {
      clientId: sale.clientId,
      clientName: sale.clientName,
      transactionsCount: 1,
      grossTotal: sale.grossTotal
    });
  }

  const topClients = [...clientMap.values()]
    .sort((left, right) => right.grossTotal - left.grossTotal)
    .slice(0, 6);

  return {
    period: params.period,
    startDate: params.startDate,
    endDate: params.endDate,
    accumulatedCashInBox: params.accumulatedCashInBox,
    grossSales,
    netCollected,
    discountTotal,
    cashWithdrawalsTotal,
    outstandingFiado: totalOutstandingFiado,
    transactionsCount,
    productsSoldCount,
    normalSalesGross,
    familyConsumptionGross,
    fiadoGross,
    repaymentsTotal,
    paymentBreakdown,
    topProducts,
    topClients,
    sales: sortedSales,
    payments: sortedPayments
  };
}

export function mapProfileRecord(record: Record<string, unknown>): {
  id: string;
  email: string;
  fullName: string | null;
  role: PosRole;
} {
  const roleValue = String(record.role ?? "cajero");

  return {
    id: String(record.id),
    email: String(record.email ?? ""),
    fullName: record.full_name ? String(record.full_name) : null,
    role: isPosRole(roleValue) ? roleValue : "cajero"
  };
}
