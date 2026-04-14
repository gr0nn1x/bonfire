import { useState, useEffect, useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput } from "react-native";
import { supabase } from "@/lib/supabase";
import { ScreenContainer } from "@/components/screen-container";
import { RestTimer } from "@/components/RestTimer";
import { PlateCalculator } from "@/components/PlateCalculator";

const DAYS_NAMES = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];

// Pomocná funkce pro získání lokálního data YYYY-MM-DD
const getLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [activePlan, setActivePlan] = useState<any>(null);
  const [todayWorkout, setTodayWorkout] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [completedDates, setCompletedDates] = useState<string[]>([]);
  
  const [isExecuting, setIsExecuting] = useState(false);
  const [sessionExercises, setSessionExercises] = useState<any[]>([]);

  const [showTimer, setShowTimer] = useState(false);
  const [timerDuration, setTimerDuration] = useState(90);

  const [showPlateCalc, setShowPlateCalc] = useState(false);
  const [currentWeightForCalc, setCurrentWeightForCalc] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Načtení plánu
      const { data: plan } = await supabase
        .from('workout_plans')
        .select('*, plan_days(*, plan_exercises(*, weight, notes, exercises(name))))')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      setActivePlan(plan);

      // 2. Načtení logů pro kalendář
      const { data: logs } = await supabase
        .from('workout_logs')
        .select('date, weight_lifted, reps_done')
        .eq('user_id', user.id);

      if (logs) {
        // Zeleně svítí jen dny, kde je váha > 0 NEBO opakování > 0
        const dates = logs
          .filter(l => (Number(l.weight_lifted) > 0 || Number(l.reps_done) > 0))
          .map(l => {
            // Bereme jen datumovou část YYYY-MM-DD z ISO stringu
            return l.date.split('T')[0];
          });
        setCompletedDates([...new Set(dates)]);
      }

      if (plan) updateTodayWorkout(plan, selectedDate);
    } catch (e) { 
      console.error(e); 
    } finally { 
      setLoading(false); 
    }
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
    const dateStr = getLocalDateString(selectedDate);

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
        actual_weight: log ? log.weight_lifted.toString() : (pe.weight?.toString() || ""),
        actual_reps: log ? log.reps_done.toString() : (pe.reps?.toString() || ""),
        actual_rpe: log ? (log.rpe?.toString() || "") : (pe.rpe?.toString() || ""),
        actual_percentage: log ? (log.percentage?.toString() || "") : (pe.percentage?.toString() || ""),
        actual_notes: log ? (log.notes || "") : "",
        template_notes: pe.notes || "",
        template_weight: pe.weight || 0,
        template_sets: pe.sets || 0,
        template_reps: pe.reps || 0
      };
    });
    setSessionExercises(items);
    setIsExecuting(true);
  };

  const saveWorkoutSession = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    try {
      const dateStr = getLocalDateString(selectedDate);
      
      // Smazání prázdných i starých záznamů pro tento den
      await supabase.from('workout_logs').delete().eq('user_id', user.id).gte('date', `${dateStr}T00:00:00`).lte('date', `${dateStr}T23:59:59`);

      const logsToInsert = sessionExercises
        .filter(ex => ex.done || (ex.actual_weight && parseFloat(ex.actual_weight) > 0))
        .map(ex => ({
          user_id: user.id,
          exercise_id: ex.exercise_id,
          weight_lifted: parseFloat(ex.actual_weight.replace(',', '.')) || 0,
          reps_done: parseInt(ex.actual_reps) || 0,
          rpe: ex.actual_rpe ? parseFloat(ex.actual_rpe.replace(',', '.')) : null,
          percentage: ex.actual_percentage ? parseFloat(ex.actual_percentage.replace(',', '.')) : null,
          notes: ex.actual_notes || null,
          date: selectedDate.toISOString()
        }));

      if (logsToInsert.length > 0) {
        const { error } = await supabase.from('workout_logs').insert(logsToInsert);
        if (error) throw error;
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
          const dateISO = getLocalDateString(date);
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

      {/* KARTA TRÉNINKU NA PLOŠE */}
      <View className="bg-slate-800 p-5 rounded-[32px] border border-slate-700 shadow-xl">
        {activePlan ? (
          todayWorkout ? (
            <View>
              <Text className="text-orange-500 font-bold uppercase tracking-widest text-[10px] mb-1">
                {completedDates.includes(getLocalDateString(selectedDate)) ? "✓ DOKONČENO" : "NAPLÁNOVÁNO"}
              </Text>
              <Text className="text-2xl font-bold text-white mb-1">{todayWorkout.name}</Text>
              
              {activePlan.description ? (
                <Text className="text-slate-400 text-xs mb-4 italic" numberOfLines={2}>{activePlan.description}</Text>
              ) : null}

              {todayWorkout.plan_exercises.slice(0, 3).map((pe: any, idx: number) => (
                <Text key={idx} className="text-slate-300 mb-1">• {pe.exercises.name}</Text>
              ))}
              <TouchableOpacity onPress={startWorkout} className={`p-4 rounded-2xl mt-6 items-center ${completedDates.includes(getLocalDateString(selectedDate)) ? 'bg-slate-700 border border-green-500' : 'bg-orange-500'}`}>
                <Text className="text-white font-bold text-lg">{completedDates.includes(getLocalDateString(selectedDate)) ? "UPRAVIT ZÁZNAM" : "ZAČÍT CVIČIT"}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="items-center py-4"><Text className="text-slate-400 italic text-center">Dnes nemáš tréninkový den.🧘</Text></View>
          )
        ) : (
          <View className="items-center py-4"><Text className="text-white font-bold">Nemáš aktivní plán.</Text></View>
        )}
      </View>

      {/* MODAL TRÉNINKU */}
      <Modal visible={isExecuting} animationType="slide">
        <View className="flex-1 bg-slate-900">
          <View className="p-6 pt-12 bg-slate-800 flex-row justify-between items-center border-b border-slate-700">
            <View className="flex-1">
              <Text className="text-white text-xl font-bold">{todayWorkout?.name}</Text>
              <Text className="text-orange-500 font-bold text-xs">{selectedDate.toLocaleDateString('cs-CZ')}</Text>
            </View>
            <View className="flex-row items-center gap-3">
              <TouchableOpacity onPress={() => setShowTimer(true)} className="bg-orange-500 px-4 py-2 rounded-xl shadow-sm"><Text className="text-white font-bold text-xs">⏱️ TIMER</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => { setIsExecuting(false); setShowTimer(false); }} className="bg-slate-700 h-10 w-10 rounded-full items-center justify-center"><Text className="text-white font-bold text-lg">×</Text></TouchableOpacity>
            </View>
          </View>

          <ScrollView className="p-4" contentContainerStyle={{ paddingBottom: 250 }}>
            {/* Popis plánu v detailu */}
            {activePlan?.description ? (
              <View className="bg-slate-800/50 p-4 rounded-2xl mb-6 border border-slate-700">
                <Text className="text-orange-500 font-bold text-[10px] uppercase mb-1">Popis šablony</Text>
                <Text className="text-slate-300 text-xs italic leading-4">{activePlan.description}</Text>
              </View>
            ) : null}

            {sessionExercises.map((ex, idx) => (
              <View key={idx} className={`mb-6 p-5 rounded-[32px] border ${ex.done ? 'bg-green-900/10 border-green-500/50' : 'bg-slate-800 border-slate-700'}`}>
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-xl font-bold text-white flex-1">{ex.exercises.name}</Text>
                  <TouchableOpacity onPress={() => { const next = [...sessionExercises]; next[idx].done = !next[idx].done; setSessionExercises(next); if (next[idx].done) setShowTimer(true); }} className={`w-11 h-11 rounded-2xl items-center justify-center border-2 ${ex.done ? 'bg-green-500 border-green-500' : 'border-slate-600 bg-slate-900'}`}>{ex.done && <Text className="text-white font-bold text-xl">✓</Text>}</TouchableOpacity>
                </View>

                {/* Instrukce k cviku */}
                {ex.template_notes ? (
                   <View className="bg-orange-500/5 border-l-2 border-orange-500/50 p-2 mb-4 rounded-r-lg">
                      <Text className="text-orange-300 text-[9px] font-bold uppercase mb-0.5 tracking-widest">Instrukce:</Text>
                      <Text className="text-slate-400 text-xs italic">{ex.template_notes}</Text>
                   </View>
                ) : null}

                {/* Cíle z šablony */}
                <View className="bg-slate-900/40 p-2 rounded-xl mb-4 flex-row justify-around border border-slate-700/50">
                   <Text className="text-slate-500 text-[10px] font-bold uppercase">Cíl: <Text className="text-slate-300">{ex.template_sets}x{ex.template_reps}</Text></Text>
                   <Text className="text-slate-500 text-[10px] font-bold uppercase">Plán: <Text className="text-slate-300">{ex.template_weight}kg</Text></Text>
                </View>

                <View className="gap-3">
                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <Text className="text-slate-500 text-[9px] font-bold mb-1 uppercase ml-1 tracking-tighter">Váha (kg)</Text>
                      <TextInput keyboardType="numeric" value={ex.actual_weight} onChangeText={(v) => { const next = [...sessionExercises]; next[idx].actual_weight = v; if (v.length > 0) next[idx].done = true; setSessionExercises(next); }} className="bg-slate-900 text-white p-3 rounded-xl border border-slate-700 text-base font-bold text-center" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-slate-500 text-[9px] font-bold mb-1 uppercase ml-1 tracking-tighter">Opakování</Text>
                      <TextInput keyboardType="numeric" value={ex.actual_reps} onChangeText={(v) => { const next = [...sessionExercises]; next[idx].actual_reps = v; setSessionExercises(next); }} className="bg-slate-900 text-white p-3 rounded-xl border border-slate-700 text-base font-bold text-center" />
                    </View>
                  </View>
                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <Text className="text-slate-500 text-[9px] font-bold mb-1 uppercase ml-1 tracking-tighter">RPE (1-10)</Text>
                      <TextInput keyboardType="numeric" value={ex.actual_rpe} onChangeText={(v) => { const next = [...sessionExercises]; next[idx].actual_rpe = v; setSessionExercises(next); }} className="bg-slate-900 text-white p-3 rounded-xl border border-slate-700 text-base font-bold text-center" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-slate-500 text-[9px] font-bold mb-1 uppercase ml-1 tracking-tighter">Zátěž (%)</Text>
                      <TextInput keyboardType="numeric" value={ex.actual_percentage} onChangeText={(v) => { const next = [...sessionExercises]; next[idx].actual_percentage = v; setSessionExercises(next); }} className="bg-slate-900 text-white p-3 rounded-xl border border-slate-700 text-base font-bold text-center" />
                    </View>
                  </View>
                  <TouchableOpacity className="bg-slate-700/50 py-2.5 rounded-xl border border-slate-600 items-center mt-1" onPress={() => { const w = parseFloat(ex.actual_weight.replace(',', '.')); if (w >= 20) { setCurrentWeightForCalc(w); setShowPlateCalc(true); } else { Alert.alert("Tip", "Zadej aspoň 20kg."); } }}>
                    <Text className="text-orange-500 font-bold text-[10px] tracking-widest">🧮 KALKULAČKA KOTOUČŮ</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>

          <RestTimer isVisible={showTimer} duration={timerDuration} onClose={() => setShowTimer(false)} />
          <PlateCalculator isVisible={showPlateCalc} targetWeight={currentWeightForCalc} onClose={() => setShowPlateCalc(false)} />

          <View className="absolute bottom-0 left-0 right-0 p-6 bg-slate-900 border-t border-slate-800 shadow-2xl">
            <TouchableOpacity onPress={saveWorkoutSession} className="bg-green-600 p-5 rounded-2xl items-center shadow-lg"><Text className="text-white font-bold text-xl uppercase tracking-widest">Uložit trénink</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}