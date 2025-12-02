-- Add category column back to products table
-- Run this in Supabase SQL Editor

ALTER TABLE products 
ADD COLUMN category TEXT NOT NULL DEFAULT 'Other';

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- Add comment for documentation
COMMENT ON COLUMN products.category IS 'Product category: Breakfast, Lunch, Hot Food, Sandwiches, Bakery, or Other';

