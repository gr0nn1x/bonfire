export type MuscleGroup =
  | "chest"
  | "back"
  | "legs"
  | "shoulders"
  | "arms"
  | "core"
  | "full_body"
  | "cardio";

export type FriendshipStatus = "pending" | "accepted";

export interface Profile {
  id: string;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  strength_points: number;
  level: number;
}

export interface Exercise {
  id: string;
  name: string;
  muscle_group: MuscleGroup;
  description: string | null;
}

export interface WorkoutPlan {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  duration_weeks: number;
  created_at?: string;
}

export interface PlanDayInput {
  day_number: number;
  exercise_id: string;
  sets: number;
  reps: number;
  weight: number;
}

export interface WorkoutPlanInput {
  title: string;
  description: string;
  is_public: boolean;
  duration_weeks: number;
  days: PlanDayInput[];
}
