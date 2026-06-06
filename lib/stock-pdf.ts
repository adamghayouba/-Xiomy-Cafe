import type { Product } from "@/lib/pos-data";
import { isProductLowStock, isProductOutOfStock } from "@/lib/pos-domain";
import { formatCop, getTodayKey } from "@/lib/pos-utils";
import { downloadSimplePdf } from "@/lib/pdf-utils";

export function downloadLowStockPdf(products: Product[]) {
  const priorityProducts = products.filter(
    (product) => isProductOutOfStock(product) || isProductLowStock(product)
  );

  const generatedAt = new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bogota"
  }).format(new Date());

  const lines = [
    "Gastrobar Raices",
    "Lista de compras - stock bajo y sin stock",
    `Generado: ${generatedAt}`,
    "",
    ...priorityProducts.flatMap((product) => {
      const status = isProductOutOfStock(product) ? "Sin stock" : "Stock bajo";
      const stock = product.stockQuantity ?? 0;
      const minimum = product.lowStockThreshold ?? 0;

      return [
        product.name,
        `Categoria: ${product.category}${product.subcategory ? ` / ${product.subcategory}` : ""}`,
        `Estado: ${status} | Stock actual: ${stock} | Stock minimo: ${minimum}`,
        `Precio venta: ${product.price > 0 ? formatCop(product.price) : "Pendiente"}`,
        ""
      ];
    })
  ];

  const contentLines = lines.length
    ? lines
    : [
      "Gastrobar Raices",
      "Lista de compras - stock bajo y sin stock",
      `Generado: ${generatedAt}`,
      "",
      "No hay productos con stock bajo o sin stock en este momento."
    ];

  downloadSimplePdf(`lista-stock-gastrobar-raices-${getTodayKey()}.pdf`, contentLines);
}
