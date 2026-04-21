import { useState, useEffect, useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { supabase } from "@/lib/supabase";
import { ScreenContainer } from "@/components/screen-container";
import { RestTimer } from "@/components/RestTimer";
import { PlateCalculator } from "@/components/PlateCalculator";
import { RpeCalculator } from "@/components/RpeCalculator"; // NOVÉ
import { DotsCalculator } from "@/components/DotsCalculator";
import { Trophy, Calculator } from 'lucide-react-native';
import { useLanguage } from "@/hooks/useLanguage";

const getLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function HomeScreen() {
  const { language } = useLanguage();
  const isCs = language === "cs";
  const dayNames = isCs
    ? ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"]
    : ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const [loading, setLoading] = useState(true);
  const [activePlan, setActivePlan] = useState<any>(null);
  const [todayWorkout, setTodayWorkout] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [completedDates, setCompletedDates] = useState<string[]>([]);
  const [showDotsCalc, setShowDotsCalc] = useState(false);
  
  const [isExecuting, setIsExecuting] = useState(false);
  const [sessionExercises, setSessionExercises] = useState<any[]>([]);
  const [showTimer, setShowTimer] = useState(false);
  const [showPlateCalc, setShowPlateCalc] = useState(false);
  const [currentWeightForCalc, setCurrentWeightForCalc] = useState(0);

  const [showRpeCalc, setShowRpeCalc] = useState(false); // NOVÉ

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: plan, error: planError } = await supabase
        .from('workout_plans')
        .select('*, plan_days(*, plan_exercises(*, exercises(name)))')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (planError) console.error("Plan Error:", planError);
      setActivePlan(plan);

      if (plan) {
        const { data: logs } = await supabase
          .from('workout_logs')
          .select('date, weight_lifted, reps_done')
          .eq('user_id', user.id)
          .eq('plan_id', plan.id);

        if (logs) {
          // OPRAVA 1: Zrušeno filtrování podle váhy/opakování. 
          // Nyní stačí, že je záznam v databázi, a den zezelená.
          const dates = logs.map(l => l.date.split('T')[0]);
          setCompletedDates([...new Set(dates)]);
        }
        updateTodayWorkout(plan, selectedDate);
      } else {
        setCompletedDates([]);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const updateTodayWorkout = (plan: any, date: Date) => {
    let dayNum = date.getDay();
    dayNum = dayNum === 0 ? 7 : dayNum;
    const dayMatch = plan.plan_days?.find((d: any) => d.day_of_week === dayNum);
    setTodayWorkout(dayMatch || null);
  };

  useEffect(() => { fetchData(); }, []);

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    if (activePlan) updateTodayWorkout(activePlan, date);
  };

  const startWorkout = async () => {
    if (!activePlan) return;
    const { data: { user } } = await supabase.auth.getUser();
    
    // Získáme spolehlivé lokální datum bez ohledu na časové pásmo
    const dateStr = getLocalDateString(selectedDate);

    const { data: existingLogs } = await supabase
      .from('workout_logs')
      .select('*')
      .eq('user_id', user?.id)
      .eq('plan_id', activePlan.id)
      .gte('date', `${dateStr}T00:00:00`)
      .lte('date', `${dateStr}T23:59:59`);

    let items = [];
    if (todayWorkout?.plan_exercises) {
      items = todayWorkout.plan_exercises.map((pe: any) => {
        const log = existingLogs?.find(l => l.exercise_id === pe.exercise_id);
        return {
          ...pe,
          done: !!log,
          actual_weight: log ? String(log.weight_lifted || "") : String(pe.weight || ""),
          actual_reps: log ? String(log.reps_done || "") : String(pe.reps || ""),
          actual_rpe: log ? String(log.rpe || "") : String(pe.rpe || ""),
          actual_percentage: log ? String(log.percentage || "") : String(pe.percentage || ""),
          actual_notes: log ? (log.notes || "") : "",
          template_notes: pe.notes || ""
        };
      });
    }
    setSessionExercises(items);
    setIsExecuting(true);
  };

  const saveWorkoutSession = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !activePlan) return;
    try {
      const dateStr = getLocalDateString(selectedDate);
      const planId = activePlan.id;

      // OPRAVA 2: Ukládáme čas přesně na 12:00:00 (poledne).
      // Tím pádem to při žádném posunu času (ani zimní/letní, ani středoevropský) neuskočí na předchozí nebo další den.
      const safeDateString = `${dateStr}T12:00:00`;

      await supabase.from('workout_logs').delete()
        .eq('user_id', user.id)
        .eq('plan_id', planId)
        .gte('date', `${dateStr}T00:00:00`)
        .lte('date', `${dateStr}T23:59:59`);

      const logsToInsert = sessionExercises
        .filter(ex => ex.done === true) 
        .map(ex => {
          const safeParseFloat = (val: any) => {
            if (!val) return null;
            const parsed = parseFloat(String(val).replace(',', '.'));
            return isNaN(parsed) ? null : parsed;
          };

          const safeParseInt = (val: any) => {
            if (!val) return 0;
            const parsed = parseInt(String(val).replace(',', '.'), 10);
            return isNaN(parsed) ? 0 : parsed;
          };

          return {
            user_id: user.id,
            plan_id: planId,
            exercise_id: ex.exercise_id,
            weight_lifted: safeParseFloat(ex.actual_weight) || 0,
            reps_done: safeParseInt(ex.actual_reps) || 0,
            rpe: safeParseFloat(ex.actual_rpe),
            percentage: safeParseFloat(ex.actual_percentage),
            notes: ex.actual_notes || null,
            date: safeDateString // Zde používáme bezpečný čas v poledne
          };
        });

      if (logsToInsert.length > 0) {
        const { error } = await supabase.from('workout_logs').insert(logsToInsert);
        if (error) throw error;
      }
      
      setIsExecuting(false);
      fetchData(); 
      
    } catch (e: any) { 
      Alert.alert(isCs ? "Chyba při ukládání" : "Save failed", e.message); 
      console.error(e);
    }
  };

  const calendarDays = useMemo(() => {
    const days = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date(); d.setDate(new Date().getDate() + i);
      days.push(d);
    }
    return days;
  }, []);

  return (
    <ScreenContainer>
     <View className="mb-6 flex-row justify-between items-center">
  <Text className="text-3xl font-bold text-white">{isCs ? "Bonfire Fitness - Makej!" : "Bonfire Fitness - Git Gud!"}</Text>
  <View className="flex-row gap-2">
    {/* DOTS Tlačidlo */}
    <TouchableOpacity onPress={() => setShowDotsCalc(true)} className="bg-slate-800 p-2.5 rounded-full border border-slate-700">
      <Trophy size={24} color="#3b82f6" /> 
    </TouchableOpacity>
    
    {/* RPE Tlačidlo */}
    <TouchableOpacity onPress={() => setShowRpeCalc(true)} className="bg-slate-800 p-2.5 rounded-full border border-slate-700">
      <Calculator size={24} color="#f97316" />
    </TouchableOpacity>
  </View>
</View>

      <View className="flex-row justify-between mb-8 bg-slate-800 p-2 rounded-2xl">
        {calendarDays.map((date, i) => {
          const isSelected = date.toDateString() === selectedDate.toDateString();
          const dateISO = getLocalDateString(date);
          let dayOfWeek = date.getDay(); dayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
          const isPlanned = activePlan?.plan_days?.some((d: any) => d.day_of_week === dayOfWeek);
          const isDone = completedDates.includes(dateISO);
          return (
            <TouchableOpacity key={i} onPress={() => handleDateSelect(date)} className={`items-center p-3 rounded-xl ${isSelected ? 'bg-orange-500' : ''}`}>
              <Text className={`text-xs ${isSelected ? 'text-white' : 'text-slate-500'}`}>{dayNames[date.getDay()]}</Text>
              <Text className={`text-lg font-bold ${isSelected ? 'text-white' : (isDone ? 'text-green-400' : (isPlanned ? 'text-orange-400' : 'text-slate-300'))}`}>{date.getDate()}</Text>
              <View className={`w-1.5 h-1.5 rounded-full mt-1 ${isDone ? 'bg-green-500' : (isPlanned ? (isSelected ? 'bg-white' : 'bg-orange-500') : 'bg-transparent')}`} />
            </TouchableOpacity>
          );
        })}
      </View>

      <View className="bg-slate-800 p-5 rounded-[32px] border border-slate-700 shadow-xl">
        {activePlan ? (
          todayWorkout ? (
            <View>
              <Text className="text-orange-500 font-bold uppercase tracking-widest text-[10px] mb-1">
                {completedDates.includes(getLocalDateString(selectedDate))
                  ? isCs
                    ? "✓ DOKONČENO"
                    : "✓ COMPLETED"
                  : isCs
                    ? "NAPLÁNOVÁNO"
                    : "PLANNED"}
              </Text>
              <Text className="text-2xl font-bold text-white mb-1">{todayWorkout.name}</Text>
              {activePlan.description ? <Text className="text-slate-400 text-xs mb-4 italic">{activePlan.description}</Text> : null}
              <TouchableOpacity onPress={startWorkout} className={`p-4 rounded-2xl mt-6 items-center ${completedDates.includes(getLocalDateString(selectedDate)) ? 'bg-slate-700 border border-green-500' : 'bg-orange-500'}`}>
                <Text className="text-white font-bold text-lg">{completedDates.includes(getLocalDateString(selectedDate)) ? (isCs ? "ZOBRAZIT / UPRAVIT" : "VIEW / EDIT") : isCs ? "ZAČÍT CVIČIT" : "START WORKOUT"}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="items-center py-4"><Text className="text-slate-400 italic">{isCs ? "Dnes nemáš tréninkový den. 🧘" : "No workout is planned for today. 🧘"}</Text></View>
          )
        ) : (
          <View className="items-center py-4"><Text className="text-white font-bold italic">{isCs ? "Nemáš aktivní plán." : "You don't have an active plan."}</Text></View>
        )}
      </View>

      <Modal visible={isExecuting} animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-slate-900">
          <View className="p-6 pt-12 bg-slate-800 flex-row justify-between items-center border-b border-slate-700">
            <View className="flex-1">
              <Text className="text-white text-xl font-bold" numberOfLines={1}>{todayWorkout?.name}</Text>
              <Text className="text-orange-500 font-bold text-xs">{selectedDate.toLocaleDateString(isCs ? 'cs-CZ' : 'en-US')}</Text>
            </View>
            <TouchableOpacity onPress={() => setIsExecuting(false)} className="bg-slate-700 h-10 w-10 rounded-full items-center justify-center">
              <Text className="text-white font-bold text-lg">×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView className="p-4" contentContainerStyle={{ paddingBottom: 150 }}>
           {activePlan?.description ? (
  <View className="bg-slate-800/50 p-4 rounded-2xl mb-6 border border-slate-700">
    <Text className="text-orange-500 font-bold text-[10px] uppercase mb-1">{isCs ? "Cíl šablony" : "Template goal"}</Text>
    <Text className="text-slate-300 text-xs italic">{activePlan.description}</Text>
  </View>
) : null}

            {sessionExercises.map((ex, idx) => (
              <View key={idx} className={`mb-6 p-5 rounded-[32px] border ${ex.done ? 'bg-green-900/10 border-green-500/50' : 'bg-slate-800 border-slate-700'}`}>
                <View className="flex-row justify-between items-center mb-4">
                  <View className="flex-1">
                    <Text className="text-xl font-bold text-white">{ex.exercises?.name || (isCs ? "Neznámý cvik" : "Unknown exercise")}</Text>
                    {ex.template_notes ? <Text className="text-orange-300/80 text-[11px] italic mt-1">💡 {ex.template_notes}</Text> : null}
                  </View>
                  
                  <View className="flex-row items-center gap-2">
                    <TouchableOpacity 
                      onPress={() => setShowTimer(true)}
                      className="w-10 h-10 rounded-xl items-center justify-center bg-slate-700 border border-slate-600"
                    >
                      <Text className="text-lg">⏱️</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      onPress={() => { const n = [...sessionExercises]; n[idx].done = !n[idx].done; setSessionExercises(n); }}
                      className={`w-12 h-12 rounded-2xl items-center justify-center border-2 ${ex.done ? 'bg-green-500 border-green-500' : 'border-slate-600 bg-slate-900'}`}
                    >
                      {ex.done && <Text className="text-white font-bold text-2xl">✓</Text>}
                    </TouchableOpacity>
                  </View>
                </View>

                <View className="gap-3">
                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <Text className="text-slate-500 text-[9px] font-bold mb-1 uppercase ml-1">{isCs ? "Váha (kg)" : "Weight (kg)"}</Text>
                      <TextInput 
                        keyboardType="numeric" 
                        value={ex.actual_weight} 
                        onChangeText={(v) => { 
                          const n = [...sessionExercises]; 
                          n[idx].actual_weight = v; 
                          setSessionExercises(n); 
                        }} 
                        className="bg-slate-900 text-white p-3 rounded-xl border border-slate-700 text-center font-bold" 
                      />
                      <TouchableOpacity className="mt-1 self-center" onPress={() => { setCurrentWeightForCalc(parseFloat(ex.actual_weight) || 0); setShowPlateCalc(true); }}>
                        <Text className="text-orange-500 text-[10px] font-bold italic">{isCs ? "🧮 KOTOUČE" : "🧮 PLATES"}</Text>
                      </TouchableOpacity>
                    </View>
                    <View className="flex-1">
                      <Text className="text-slate-500 text-[9px] font-bold mb-1 uppercase ml-1">{isCs ? "Opakování" : "Reps"}</Text>
                      <TextInput 
                        keyboardType="numeric" 
                        value={ex.actual_reps} 
                        onChangeText={(v) => { 
                          const n = [...sessionExercises]; 
                          n[idx].actual_reps = v; 
                          setSessionExercises(n); 
                        }} 
                        className="bg-slate-900 text-white p-3 rounded-xl border border-slate-700 text-center font-bold" 
                      />
                    </View>
                  </View>

                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <Text className="text-slate-500 text-[9px] font-bold mb-1 uppercase ml-1">RPE (1-10)</Text>
                      <TextInput keyboardType="numeric" value={ex.actual_rpe} onChangeText={(v) => { const n = [...sessionExercises]; n[idx].actual_rpe = v; setSessionExercises(n); }} className="bg-slate-900 text-white p-3 rounded-xl border border-slate-700 text-center" placeholder="-" placeholderTextColor="#444" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-slate-500 text-[9px] font-bold mb-1 uppercase ml-1">{isCs ? "Zátěž (%)" : "Load (%)"}</Text>
                      <TextInput keyboardType="numeric" value={ex.actual_percentage} onChangeText={(v) => { const n = [...sessionExercises]; n[idx].actual_percentage = v; setSessionExercises(n); }} className="bg-slate-900 text-white p-3 rounded-xl border border-slate-700 text-center" placeholder="-" placeholderTextColor="#444" />
                    </View>
                  </View>

                  <View>
                    <Text className="text-slate-500 text-[9px] font-bold mb-1 uppercase ml-1">{isCs ? "Tvoje poznámka" : "Your note"}</Text>
                    <TextInput multiline value={ex.actual_notes} onChangeText={(v) => { const n = [...sessionExercises]; n[idx].actual_notes = v; setSessionExercises(n); }} className="bg-slate-900 text-white p-3 rounded-xl border border-slate-700 text-xs italic" placeholder={isCs ? "Dneska to šlo lehce..." : "Today felt easy..."} placeholderTextColor="#444" />
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>

          <View className="p-6 bg-slate-900 border-t border-slate-800 shadow-2xl">
            <TouchableOpacity onPress={saveWorkoutSession} className="bg-green-600 p-5 rounded-2xl items-center shadow-lg">
              <Text className="text-white font-bold text-xl uppercase tracking-widest italic">{isCs ? "Uložit trénink ✓" : "Save workout ✓"}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        <PlateCalculator isVisible={showPlateCalc} targetWeight={currentWeightForCalc} onClose={() => setShowPlateCalc(false)} />
        <RestTimer isVisible={showTimer} duration={90} onClose={() => setShowTimer(false)} />

      </Modal>
           <RpeCalculator isVisible={showRpeCalc} onClose={() => setShowRpeCalc(false)} />
   <DotsCalculator isVisible={showDotsCalc} onClose={() => setShowDotsCalc(false)} />
    </ScreenContainer>
  );
}
