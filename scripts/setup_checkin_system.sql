-- Script to set up check-in functionality in the Supabase database

-- Create user_checkins table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_checkins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    photos TEXT[],
    location JSONB,
    
    UNIQUE(user_id, place_id)  -- Prevent multiple check-ins to the same place
);

-- Add visited_by counter to places table if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'places' AND column_name = 'visited_by'
    ) THEN
        ALTER TABLE places ADD COLUMN visited_by INTEGER DEFAULT 0;
    END IF;
END $$;

-- Create a function to increment the visited_by counter
CREATE OR REPLACE FUNCTION increment_place_visit_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE places
    SET visited_by = visited_by + 1
    WHERE id = NEW.place_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to call the function when a new check-in is added
CREATE OR REPLACE TRIGGER increment_visit_counter
AFTER INSERT ON user_checkins
FOR EACH ROW
EXECUTE FUNCTION increment_place_visit_count();

-- Function to call from application
CREATE OR REPLACE FUNCTION increment_place_visit_count(p_place_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE places
    SET visited_by = visited_by + 1
    WHERE id = p_place_id;
END;
$$ LANGUAGE plpgsql;

-- Create user_challenge_progress table
CREATE TABLE IF NOT EXISTS user_challenge_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    requirement_id UUID NOT NULL REFERENCES challenge_requirements(id) ON DELETE CASCADE,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(user_id, challenge_id, requirement_id)
);

-- Create points_history table to track user point awards
CREATE TABLE IF NOT EXISTS points_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    points INTEGER NOT NULL,
    action VARCHAR(255) NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies to secure the tables

-- Policy for user_checkins
ALTER TABLE user_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own check-ins"
ON user_checkins FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own check-ins"
ON user_checkins FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy for points_history
ALTER TABLE points_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own points history"
ON points_history FOR SELECT
USING (auth.uid() = user_id);

-- Policy for user_challenge_progress
ALTER TABLE user_challenge_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own challenge progress"
ON user_challenge_progress FOR SELECT
USING (auth.uid() = user_id);

-- Create stored procedure for updating user stats based on checkins
CREATE OR REPLACE FUNCTION update_user_stats_from_checkins(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    total_checkins INTEGER;
    unique_cities INTEGER;
BEGIN
    -- Count total check-ins
    SELECT COUNT(*) INTO total_checkins
    FROM user_checkins
    WHERE user_id = p_user_id;
    
    -- Count unique cities visited
    SELECT COUNT(DISTINCT p.city) INTO unique_cities
    FROM user_checkins c
    JOIN places p ON c.place_id = p.id
    WHERE c.user_id = p_user_id;
    
    -- Update user stats
    INSERT INTO user_stats (user_id, checkin_count, cities_visited)
    VALUES (p_user_id, total_checkins, unique_cities)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        checkin_count = EXCLUDED.checkin_count,
        cities_visited = EXCLUDED.cities_visited;
END;
$$ LANGUAGE plpgsql;
