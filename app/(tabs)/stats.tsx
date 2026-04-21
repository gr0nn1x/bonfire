import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, Alert, Keyboard } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { supabase } from "@/lib/supabase";
import { EXERCISE_DATABASE, MUSCLE_LABELS, MuscleGroup, getLocalizedExerciseName, getLocalizedMuscleLabels } from '@/lib/muscleMap';
import { useLanguage } from "@/hooks/useLanguage";

const screenWidth = Dimensions.get("window").width;

// --- POMOCNÁ FUNKCE PRO SPÁROVÁNÍ NÁZVŮ ---
const normalizeName = (name: string) => name ? name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() : "";

// --- SVALOVÁ HEATMAPA ---
const calculateMuscleVolume = (logs: any[]) => {
  const volume: Record<string, number> = {};
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  logs.forEach(log => {
    const logDate = new Date(log.date);

    // KOUZLO: log.plan_id !== null zaručí, že to počítá JEN odškrtnuté cviky z hlavní stránky (kalendáře)
    if (logDate >= sevenDaysAgo && log.plan_id !== null) {
      const exInfo: any = log.exercises;
      const rawName = Array.isArray(exInfo) ? exInfo[0]?.name : exInfo?.name;
      if (!rawName) return;

      const normName = normalizeName(rawName);

      // Chytřejší hledání (i pro starší plány s nepřesným názvem)
      let def = EXERCISE_DATABASE.find(d => normalizeName(d.name) === normName);
      if (!def) {
        if (normName.includes('bench') || normName.includes('tlak')) def = EXERCISE_DATABASE.find(d => d.name.includes('Benchpress'));
        else if (normName.includes('squat') || normName.includes('drep')) def = EXERCISE_DATABASE.find(d => d.name.includes('Dřep'));
        else if (normName.includes('deadlift') || normName.includes('tah')) def = EXERCISE_DATABASE.find(d => d.name.includes('Mrtvý tah'));
        else if (normName.includes('shyb') || normName.includes('pull')) def = EXERCISE_DATABASE.find(d => d.name.includes('Shyby'));
      }

      if (def) {
        // Započítáme body únavy
        def.primary.forEach(m => volume[m] = (volume[m] || 0) + 1);
        def.secondary.forEach(m => volume[m] = (volume[m] || 0) + 0.5);
      }
    }
  });
  return volume;
};

