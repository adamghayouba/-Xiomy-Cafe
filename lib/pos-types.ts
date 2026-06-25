import type {
  BeverageSubcategory,
  PaymentMethod,
  Product,
  TopLevelCategory
} from "@/lib/pos-data";
import type { PosRole } from "@/lib/pos-permissions";

export type ClientPricingType = "normal" | "familia" | "fiado";
export type SaleStatus = "paid" | "discounted" | "pending";
export type SaleCancellationRequestStatus = "pending" | "approved" | "rejected";
export type SettlementType =
  | "pago_normal"
  | "consumo_familiar"
  | "descuento_total"
  | "cortesia"
  | "fiado";
export type ClientReportPeriod = "today" | "week" | "month" | "custom";
export type SalesReportPeriod = "day" | "week" | "month" | "year" | "custom";

export type PosProfile = {
  id: string;
  email: string;
  fullName: string | null;
  role: PosRole;
};

export type PosClient = {
  id: string;
  fullName: string;
  active: boolean;
  pricingType: ClientPricingType;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrderItem = {
  product: Product;
  quantity: number;
};

export type SaleInputItem = {
  productId: string;
  quantity: number;
};

export type DailySummary = {
  salesCount: number;
  grossSales: number;
  discountTotal: number;
  netRevenue: number;
  estimatedCost: number;
  grossProfit: number;
};

export type SaleHistoryEntry = {
  id: string;
  createdAt: string;
  paymentMethod: PaymentMethod | null;
  settlementType: SettlementType;
  clientName: string | null;
  clientPricingType: ClientPricingType | null;
  grossTotal: number;
  discountTotal: number;
  netTotal: number;
  estimatedCost: number;
  grossProfit: number;
  itemsCount: number;
  saleStatus: SaleStatus;
  isCancelled: boolean;
  cancellationRequestStatus: SaleCancellationRequestStatus | null;
  cancellationReason: string | null;
  cancellationRequestedAt: string | null;
  cancellationApprovedAt: string | null;
};

export type SaleCancellationRequest = {
  id: string;
  saleId: string;
  saleCreatedAt: string;
  saleGrossTotal: number;
  saleNetTotal: number;
  requestedByLabel: string;
  requestedByUserId: string | null;
  requestedAt: string;
  reason: string | null;
  status: SaleCancellationRequestStatus;
  approvedByLabel: string | null;
  approvedByUserId: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  resolutionNote: string | null;
};

export type ClientTransactionItem = {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type ClientTransactionEntry = SaleHistoryEntry & {
  clientId: string | null;
  items: ClientTransactionItem[];
};

export type ClientPaymentEntry = {
  id: string;
  clientId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paidByName: string | null;
  notes: string | null;
  createdAt: string;
};

export type ClientTabAccount = {
  clientId: string;
  clientName: string;
  outstandingBalance: number;
  totalTabSales: number;
  totalRepayments: number;
  transactions: ClientTransactionEntry[];
  payments: ClientPaymentEntry[];
};

export type ClientTabAccountSummary = {
  clientId: string;
  clientName: string;
  outstandingBalance: number;
};

export type ClientTabAccountsResponse = {
  accounts: ClientTabAccountSummary[];
  selectedClientId: string | null;
  account: ClientTabAccount | null;
};

export type ClientUsageSummary = {
  clientId: string;
  clientName: string;
  pricingType: ClientPricingType;
  transactionsCount: number;
  grossTotal: number;
  discountTotal: number;
  netCollected: number;
};

export type ClientUsageReport = {
  period: ClientReportPeriod;
  startDate: string | null;
  endDate: string | null;
  summaries: ClientUsageSummary[];
  selectedClientId: string | null;
  transactions: ClientTransactionEntry[];
  tabAccount: ClientTabAccount | null;
};

export type SalesTopProduct = {
  productId: string;
  productName: string;
  quantity: number;
  grossTotal: number;
};

export type SalesTopClient = {
  clientId: string;
  clientName: string;
  transactionsCount: number;
  grossTotal: number;
};

export type SalesPaymentBreakdown = {
  method: PaymentMethod;
  total: number;
};

export type SalesReport = {
  period: SalesReportPeriod;
  startDate: string | null;
  endDate: string | null;
  accumulatedCashInBox: number;
  grossSales: number;
  netCollected: number;
  discountTotal: number;
  cashWithdrawalsTotal: number;
  outstandingFiado: number;
  transactionsCount: number;
  productsSoldCount: number;
  normalSalesGross: number;
  familyConsumptionGross: number;
  fiadoGross: number;
  repaymentsTotal: number;
  paymentBreakdown: SalesPaymentBreakdown[];
  topProducts: SalesTopProduct[];
  topClients: SalesTopClient[];
  sales: ClientTransactionEntry[];
  payments: ClientPaymentEntry[];
};

export type CashCloseoutSnapshot = {
  businessDate: string;
  startingCash: number;
  cashSales: number;
  transferSales: number;
  fiadoGenerated: number;
  familyConsumption: number;
  repaymentsReceived: number;
  cashWithdrawals: number;
  cancelledSales: number;
  expectedCash: number;
  accumulatedCash: number;
  totalAvailableCash: number;
};

export type CashWithdrawalScope = "shift" | "accumulated";

export type CashWithdrawalRecord = {
  id: string;
  businessDate: string;
  amount: number;
  scope: CashWithdrawalScope;
  note: string | null;
  createdByLabel: string;
  createdAt: string;
};

export type CashCloseoutRecord = {
  id: string;
  businessDate: string;
  startingCash: number;
  countedCash: number;
  expectedCash: number;
  difference: number;
  notes: string | null;
  closedByLabel: string;
  cashierLabel: string;
  createdAt: string;
  reviewedByLabel: string | null;
  reviewedAt: string | null;
};

export type PosBootstrapData = {
  profile: PosProfile;
  products: Product[];
  clients: PosClient[];
  recentSales: SaleHistoryEntry[];
  dailySummary: DailySummary;
};

export type DailySalesHistoryResponse = {
  sales: ClientTransactionEntry[];
  rangeStart: string;
  rangeEnd: string;
  businessDate: string;
};

export type ProductFormState = {
  id?: string;
  name: string;
  category: TopLevelCategory;
  subcategory: BeverageSubcategory | "";
  price: string;
  cost: string;
  image: string;
  active: boolean;
  trackStock: boolean;
  stockQuantity: string;
  lowStockThreshold: string;
};

export type ClientFormState = {
  id?: string;
  fullName: string;
  pricingType: ClientPricingType;
  notes: string;
  active: boolean;
};
