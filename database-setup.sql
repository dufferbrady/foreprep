-- Create the products table in Supabase
-- Run this in your Supabase SQL Editor (Database > SQL Editor)

CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  cost_price NUMERIC(10, 2) NOT NULL CHECK (cost_price > 0),
  sell_price NUMERIC(10, 2) NOT NULL CHECK (sell_price > 0),
  shelf_life NUMERIC(10, 2),
  prep_time INTEGER,
  storage_type TEXT,
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add an index for faster queries
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);

-- Enable Row Level Security (RLS)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations (adjust based on your auth requirements)
CREATE POLICY "Enable all operations for everyone" 
  ON products 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Optional: Insert some sample data for testing
INSERT INTO products (name, category, cost_price, sell_price, shelf_life, prep_time, storage_type)
VALUES 
  ('Chocolate Croissant', 'Bakery', 1.20, 3.50, 24, 15, 'Ambient'),
  ('Club Sandwich', 'Sandwiches', 2.50, 6.95, 12, 5, 'Chilled'),
  ('Full Irish Breakfast', 'Breakfast', 4.00, 12.95, 2, 20, 'Hot Cabinet'),
  ('Chicken Curry', 'Lunch', 3.50, 9.95, 3, 30, 'Hot Cabinet'),
  ('Sourdough Loaf', 'Bakery', 2.00, 5.50, 48, 180, 'Ambient');

