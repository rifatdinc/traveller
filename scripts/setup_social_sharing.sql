-- Setup script for social sharing functionality in Supabase

-- Create shared_checkins table if it doesn't exist
CREATE TABLE IF NOT EXISTS shared_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checkin_id UUID NOT NULL REFERENCES user_checkins(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shared_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    caption TEXT,
    visibility TEXT DEFAULT 'friends',  -- 'friends', 'public', 'private'
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0
);

-- Create social_feed table if it doesn't exist
CREATE TABLE IF NOT EXISTS social_feed (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL, -- 'checkin', 'challenge_completion', 'badge_earned'
    content_id UUID NOT NULL,    -- ID of the related content
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create social_comments table if it doesn't exist
CREATE TABLE IF NOT EXISTS social_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shared_item_id UUID NOT NULL REFERENCES shared_checkins(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create social_likes table if it doesn't exist
CREATE TABLE IF NOT EXISTS social_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shared_item_id UUID NOT NULL REFERENCES shared_checkins(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(shared_item_id, user_id)  -- Prevent duplicate likes
);

-- Create user_followers table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_followers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, follower_id)  -- Prevent duplicate follows
);

-- Create function to update likes count
CREATE OR REPLACE FUNCTION update_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE shared_checkins
        SET likes_count = likes_count + 1
        WHERE id = NEW.shared_item_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE shared_checkins
        SET likes_count = likes_count - 1
        WHERE id = OLD.shared_item_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create function to update comments count
CREATE OR REPLACE FUNCTION update_comments_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE shared_checkins
        SET comments_count = comments_count + 1
        WHERE id = NEW.shared_item_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE shared_checkins
        SET comments_count = comments_count - 1
        WHERE id = OLD.shared_item_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for like and comment counting
CREATE TRIGGER update_likes_count_trigger
AFTER INSERT OR DELETE ON social_likes
FOR EACH ROW
EXECUTE FUNCTION update_likes_count();

CREATE TRIGGER update_comments_count_trigger
AFTER INSERT OR DELETE ON social_comments
FOR EACH ROW
EXECUTE FUNCTION update_comments_count();

-- Create function to add items to social feed
CREATE OR REPLACE FUNCTION add_to_social_feed()
RETURNS TRIGGER AS $$
DECLARE
    follower_record RECORD;
BEGIN
    -- First add to user's own feed
    INSERT INTO social_feed (user_id, content_type, content_id)
    VALUES (NEW.user_id, 'checkin', NEW.id);
    
    -- Then add to all followers' feeds
    FOR follower_record IN (
        SELECT follower_id 
        FROM user_followers
        WHERE user_id = NEW.user_id
    ) LOOP
        INSERT INTO social_feed (user_id, content_type, content_id)
        VALUES (follower_record.follower_id, 'checkin', NEW.id);
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to add shared check-ins to social feeds
CREATE TRIGGER add_to_social_feed_trigger
AFTER INSERT ON shared_checkins
FOR EACH ROW
EXECUTE FUNCTION add_to_social_feed();

-- Add RLS policies to secure the tables

-- Policy for shared_checkins
ALTER TABLE shared_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their own shared check-ins"
ON shared_checkins FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can see friends' public shared check-ins"
ON shared_checkins FOR SELECT
USING (
    visibility = 'public' OR
    (visibility = 'friends' AND 
     EXISTS (
         SELECT 1 FROM user_followers 
         WHERE user_id = shared_checkins.user_id AND follower_id = auth.uid()
     ))
);

CREATE POLICY "Users can create their own shared check-ins"
ON shared_checkins FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own shared check-ins"
ON shared_checkins FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own shared check-ins"
ON shared_checkins FOR DELETE
USING (auth.uid() = user_id);

-- Policy for social_comments
ALTER TABLE social_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see comments on visible shared check-ins"
ON social_comments FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM shared_checkins sc
        WHERE sc.id = shared_item_id AND
        (sc.visibility = 'public' OR 
         sc.user_id = auth.uid() OR
         (sc.visibility = 'friends' AND 
          EXISTS (
              SELECT 1 FROM user_followers 
              WHERE user_id = sc.user_id AND follower_id = auth.uid()
          ))
        )
    )
);

CREATE POLICY "Users can create comments on visible shared check-ins"
ON social_comments FOR INSERT
WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
        SELECT 1 FROM shared_checkins sc
        WHERE sc.id = shared_item_id AND
        (sc.visibility = 'public' OR 
         sc.user_id = auth.uid() OR
         (sc.visibility = 'friends' AND 
          EXISTS (
              SELECT 1 FROM user_followers 
              WHERE user_id = sc.user_id AND follower_id = auth.uid()
          ))
        )
    )
);

CREATE POLICY "Users can delete their own comments"
ON social_comments FOR DELETE
USING (auth.uid() = user_id);

-- Similar policies for social_likes and other tables
ALTER TABLE social_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see likes on visible shared check-ins"
ON social_likes FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM shared_checkins sc
        WHERE sc.id = shared_item_id AND
        (sc.visibility = 'public' OR 
         sc.user_id = auth.uid() OR
         (sc.visibility = 'friends' AND 
          EXISTS (
              SELECT 1 FROM user_followers 
              WHERE user_id = sc.user_id AND follower_id = auth.uid()
          ))
        )
    )
);

CREATE POLICY "Users can like visible shared check-ins"
ON social_likes FOR INSERT
WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
        SELECT 1 FROM shared_checkins sc
        WHERE sc.id = shared_item_id AND
        (sc.visibility = 'public' OR 
         sc.user_id = auth.uid() OR
         (sc.visibility = 'friends' AND 
          EXISTS (
              SELECT 1 FROM user_followers 
              WHERE user_id = sc.user_id AND follower_id = auth.uid()
          ))
        )
    )
);

CREATE POLICY "Users can unlike (delete likes)"
ON social_likes FOR DELETE
USING (auth.uid() = user_id);

-- Policy for social_feed
ALTER TABLE social_feed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own feed"
ON social_feed FOR SELECT
USING (auth.uid() = user_id);

-- Policy for user_followers
ALTER TABLE user_followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can see followers"
ON user_followers FOR SELECT
USING (true);

CREATE POLICY "Users can add themselves as followers"
ON user_followers FOR INSERT
WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow"
ON user_followers FOR DELETE
USING (auth.uid() = follower_id);
