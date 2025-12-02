-- Add department column to products table
-- Run this in Supabase SQL Editor

ALTER TABLE products 
ADD COLUMN department TEXT NOT NULL DEFAULT 'Deli';

-- Add index for better query performance when filtering by department
CREATE INDEX IF NOT EXISTS idx_products_department ON products(department);

-- Add comment for documentation
COMMENT ON COLUMN products.department IS 'Department classification: Deli, Bakery, Cigarettes, Soft Drinks, or Other';

