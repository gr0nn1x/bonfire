import { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import { useCreateWorkoutPlan } from "@/hooks/useCreateWorkoutPlan";
import { Button, Field, ToggleField } from "@/components/ui";
import { ScreenContainer } from "@/components/screen-container";
import { SectionCard } from "@/components/section-card";
import type { Exercise, WorkoutPlanInput } from "@/types/database";
import { supabase } from "@/lib/supabase";
import { createUserSchedule, fetchMyActiveSchedules } from "@/lib/schedule";
import { searchExercisesByName } from "@/lib/exercises";

const initialPlan: WorkoutPlanInput = {
  title: "",
  description: "",
  is_public: true,
  duration_weeks: 4,
  days: [
    {
      day_number: 1,
      exercise_id: "",
      sets: 4,
      reps: 8,
      weight: 60,
    },
  ],
};

export default function PlansScreen() {
  const [plan, setPlan] = useState<WorkoutPlanInput>(initialPlan);
  const createWorkoutPlan = useCreateWorkoutPlan();

  const [myPlans, setMyPlans] = useState<Array<{ id: string; title: string }>>(
    [],
  );
  const [isLoadingMyPlans, setIsLoadingMyPlans] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [scheduleStartDate, setScheduleStartDate] = useState<string>("");

  const [activeSchedulesCount, setActiveSchedulesCount] = useState(0);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const [exerciseSearchQuery, setExerciseSearchQuery] = useState("");
  const [exerciseSearchResults, setExerciseSearchResults] = useState<
    Exercise[]
  >([]);
  const [isSearchingExercises, setIsSearchingExercises] = useState(false);

  const updateFirstDay = (
    key: "exercise_id" | "sets" | "reps" | "weight",
    value: string,
  ) => {
    setPlan((current) => ({
      ...current,
      days: current.days.map((day, index) =>
        index !== 0
          ? day
          : {
              ...day,
              [key]:
                key === "exercise_id" ? value : Number.parseInt(value || "0", 10),
            },
      ),
    }));
  };

  useEffect(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    setScheduleStartDate(`${yyyy}-${mm}-${dd}`);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadMyPlans = async () => {
      try {
        setIsLoadingMyPlans(true);
        setScheduleError(null);

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) return;

        const { data, error } = await supabase
          .from("workout_plans")
          .select("id,title")
          .eq("creator_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        const list = (data ?? []) as Array<{ id: string; title: string }>;

        if (!isMounted) return;
        setMyPlans(list);
        if (!selectedPlanId && list[0]?.id) setSelectedPlanId(list[0].id);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Chyba při načítání.";
        if (!isMounted) return;
        setScheduleError(message);
      } finally {
        if (!isMounted) return;
        setIsLoadingMyPlans(false);
      }
    };

    const loadScheduleCount = async () => {
      try {
        const schedules = await fetchMyActiveSchedules();
        if (isMounted) setActiveSchedulesCount(schedules.length);
      } catch {
        if (isMounted) setActiveSchedulesCount(0);
      }
    };

    void loadMyPlans();
    void loadScheduleCount();

    return () => {
      isMounted = false;
    };
  }, [selectedPlanId]);

  const handleSearchExercises = async () => {
    const q = exerciseSearchQuery.trim();
    if (!q) {
      setExerciseSearchResults([]);
      return;
    }

    try {
      setIsSearchingExercises(true);
      const results = await searchExercisesByName(q);
      setExerciseSearchResults(results);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Nepodařilo se vyhledat cviky.";
      Alert.alert("Chyba", message);
    } finally {
      setIsSearchingExercises(false);
    }
  };

  const handleCreateSchedule = async () => {
    if (!selectedPlanId) {
      Alert.alert("Vyber plán", "Nejdřív vyber svůj plán.");
      return;
    }
    if (!scheduleStartDate.trim()) {
      Alert.alert("Datum", "Vyplň start date ve formátu YYYY-MM-DD.");
      return;
    }

    try {
      setScheduleError(null);
      await createUserSchedule({
        plan_id: selectedPlanId,
        start_date: scheduleStartDate.trim(),
        active: true,
      });

      const schedules = await fetchMyActiveSchedules();
      setActiveSchedulesCount(schedules.length);
      Alert.alert("Plán vložen do kalendáře", "Teď se objeví v 'Dnešním tréninku'.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Nepodařilo se naplánovat.";
      setScheduleError(message);
      Alert.alert("Chyba", message);
    }
  };

  const handleSubmit = async () => {
    if (!plan.title.trim()) {
      Alert.alert("Chybi nazev", "Vypln nejdriv nazev planu.");
      return;
    }

    if (!plan.days[0]?.exercise_id.trim()) {
      Alert.alert("Chybi cvik", "Vypln exercise_id pro prvni den.");
      return;
    }

    try {
      await createWorkoutPlan.mutateAsync(plan);
      Alert.alert("Plan ulozen", "Workout plan a plan_days byly odeslany do Supabase.");
      setPlan(initialPlan);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nepodarilo se ulozit plan.";
      Alert.alert("Chyba pri ukladani", message);
    }
  };

  return (
    <ScreenContainer>
      <View className="gap-2">
        <Text className="text-3xl font-bold text-text">Tvorba plánu</Text>
        <Text className="text-base leading-6 text-muted">
          Jedna obrazovka pro jednorázový workout i více-týdenní cyklus.
        </Text>
      </View>

      <SectionCard
        title="Detaily plánu"
        subtitle="Tady se sbírá minimum dat, která pak uložíš do workout_plans."
      >
        <Field
          label="Název"
          placeholder="Např. Push Pull Legs"
          value={plan.title}
          onChangeText={(title) => setPlan((current) => ({ ...current, title }))}
        />
        <Field
          label="Popis"
          placeholder="Cíl, progresivní overload, poznámky..."
          value={plan.description}
          onChangeText={(description) =>
            setPlan((current) => ({ ...current, description }))
          }
          multiline
        />
        <Field
          label="Délka cyklu (týdny)"
          value={String(plan.duration_weeks)}
          onChangeText={(value) =>
            setPlan((current) => ({
              ...current,
              duration_weeks: Number.parseInt(value || "1", 10),
            }))
          }
          keyboardType="numeric"
        />
        <ToggleField
          label="Veřejný plán"
          description="Zapni, pokud chceš, aby se plán ukázal v komunitní knihovně."
          value={plan.is_public}
          onValueChange={(is_public) =>
            setPlan((current) => ({ ...current, is_public }))
          }
        />
      </SectionCard>

      <SectionCard
        title="Den 1"
        subtitle="Ukázkový editor jednoho dne. Další dny můžeš přidat jako opakovatelné pole."
      >
        <View className="gap-2">
          <Field
            label="Vyhledat cvik"
            placeholder="např. Bench Press"
            value={exerciseSearchQuery}
            onChangeText={setExerciseSearchQuery}
          />
          <Button
            variant="secondary"
            disabled={isSearchingExercises}
            onPress={() => void handleSearchExercises()}
          >
            {isSearchingExercises ? "Hledám..." : "Najít cvik"}
          </Button>

          {exerciseSearchResults.length > 0 ? (
            <View className="gap-2">
              {exerciseSearchResults.map((ex) => (
                <Pressable
                  key={ex.id}
                  onPress={() => {
                    updateFirstDay("exercise_id", ex.id);
                    setExerciseSearchResults([]);
                  }}
                  className="rounded-2xl border border-border bg-surface px-4 py-3"
                >
                  <Text className="text-sm font-semibold text-text">
                    {ex.name}
                  </Text>
                  <Text className="text-xs text-muted">{ex.id}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <Field
          label="Exercise ID (fallback)"
          placeholder="UUID cviku ze Supabase"
          value={plan.days[0]?.exercise_id ?? ""}
          onChangeText={(value) => updateFirstDay("exercise_id", value)}
        />
        <Field
          label="Počet sérií"
          value={String(plan.days[0]?.sets ?? 0)}
          onChangeText={(value) => updateFirstDay("sets", value)}
          keyboardType="numeric"
        />
        <Field
          label="Počet opakování"
          value={String(plan.days[0]?.reps ?? 0)}
          onChangeText={(value) => updateFirstDay("reps", value)}
          keyboardType="numeric"
        />
        <Field
          label="Váha (kg)"
          value={String(plan.days[0]?.weight ?? 0)}
          onChangeText={(value) => updateFirstDay("weight", value)}
          keyboardType="numeric"
        />
      </SectionCard>

      <SectionCard title="Naplánovat workout" subtitle="Vloží plán do kalendáře.">
        {scheduleError ? (
          <Text className="text-sm leading-6 text-red-200">{scheduleError}</Text>
        ) : null}

        <Text className="text-sm leading-6 text-text">
          Aktivní plánované tréninky: {activeSchedulesCount}
        </Text>

        <View className="gap-3">
          <Field
            label="Start date (YYYY-MM-DD)"
            value={scheduleStartDate}
            onChangeText={setScheduleStartDate}
          />

          <Text className="text-sm font-semibold text-text">Vybraný plán</Text>

          {isLoadingMyPlans ? (
            <Text className="text-sm text-muted">Načítám tvoje plány...</Text>
          ) : myPlans.length === 0 ? (
            <Text className="text-sm text-muted">
              Zatím nemáš žádné plány. Nejprve vytvoř plán nahoře.
            </Text>
          ) : (
            <View className="gap-2">
              {myPlans.slice(0, 8).map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => setSelectedPlanId(p.id)}
                  className={`rounded-2xl border px-4 py-3 ${
                    selectedPlanId === p.id
                      ? "border-primary"
                      : "border-border bg-surface"
                  }`}
                >
                  <Text className="text-sm font-semibold text-text">{p.title}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <Button
            onPress={() => void handleCreateSchedule()}
            disabled={myPlans.length === 0 || !selectedPlanId}
          >
            Vytvořit v kalendáři
          </Button>
        </View>
      </SectionCard>

      <Button onPress={() => void handleSubmit()}>
        {createWorkoutPlan.isPending ? "Ukladam..." : "Ulozit plan"}
      </Button>
    </ScreenContainer>
  );
}
