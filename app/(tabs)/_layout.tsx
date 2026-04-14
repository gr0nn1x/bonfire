import { Tabs, Redirect } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { ActivityIndicator, View } from "react-native";

export default function TabsLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <View className="flex-1 bg-slate-900 justify-center"><ActivityIndicator color="#f97316" /></View>;

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#0f172a" },
        headerTintColor: "#f8fafc",
        tabBarStyle: { backgroundColor: "#0f172a", borderTopColor: "#1e293b" },
        tabBarActiveTintColor: "#f97316",
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Domů" }} />
      <Tabs.Screen name="plans" options={{ title: "Plány" }} />
      <Tabs.Screen name="stats" options={{ title: "Statistiky" }} />
      <Tabs.Screen name="profile" options={{ title: "Profil" }} />
    </Tabs>
  );
}