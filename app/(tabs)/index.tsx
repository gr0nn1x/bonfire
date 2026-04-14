import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { SectionCard } from "@/components/section-card";
import { useAuth } from "@/hooks/useAuth";
import { Button, Field } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { fetchMyActiveSchedules, type ScheduledPlan } from "@/lib/schedule";
import { logWorkout } from "@/lib/workout-logs";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUTCDateOnly(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function utcMidnightFromDateString(yyyyMmDd: string) {
  const [y, m, d] = yyyyMmDd.split("-").map((v) => Number.parseInt(v, 10));
  return new Date(Date.UTC(y, m - 1, d));
}

function formatDate(isoOrDateString: string | Date) {
  const date = typeof isoOrDateString === "string" ? new Date(isoOrDateString) : isoOrDateString;
  return date.toLocaleDateString("cs-CZ");
}

export default function HomeScreen() {
  const { user } = useAuth();

  const [schedules, setSchedules] = useState<ScheduledPlan[]>([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(true);
  const [schedulesError, setSchedulesError] = useState<string | null>(null);

  const [recentLogs, setRecentLogs] = useState<
    Array<{
      id: string;
      exercise_id: string;
      exercise_name: string | null;
      weight_lifted: number;
      reps_done: number;
      date: string;
    }>
  >([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(true);

  type Draft = { sets: string; reps: string; weight: string };
  const [logDrafts, setLogDrafts] = useState<Record<string, Draft>>({});

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        setIsLoadingSchedules(true);
        setSchedulesError(null);
        const data = await fetchMyActiveSchedules();
        if (!isMounted) return;
        setSchedules(data);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Nepodařilo se načíst plán.";
        if (!isMounted) return;
        setSchedulesError(message);
      } finally {
        if (!isMounted) return;
        setIsLoadingSchedules(false);
      }
    };

    const loadRecent = async () => {
      try {
        setIsLoadingRecent(true);
        const { data: logs, error } = await supabase
          .from("workout_logs")
          .select("id,exercise_id,weight_lifted,reps_done,date")
          .order("date", { ascending: false })
          .limit(5);

        if (error) throw error;
        const list = (logs ?? []) as Array<{
          id: string;
          exercise_id: string;
          weight_lifted: number;
          reps_done: number;
          date: string;
        }>;

        const exerciseIds = Array.from(new Set(list.map((l) => l.exercise_id)));
        const { data: exercises, error: exError } = await supabase
          .from("exercises")
          .select("id,name")
          .in("id", exerciseIds);
        if (exError) throw exError;

        const exerciseNameById = new Map(
          (exercises ?? []).map((ex) => [ex.id as string, (ex.name as string) ?? null]),
        );

        const hydrated = list.map((l) => ({
          ...l,
          exercise_name: exerciseNameById.get(l.exercise_id) ?? null,
        }));
        if (!isMounted) return;
        setRecentLogs(hydrated);
      } catch {
        // Ticho: neblokuj zbytek UI jen kvůli recent logům.
      } finally {
        if (!isMounted) return;
        setIsLoadingRecent(false);
      }
    };

    void load();
    void loadRecent();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const todayWorkout = useMemo(() => {
    const utcToday = toUTCDateOnly(new Date());

    for (const schedule of schedules) {
      const scheduleStart = utcMidnightFromDateString(schedule.start_date);
      const diffDays = Math.floor((utcToday.getTime() - scheduleStart.getTime()) / MS_PER_DAY);
      if (diffDays < 0) continue;

      const dayNumber = diffDays + 1;
      const matches = schedule.days.filter((d) => d.day_number === dayNumber);
      if (matches.length > 0) {
        return { schedule, days: matches };
      }
    }

    return null;
  }, [schedules]);

  useEffect(() => {
    if (!todayWorkout) return;
    const next: Record<string, Draft> = {};
    for (const d of todayWorkout.days) {
      next[d.exercise_id] = {
        sets: String(d.sets ?? 1),
        reps: String(d.reps ?? 1),
        weight: String(d.weight ?? 0),
      };
    }
    setLogDrafts(next);
  }, [todayWorkout]);

  const upcoming = useMemo(() => {
    if (schedules.length === 0) return [];
    const utcToday = toUTCDateOnly(new Date());
    const items: Array<{
      date: Date;
      plan_title: string;
      exercise_name: string | null;
      sets: number;
      reps: number;
      weight: number;
    }> = [];

    for (let offset = 0; offset < 14; offset++) {
      const date = new Date(utcToday.getTime() + offset * MS_PER_DAY);
      let found: (typeof items)[number] | null = null;

      for (const schedule of schedules) {
        const scheduleStart = utcMidnightFromDateString(schedule.start_date);
        const diffDays = Math.floor((date.getTime() - scheduleStart.getTime()) / MS_PER_DAY);
        if (diffDays < 0) continue;
        const dayNumber = diffDays + 1;
        const match = schedule.days.find((d) => d.day_number === dayNumber);
        if (!match) continue;

        found = {
          date,
          plan_title: schedule.plan_title,
          exercise_name: match.exercise_name,
          sets: match.sets,
          reps: match.reps,
          weight: match.weight,
        };
        break;
      }

      if (found) items.push(found);
      if (items.length >= 5) break;
    }

    return items;
  }, [schedules]);

  const handleLog = async () => {
    if (!todayWorkout) return;

    try {
      // Logujeme všechny cviky pro dnešní `day_number`.
      for (const d of todayWorkout.days) {
        const draft = logDrafts[d.exercise_id];
        const sets = Number.parseInt(draft?.sets ?? "0", 10);
        const reps = Number.parseInt(draft?.reps ?? "0", 10);
        const weight = Number.parseFloat(draft?.weight ?? "0");

        if (!Number.isFinite(sets) || sets <= 0) {
          Alert.alert("Chyba", `Vyplň počet sérií pro ${d.exercise_name ?? "cvičení"}.`);
          return;
        }
        if (!Number.isFinite(reps) || reps <= 0) {
          Alert.alert("Chyba", `Vyplň počet opakování v sérii pro ${d.exercise_name ?? "cvičení"}.`);
          return;
        }
        if (!Number.isFinite(weight) || weight < 0) {
          Alert.alert("Chyba", `Vyplň váhu (kg) pro ${d.exercise_name ?? "cvičení"}.`);
          return;
        }

        await logWorkout({
          exercise_id: d.exercise_id,
          sets,
          reps,
          weight,
          date: new Date(),
        });
      }

      Alert.alert("Hotovo", "Workout byl uložen.");
      // Refresh recent logs
      const { data: logs } = await supabase
        .from("workout_logs")
        .select("id,exercise_id,weight_lifted,reps_done,date")
        .order("date", { ascending: false })
        .limit(5);
      const list = (logs ?? []) as Array<{
        id: string;
        exercise_id: string;
        weight_lifted: number;
        reps_done: number;
        date: string;
      }>;
      const exerciseIds = Array.from(new Set(list.map((l) => l.exercise_id)));
      const { data: exercises } = await supabase
        .from("exercises")
        .select("id,name")
        .in("id", exerciseIds);
      const exerciseNameById = new Map(
        (exercises ?? []).map((ex) => [ex.id as string, (ex.name as string) ?? null]),
      );
      setRecentLogs(
        list.map((l) => ({
          ...l,
          exercise_name: exerciseNameById.get(l.exercise_id) ?? null,
        })),
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Nepodařilo se uložit workout.";
      Alert.alert("Chyba", message);
    }
  };

  return (
    <ScreenContainer>
      <View className="gap-2">
        <Text className="text-4xl font-bold text-text">Bonfire</Text>
        <Text className="text-base leading-6 text-muted">
          {user ? `Přihlášený: ${user.email}` : "Přihlášený uživatel"}
        </Text>
      </View>

      <SectionCard
        title="Dnešní trénink"
        subtitle="Vyplň odjeté série a ulož."
      >
        {isLoadingSchedules ? (
          <View className="items-center py-6">
            <ActivityIndicator size="large" color="#f97316" />
          </View>
        ) : schedulesError ? (
          <Text className="text-sm leading-6 text-red-200">{schedulesError}</Text>
        ) : todayWorkout ? (
          <View className="gap-4">
            <View className="gap-1">
              <Text className="text-sm font-semibold text-text">
                {todayWorkout.schedule.plan_title}
              </Text>
              <Text className="text-sm leading-6 text-muted">
                Dnešní cyklus: den {todayWorkout.days[0]?.day_number}
              </Text>
            </View>

            <View className="gap-3">
              {todayWorkout.days.map((d) => (
                <View
                  key={d.exercise_id}
                  className="rounded-2xl border border-border bg-card px-4 py-3"
                >
                  <Text className="text-sm font-semibold text-text">
                    {d.exercise_name ?? "Cvik"}
                  </Text>
                  <View className="gap-2 pt-2">
                    <Field
                      label="Počet sérií"
                      value={logDrafts[d.exercise_id]?.sets ?? String(d.sets ?? 1)}
                      onChangeText={(v) =>
                        setLogDrafts((cur) => ({
                          ...cur,
                          [d.exercise_id]: {
                            sets: v,
                            reps: cur[d.exercise_id]?.reps ?? String(d.reps ?? 1),
                            weight:
                              cur[d.exercise_id]?.weight ??
                              String(d.weight ?? 0),
                          },
                        }))
                      }
                      keyboardType="numeric"
                    />
                    <Field
                      label="Opakování v sérii"
                      value={logDrafts[d.exercise_id]?.reps ?? String(d.reps ?? 1)}
                      onChangeText={(v) =>
                        setLogDrafts((cur) => ({
                          ...cur,
                          [d.exercise_id]: {
                            sets: cur[d.exercise_id]?.sets ?? String(d.sets ?? 1),
                            reps: v,
                            weight:
                              cur[d.exercise_id]?.weight ??
                              String(d.weight ?? 0),
                          },
                        }))
                      }
                      keyboardType="numeric"
                    />
                    <Field
                      label="Váha (kg)"
                      value={
                        logDrafts[d.exercise_id]?.weight ?? String(d.weight ?? 0)
                      }
                      onChangeText={(v) =>
                        setLogDrafts((cur) => ({
                          ...cur,
                          [d.exercise_id]: {
                            sets: cur[d.exercise_id]?.sets ?? String(d.sets ?? 1),
                            reps: cur[d.exercise_id]?.reps ?? String(d.reps ?? 1),
                            weight: v,
                          },
                        }))
                      }
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              ))}
            </View>

            <Button onPress={() => void handleLog()}>
              Uložit workout
            </Button>
          </View>
        ) : (
          <Text className="text-sm leading-6 text-text">
            Nemáš naplánovaný workout na dnešní den. V záložce `Plány` si naplánuj cyklus.
          </Text>
        )}
      </SectionCard>

      <SectionCard title="Nejbližší tréninky" subtitle="Podle tvých plánů">
        {upcoming.length === 0 ? (
          <Text className="text-sm leading-6 text-text">Zatím nemáš žádné tréninky naplánované.</Text>
        ) : (
          <View className="gap-3">
            {upcoming.map((item, idx) => (
              <View
                // eslint-disable-next-line react/no-array-index-key
                key={`${item.date.toISOString()}-${idx}`}
                className="rounded-2xl border border-border bg-card px-4 py-3"
              >
                <Text className="text-sm font-semibold text-text">{formatDate(item.date)}</Text>
                <Text className="text-sm leading-6 text-muted">
                  {item.plan_title} · {item.exercise_name ?? "Cvik"}
                </Text>
              </View>
            ))}
          </View>
        )}
      </SectionCard>

      <SectionCard title="Poslední zapsané" subtitle="Rychlý přehled">
        {isLoadingRecent ? (
          <View className="items-center py-6">
            <ActivityIndicator size="small" color="#f97316" />
          </View>
        ) : recentLogs.length === 0 ? (
          <Text className="text-sm leading-6 text-text">Zatím nemáš žádné záznamy.</Text>
        ) : (
          <View className="gap-3">
            {recentLogs.map((log) => (
              <View key={log.id} className="rounded-2xl border border-border bg-card px-4 py-3">
                <Text className="text-sm font-semibold text-text">
                  {log.exercise_name ?? "Cvik"} · {formatDate(log.date)}
                </Text>
                <Text className="text-sm leading-6 text-muted">
                  {log.weight_lifted} kg · {log.reps_done} opakování
                </Text>
              </View>
            ))}
          </View>
        )}
      </SectionCard>
    </ScreenContainer>
  );
}
