-- Migration: Add active column for soft delete functionality
-- Run this in Supabase SQL Editor

-- Add active column with default value true
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true NOT NULL;

-- Set all existing products to active
UPDATE products SET active = true WHERE active IS NULL;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);

-- Update the sample data if needed (make sure all existing products are active)
UPDATE products SET active = true;

