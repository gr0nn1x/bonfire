import { supabase } from "@/lib/supabase";

export async function logWorkout({
  exercise_id,
  sets,
  reps,
  weight,
  date,
}: {
  exercise_id: string;
  sets: number;
  reps: number;
  weight: number;
  date?: Date;
}): Promise<void> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) throw new Error("Musíš být přihlášený.");

  const totalReps = Math.max(1, sets * reps);

  const insertDate = date ? date.toISOString() : new Date().toISOString();

  const { error: insertError } = await supabase.from("workout_logs").insert({
    user_id: user.id,
    exercise_id,
    weight_lifted: weight,
    reps_done: totalReps,
    date: insertDate,
  });

  if (insertError) throw insertError;
}

