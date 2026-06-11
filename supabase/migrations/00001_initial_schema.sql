-- Create tables for Reforma Control App

CREATE TABLE IF NOT EXISTS material_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  category_id UUID REFERENCES material_categories(id) ON DELETE SET NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  price DECIMAL(10,2),
  currency TEXT DEFAULT 'EUR',
  store_name TEXT,
  product_url TEXT,
  main_image_url TEXT,
  description TEXT,
  measurements TEXT,
  status TEXT DEFAULT 'Mirando',
  priority TEXT DEFAULT 'Media',
  availability TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE material_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

-- RLS policies for material_categories
CREATE POLICY "Users can view own categories"
  ON material_categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own categories"
  ON material_categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories"
  ON material_categories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories"
  ON material_categories FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for rooms
CREATE POLICY "Users can view own rooms"
  ON rooms FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own rooms"
  ON rooms FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rooms"
  ON rooms FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own rooms"
  ON rooms FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for materials
CREATE POLICY "Users can view own materials"
  ON materials FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own materials"
  ON materials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own materials"
  ON materials FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own materials"
  ON materials FOR DELETE
  USING (auth.uid() = user_id);

-- Create storage bucket for material images
INSERT INTO storage.buckets (id, name, public) VALUES ('material-images', 'material-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to material-images
CREATE POLICY "Users can upload images"
  ON storage.objects FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Allow public access to images
CREATE POLICY "Anyone can view images"
  ON storage.objects FOR SELECT
  USING (true);

CREATE POLICY "Users can delete own images"
  ON storage.objects FOR DELETE
  USING (auth.uid() = owner);

-- Seed default categories
INSERT INTO material_categories (user_id, name) VALUES
  (NULL, 'Suelo'),
  (NULL, 'Baño'),
  (NULL, 'Cocina'),
  (NULL, 'Iluminación'),
  (NULL, 'Pintura'),
  (NULL, 'Muebles'),
  (NULL, 'Electrodomésticos'),
  (NULL, 'Carpintería'),
  (NULL, 'Decoración'),
  (NULL, 'Sanitarios'),
  (NULL, 'Grifería'),
  (NULL, 'Revestimientos'),
  (NULL, 'Climatización'),
  (NULL, 'Puertas'),
  (NULL, 'Ventanas'),
  (NULL, 'Herrajes'),
  (NULL, 'Otros');

-- Seed default rooms
INSERT INTO rooms (user_id, name) VALUES
  (NULL, 'Cocina'),
  (NULL, 'Baño principal'),
  (NULL, 'Baño secundario'),
  (NULL, 'Salón'),
  (NULL, 'Comedor'),
  (NULL, 'Habitación principal'),
  (NULL, 'Habitación secundaria'),
  (NULL, 'Despacho'),
  (NULL, 'Pasillo'),
  (NULL, 'Entrada'),
  (NULL, 'Terraza'),
  (NULL, 'Exterior'),
  (NULL, 'General');
