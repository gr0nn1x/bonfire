import { Tabs, Redirect } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { ActivityIndicator, View } from "react-native";
import { Activity } from 'lucide-react-native';
import { useLanguage } from "@/hooks/useLanguage";

export default function TabsLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const { language } = useLanguage();
  const isCs = language === "cs";

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
      <Tabs.Screen name="index" options={{ title: isCs ? "Domů" : "Home" }} />
      <Tabs.Screen name="plans" options={{ title: isCs ? "Plány" : "Plans" }} />
      <Tabs.Screen name="stats" options={{ title: isCs ? "Statistiky" : "Stats" }} />
       <Tabs.Screen
        name="feed"
        options={{
          title: isCs ? 'Komunita' : 'Feed',
          tabBarIcon: ({ color }) => <Activity size={24} color={color} />,
        }}
      />
      <Tabs.Screen name="profile" options={{ title: isCs ? "Profil" : "Profile" }} />
    </Tabs>
  );
}
