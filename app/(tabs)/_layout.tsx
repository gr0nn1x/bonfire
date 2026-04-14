import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#0f172a" },
        headerTintColor: "#f8fafc",
        tabBarStyle: {
          backgroundColor: "#111827",
          borderTopColor: "#334155",
        },
        tabBarActiveTintColor: "#f97316",
        tabBarInactiveTintColor: "#94a3b8",
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Domu" }} />
      <Tabs.Screen name="plans" options={{ title: "Plány" }} />
      <Tabs.Screen name="profile" options={{ title: "Profil" }} />
    </Tabs>
  );
}
