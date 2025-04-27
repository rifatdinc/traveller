// Veritabanı modellerinin tip tanımlamaları
export interface User {
  id: string;
  username: string;
  email?: string;
  avatar_url: string;
  total_points: number;
  level: string;
  rank?: number;
  visited_places?: number;
  badges?: Badge[];
  created_at?: string;
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  user_id?: string;
}

export interface Place {
  id: string;
  name: string;
  type: string;
  points: number;
  location?: {
    latitude: number;
    longitude: number;
  };
  city: string;
  description: string;
  image_url: string;
  image?: string; // Mock data compatibility
  visited_by?: number;
  rating: number;
  created_at?: string;
  status?: 'visited' | 'not_visited'; // Place visit status in a plan
}

export interface InterestTag {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}

export interface TripPlan {
  id: string;
  title: string;
  description?: string;
  category?: string;
  budget?: string;
  duration?: string;
  image_url?: string;
  total_points?: number;
  created_by: string;
  is_public?: boolean;
  created_at?: string;
  updated_at?: string;
  username?: string;
  avatar?: string;
  status?: 'pending' | 'ongoing' | 'completed' | 'cancelled';
  places?: Place[];
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  points: number;
  image_url: string;
  image?: string; // Mock data compatibility
  deadline: string;
  is_daily?: boolean;
  valid_until?: string;
  participation_count?: number;
  created_at?: string;
  challenge_type: 'visit' | 'activity' | 'collection' | 'social' | 'gastronomy' | 'photo' | 'general';
  category?: 'nature' | 'culture' | 'gastronomy' | 'adventure' | 'general';
  difficulty?: 'easy' | 'medium' | 'hard';
  requirements?: ChallengeRequirement[];
  target_count?: number; // Number of items needed to complete (e.g., visit 3 places)
  target_place_ids?: string[]; // Specific place IDs needed for this challenge
}

export interface ChallengeRequirement {
  id: string;
  description: string;
  type: 'visit_place' | 'take_photo' | 'check_in' | 'post_content' | 'visit_category' | 'rate_place' | 'custom';
  target_id?: string; // If the requirement targets a specific place, category, etc.
  count?: number; // Required count for completion
  is_completed?: boolean;
}

export interface UserChallenge {
  id: string;
  user_id: string;
  challenge_id: string;
  progress: number; // Current progress (e.g., 2 out of 3 places visited)
  progress_percentage?: number; // 0-100 percentage
  completed: boolean;
  completion_date?: string;
  joined_at: string;
  requirements_progress?: UserChallengeRequirementProgress[];
  challenge?: Challenge; // The related challenge
}

export interface UserChallengeRequirementProgress {
  requirement_id: string;
  completed: boolean;
  current_count?: number;
  completion_date?: string;
}

export interface FeedPost {
  id: string;
  user_id: string;
  title?: string;
  content: string;
  image_url?: string;
  location?: string;
  place_id?: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  user?: User;
}

export interface Plan {
  id: string;
  user_id: string;
  place_id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  status: 'planned' | 'ongoing' | 'completed' | 'canceled';
  place?: Place;
  created_at?: string;
}
