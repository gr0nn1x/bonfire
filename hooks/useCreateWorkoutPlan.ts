import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createWorkoutPlan } from "@/lib/workout-plans";
import type { WorkoutPlanInput } from "@/types/database";

export function useCreateWorkoutPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: WorkoutPlanInput) => createWorkoutPlan(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["public-plans"] });
      await queryClient.invalidateQueries({ queryKey: ["my-plans"] });
    },
  });
}
