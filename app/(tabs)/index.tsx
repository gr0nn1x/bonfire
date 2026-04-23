import { useState, useEffect, useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, FlatList, DeviceEventEmitter } from "react-native";
import { supabase } from "@/lib/supabase";
import { ScreenContainer } from "@/components/screen-container";
import { RestTimer } from "@/components/RestTimer";
import { PlateCalculator } from "@/components/PlateCalculator";
import { RpeCalculator } from "@/components/RpeCalculator";
import { DotsCalculator } from "@/components/DotsCalculator";
import { Trophy, Calculator, Plus, Search, X } from 'lucide-react-native';
import { useLanguage } from "@/hooks/useLanguage";
import { Calendar, LocaleConfig } from 'react-native-calendars';

// --- LOKALIZACE KALENDÁŘE ---
LocaleConfig.locales['cs'] = {
  monthNames: ['Leden','Únor','Březen','Duben','Květen','Červen','Červenec','Srpen','Září','Říjen','Listopad','Prosinec'],
  monthNamesShort: ['Led','Úno','Bře','Dub','Kvě','Čer','Čvc','Srp','Zář','Říj','Lis','Pro'],
  dayNames: ['Neděle','Pondělí','Úterý','Středa','Čtvrtek','Pátek','Sobota'],
  dayNamesShort: ['Ne','Po','Út','St','Čt','Pá','So'],
  today: 'Dnes'
};
LocaleConfig.locales['en'] = {
  monthNames: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  monthNamesShort: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  dayNames: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
  dayNamesShort: ['Su','Mo','Tu','We','Th','Fr','Sa'],
  today: 'Today'
};

const getLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function HomeScreen() {
  const { language } = useLanguage();
  const isCs = language === "cs";
  LocaleConfig.defaultLocale = isCs ? 'cs' : 'en';

  const [loading, setLoading] = useState(true);
  const [activePlan, setActivePlan] = useState<any>(null);
  const [todayWorkout, setTodayWorkout] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [completedDates, setCompletedDates] = useState<string[]>([]);
  
  // Custom název pro volný trénink
  const [customWorkoutName, setCustomWorkoutName] = useState("");

  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [allExercises, setAllExercises] = useState<any[]>([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [isExecuting, setIsExecuting] = useState(false);
  const [sessionExercises, setSessionExercises] = useState<any[]>([]);
  const [showTimer, setShowTimer] = useState(false);
  const [showPlateCalc, setShowPlateCalc] = useState(false);
  const [currentWeightForCalc, setCurrentWeightForCalc] = useState(0);
  const [showRpeCalc, setShowRpeCalc] = useState(false);
  const [showDotsCalc, setShowDotsCalc] = useState(false);

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

      const { data: logs } = await supabase
        .from('workout_logs')
        .select('*, exercises(name)')
        .eq('user_id', user.id);

      if (logs) {
        setAllLogs(logs);
        const dates = logs.map(l => l.date.split('T')[0]);
        setCompletedDates([...new Set(dates)]);
      } else {
        setAllLogs([]);
        setCompletedDates([]);
      }

      if (plan) {
        updateTodayWorkout(plan, selectedDate);
      } else {
        setTodayWorkout(null);
      }

      const { data: exList } = await supabase.from('exercises').select('*').order('name');
      setAllExercises(exList || []);

    } catch (e) { console.error(e); } finally { setLoading(false); }
  };
  useEffect(() => { 
    // Načte se poprvé při startu
    fetchData(); 

    // Bude poslouchat signály z jiných obrazovek
    const subscription = DeviceEventEmitter.addListener('planChanged', () => {
      fetchData();
    });

    // Cleanup při odchodu
    return () => {
      subscription.remove();
    };
  }, []);

  const updateTodayWorkout = (plan: any, date: Date) => {
    let dayNum = date.getDay();
    dayNum = dayNum === 0 ? 7 : dayNum;
    const dayMatch = plan.plan_days?.find((d: any) => d.day_of_week === dayNum);
    setTodayWorkout(dayMatch || null);
  };

  useEffect(() => { fetchData(); }, []);

  const handleDayPress = (day: any) => {
    const [y, m, d] = day.dateString.split('-');
    const newDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    setSelectedDate(newDate);
    if (activePlan) {
      updateTodayWorkout(activePlan, newDate);
    } else {
      setTodayWorkout(null);
    }
    // Vyresetujeme případný custom název při změně dne
    setCustomWorkoutName("");
  };

  const startWorkout = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const dateStr = getLocalDateString(selectedDate);

    const { data: existingLogs } = await supabase
      .from('workout_logs')
      .select('*')
      .eq('user_id', user?.id)
      .gte('date', `${dateStr}T00:00:00`)
      .lte('date', `${dateStr}T23:59:59`);

    let items: any[] = [];
    
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

    existingLogs?.forEach(log => {
      const alreadyIn = items.find(it => it.exercise_id === log.exercise_id);
      if (!alreadyIn) {
        const exDetail = allExercises.find(e => e.id === log.exercise_id);
        items.push({ 
          exercise_id: log.exercise_id, 
          exercises: { name: exDetail?.name }, 
          done: true, 
          actual_weight: String(log.weight_lifted), 
          actual_reps: String(log.reps_done), 
          actual_rpe: String(log.rpe || ""), 
          actual_percentage: String(log.percentage || ""), 
          actual_notes: log.notes || "", 
          is_extra: true 
        });
      }
    });

    setSessionExercises(items);
    setIsExecuting(true);
  };
  const createAndAddExercise = async (newExerciseName: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const trimmedName = newExerciseName.trim();
    if (!trimmedName) return;

    try {
      // Vytvoření nového cviku v databázi Supabase
      const { data: newEx, error } = await supabase
        .from('exercises')
        .insert({ 
          name: trimmedName, 
          creator_id: user.id, 
          muscle_group: 'full_body' // Výchozí skupina
        })
        .select()
        .single();
      
      if (error) throw error;

      // Přidáme ho rovnou i do lokálního seznamu, aby se příště už normálně vyhledal
      setAllExercises(prev => [...prev, newEx]);
      
      // A rovnou ho přidáme do právě probíhajícího tréninku
      addExtraExercise(newEx);
      
    } catch (e: any) { 
      Alert.alert(isCs ? "Chyba při vytváření cviku" : "Error creating exercise", e.message); 
    }
  };

 const addExtraExercise = (exercise: any) => {
    setSessionExercises(prev => [...prev, {
      exercise_id: exercise.id,
      exercises: { name: exercise.name },
      done: true,
      actual_weight: "",
      actual_reps: "",
      actual_rpe: "",
      actual_percentage: "",
      actual_notes: "",
      is_extra: true
    }]);
    setShowExercisePicker(false);
  };

 const saveWorkoutSession = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    try {
      const dateStr = getLocalDateString(selectedDate);
      const planId = activePlan?.id || null;
      const safeDateString = `${dateStr}T12:00:00`;

      await supabase.from('workout_logs').delete()
        .eq('user_id', user.id)
        .gte('date', `${dateStr}T00:00:00`)
        .lte('date', `${dateStr}T23:59:59`);

      const logsToInsert = sessionExercises
        .filter(ex => ex.done === true || (ex.actual_weight !== "" && ex.actual_reps !== "")) 
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
            date: safeDateString,
            // 💡 TIP: Pokud si v Supabase přidáš do workout_logs sloupec 'custom_name',
            // stačí odkomentovat řádek níže a tvůj vlastní název se uloží do databáze!
            // custom_name: customWorkoutName ? customWorkoutName : null
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

  const markedDates = useMemo(() => {
    const marks: any = {};
    const selectedStr = getLocalDateString(selectedDate);

    if (activePlan?.plan_days) {
      const plannedDays = activePlan.plan_days.map((pd: any) => pd.day_of_week);
      for (let i = -30; i < 60; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        let dw = d.getDay(); dw = dw === 0 ? 7 : dw;
        if (plannedDays.includes(dw)) {
          marks[getLocalDateString(d)] = { marked: true, dotColor: '#f97316' };
        }
      }
    }

    completedDates.forEach(dateStr => {
      marks[dateStr] = { marked: true, dotColor: '#22C55E' };
    });

    marks[selectedStr] = {
      ...marks[selectedStr],
      selected: true,
      selectedColor: '#F97316',
    };

    return marks;
  }, [completedDates, selectedDate, activePlan]);

  const filteredExercises = allExercises.filter(ex => 
    ex.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentDayLogs = useMemo(() => {
    const dateStr = getLocalDateString(selectedDate);
    return allLogs.filter(l => l.date.split('T')[0] === dateStr);
  }, [allLogs, selectedDate]);

  const isDone = completedDates.includes(getLocalDateString(selectedDate));

  return (
    <ScreenContainer>
      <View className="mb-6 flex-row justify-between items-center">
        <Text className="text-3xl font-bold text-white">{isCs ? "Bonfire Fitness - Makej!" : "Bonfire Fitness - Git Gud!"}</Text>
        <View className="flex-row gap-2">
          <TouchableOpacity onPress={() => setShowDotsCalc(true)} className="bg-slate-800 p-2.5 rounded-full border border-slate-700">
            <Trophy size={24} color="#3b82f6" /> 
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowRpeCalc(true)} className="bg-slate-800 p-2.5 rounded-full border border-slate-700">
            <Calculator size={24} color="#f97316" />
          </TouchableOpacity>
        </View>
      </View>

      <View className="bg-slate-800 rounded-2xl overflow-hidden mb-8 border border-slate-700 shadow-xl">
        <Calendar
          current={getLocalDateString(selectedDate)}
          onDayPress={handleDayPress}
          markedDates={markedDates}
          firstDay={1} 
          theme={{
            backgroundColor: '#1E293B',
            calendarBackground: '#1E293B',
            textSectionTitleColor: '#94A3B8',
            selectedDayBackgroundColor: '#F97316',
            selectedDayTextColor: '#ffffff',
            todayTextColor: '#F97316',
            dayTextColor: '#F1F5F9',
            textDisabledColor: '#334155',
            dotColor: '#F97316', 
            selectedDotColor: '#ffffff',
            arrowColor: '#F97316',
            monthTextColor: '#F1F5F9',
            textDayFontWeight: '500',
            textMonthFontWeight: 'bold',
            textDayHeaderFontWeight: '600',
            textDayFontSize: 16,
            textMonthFontSize: 18,
          }}
        />
      </View>

      <View className="bg-slate-800 p-5 rounded-[32px] border border-slate-700 shadow-xl">
        {isDone ? (
          <View>
            <Text className="text-green-500 font-bold uppercase tracking-widest text-[10px] mb-1">
              ✓ {isCs ? "ODCVIČENO" : "COMPLETED"}
            </Text>
            <Text className="text-2xl font-bold text-white mb-3">
              {todayWorkout ? todayWorkout.name : (customWorkoutName || (isCs ? "Volný trénink" : "Free Workout"))}
            </Text>
            
            <View className="bg-slate-900/50 p-3 rounded-2xl mb-4 border border-slate-700/50">
              {currentDayLogs.map((log, i) => (
                <Text key={i} className="text-slate-400 text-xs mb-1">
                  • {log.exercises?.name} ({log.weight_lifted}kg x {log.reps_done})
                </Text>
              ))}
            </View>

            <TouchableOpacity onPress={startWorkout} className="bg-slate-700 border border-green-500 p-4 rounded-2xl mt-2 items-center">
              <Text className="text-white font-bold text-lg">{isCs ? "ZOBRAZIT / UPRAVIT" : "VIEW / EDIT"}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            {todayWorkout ? (
              <View>
                <Text className="text-orange-500 font-bold uppercase tracking-widest text-[10px] mb-1">
                  {isCs ? "NAPLÁNOVÁNO" : "PLANNED"}
                </Text>
                <Text className="text-2xl font-bold text-white mb-1">{todayWorkout.name}</Text>
                {activePlan?.description ? <Text className="text-slate-400 text-xs mb-4 italic">{activePlan.description}</Text> : null}
                <TouchableOpacity onPress={startWorkout} className="bg-orange-500 p-4 rounded-2xl mt-6 items-center">
                  <Text className="text-white font-bold text-lg">{isCs ? "ZAČÍT TRÉNINK" : "START WORKOUT"}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="items-center py-4">
                <Text className="text-slate-400 italic mb-6 text-center">
                  {isCs ? "Pro tento den nemáš naplánovaný trénink. 🧘" : "No workout planned for this day. 🧘"}
                </Text>
                <TouchableOpacity 
                  onPress={startWorkout} 
                  className="bg-slate-700 w-full p-4 rounded-2xl items-center border border-slate-600 border-dashed"
                >
                  <Text className="text-orange-400 font-bold text-lg">{isCs ? "+ Zapsat volný trénink" : "+ Add free workout"}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      <Modal visible={isExecuting} animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-slate-900">
          <View className="p-6 pt-12 bg-slate-800 flex-row justify-between items-center border-b border-slate-700">
            <View className="flex-1 mr-4">
              {/* TADY JE INPUT PRO PŘEJMENOVÁNÍ VOLNÉHO TRÉNINKU */}
              {todayWorkout ? (
                <Text className="text-white text-xl font-bold" numberOfLines={1}>{todayWorkout.name}</Text>
              ) : (
                <TextInput 
                  value={customWorkoutName}
                  onChangeText={setCustomWorkoutName}
                  placeholder={isCs ? "✏️ Pojmenuj svůj trénink..." : "✏️ Name your workout..."}
                  placeholderTextColor="#f97316"
                  className="text-white text-xl font-bold p-0 m-0"
                />
              )}
              <Text className="text-slate-400 font-bold text-xs mt-1">{selectedDate.toLocaleDateString(isCs ? 'cs-CZ' : 'en-US')}</Text>
            </View>
            <TouchableOpacity onPress={() => setIsExecuting(false)} className="bg-slate-700 h-10 w-10 rounded-full items-center justify-center">
              <X size={24} color="white" />
            </TouchableOpacity>
          </View>

          <ScrollView className="p-4" contentContainerStyle={{ paddingBottom: 150 }}>
           {activePlan?.description && todayWorkout ? (
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
                    {ex.is_extra && <Text className="text-orange-500 text-[10px] font-bold mt-1">EXTRA CVIK</Text>}
                    {ex.template_notes ? <Text className="text-orange-300/80 text-[11px] italic mt-1">💡 {ex.template_notes}</Text> : null}
                  </View>
                  
                  <View className="flex-row items-center gap-2">
                    <TouchableOpacity 
                      onPress={() => setShowTimer(true)}
                      className="w-10 h-10 rounded-xl items-center justify-center bg-slate-700 border border-slate-600"
                    >
                      <Text className="text-lg">⏱️</Text>
                    </TouchableOpacity>

                    {/* OPRAVENÝ CHECKBOX */}
                    <TouchableOpacity 
                      onPress={() => { 
                        const n = [...sessionExercises]; 
                        n[idx] = { ...n[idx], done: !n[idx].done }; 
                        setSessionExercises(n); 
                      }}
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
                      {/* OPRAVENÝ INPUT VÁHY */}
                      <TextInput 
                        keyboardType="numeric" 
                        value={ex.actual_weight} 
                        onChangeText={(v) => { 
                          const n = [...sessionExercises]; 
                          n[idx] = { ...n[idx], actual_weight: v }; 
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
                      {/* OPRAVENÝ INPUT OPAKOVÁNÍ */}
                      <TextInput 
                        keyboardType="numeric" 
                        value={ex.actual_reps} 
                        onChangeText={(v) => { 
                          const n = [...sessionExercises]; 
                          n[idx] = { ...n[idx], actual_reps: v }; 
                          setSessionExercises(n); 
                        }} 
                        className="bg-slate-900 text-white p-3 rounded-xl border border-slate-700 text-center font-bold" 
                      />
                    </View>
                  </View>

                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <Text className="text-slate-500 text-[9px] font-bold mb-1 uppercase ml-1">RPE (1-10)</Text>
                      <TextInput 
                        keyboardType="numeric" 
                        value={ex.actual_rpe} 
                        onChangeText={(v) => { 
                          const n = [...sessionExercises]; 
                          n[idx] = { ...n[idx], actual_rpe: v }; 
                          setSessionExercises(n); 
                        }} 
                        className="bg-slate-900 text-white p-3 rounded-xl border border-slate-700 text-center" placeholder="-" placeholderTextColor="#444" 
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-slate-500 text-[9px] font-bold mb-1 uppercase ml-1">{isCs ? "Zátěž (%)" : "Load (%)"}</Text>
                      <TextInput 
                        keyboardType="numeric" 
                        value={ex.actual_percentage} 
                        onChangeText={(v) => { 
                          const n = [...sessionExercises]; 
                          n[idx] = { ...n[idx], actual_percentage: v }; 
                          setSessionExercises(n); 
                        }} 
                        className="bg-slate-900 text-white p-3 rounded-xl border border-slate-700 text-center" placeholder="-" placeholderTextColor="#444" 
                      />
                    </View>
                  </View>

                  <View>
                    <Text className="text-slate-500 text-[9px] font-bold mb-1 uppercase ml-1">{isCs ? "Tvoje poznámka" : "Your note"}</Text>
                    <TextInput 
                      multiline 
                      value={ex.actual_notes} 
                      onChangeText={(v) => { 
                        const n = [...sessionExercises]; 
                        n[idx] = { ...n[idx], actual_notes: v }; 
                        setSessionExercises(n); 
                      }} 
                      className="bg-slate-900 text-white p-3 rounded-xl border border-slate-700 text-xs italic" placeholder={isCs ? "Dneska to šlo lehce..." : "Today felt easy..."} placeholderTextColor="#444" 
                    />
                  </View>
                </View>
              </View>
            ))}

            <TouchableOpacity 
              onPress={() => setShowExercisePicker(true)}
              className="mt-2 mb-10 py-5 rounded-2xl border-2 border-dashed border-slate-600 items-center flex-row justify-center gap-2 bg-slate-800/50"
            >
              <Plus size={20} color="#94a3b8" />
              <Text className="text-slate-300 font-bold tracking-widest">{isCs ? "PŘIDAT EXTRA CVIK" : "ADD EXTRA EXERCISE"}</Text>
            </TouchableOpacity>

          </ScrollView>

          <View className="p-6 bg-slate-900 border-t border-slate-800 shadow-2xl">
            <TouchableOpacity onPress={saveWorkoutSession} className="bg-green-600 p-5 rounded-2xl items-center shadow-lg">
              <Text className="text-white font-bold text-xl uppercase tracking-widest italic">{isCs ? "Uložit trénink ✓" : "Save workout ✓"}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showExercisePicker} animationType="fade" transparent={true}>
        <View className="flex-1 bg-black/80 justify-center p-6">
          <View className="bg-slate-800 rounded-[32px] border border-slate-700 max-h-[80%] overflow-hidden">
            <View className="p-4 border-b border-slate-700 flex-row items-center gap-3">
              <Search size={20} color="#94a3b8" />
              <TextInput 
                placeholder={isCs ? "Hledat cvik..." : "Search exercise..."}
                placeholderTextColor="#666"
                value={searchQuery}
                onChangeText={setSearchQuery}
                className="flex-1 text-white text-lg font-bold"
              />
              <TouchableOpacity onPress={() => setShowExercisePicker(false)}>
                <X size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <FlatList 
              data={filteredExercises}
              keyExtractor={item => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity 
                  onPress={() => addExtraExercise(item)}
                  className="p-4 border-b border-slate-700/50 flex-row justify-between items-center"
                >
                  <View>
                    <Text className="text-white font-bold text-lg">{item.name}</Text>
                    <Text className="text-slate-500 text-xs mt-1">{item.target_muscle_group || "Ostatní"}</Text>
                  </View>
                  <Plus size={20} color="#f97316" />
                </TouchableOpacity>
              )}
             ListEmptyComponent={
                <View className="p-8 items-center border border-slate-700 border-dashed rounded-2xl bg-slate-900/50 mt-4">
                  <Text className="text-slate-400 italic text-center mb-2">
                    {isCs ? "Tento cvik ještě neznáme." : "We don't know this exercise yet."}
                  </Text>
                  {searchQuery.trim().length > 0 && (
                    <TouchableOpacity 
                      onPress={() => createAndAddExercise(searchQuery)} 
                      className="bg-orange-500 px-6 py-3 rounded-xl mt-2"
                    >
                      <Text className="text-white font-bold">
                        {isCs ? `Vytvořit "${searchQuery.trim()}"` : `Create "${searchQuery.trim()}"`}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      <PlateCalculator isVisible={showPlateCalc} targetWeight={currentWeightForCalc} onClose={() => setShowPlateCalc(false)} />
      <RestTimer isVisible={showTimer} duration={90} onClose={() => setShowTimer(false)} />
      <RpeCalculator isVisible={showRpeCalc} onClose={() => setShowRpeCalc(false)} />
      <DotsCalculator isVisible={showDotsCalc} onClose={() => setShowDotsCalc(false)} />
    </ScreenContainer>
  );
}