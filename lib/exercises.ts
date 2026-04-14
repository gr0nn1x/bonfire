import { supabase } from "@/lib/supabase";
import type { Exercise as ExerciseType } from "@/types/database";

export async function searchExercisesByName(
  query: string,
): Promise<ExerciseType[]> {
  const q = query.trim();
  if (!q) return [];

  const { data, error } = await supabase
    .from("exercises")
    .select("*")
    .ilike("name", `%${q}%`)
    .limit(10)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ExerciseType[];
}

