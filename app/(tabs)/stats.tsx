import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, Alert } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { supabase } from "@/lib/supabase";

const screenWidth = Dimensions.get("window").width;

export default function StatsScreen() {
  const [weightInput, setWeightInput] = useState("");
  const [weightData, setWeightData] = useState<any>(null);
  const [weightLogs, setWeightLogs] = useState<any[]>([]);

  const [exerciseGraphs, setExerciseGraphs] = useState<any[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [exerciseName, setExerciseName] = useState("");
  const [liftWeight, setLiftWeight] = useState("");
  const [liftReps, setLiftReps] = useState("");

  const [quickForms, setQuickForms] = useState<Record<string, { weight: string, reps: string }>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Historie váhy
      const { data: weights, error: wError } = await supabase
        .from('body_weight_logs')
        .select('id, date, weight')
        .eq('user_id', user.id)
        .order('date', { ascending: true })
        .order('id', { ascending: true }); // <--- OPRAVA 2: TIE-BREAKER (Řadí podle času přidání ve stejný den)

      if (wError) throw wError;

      if (weights) {
        setWeightLogs([...weights].reverse());
        if (weights.length > 0) {
          let wLabels = weights.map(d => new Date(d.date).toLocaleDateString('cs-CZ').slice(0, 5));
          let wData = weights.map(d => parseFloat(d.weight));
          
          if (wData.length === 1) {
            wData.push(wData[0]);
            wLabels.push(wLabels[0]);
          }

          setWeightData({ labels: wLabels, datasets: [{ data: wData }] });
        } else {
          setWeightData(null);
        }
      }

      // 2. Historie Výkonů
      const { data: logs, error: lError } = await supabase
        .from('workout_logs')
        .select(`id, date, weight_lifted, reps_done, exercise_id, exercises ( name )`)
        .eq('user_id', user.id)
        .order('date', { ascending: true })
        .order('id', { ascending: true }); // Pro jistotu přidáno i sem!

      if (lError) throw lError;

      if (logs) {
        setWorkoutLogs([...logs].reverse());

        const grouped: any = {};
        logs.forEach(log => {
          const exInfo: any = log.exercises;
          const name = Array.isArray(exInfo) ? exInfo[0]?.name : exInfo?.name;
          
          if (!name) return;
          
          if (!grouped[name]) {
            grouped[name] = { id: log.exercise_id, name: name, labels: [], data: [] };
          }
          
          if (log.reps_done === 1) {
            grouped[name].labels.push(new Date(log.date).toLocaleDateString('cs-CZ').slice(0, 5));
            grouped[name].data.push(log.weight_lifted);
          }
        });

        const formattedGraphs = Object.values(grouped).map((g: any) => {
          if (g.data.length === 1) {
            g.data.push(g.data[0]);
            g.labels.push(g.labels[0]);
          }

          return {
            id: g.id,
            name: g.name,
            chart: g.data.length > 0 ? { labels: g.labels, datasets: [{ data: g.data }] } : null
          };
        });

        setExerciseGraphs(formattedGraphs);
      }
    } catch (error) {
      console.error("Chyba při stahování dat:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleQuickAddChange = (id: string, field: 'weight'|'reps', value: string) => {
    setQuickForms(prev => ({
      ...prev,
      [id]: { ...(prev[id] || { weight: "", reps: "" }), [field]: value }
    }));
  };

  const handleQuickAddSubmit = async (exerciseId: string) => {
    const weight = quickForms[exerciseId]?.weight?.replace(',', '.');
    const reps = quickForms[exerciseId]?.reps;

    if (!weight || !reps) {
      Alert.alert("Chyba", "Vyplň váhu i opakování.");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const { error } = await supabase.from("workout_logs").insert({
        user_id: user.id,
        exercise_id: exerciseId,
        weight_lifted: parseFloat(weight),
        reps_done: parseInt(reps),
        date: new Date().toISOString()
      });

      if (error) throw error;

      setQuickForms(prev => ({ ...prev, [exerciseId]: { weight: "", reps: "" } }));
      fetchData();
    } catch (e: any) {
      Alert.alert("Chyba při ukládání cviku", e.message);
    }
  };

  const handleSaveWeight = async () => {
    if (!weightInput) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const parsedWeight = parseFloat(weightInput.replace(',', '.'));
    
    if (isNaN(parsedWeight)) {
      Alert.alert("Chyba", "Zadej platné číslo.");
      return;
    }

    try {
      const { error } = await supabase.from("body_weight_logs").insert({
        user_id: user.id,
        weight: parsedWeight,
        date: new Date().toISOString()
      });

      if (error) throw error;
      
      setWeightInput("");
      fetchData();
    } catch (e: any) {
      Alert.alert("Chyba při ukládání váhy", e.message);
    }
  };

  const handleSaveMaxLift = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !exerciseName || !liftWeight || !liftReps) {
      Alert.alert("Chyba", "Vyplň všechna pole.");
      return;
    }

    const parsedWeight = parseFloat(liftWeight.replace(',', '.'));

    try {
      let { data: ex } = await supabase.from('exercises').select('id').ilike('name', exerciseName.trim()).maybeSingle();
      let exId = ex?.id;

      if (!exId) {
        const { data: newEx, error: createError } = await supabase.from('exercises').insert({ 
          name: exerciseName.trim(), 
          creator_id: user.id, 
          muscle_group: 'full_body' 
        }).select().single();
        
        if (createError) throw createError;
        exId = newEx.id;
      }

      const { error: logError } = await supabase.from("workout_logs").insert({
        user_id: user.id,
        exercise_id: exId,
        weight_lifted: parsedWeight,
        reps_done: parseInt(liftReps),
        date: new Date().toISOString()
      });

      if (logError) throw logError;

      setExerciseName(""); setLiftWeight(""); setLiftReps("");
      fetchData();
    } catch (e: any) {
      Alert.alert("Chyba při ukládání", e.message);
    }
  };

  const handleDeleteWeight = async (id: string) => {
    await supabase.from('body_weight_logs').delete().eq('id', id);
    fetchData();
  };

  const handleDeleteWorkout = async (id: string) => {
    await supabase.from('workout_logs').delete().eq('id', id);
    fetchData();
  };

  if (loading) return <ActivityIndicator className="flex-1 bg-slate-900" color="#f97316" />;

  return (
    <ScrollView className="flex-1 bg-slate-900 p-4">
      
      <Text className="text-xl font-bold text-white mb-4 mt-2">Moje Váha</Text>
      <View className="flex-row gap-2 mb-4">
        <TextInput
          className="flex-1 bg-slate-800 text-white p-3 rounded-lg border border-slate-700"
          placeholder="Aktuální váha (např. 80,5)"
          placeholderTextColor="#64748b"
          keyboardType="numeric"
          value={weightInput}
          onChangeText={setWeightInput}
        />
        <TouchableOpacity className="bg-orange-500 justify-center px-4 rounded-lg" onPress={handleSaveWeight}>
          <Text className="text-white font-bold">Uložit</Text>
        </TouchableOpacity>
      </View>

      {weightData && (
        <View className="rounded-xl overflow-hidden mb-6">
          <LineChart data={weightData} width={screenWidth - 32} height={200} 
            chartConfig={{ color: (op = 1) => `rgba(249, 115, 22, ${op})`, backgroundGradientFrom: "#1e293b", backgroundGradientTo: "#1e293b", decimalPlaces: 1 }} 
            bezier 
            style={{ paddingRight: 40 }} 
          />
        </View>
      )}

      {weightLogs.length > 0 && (
        <View className="bg-slate-800 p-3 rounded-xl mb-8">
          <Text className="text-slate-400 font-bold mb-2">Historie zápisů váhy:</Text>
          {weightLogs.slice(0, 5).map(log => (
            <View key={log.id} className="flex-row justify-between items-center bg-slate-700 p-2 rounded mb-2">
              <Text className="text-white">
                {/* OPRAVA 1: Smazáno toLocaleTimeString(), teď tam je jen krásné datum */}
                {new Date(log.date).toLocaleDateString('cs-CZ')} - 
                <Text className="font-bold text-orange-400"> {log.weight} kg</Text>
              </Text>
              <TouchableOpacity onPress={() => handleDeleteWeight(log.id)} className="bg-red-500/20 px-3 py-1 rounded">
                <Text className="text-red-500 font-bold">X</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View className="bg-slate-800 p-4 rounded-xl mb-8 mt-4 border border-slate-700">
        <Text className="text-lg font-bold text-white mb-2">Nový Cvik / Výkon</Text>
        <TextInput placeholder="Název cviku (např. Dřep)" value={exerciseName} onChangeText={setExerciseName} className="bg-slate-900 text-white p-3 rounded-lg mb-2 border border-slate-700" placeholderTextColor="#64748b" />
        <View className="flex-row gap-2">
          <TextInput placeholder="Váha (kg)" value={liftWeight} onChangeText={setLiftWeight} keyboardType="numeric" className="flex-1 bg-slate-900 text-white p-3 rounded-lg border border-slate-700" placeholderTextColor="#64748b" />
          <TextInput placeholder="Opakování" value={liftReps} onChangeText={setLiftReps} keyboardType="numeric" className="flex-1 bg-slate-900 text-white p-3 rounded-lg border border-slate-700" placeholderTextColor="#64748b" />
        </View>
        <TouchableOpacity onPress={handleSaveMaxLift} className="bg-orange-500 p-3 rounded-lg mt-3 items-center">
          <Text className="text-white font-bold text-lg">Zapsat Výkon</Text>
        </TouchableOpacity>
      </View>

      {exerciseGraphs.length > 0 && <Text className="text-xl font-bold text-white mb-4">Moje Cviky (Grafy 1RM)</Text>}
      {exerciseGraphs.map((g, i) => (
        <View key={i} className="mb-8 bg-slate-800/50 p-3 rounded-xl border border-slate-800">
          <Text className="text-slate-200 font-bold mb-2 ml-1 text-lg">{g.name}</Text>
          
          {g.chart ? (
            <View className="rounded-xl overflow-hidden mb-3">
              <LineChart data={g.chart} width={screenWidth - 56} height={180} 
                chartConfig={{ color: (op = 1) => `rgba(34, 197, 94, ${op})`, backgroundGradientFrom: "#1e293b", backgroundGradientTo: "#1e293b", decimalPlaces: 0 }} 
                bezier 
                style={{ paddingRight: 40 }}
              />
            </View>
          ) : (
            <Text className="text-slate-500 italic mb-3 ml-1">Graf se zobrazí po zapsání výkonu na 1 opakování.</Text>
          )}

          <View className="flex-row gap-2">
            <TextInput 
              placeholder="Kg" keyboardType="numeric" 
              value={quickForms[g.id]?.weight || ""} 
              onChangeText={(val) => handleQuickAddChange(g.id, 'weight', val)} 
              className="flex-1 bg-slate-700 text-white p-2 rounded-lg border border-slate-600" placeholderTextColor="#94a3b8" 
            />
            <TextInput 
              placeholder="Opakování" keyboardType="numeric" 
              value={quickForms[g.id]?.reps || ""} 
              onChangeText={(val) => handleQuickAddChange(g.id, 'reps', val)} 
              className="flex-1 bg-slate-700 text-white p-2 rounded-lg border border-slate-600" placeholderTextColor="#94a3b8" 
            />
            <TouchableOpacity onPress={() => handleQuickAddSubmit(g.id)} className="bg-green-600 px-4 justify-center items-center rounded-lg">
              <Text className="text-white font-bold text-lg">+</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {workoutLogs.length > 0 && (
        <View className="bg-slate-800 p-3 rounded-xl mb-12">
          <Text className="text-slate-400 font-bold mb-2">Historie všech výkonů:</Text>
          {workoutLogs.slice(0, 10).map(log => {
            const exInfo: any = log.exercises;
            const exName = Array.isArray(exInfo) ? exInfo[0]?.name : exInfo?.name;
            return (
              <View key={log.id} className="flex-row justify-between items-center bg-slate-700 p-2 rounded mb-2">
                <View>
                  <Text className="text-white font-bold">{exName}</Text>
                  <Text className="text-slate-400 text-xs">{new Date(log.date).toLocaleDateString('cs-CZ')} • {log.weight_lifted} kg x {log.reps_done} rep</Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteWorkout(log.id)} className="bg-red-500/20 px-3 py-2 rounded">
                  <Text className="text-red-500 font-bold">Smazat</Text>
                </TouchableOpacity>
              </View>
            )
          })}
        </View>
      )}

    </ScrollView>
  );
}