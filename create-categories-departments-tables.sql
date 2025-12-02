-- Create categories and departments tables for dynamic management
-- Run this in Supabase SQL Editor

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT DEFAULT 'gray',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Departments table
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT DEFAULT 'gray',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_unique ON categories(LOWER(name));
CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_name_unique ON departments(LOWER(name));

-- Add regular indexes
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(active);
CREATE INDEX IF NOT EXISTS idx_departments_active ON departments(active);

-- Enable Row Level Security (RLS)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

-- Create policies that allow all operations (adjust based on your auth requirements)
CREATE POLICY "Enable all operations for categories" 
  ON categories 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "Enable all operations for departments" 
  ON departments 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Seed with default categories
INSERT INTO categories (name, color) VALUES
  ('Breakfast', 'yellow'),
  ('Lunch', 'green'),
  ('Hot Food', 'red'),
  ('Sandwiches', 'blue'),
  ('Bakery', 'purple'),
  ('Other', 'gray')
ON CONFLICT DO NOTHING;

-- Seed with default departments
INSERT INTO departments (name, color) VALUES
  ('Deli', 'blue'),
  ('Bakery', 'amber'),
  ('Cigarettes', 'green'),
  ('Soft Drinks', 'cyan'),
  ('Other', 'gray')
ON CONFLICT DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE categories IS 'User-managed product categories with customizable colors';
COMMENT ON TABLE departments IS 'User-managed business departments with customizable colors';

