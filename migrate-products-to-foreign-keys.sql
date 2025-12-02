-- Migrate products table to use category_id and department_id foreign keys
-- Run this AFTER creating categories and departments tables
-- Run this in Supabase SQL Editor

-- Step 1: Add new foreign key columns
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id),
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);

-- Step 2: Migrate existing data from text fields to foreign keys
-- Map existing category text values to category IDs
UPDATE products p
SET category_id = c.id
FROM categories c
WHERE LOWER(p.category) = LOWER(c.name)
AND p.category_id IS NULL;

-- Map existing department text values to department IDs
UPDATE products p
SET department_id = d.id
FROM departments d
WHERE LOWER(p.department) = LOWER(d.name)
AND p.department_id IS NULL;

-- Step 3: Set any remaining NULL values to 'Other'
-- For categories
UPDATE products
SET category_id = (SELECT id FROM categories WHERE name = 'Other' LIMIT 1)
WHERE category_id IS NULL;

-- For departments
UPDATE products
SET department_id = (SELECT id FROM departments WHERE name = 'Other' LIMIT 1)
WHERE department_id IS NULL;

-- Step 4: Make the foreign key columns NOT NULL
ALTER TABLE products 
  ALTER COLUMN category_id SET NOT NULL,
  ALTER COLUMN department_id SET NOT NULL;

-- Step 5: Drop old text columns
ALTER TABLE products 
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS department;

-- Step 6: Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_department_id ON products(department_id);

-- Add comments
COMMENT ON COLUMN products.category_id IS 'Foreign key reference to categories table';
COMMENT ON COLUMN products.department_id IS 'Foreign key reference to departments table';

