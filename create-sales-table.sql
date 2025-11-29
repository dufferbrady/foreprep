-- Create the sales_data table for tracking daily sales
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS sales_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sale_date DATE NOT NULL,
  time_period TEXT NOT NULL,
  quantity_sold INTEGER NOT NULL CHECK (quantity_sold > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sales_data_product_id ON sales_data(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_data_sale_date ON sales_data(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_data_time_period ON sales_data(time_period);

-- Create a unique constraint to prevent duplicate entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_data_unique_entry 
  ON sales_data(product_id, sale_date, time_period);

-- Enable Row Level Security (RLS)
ALTER TABLE sales_data ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations
CREATE POLICY "Enable all operations for everyone" 
  ON sales_data 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Insert some sample data for testing
INSERT INTO sales_data (product_id, sale_date, time_period, quantity_sold)
SELECT 
  p.id,
  CURRENT_DATE,
  'Breakfast',
  floor(random() * 20 + 5)::integer
FROM products p
WHERE p.active = true
LIMIT 3
ON CONFLICT (product_id, sale_date, time_period) DO NOTHING;

INSERT INTO sales_data (product_id, sale_date, time_period, quantity_sold)
SELECT 
  p.id,
  CURRENT_DATE,
  'Lunch',
  floor(random() * 30 + 10)::integer
FROM products p
WHERE p.active = true
LIMIT 2
ON CONFLICT (product_id, sale_date, time_period) DO NOTHING;

