import { supabase } from "@/lib/supabase";
import { tByLanguage } from "@/lib/locale";

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
  if (!user) throw new Error(await tByLanguage({ cs: "Musíš být přihlášený.", en: "You must be signed in." }));

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


// --- TĚLESNÁ VÁHA ---
export async function logBodyWeight(weight: number) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error(await tByLanguage({ cs: "Musíš být přihlášený.", en: "You must be signed in." }));

  const today = new Date().toISOString().split('T')[0];

  // Použijeme upsert, kdyby uživatel zadával váhu podruhé ve stejný den, jen se přepíše
  const { error } = await supabase.from("body_weight_logs").upsert({
    user_id: user.id,
    weight,
    date: today,
  }, { onConflict: "user_id, date" });

  if (error) throw error;
}

export async function getBodyWeightHistory() {
  const { data, error } = await supabase
    .from("body_weight_logs")
    .select("date, weight")
    .order("date", { ascending: true });

  if (error) throw error;
  return data;
}

// --- MAXIMÁLKY (1RM) ---
// Vypočítá odhadovanou maximálku pro 1 opakování (Brzyckiho vzorec) nebo vrátí reálnou zvednutou váhu
export async function getExerciseMaxHistory(exercise_id: string) {
  const { data, error } = await supabase
    .from("workout_logs")
    .select("date, weight_lifted, reps_done")
    .eq("exercise_id", exercise_id)
    .order("date", { ascending: true });

  if (error) throw error;

  // Seskupíme podle data a najdeme ten nejlepší výkon daného dne
  const dailyMaxes: Record<string, number> = {};
  
  data.forEach((log) => {
    const day = new Date(log.date).toISOString().split('T')[0];
    // Výpočet odhadovaného 1RM: Váha * (36 / (37 - počet opakování))
    const estimated1RM = log.weight_lifted * (36 / (37 - log.reps_done));
    
    if (!dailyMaxes[day] || estimated1RM > dailyMaxes[day]) {
      dailyMaxes[day] = estimated1RM;
    }
  });

  return Object.entries(dailyMaxes).map(([date, maxWeight]) => ({
    date,
    maxWeight: Math.round(maxWeight * 10) / 10 // zaokrouhlení na 1 des. místo
  }));
}
