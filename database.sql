-- 1. Create a category sequence tracking table
CREATE TABLE IF NOT EXISTS category_sequences (
    category_name VARCHAR(100) PRIMARY KEY,
    last_value INT NOT NULL DEFAULT 0
);

-- 2. Create the sequence generator function
CREATE OR REPLACE FUNCTION get_next_serial(cat_name VARCHAR)
RETURNS INT AS $$
DECLARE
    next_val INT;
    clean_cat VARCHAR;
BEGIN
    clean_cat := LOWER(TRIM(cat_name));
    
    INSERT INTO category_sequences (category_name, last_value)
    VALUES (clean_cat, 1)
    ON CONFLICT (category_name)
    DO UPDATE SET last_value = category_sequences.last_value + 1
    RETURNING last_value INTO next_val;
    
    RETURN next_val;
END;
$$ LANGUAGE plpgsql;

-- 3. Create products table (extended for bulk upload features)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial_number INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    v_price NUMERIC(10, 2) NOT NULL,
    i_price NUMERIC(10, 2) NOT NULL,
    sku VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(100) NOT NULL,
    sub_category VARCHAR(100) NOT NULL,
    image_url TEXT,
    hsn_code VARCHAR(50),
    sku_prefix VARCHAR(50),
    created_by VARCHAR(100) DEFAULT 'Operator',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create trigger logic to automatically set the serial number on insertion
CREATE OR REPLACE FUNCTION set_product_serial_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.serial_number := get_next_serial(NEW.category);
    
    -- Dynamically generate the SKU using the SKU prefix, category short name, and serial number
    -- Format: [PREFIX]-[CAT-SHORT]-[SERIAL]
    IF NEW.sku IS NULL OR NEW.sku = '' THEN
        NEW.sku := COALESCE(NEW.sku_prefix, 'SKU') || '-' || UPPER(SUBSTRING(NEW.category, 1, 3)) || '-' || LPAD(CAST(NEW.serial_number AS VARCHAR), 3, '0');
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS trg_set_product_serial_number ON products;

-- Attach trigger
CREATE TRIGGER trg_set_product_serial_number
BEFORE INSERT ON products
FOR EACH ROW
EXECUTE FUNCTION set_product_serial_number();

-- 5. Create audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID,
    user_name VARCHAR(100),
    user_role VARCHAR(50),
    action VARCHAR(100) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE', 'UNLOCK'
    previous_value JSONB,
    updated_value JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Add index optimization
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON audit_logs(record_id);
