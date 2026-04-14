import { supabase } from "@/lib/supabase";
import type { WorkoutPlanInput } from "@/types/database";

export async function createWorkoutPlan(input: WorkoutPlanInput) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw authError;
  }

  if (!user) {
    throw new Error("Musis byt prihlaseny.");
  }

  const { data: plan, error: planError } = await supabase
    .from("workout_plans")
    .insert({
      creator_id: user.id,
      title: input.title.trim(),
      description: input.description.trim() || null,
      is_public: input.is_public,
      duration_weeks: input.duration_weeks,
    })
    .select("id")
    .single();

  if (planError) {
    throw planError;
  }

  const dayRows = input.days.map((day) => ({
    plan_id: plan.id,
    day_number: day.day_number,
    exercise_id: day.exercise_id,
    sets: day.sets,
    reps: day.reps,
    weight: day.weight,
  }));

  const { error: daysError } = await supabase.from("plan_days").insert(dayRows);

  if (daysError) {
    throw daysError;
  }

  return plan;
}
