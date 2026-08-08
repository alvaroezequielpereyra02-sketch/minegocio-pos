-- =============================================================================
-- MiNegocio POS — Migración Fase 2A
-- Agrega la tabla `customers`, que no estaba en el schema original de la Fase 0.
--
-- Por qué hace falta: `customers` es la libreta de clientes que el vendedor
-- administra a mano para asignar ventas del POS (walk-in, mayoristas
-- conocidos). Es DISTINTA de `users` con role='client' — esos son los
-- clientes que se registran solos con Google desde el catálogo público
-- (Fase 1). Un mismo negocio puede tener ambos tipos conviviendo.
--
-- INSTRUCCIONES: SQL Editor de Supabase → pegar y ejecutar.
-- =============================================================================

CREATE TABLE customers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT,
  address     TEXT,
  email       TEXT,
  is_wholesale BOOLEAN NOT NULL DEFAULT FALSE,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX customers_store_idx ON customers (store_id, name);

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_staff_all"
  ON customers FOR ALL
  USING (
    store_id = auth_store_id()
    AND auth_role() IN ('admin', 'employee')
  );
