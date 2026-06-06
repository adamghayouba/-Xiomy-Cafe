import type { SalesReport } from "@/lib/pos-types";
import { getSaleStatusLabel, getSettlementTypeLabel } from "@/lib/pos-domain";
import { downloadSimplePdf } from "@/lib/pdf-utils";
import { formatCop, formatSaleTime, getTodayKey } from "@/lib/pos-utils";

function formatPeriodLabel(report: SalesReport) {
  if (report.period === "day") return "Día";
  if (report.period === "week") return "Semana";
  if (report.period === "month") return "Mes";
  if (report.period === "year") return "Año";
  return "Rango personalizado";
}

function formatRangeLabel(report: SalesReport) {
  if (report.period !== "custom") {
    return formatPeriodLabel(report);
  }

  if (report.startDate && report.endDate) {
    return `${report.startDate} a ${report.endDate}`;
  }

  return "Rango personalizado";
}

function downloadBlob(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

function toCsvValue(value: string | number | null | undefined) {
  const normalized = value === null || typeof value === "undefined" ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

export function downloadSalesReportPdf(report: SalesReport) {
  const generatedAt = new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bogota"
  }).format(new Date());

  const lines = [
    "Gastrobar Raices",
    "Reporte de ventas",
    `Periodo: ${formatPeriodLabel(report)}`,
    `Rango: ${formatRangeLabel(report)}`,
    `Generado: ${generatedAt}`,
    "",
    "Resumen",
    `Ventas totales: ${formatCop(report.grossSales)}`,
    `Cobrado total: ${formatCop(report.netCollected)}`,
    `Descuentos totales: ${formatCop(report.discountTotal)}`,
    `Fiados generados: ${formatCop(report.fiadoGross)}`,
    `Abonos recibidos: ${formatCop(report.repaymentsTotal)}`,
    `Cuentas pendientes: ${formatCop(report.outstandingFiado)}`,
    `Numero de transacciones: ${report.transactionsCount}`,
    `Productos vendidos: ${report.productsSoldCount}`,
    "",
    "Desglose",
    `Ventas normales: ${formatCop(report.normalSalesGross)}`,
    `Consumo familiar: ${formatCop(report.familyConsumptionGross)}`,
    `Fiados: ${formatCop(report.fiadoGross)}`,
    `Abonos: ${formatCop(report.repaymentsTotal)}`,
    "",
    "Cobrado por metodo",
    ...(report.paymentBreakdown.length
      ? report.paymentBreakdown.map(
          (entry) => `${entry.method}: ${formatCop(entry.total)}`
        )
      : ["Sin movimientos cobrados en este periodo."]),
    "",
    "Top productos vendidos",
    ...(report.topProducts.length
      ? report.topProducts.map(
          (product) =>
            `${product.productName} | ${product.quantity} vendidos | ${formatCop(product.grossTotal)}`
        )
      : ["Sin productos vendidos en este periodo."])
  ];

  downloadSimplePdf(`reporte-ventas-${getTodayKey()}.pdf`, lines);
}

export function downloadSalesReportCsv(report: SalesReport) {
  const header = [
    "tipo_registro",
    "fecha",
    "hora",
    "id",
    "cliente",
    "estado",
    "metodo_o_liquidacion",
    "bruto",
    "descuento",
    "cobrado",
    "items",
    "detalle_items",
    "pagado_por",
    "nota"
  ];

  const saleRows = report.sales.map((sale) => [
    "venta",
    new Date(sale.createdAt).toLocaleDateString("sv-SE", { timeZone: "America/Bogota" }),
    formatSaleTime(sale.createdAt),
    sale.id,
    sale.clientName ?? "",
    getSaleStatusLabel(sale.saleStatus),
    sale.paymentMethod ?? getSettlementTypeLabel(sale.settlementType),
    sale.grossTotal,
    sale.discountTotal,
    sale.netTotal,
    sale.itemsCount,
    sale.items.map((item) => `${item.quantity} x ${item.productName}`).join(" | "),
    "",
    ""
  ]);

  const paymentRows = report.payments.map((payment) => [
    "abono",
    new Date(payment.createdAt).toLocaleDateString("sv-SE", { timeZone: "America/Bogota" }),
    formatSaleTime(payment.createdAt),
    payment.id,
    "",
    "Abono",
    payment.paymentMethod,
    0,
    0,
    payment.amount,
    "",
    "",
    payment.paidByName ?? "",
    payment.notes ?? ""
  ]);

  const summaryRows = [
    [],
    ["resumen", "valor"],
    ["Ventas totales", report.grossSales],
    ["Cobrado total", report.netCollected],
    ["Descuentos totales", report.discountTotal],
    ["Fiados generados", report.fiadoGross],
    ["Abonos recibidos", report.repaymentsTotal],
    ["Cuentas pendientes", report.outstandingFiado],
    ["Numero de transacciones", report.transactionsCount],
    ["Productos vendidos", report.productsSoldCount]
  ];

  const csv = [header, ...saleRows, ...paymentRows, ...summaryRows]
    .map((row) => row.map((value) => toCsvValue(value as string | number)).join(","))
    .join("\n");

  downloadBlob(`reporte-ventas-${getTodayKey()}.csv`, csv, "text/csv;charset=utf-8;");
}
