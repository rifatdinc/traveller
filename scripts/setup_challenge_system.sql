-- This script sets up the necessary tables for the improved challenge system
-- Run this in your Supabase SQL Editor

-- Ensure schemas exist
CREATE SCHEMA IF NOT EXISTS public;

-- Table for challenge requirements
CREATE TABLE IF NOT EXISTS public.challenge_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('visit_place', 'take_photo', 'check_in', 'post_content', 'visit_category', 'rate_place', 'custom')),
  target_id TEXT, -- Could be a place ID, category ID, etc.
  count INTEGER DEFAULT 1, -- How many times this requirement needs to be completed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add index on challenge_id
CREATE INDEX IF NOT EXISTS idx_challenge_requirements_challenge_id ON public.challenge_requirements(challenge_id);

-- Table for tracking user challenge requirement progress
CREATE TABLE IF NOT EXISTS public.user_challenge_requirement_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_challenge_id UUID NOT NULL,
  requirement_id UUID NOT NULL REFERENCES public.challenge_requirements(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT FALSE,
  current_count INTEGER DEFAULT 0,
  completion_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add compound index
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_challenge_requirement_uniq 
  ON public.user_challenge_requirement_progress(user_challenge_id, requirement_id);

-- Add columns to user_challenges table if they don't exist
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.user_challenges ADD COLUMN progress INTEGER DEFAULT 0;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  
  BEGIN
    ALTER TABLE public.user_challenges ADD COLUMN progress_percentage INTEGER DEFAULT 0;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  
  BEGIN
    ALTER TABLE public.user_challenges ADD COLUMN completion_date TIMESTAMP WITH TIME ZONE;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  
  BEGIN
    ALTER TABLE public.user_challenges ADD COLUMN joined_at TIMESTAMP WITH TIME ZONE DEFAULT now();
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
END $$;

-- Add columns to challenges table if they don't exist
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.challenges ADD COLUMN challenge_type TEXT DEFAULT 'general';
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  
  BEGIN
    ALTER TABLE public.challenges ADD COLUMN category TEXT DEFAULT 'general';
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  
  BEGIN
    ALTER TABLE public.challenges ADD COLUMN difficulty TEXT DEFAULT 'medium';
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  
  BEGIN
    ALTER TABLE public.challenges ADD COLUMN target_count INTEGER DEFAULT 1;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  
  BEGIN
    ALTER TABLE public.challenges ADD COLUMN target_place_ids TEXT[];
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
END $$;

-- Sample data insertion for a gastronomy challenge
-- Uncomment and modify as needed
/*
INSERT INTO public.challenges (
  title, 
  description, 
  points, 
  image_url, 
  deadline, 
  is_daily, 
  challenge_type, 
  category, 
  difficulty,
  target_count,
  target_place_ids
) VALUES (
  'Lezzet Avcısı', 
  'Şehrin en iyi 3 restoranını ziyaret et ve fotoğraf paylaş', 
  500, 
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8cmVzdGF1cmFudHxlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=800&q=60', 
  'Süresiz', 
  false, 
  'gastronomy', 
  'gastronomy', 
  'medium',
  3,
  ARRAY['place-id-1', 'place-id-2', 'place-id-3']
) RETURNING id;

-- Use the returned challenge ID to create requirements
INSERT INTO public.challenge_requirements (
  challenge_id, 
  description, 
  type, 
  target_id, 
  count
) VALUES 
  ('RETURNED-CHALLENGE-ID', 'Restoran 1 ziyareti', 'visit_place', 'place-id-1', 1),
  ('RETURNED-CHALLENGE-ID', 'Restoran 2 ziyareti', 'visit_place', 'place-id-2', 1),
  ('RETURNED-CHALLENGE-ID', 'Restoran 3 ziyareti', 'visit_place', 'place-id-3', 1),
  ('RETURNED-CHALLENGE-ID', 'Lezzetli bir fotoğraf paylaş', 'post_content', null, 1);
*/
