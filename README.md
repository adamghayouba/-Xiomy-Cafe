# Xiomy Cafe POS

Responsive point-of-sale app for Xiomy Cafe built with Next.js, TypeScript, Tailwind CSS, and Supabase.

## Current scope

- One shared POS app with no login screen
- Products, sales, and sale items stored in Supabase
- Clients and family discounts stored in Supabase
- Daily totals from the database
- Product and client administration inside the same shared interface
- Simple responsive POS workflow for sales

## Project structure

```text
app/
  page.tsx
  api/
  layout.tsx
components/
  app-shell.tsx
  pos/pos-app.tsx
  setup/
lib/
  pos-data.ts
  pos-domain.ts
  pos-service.ts
  pos-types.ts
  pos-utils.ts
  supabase/
supabase/schema.sql
```

## Local setup

1. Use Node.js `20.18.0` or newer.
2. Install dependencies with `npm install`.
3. Create `.env.local` from `.env.example`.
4. Set:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

5. Run the SQL in [supabase/schema.sql](/Users/adamghayouba/Xiomy-Cafe/supabase/schema.sql).
6. Start the app with `npm run dev`.
7. Open [http://localhost:3000](http://localhost:3000).

## Notes

- La app abre directo al POS, sin login ni perfiles.
- El backend usa Supabase para productos, clientes, descuentos, ventas y `sale_items`.
- `supabase/schema.sql` deja la base lista para operar con la llave pública del proyecto.
