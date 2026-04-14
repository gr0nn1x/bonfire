import { useState, useEffect, useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput } from "react-native";
import { supabase } from "@/lib/supabase";
import { ScreenContainer } from "@/components/screen-container";
import { RestTimer } from "@/components/RestTimer";

const DAYS_NAMES = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [activePlan, setActivePlan] = useState<any>(null);
  const [todayWorkout, setTodayWorkout] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [completedDates, setCompletedDates] = useState<string[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [sessionExercises, setSessionExercises] = useState<any[]>([]);

  // --- STATE PRO REST TIMER ---
  const [showTimer, setShowTimer] = useState(false);
  const [timerDuration, setTimerDuration] = useState(90);

  const fetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: plan } = await supabase
      .from('workout_plans')
      .select('*, plan_days(*, plan_exercises(*, exercises(name)))')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    setActivePlan(plan);

    const { data: logs } = await supabase.from('workout_logs').select('date').eq('user_id', user.id);

    if (logs) {
      const dates = logs.map(l => new Date(l.date).toISOString().split('T')[0]);
      setCompletedDates([...new Set(dates)]);
    }

    if (plan) updateTodayWorkout(plan, selectedDate);
    setLoading(false);
  };

  const updateTodayWorkout = (plan: any, date: Date) => {
    let dayNum = date.getDay();
    dayNum = dayNum === 0 ? 7 : dayNum;
    const dayMatch = plan.plan_days.find((d: any) => d.day_of_week === dayNum);
    setTodayWorkout(dayMatch || null);
  };

  useEffect(() => { fetchData(); }, []);

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    if (activePlan) updateTodayWorkout(activePlan, date);
  };

  const startWorkout = async () => {
    if (!todayWorkout) return;
    const { data: { user } } = await supabase.auth.getUser();
    const dateStr = selectedDate.toISOString().split('T')[0];

    const { data: existingLogs } = await supabase
      .from('workout_logs')
      .select('*')
      .eq('user_id', user?.id)
      .gte('date', `${dateStr}T00:00:00`)
      .lte('date', `${dateStr}T23:59:59`);

    const items = todayWorkout.plan_exercises.map((pe: any) => {
      const log = existingLogs?.find(l => l.exercise_id === pe.exercise_id);
      return {
        ...pe,
        done: !!log,
        actual_weight: log ? log.weight_lifted.toString() : "",
        actual_reps: log ? log.reps_done.toString() : pe.reps.toString(),
        actual_rpe: log ? (log.rpe?.toString() || "") : (pe.rpe?.toString() || ""),
        actual_notes: log ? (log.notes || "") : ""
      };
    });
    setSessionExercises(items);
    setIsExecuting(true);
  };

  const saveWorkoutSession = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      await supabase.from('workout_logs').delete().eq('user_id', user.id).gte('date', `${dateStr}T00:00:00`).lte('date', `${dateStr}T23:59:59`);

      const logs = sessionExercises.filter(ex => ex.done).map(ex => ({
        user_id: user.id, exercise_id: ex.exercise_id, weight_lifted: parseFloat(ex.actual_weight.replace(',', '.')) || 0,
        reps_done: parseInt(ex.actual_reps) || 0, rpe: ex.actual_rpe ? parseFloat(ex.actual_rpe.replace(',', '.')) : null,
        notes: ex.actual_notes || null, date: selectedDate.toISOString()
      }));

      if (logs.length > 0) {
        await supabase.from('workout_logs').insert(logs);
      }
      setIsExecuting(false);
      setShowTimer(false);
      fetchData();
    } catch (e: any) { Alert.alert("Chyba", e.message); }
  };

  const calendarDays = useMemo(() => {
    const days = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date();
      d.setDate(new Date().getDate() + i);
      days.push(d);
    }
    return days;
  }, []);

  if (loading) return <ActivityIndicator className="flex-1 bg-slate-900" color="#f97316" />;

  return (
    <ScreenContainer>
      <View className="mb-6">
        <Text className="text-3xl font-bold text-white">Bonfire 🔥</Text>
        <Text className="text-slate-400">Tvůj tréninkový přehled</Text>
      </View>

      {/* KALENDÁŘ */}
      <View className="flex-row justify-between mb-8 bg-slate-800 p-2 rounded-2xl">
        {calendarDays.map((date, i) => {
          const isSelected = date.toDateString() === selectedDate.toDateString();
          const dateISO = date.toISOString().split('T')[0];
          let dayOfWeek = date.getDay();
          dayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
          const isPlanned = activePlan?.plan_days?.some((d: any) => d.day_of_week === dayOfWeek);
          const isDone = completedDates.includes(dateISO);

          return (
            <TouchableOpacity key={i} onPress={() => handleDateSelect(date)} className={`items-center p-3 rounded-xl ${isSelected ? 'bg-orange-500' : ''}`}>
              <Text className={`text-xs ${isSelected ? 'text-white' : 'text-slate-500'}`}>{DAYS_NAMES[date.getDay()]}</Text>
              <Text className={`text-lg font-bold ${isSelected ? 'text-white' : (isDone ? 'text-green-400' : (isPlanned ? 'text-orange-400' : 'text-slate-300'))}`}>{date.getDate()}</Text>
              <View className={`w-1.5 h-1.5 rounded-full mt-1 ${isDone ? 'bg-green-500' : (isPlanned ? (isSelected ? 'bg-white' : 'bg-orange-500') : 'bg-transparent')}`} />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* HLAVNÍ KARTA TRÉNINKU */}
      <View className="bg-slate-800 p-5 rounded-3xl border border-slate-700 shadow-xl">
        {activePlan ? (
          todayWorkout ? (
            <View>
              <Text className="text-orange-500 font-bold uppercase tracking-widest text-[10px] mb-1">
                {completedDates.includes(selectedDate.toISOString().split('T')[0]) ? "✓ DOKONČENO" : "NAPLÁNOVÁNO"}
              </Text>
              <Text className="text-2xl font-bold text-white mb-4">{todayWorkout.name}</Text>
              <TouchableOpacity onPress={startWorkout} className={`p-4 rounded-2xl mt-6 items-center ${completedDates.includes(selectedDate.toISOString().split('T')[0]) ? 'bg-slate-700 border border-green-500' : 'bg-orange-500'}`}>
                <Text className="text-white font-bold text-lg">{completedDates.includes(selectedDate.toISOString().split('T')[0]) ? "UPRAVIT ZÁZNAM" : "ZAČÍT CVIČIT"}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="items-center py-4"><Text className="text-slate-400 italic text-lg text-center">Dnes nemáš nic v plánu. 🧘</Text></View>
          )
        ) : (
          <View className="items-center py-4"><Text className="text-white font-bold">Nemáš aktivní plán.</Text></View>
        )}
      </View>

      {/* MODAL TRÉNINKU */}
      <Modal visible={isExecuting} animationType="slide">
        <View className="flex-1 bg-slate-900">
          
          {/* HEADER MODALU S TLAČÍTKEM PRO TIMER */}
          <View className="p-6 pt-12 bg-slate-800 flex-row justify-between items-center border-b border-slate-700">
            <View className="flex-1">
              <Text className="text-white text-xl font-bold" numberOfLines={1}>{todayWorkout?.name}</Text>
              <Text className="text-orange-500 font-bold">{selectedDate.toLocaleDateString('cs-CZ')}</Text>
            </View>
            
            <View className="flex-row items-center gap-3">
              {/* --- NOVÉ TLAČÍTKO PRO RUČNÍ SPUŠTĚNÍ TIMERU --- */}
              <TouchableOpacity 
                onPress={() => { setShowTimer(false); setTimeout(() => setShowTimer(true), 50); }}
                className="bg-orange-500/20 border border-orange-500 px-3 py-2 rounded-xl flex-row items-center"
              >
                <Text className="text-orange-500 font-bold mr-1 text-xs">⏱️ PAUZA</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => { setIsExecuting(false); setShowTimer(false); }} className="bg-slate-700 h-10 w-10 rounded-full items-center justify-center">
                <Text className="text-white font-bold text-lg">×</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView className="p-4" contentContainerStyle={{ paddingBottom: 300 }}>
            {sessionExercises.map((ex, idx) => (
              <View key={idx} className={`mb-6 p-4 rounded-2xl border ${ex.done ? 'bg-green-900/10 border-green-500/50' : 'bg-slate-800 border-slate-700'}`}>
                <View className="flex-row justify-between items-center mb-3">
                  <Text className="text-xl font-bold text-white flex-1">{ex.exercises.name}</Text>
                  <TouchableOpacity 
                    onPress={() => {
                      const next = [...sessionExercises];
                      const isNowDone = !next[idx].done;
                      next[idx].done = isNowDone;
                      setSessionExercises(next);
                      if (isNowDone) { setShowTimer(false); setTimeout(() => setShowTimer(true), 50); }
                    }}
                    className={`w-10 h-10 rounded-xl items-center justify-center border ${ex.done ? 'bg-green-500 border-green-500' : 'border-slate-600 bg-slate-900'}`}
                  >
                    {ex.done && <Text className="text-white font-bold text-xl">✓</Text>}
                  </TouchableOpacity>
                </View>

                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-bold mb-1 uppercase tracking-tighter">Váha (kg)</Text>
                    <TextInput keyboardType="numeric" value={ex.actual_weight} onChangeText={(v) => { const next = [...sessionExercises]; next[idx].actual_weight = v; setSessionExercises(next); }} className="bg-slate-900 text-white p-3 rounded-xl border border-slate-700" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-bold mb-1 uppercase tracking-tighter">Opak.</Text>
                    <TextInput keyboardType="numeric" value={ex.actual_reps} onChangeText={(v) => { const next = [...sessionExercises]; next[idx].actual_reps = v; setSessionExercises(next); }} className="bg-slate-900 text-white p-3 rounded-xl border border-slate-700" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-bold mb-1 uppercase tracking-tighter">RPE</Text>
                    <TextInput keyboardType="numeric" value={ex.actual_rpe} onChangeText={(v) => { const next = [...sessionExercises]; next[idx].actual_rpe = v; setSessionExercises(next); }} className="bg-slate-900 text-white p-3 rounded-xl border border-slate-700" />
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* --- REST TIMER (VYNUCENÁ POZICE) --- */}
          {showTimer && (
            <View 
              style={{ 
                position: 'absolute', 
                bottom: 115, 
                left: 16, 
                right: 16, 
                zIndex: 9999, 
                elevation: 100,
                backgroundColor: '#1e293b', // Přidané pozadí pro jistotu
                borderRadius: 24,
              }}
            >
              <RestTimer duration={timerDuration} onClose={() => setShowTimer(false)} />
            </View>
          )}

          <View className="absolute bottom-0 left-0 right-0 p-6 bg-slate-900 border-t border-slate-800 shadow-2xl">
            <TouchableOpacity onPress={saveWorkoutSession} className="bg-green-600 p-4 rounded-2xl items-center">
              <Text className="text-white font-bold text-xl uppercase tracking-widest">Uložit trénink</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}