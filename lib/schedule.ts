import { supabase } from "@/lib/supabase";
import type { Exercise, Profile, WorkoutPlan } from "@/types/database";
import type { PlanDayInput } from "@/types/database";

export type ScheduledWorkoutDay = {
  day_number: number;
  exercise_id: string;
  exercise_name: string | null;
  sets: number;
  reps: number;
  weight: number;
};

export type ScheduledPlan = {
  plan_id: string;
  plan_title: string;
  start_date: string; // YYYY-MM-DD (date column)
  active: boolean;
  duration_weeks: number;
  days: ScheduledWorkoutDay[];
};

export async function createUserSchedule({
  plan_id,
  start_date,
  active = true,
}: {
  plan_id: string;
  start_date: string;
  active?: boolean;
}): Promise<void> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("Musíš být přihlášený.");

  const { error: insertError } = await supabase.from("user_schedule").insert({
    user_id: user.id,
    plan_id,
    start_date,
    active,
  });

  if (insertError) throw insertError;
}

export async function fetchMyActiveSchedules(): Promise<ScheduledPlan[]> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) return [];

  const { data: schedules, error: schedulesError } = await supabase
    .from("user_schedule")
    .select("plan_id,start_date,active")
    .eq("user_id", user.id)
    .eq("active", true)
    .order("start_date", { ascending: true });

  if (schedulesError) throw schedulesError;
  if (!schedules || schedules.length === 0) return [];

  const planIds = Array.from(new Set(schedules.map((s) => s.plan_id)));

  const { data: plans, error: plansError } = await supabase
    .from("workout_plans")
    .select("id,title,duration_weeks")
    .in("id", planIds);

  if (plansError) throw plansError;

  const planTitleById = new Map(
    (plans ?? []).map((p) => [p.id as string, p.title as string]),
  );

  const { data: planDays, error: planDaysError } = await supabase
    .from("plan_days")
    .select("plan_id,day_number,exercise_id,sets,reps,weight")
    .in("plan_id", planIds);

  if (planDaysError) throw planDaysError;

  const exerciseIds = Array.from(
    new Set((planDays ?? []).map((d) => d.exercise_id as string)),
  );

  const { data: exercises, error: exercisesError } = await supabase
    .from("exercises")
    .select("id,name")
    .in("id", exerciseIds);

  if (exercisesError) throw exercisesError;

  const exerciseNameById = new Map(
    (exercises ?? []).map((e) => [e.id as string, (e.name as string) ?? null]),
  );

  const groupedDays = new Map<string, ScheduledWorkoutDay[]>();
  for (const day of planDays ?? []) {
    const planId = day.plan_id as string;
    const exerciseId = day.exercise_id as string;
    const list = groupedDays.get(planId) ?? [];
    list.push({
      day_number: day.day_number as number,
      exercise_id: exerciseId,
      exercise_name: exerciseNameById.get(exerciseId) ?? null,
      sets: day.sets as number,
      reps: day.reps as number,
      weight: day.weight as number,
    });
    groupedDays.set(planId, list);
  }

  // Ensure days are sorted by day_number for predictable display.
  for (const [planId, days] of groupedDays) {
    days.sort((a, b) => a.day_number - b.day_number);
    groupedDays.set(planId, days);
  }

  // Attach grouped days back to each schedule entry.
  return (schedules ?? []).map((s) => ({
    plan_id: s.plan_id as string,
    plan_title: planTitleById.get(s.plan_id as string) ?? "Plan",
    start_date: s.start_date as string,
    active: s.active as boolean,
    duration_weeks:
      (plans ?? []).find((p) => p.id === s.plan_id)?.duration_weeks ?? 1,
    days: groupedDays.get(s.plan_id as string) ?? [],
  }));
}

