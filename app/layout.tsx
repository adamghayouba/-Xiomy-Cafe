import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "Gastrobar Raices",
  description: "Punto de venta compartido con Supabase para productos, clientes y ventas."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
