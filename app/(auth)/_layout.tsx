import { Stack, Redirect } from "expo-router";
import { useAuth } from "@/hooks/useAuth";

export default function AuthLayout() {
  const { isAuthenticated } = useAuth();

  // POKUD UŽ JSI PŘIHLÁŠEN -> ŠUP DO APPKY
  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#0f172a" },
        headerTintColor: "#f8fafc",
        contentStyle: { backgroundColor: "#0f172a" },
      }}
    >
      <Stack.Screen name="sign-in" options={{ title: "Přihlášení" }} />
    </Stack>
  );
}