-- =============================================================================
-- MiNegocio POS — Migración Fase 3A
-- Corrige el modelo de transacciones para que coincida con cómo se usa de
-- verdad en Pedidos y Reparto, y prepara `customers` para las estadísticas
-- que se actualizan en cada venta.
--
-- INSTRUCCIONES: SQL Editor de Supabase → pegar y ejecutar.
-- Seguro de correr aunque la tabla `transactions` esté vacía (lo está —
-- nunca se pudo escribir ahí de verdad, porque el checkout seguía en
-- Firestore hasta esta fase).
-- =============================================================================

-- ── 1. client_id no puede ser una FK estricta a users ───────────────────────
-- Puede apuntar a `customers` (libreta del POS) o a `users` (cliente
-- registrado con Google), o ser NULL (venta a un desconocido/mostrador).
-- La integridad se resuelve a nivel de aplicación, no de base de datos.
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_client_id_fkey;

-- ── 2. Nueva columna: de qué tabla viene client_id ──────────────────────────
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS client_role TEXT
  CHECK (client_role IN ('customer', 'client', 'guest'));

-- ── 3. Corregir los valores reales de fulfillment_status ────────────────────
-- El valor real que usa Reparto es 'delivering'/'completed', no
-- 'ready'/'delivered' como se había definido originalmente.
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_fulfillment_status_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_fulfillment_status_check
  CHECK (fulfillment_status IN ('pending', 'preparing', 'delivering', 'completed', 'cancelled'));

-- ── 4. Estadísticas de cliente en `customers` ───────────────────────────────
-- Se actualizan en cada venta asignada a un cliente de la libreta del POS.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS orders_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_purchase_at TIMESTAMPTZ;

-- ── 5. Snapshot de categoría en cada ítem vendido ────────────────────────────
-- El cálculo de Balance agrupa las ventas por categoría usando la categoría
-- que tenía el producto AL MOMENTO de la venta (no la actual — un producto
-- puede cambiar de categoría después). Sin esto, ese desglose no se puede
-- reconstruir.
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS category_id UUID;
