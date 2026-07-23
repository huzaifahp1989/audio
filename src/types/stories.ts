export interface Story {
  id: string;
  title: string;
  summary: string;
  content?: string; // Full text if needed
  age_min: number;
  age_max: number;
  is_active: boolean;
  created_at: string;
}

export interface Recording {
  id: string;
  user_id: string | null;
  story_id: string | null;
  audio_path: string;
  audio_url?: string;
  duration?: number;
  duration_seconds?: number | null;
  status: 'submitted' | 'approved' | 'rejected';
  points_awarded?: number | null;
  admin_notes?: string | null;
  admin_feedback?: string | null;
  is_published: boolean;
  submitted_at?: string;
  reviewed_at?: string | null;
  created_at?: string;
  category?: 'quran' | 'nasheed' | 'story' | 'hadith' | string | null;

  // Studio fields
  title?: string;
  description?: string;
  child_name?: string;
  
  // Joins
  story?: Story;
}
