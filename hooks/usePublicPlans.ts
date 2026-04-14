import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import type { WorkoutPlan } from "@/types/database";

const fetchPublicPlans = async (): Promise<WorkoutPlan[]> => {
  const { data, error } = await supabase
    .from("workout_plans")
    .select("*")
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as WorkoutPlan[];
};

export const usePublicPlans = () =>
  useQuery({
    queryKey: ["public-plans"],
    queryFn: fetchPublicPlans,
  });
