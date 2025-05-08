-- Update script for check-in functionality in the existing Supabase database

-- Update user_checkins table to add additional fields if they don't exist
DO $$ 
BEGIN
    -- Add notes column if not exists
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'user_checkins' AND column_name = 'notes'
    ) THEN
        ALTER TABLE user_checkins ADD COLUMN notes TEXT;
    END IF;

    -- Add photos column if not exists
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'user_checkins' AND column_name = 'photos'
    ) THEN
        ALTER TABLE user_checkins ADD COLUMN photos TEXT[];
    END IF;

    -- Add location column if not exists
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'user_checkins' AND column_name = 'location'
    ) THEN
        ALTER TABLE user_checkins ADD COLUMN location JSONB;
    END IF;
END $$;

-- Create points_history table if it doesn't exist
CREATE TABLE IF NOT EXISTS points_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    points INTEGER NOT NULL,
    action VARCHAR(255) NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update user_stats table to add checkin_count and cities_visited if they don't exist
DO $$ 
BEGIN
    -- Add checkin_count column if not exists
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'user_stats' AND column_name = 'checkin_count'
    ) THEN
        ALTER TABLE user_stats ADD COLUMN checkin_count INTEGER DEFAULT 0;
    END IF;

    -- Add cities_visited column if not exists
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'user_stats' AND column_name = 'cities_visited'
    ) THEN
        ALTER TABLE user_stats ADD COLUMN cities_visited INTEGER DEFAULT 0;
    END IF;
END $$;

-- Ensure 'user_checkins' has a unique constraint to prevent duplicate check-ins
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT tc.constraint_name 
        FROM information_schema.table_constraints tc 
        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_name = 'user_checkins' 
          AND tc.constraint_type = 'UNIQUE' 
          AND ccu.column_name = 'user_id' 
          AND ccu.column_name = 'place_id'
    ) THEN
        ALTER TABLE user_checkins ADD CONSTRAINT user_checkins_user_place_unique UNIQUE (user_id, place_id);
    END IF;
EXCEPTION
    WHEN duplicate_table THEN
        -- Do nothing, constraint already exists
END $$;

-- Create a function to update user stats based on check-ins
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
    UPDATE user_stats 
    SET 
        checkin_count = total_checkins,
        cities_visited = unique_cities
    WHERE user_id = p_user_id;
    
    -- If no row exists, create it
    IF NOT FOUND THEN
        INSERT INTO user_stats (user_id, checkin_count, cities_visited, total_points, level, rank, visited_places)
        VALUES (p_user_id, total_checkins, unique_cities, 0, 1, 0, total_checkins);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Add RLS policies for new tables
ALTER TABLE points_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own points history"
ON points_history FOR SELECT
USING (auth.uid() = user_id);

-- Create function to check challenge completion on check-in
CREATE OR REPLACE FUNCTION check_challenge_completion_on_checkin()
RETURNS TRIGGER AS $$
DECLARE
    place_type TEXT;
    place_city TEXT;
    challenge_record RECORD;
    requirement_record RECORD;
    progress_record RECORD;
    all_requirements_completed BOOLEAN;
BEGIN
    -- Get place information
    SELECT type, city INTO place_type, place_city
    FROM places
    WHERE id = NEW.place_id;
    
    -- Check for active challenges that involve this place
    FOR challenge_record IN (
        SELECT c.id, c.points
        FROM challenges c
        JOIN user_challenges uc ON c.id = uc.challenge_id
        WHERE uc.user_id = NEW.user_id
        AND uc.completed = FALSE
    ) LOOP
        all_requirements_completed := TRUE;
        
        -- Check each requirement for this challenge
        FOR requirement_record IN (
            SELECT cr.id, cr.type, cr.target_id, cr.count
            FROM challenge_requirements cr
            WHERE cr.challenge_id = challenge_record.id
        ) LOOP
            -- Check if this check-in satisfies a requirement
            IF (requirement_record.type = 'check_in' AND requirement_record.target_id = NEW.place_id) OR
               (requirement_record.type = 'visit_category' AND place_type = requirement_record.target_id) OR
               (requirement_record.type = 'visit_place' AND requirement_record.target_id = NEW.place_id) THEN
                
                -- Update or insert progress for this requirement
                UPDATE user_challenge_requirement_progress
                SET 
                    current_count = current_count + 1,
                    completed = CASE WHEN current_count + 1 >= requirement_record.count THEN TRUE ELSE FALSE END,
                    completion_date = CASE WHEN current_count + 1 >= requirement_record.count THEN NOW() ELSE NULL END
                WHERE user_challenge_id IN (
                    SELECT id FROM user_challenges 
                    WHERE user_id = NEW.user_id AND challenge_id = challenge_record.id
                )
                AND requirement_id = requirement_record.id;
                
                -- If no row was updated, insert a new one
                IF NOT FOUND THEN
                    INSERT INTO user_challenge_requirement_progress (
                        user_challenge_id,
                        requirement_id,
                        current_count,
                        completed,
                        completion_date
                    )
                    SELECT 
                        uc.id,
                        requirement_record.id,
                        1,
                        CASE WHEN 1 >= requirement_record.count THEN TRUE ELSE FALSE END,
                        CASE WHEN 1 >= requirement_record.count THEN NOW() ELSE NULL END
                    FROM user_challenges uc
                    WHERE uc.user_id = NEW.user_id AND uc.challenge_id = challenge_record.id;
                END IF;
            END IF;
            
            -- Check if this requirement is still not completed
            SELECT completed INTO progress_record
            FROM user_challenge_requirement_progress
            WHERE user_challenge_id IN (
                SELECT id FROM user_challenges 
                WHERE user_id = NEW.user_id AND challenge_id = challenge_record.id
            )
            AND requirement_id = requirement_record.id;
            
            IF NOT FOUND OR NOT progress_record.completed THEN
                all_requirements_completed := FALSE;
            END IF;
        END LOOP;
        
        -- If all requirements are completed, mark the challenge as completed
        IF all_requirements_completed THEN
            UPDATE user_challenges
            SET 
                completed = TRUE,
                completed_at = NOW()
            WHERE user_id = NEW.user_id AND challenge_id = challenge_record.id;
            
            -- Award points for completing challenge
            INSERT INTO points_history (user_id, points, action, details)
            VALUES (
                NEW.user_id, 
                challenge_record.points,
                'challenge_completed',
                jsonb_build_object('challenge_id', challenge_record.id)
            );
            
            -- Update user stats with new points
            UPDATE user_stats
            SET total_points = total_points + challenge_record.points
            WHERE user_id = NEW.user_id;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for challenge completion checking if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'check_challenge_completion_trigger'
    ) THEN
        CREATE TRIGGER check_challenge_completion_trigger
        AFTER INSERT ON user_checkins
        FOR EACH ROW
        EXECUTE FUNCTION check_challenge_completion_on_checkin();
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        -- Do nothing, trigger already exists
END $$;
