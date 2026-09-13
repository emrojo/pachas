-- ==============================================================================
-- MIGRATION 22: INVOICE TYPE, TAX LEGISLATION & NET PRICE (EUROPE COMPLIANCE)
-- ==============================================================================
-- Adds support for:
-- 1. Identifying European jurisdiction (is_europe)
-- 2. Invoice classification: simplified (ticket/factura simplificada) vs. full (factura completa)
-- 3. Applicable tax legislation (e.g. ES_RD_1619_2012, EU_DIRECTIVE_2006_112)
-- 4. Net price (price without VAT / base imponible) per line item
-- ==============================================================================

DO $$
BEGIN
    ALTER TABLE public.expenses 
        ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(30) DEFAULT 'simplified' NOT NULL,
        ADD COLUMN IF NOT EXISTS tax_legislation VARCHAR(50) DEFAULT 'EU_DIRECTIVE_2006_112',
        ADD COLUMN IF NOT EXISTS is_europe BOOLEAN DEFAULT TRUE NOT NULL;
EXCEPTION WHEN others THEN
    NULL;
END
$$;

DO $$
BEGIN
    ALTER TABLE public.expense_items 
        ADD COLUMN IF NOT EXISTS net_price NUMERIC(12, 2) DEFAULT NULL;
EXCEPTION WHEN others THEN
    NULL;
END
$$;
