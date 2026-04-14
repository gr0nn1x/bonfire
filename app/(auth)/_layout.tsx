import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#0f172a" },
        headerTintColor: "#f8fafc",
        contentStyle: { backgroundColor: "#0f172a" },
      }}
    >
      <Stack.Screen name="sign-in" options={{ title: "Prihlaseni" }} />
    </Stack>
  );
}