function MuscleHeatmapView({ logs }: { logs: any[] }) {
  const { language } = useLanguage();
  const isCs = language === "cs";
  const muscleLabels = getLocalizedMuscleLabels(language);
  const muscleVolume = calculateMuscleVolume(logs);
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | null>(null);

  return (
    <View className="bg-slate-800 p-4 rounded-xl mb-8 border border-slate-700 shadow-lg">
      <Text className="text-xl font-bold text-white mb-4">{isCs ? "Svalové vytížení (Posledních 7 dní)" : "Muscle load (Last 7 days)"}</Text>
      
      <View className="flex-row flex-wrap gap-2">
        {(Object.entries(muscleLabels) as [MuscleGroup, string][]).map(([key, label]) => {
          const val = muscleVolume[key] || 0;
          let bgColor = 'bg-slate-900 border-slate-700';
          if (val > 0) bgColor = 'bg-yellow-600/40 border-yellow-500/50'; 
          if (val >= 5) bgColor = 'bg-orange-600/60 border-orange-500/80'; 
          if (val >= 12) bgColor = 'bg-red-600 border-red-500'; 

          return (
            <TouchableOpacity 
              key={key}
              onPress={() => setSelectedMuscle(key)}
              className={`p-3 rounded-xl border ${bgColor} ${selectedMuscle === key ? 'border-white border-2' : ''}`}
              style={{ width: '31%' }}
            >
              <Text className="text-white text-[9px] font-bold uppercase text-center tracking-tighter" numberOfLines={1}>{label}</Text>
              <Text className="text-white text-center font-black mt-1 text-lg">{Math.floor(val)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedMuscle && (
        <View className="mt-4 p-4 bg-slate-900 rounded-xl border border-blue-500/40">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-blue-400 font-bold uppercase text-[10px] tracking-widest">{isCs ? "Nejlepší cviky" : "Best exercises"}: {muscleLabels[selectedMuscle]}</Text>
            <TouchableOpacity onPress={() => setSelectedMuscle(null)} className="px-2 py-1 bg-slate-800 rounded">
              <Text className="text-slate-400 font-bold text-xs">{isCs ? "Zavřít" : "Close"}</Text>
            </TouchableOpacity>
          </View>
          <View>
            {EXERCISE_DATABASE
              .filter(ex => ex.primary.includes(selectedMuscle))
              .map(ex => (
                <Text key={ex.id} className="text-slate-300 py-1 text-sm">• {getLocalizedExerciseName(ex, language)}</Text>
              ))}
            {EXERCISE_DATABASE.filter(ex => ex.primary.includes(selectedMuscle)).length === 0 && (
              <Text className="text-slate-500 italic text-sm">{isCs ? "Zatím žádné hlavní cviky v databázi." : "No primary exercises in the database yet."}</Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

// --- HLAVNÍ OBRAZOVKA STATISTIK ---
export default function StatsScreen() {
  const { language } = useLanguage();
  const isCs = language === "cs";
  const muscleLabels = getLocalizedMuscleLabels(language);
  const [weightInput, setWeightInput] = useState("");
  const [weightData, setWeightData] = useState<any>(null);
  const [weightLogs, setWeightLogs] = useState<any[]>([]);

  const [exerciseGraphs, setExerciseGraphs] = useState<any[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [exerciseName, setExerciseName] = useState("");
  const [showExerciseList, setShowExerciseList] = useState(false);
  const [liftWeight, setLiftWeight] = useState("");
  const [liftReps, setLiftReps] = useState("");

  const [quickForms, setQuickForms] = useState<Record<string, { weight: string, reps: string }>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: weights, error: wError } = await supabase
        .from('body_weight_logs')
        .select('id, date, weight')
        .eq('user_id', user.id)
        .order('date', { ascending: true })
        .order('id', { ascending: true });

      if (wError) throw wError;

      if (weights) {
        setWeightLogs([...weights].reverse());
        if (weights.length > 0) {
          let wLabels = weights.map(d => new Date(d.date).toLocaleDateString('cs-CZ').slice(0, 5));
          let wData = weights.map(d => parseFloat(d.weight));
          if (wData.length === 1) { wData.push(wData[0]); wLabels.push(wLabels[0]); }
          setWeightData({ labels: wLabels, datasets: [{ data: wData }] });
        } else {
          setWeightData(null);
        }
      }

      // DO SELECTU JSME PŘIDALI "plan_id", ABYCHOM POZNALI ZDROJ ZÁPISU
      const { data: logs, error: lError } = await supabase
        .from('workout_logs')
        .select(`id, date, weight_lifted, reps_done, exercise_id, plan_id, exercises ( name )`)
        .eq('user_id', user.id)
        .order('date', { ascending: true })
        .order('id', { ascending: true });

      if (lError) throw lError;

      if (logs) {
        setWorkoutLogs([...logs].reverse());

        const grouped: any = {};
        logs.forEach(log => {
          const exInfo: any = log.exercises;
          const name = Array.isArray(exInfo) ? exInfo[0]?.name : exInfo?.name;
          if (!name) return;
          
          if (!grouped[name]) grouped[name] = { id: log.exercise_id, name: name, labels: [], data: [] };
          
          // Grafy 1RM ignorují rutinní série s více opakováním
          if (log.reps_done === 1) {
            grouped[name].labels.push(new Date(log.date).toLocaleDateString('cs-CZ').slice(0, 5));
            grouped[name].data.push(log.weight_lifted);
          }
        });

        const formattedGraphs = Object.values(grouped).map((g: any) => {
          if (g.data.length === 1) { g.data.push(g.data[0]); g.labels.push(g.labels[0]); }
          return { id: g.id, name: g.name, chart: g.data.length > 0 ? { labels: g.labels, datasets: [{ data: g.data }] } : null };
        });

        setExerciseGraphs(formattedGraphs);
      }
    } catch (error) {
      console.error("Chyba při stahování dat:", error);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleQuickAddChange = (id: string, field: 'weight'|'reps', value: string) => {
    setQuickForms(prev => ({ ...prev, [id]: { ...(prev[id] || { weight: "", reps: "" }), [field]: value } }));
  };

  const handleQuickAddSubmit = async (exerciseId: string) => {
    const weight = quickForms[exerciseId]?.weight?.replace(',', '.');
    const reps = quickForms[exerciseId]?.reps;
    if (!weight || !reps) { Alert.alert(isCs ? "Chyba" : "Error", isCs ? "Vyplň váhu i opakování." : "Fill in weight and reps."); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const { error } = await supabase.from("workout_logs").insert({ user_id: user.id, exercise_id: exerciseId, weight_lifted: parseFloat(weight), reps_done: parseInt(reps), date: new Date().toISOString() });
      if (error) throw error;
      setQuickForms(prev => ({ ...prev, [exerciseId]: { weight: "", reps: "" } }));
      fetchData();
    } catch (e: any) { Alert.alert(isCs ? "Chyba při ukládání" : "Save failed", e.message); }
  };

  const handleSaveWeight = async () => {
    if (!weightInput) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const parsedWeight = parseFloat(weightInput.replace(',', '.'));
    if (isNaN(parsedWeight)) { Alert.alert(isCs ? "Chyba" : "Error", isCs ? "Zadej platné číslo." : "Enter a valid number."); return; }

    try {
      const { error } = await supabase.from("body_weight_logs").insert({ user_id: user.id, weight: parsedWeight, date: new Date().toISOString() });
      if (error) throw error;
      setWeightInput(""); fetchData();
    } catch (e: any) { Alert.alert(isCs ? "Chyba" : "Error", e.message); }
  };

  const handleSaveMaxLift = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !exerciseName || !liftWeight || !liftReps) { Alert.alert(isCs ? "Chyba" : "Error", isCs ? "Vyplň všechna pole." : "Fill in all fields."); return; }

    const parsedWeight = parseFloat(liftWeight.replace(',', '.'));

    try {
      let { data: ex } = await supabase.from('exercises').select('id').ilike('name', exerciseName.trim()).maybeSingle();
      let exId = ex?.id;

      if (!exId) {
        const { data: newEx, error: createError } = await supabase.from('exercises').insert({ name: exerciseName.trim(), creator_id: user.id, muscle_group: 'full_body' }).select().single();
        if (createError) throw createError;
        exId = newEx.id;
      }

      const { error: logError } = await supabase.from("workout_logs").insert({ user_id: user.id, exercise_id: exId, weight_lifted: parsedWeight, reps_done: parseInt(liftReps), date: new Date().toISOString() });
      if (logError) throw logError;

      setExerciseName(""); setLiftWeight(""); setLiftReps("");
      Keyboard.dismiss();
      fetchData();
    } catch (e: any) { Alert.alert(isCs ? "Chyba" : "Error", e.message); }
  };

  const handleDeleteWeight = async (id: string) => { await supabase.from('body_weight_logs').delete().eq('id', id); fetchData(); };
  const handleDeleteWorkout = async (id: string) => { await supabase.from('workout_logs').delete().eq('id', id); fetchData(); };

  if (loading) return <ActivityIndicator className="flex-1 bg-slate-900" color="#f97316" />;

  const filteredExercises = EXERCISE_DATABASE.filter(ex => 
    getLocalizedExerciseName(ex, language).toLowerCase().includes(exerciseName.toLowerCase())
  );

  return (
    <ScrollView className="flex-1 bg-slate-900 p-4" keyboardShouldPersistTaps="handled">
      
      <Text className="text-xl font-bold text-white mb-4 mt-2">{isCs ? "Moje Váha" : "My Weight"}</Text>
      <View className="flex-row gap-2 mb-4">
        <TextInput className="flex-1 bg-slate-800 text-white p-3 rounded-lg border border-slate-700" placeholder={isCs ? "Aktuální váha (např. 80,5)" : "Current weight (e.g. 80.5)"} placeholderTextColor="#64748b" keyboardType="numeric" value={weightInput} onChangeText={setWeightInput} />
        <TouchableOpacity className="bg-orange-500 justify-center px-4 rounded-lg" onPress={handleSaveWeight}><Text className="text-white font-bold">{isCs ? "Uložit" : "Save"}</Text></TouchableOpacity>
      </View>

      {weightData && (
        <View className="rounded-xl overflow-hidden mb-6">
          <LineChart data={weightData} width={screenWidth - 32} height={200} chartConfig={{ color: (op = 1) => `rgba(249, 115, 22, ${op})`, backgroundGradientFrom: "#1e293b", backgroundGradientTo: "#1e293b", decimalPlaces: 1 }} bezier style={{ paddingRight: 40 }} />
        </View>
      )}

      {weightLogs.length > 0 && (
        <View className="bg-slate-800 p-3 rounded-xl mb-8">
          <Text className="text-slate-400 font-bold mb-2">{isCs ? "Historie zápisů váhy:" : "Weight log history:"}</Text>
          {weightLogs.slice(0, 5).map(log => (
            <View key={log.id} className="flex-row justify-between items-center bg-slate-700 p-2 rounded mb-2">
              <Text className="text-white">{new Date(log.date).toLocaleDateString('cs-CZ')} - <Text className="font-bold text-orange-400"> {log.weight} kg</Text></Text>
              <TouchableOpacity onPress={() => handleDeleteWeight(log.id)} className="bg-red-500/20 px-3 py-1 rounded"><Text className="text-red-500 font-bold">X</Text></TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <MuscleHeatmapView logs={workoutLogs} />

      <View className="bg-slate-800 p-4 rounded-xl mb-8 border border-slate-700 z-50">
        <Text className="text-lg font-bold text-white mb-2">{isCs ? "Nový Cvik / Výkon" : "New Exercise / Performance"}</Text>
        
        <View style={{ zIndex: 100 }}>
          <TextInput 
            placeholder={isCs ? "Název cviku (Zadej nebo vyber ze seznamu)" : "Exercise name (type or choose from the list)"} 
            value={exerciseName} 
            onFocus={() => setShowExerciseList(true)}
            onChangeText={(text) => {
              setExerciseName(text);
              setShowExerciseList(true);
            }} 
            className="bg-slate-900 text-white p-3 rounded-lg mb-2 border border-slate-700" 
            placeholderTextColor="#64748b" 
          />
          
          {showExerciseList && (
            <View className="bg-slate-900 border border-slate-700 rounded-lg mb-4 max-h-48 overflow-hidden absolute top-14 left-0 right-0 z-50 shadow-2xl">
              <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled={true}>
                {filteredExercises.length > 0 ? (
                  filteredExercises.map((ex, idx) => (
                    <TouchableOpacity 
                      key={idx} 
                      className="p-3 border-b border-slate-800 flex-row justify-between items-center"
                      onPress={() => {
                        setExerciseName(getLocalizedExerciseName(ex, language));
                        setShowExerciseList(false);
                      }}
                    >
                      <Text className="text-white font-bold">{getLocalizedExerciseName(ex, language)}</Text>
                      <Text className="text-slate-500 text-[10px] uppercase">{muscleLabels[ex.primary[0]]}</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View className="p-4 items-center">
                    <Text className="text-slate-400 italic text-sm text-center">{isCs ? "Tento cvik ještě neexistuje." : "This exercise does not exist yet."}</Text>
                    <Text className="text-orange-500 font-bold mt-1 text-center">{isCs ? "Bude vytvořen jako nový! ✨" : "It will be created as a new one! ✨"}</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          )}
        </View>

        <View className="flex-row gap-2 mt-2">
          <TextInput placeholder={isCs ? "Váha (kg)" : "Weight (kg)"} value={liftWeight} onChangeText={setLiftWeight} keyboardType="numeric" className="flex-1 bg-slate-900 text-white p-3 rounded-lg border border-slate-700" placeholderTextColor="#64748b" />
          <TextInput placeholder={isCs ? "Opakování" : "Reps"} value={liftReps} onChangeText={setLiftReps} keyboardType="numeric" className="flex-1 bg-slate-900 text-white p-3 rounded-lg border border-slate-700" placeholderTextColor="#64748b" />
        </View>
        <TouchableOpacity onPress={handleSaveMaxLift} className="bg-orange-500 p-3 rounded-lg mt-3 items-center">
          <Text className="text-white font-bold text-lg">{isCs ? "Zapsat Výkon" : "Log Performance"}</Text>
        </TouchableOpacity>
      </View>

      {exerciseGraphs.length > 0 && <Text className="text-xl font-bold text-white mb-4">{isCs ? "Moje Cviky (Grafy 1RM)" : "My Exercises (1RM Charts)"}</Text>}
      {exerciseGraphs.map((g, i) => (
        <View key={i} className="mb-8 bg-slate-800/50 p-3 rounded-xl border border-slate-800">
          <Text className="text-slate-200 font-bold mb-2 ml-1 text-lg">{g.name}</Text>
          
          {g.chart ? (
            <View className="rounded-xl overflow-hidden mb-3">
              <LineChart data={g.chart} width={screenWidth - 56} height={180} chartConfig={{ color: (op = 1) => `rgba(34, 197, 94, ${op})`, backgroundGradientFrom: "#1e293b", backgroundGradientTo: "#1e293b", decimalPlaces: 0 }} bezier style={{ paddingRight: 40 }} />
            </View>
          ) : (
            <Text className="text-slate-500 italic mb-3 ml-1">{isCs ? "Graf se zobrazí po zapsání výkonu na 1 opakování." : "The chart will appear after logging a 1-rep performance."}</Text>
          )}

          <View className="flex-row gap-2">
            <TextInput placeholder="Kg" keyboardType="numeric" value={quickForms[g.id]?.weight || ""} onChangeText={(val) => handleQuickAddChange(g.id, 'weight', val)} className="flex-1 bg-slate-700 text-white p-2 rounded-lg border border-slate-600" placeholderTextColor="#94a3b8" />
            <TextInput placeholder={isCs ? "Opakování" : "Reps"} keyboardType="numeric" value={quickForms[g.id]?.reps || ""} onChangeText={(val) => handleQuickAddChange(g.id, 'reps', val)} className="flex-1 bg-slate-700 text-white p-2 rounded-lg border border-slate-600" placeholderTextColor="#94a3b8" />
            <TouchableOpacity onPress={() => handleQuickAddSubmit(g.id)} className="bg-green-600 px-4 justify-center items-center rounded-lg"><Text className="text-white font-bold text-lg">+</Text></TouchableOpacity>
          </View>
        </View>
      ))}

      {workoutLogs.length > 0 && (
        <View className="bg-slate-800 p-3 rounded-xl mb-12">
          <Text className="text-slate-400 font-bold mb-2">{isCs ? "Historie všech výkonů:" : "Performance history:"}</Text>
          {workoutLogs.slice(0, 10).map(log => {
            const exInfo: any = log.exercises;
            const exName = Array.isArray(exInfo) ? exInfo[0]?.name : exInfo?.name;
            return (
              <View key={log.id} className="flex-row justify-between items-center bg-slate-700 p-2 rounded mb-2">
                <View>
                  <Text className="text-white font-bold">{exName}</Text>
                  <Text className="text-slate-400 text-xs">{new Date(log.date).toLocaleDateString(isCs ? 'cs-CZ' : 'en-US')} • {log.weight_lifted} kg x {log.reps_done} {isCs ? "opak." : "reps"}</Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteWorkout(log.id)} className="bg-red-500/20 px-3 py-2 rounded"><Text className="text-red-500 font-bold">{isCs ? "Smazat" : "Delete"}</Text></TouchableOpacity>
              </View>
            )
          })}
        </View>
      )}

    </ScrollView>
  );
}
