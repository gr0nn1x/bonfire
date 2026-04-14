import { supabase } from "@/lib/supabase";

export interface AuthCredentials {
  username: string;
  password: string;
  // Kept for registration UI; current implementation uses username-only login
  // by mapping username -> synthetic email internally.
  email?: string;
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function usernameToEmail(username: string) {
  const normalized = normalizeUsername(username);
  if (!normalized) {
    throw new Error("Vypln uzivatelske jmeno.");
  }
  // Supabase email/password auth requires an email. We use a synthetic email
  // so users can log in with just username + password.
  return `${normalized}@bonfire.local`;
}

function getAuthErrorMessage(error: unknown) {
  const rawMessage =
    error instanceof Error ? error.message : "Nepodarilo se dokoncit prihlaseni.";
  const normalized = rawMessage.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Nespravny email nebo heslo.";
  }

  if (
    normalized.includes("email not confirmed") ||
    normalized.includes("not confirmed")
  ) {
    return "Prihlaseni nejde, protoze je zapnute overovani emailu. V Supabase vypni Email confirmations.";
  }

  if (normalized.includes("already registered")) {
    return "Uzivatelske jmeno uz existuje.";
  }

  if (
    normalized.includes("password should be at least") ||
    normalized.includes("password is too short")
  ) {
    return "Heslo musi mit alespon 6 znaku.";
  }

  if (normalized.includes("invalid email")) {
    return "Uzivatelske jmeno neni platne.";
  }

  if (
    normalized.includes("rate limit") ||
    normalized.includes("email rate") ||
    normalized.includes("over_email_send_rate") ||
    normalized.includes("too many requests")
  ) {
    return "Supabase docasne omezil odesilani emailu (limit prihlaseni/registraci). Zkus to za chvili, nebo v Supabase Authentication vypni potvrzeni emailu, aby se pri registraci nic neposilalo.";
  }

  return rawMessage;
}

export async function signUp({
  email,
  username,
  password,
}: AuthCredentials) {
  const authEmail = email?.trim()
    ? email.trim().toLowerCase()
    : usernameToEmail(username);
  const { data, error } = await supabase.auth.signUp({
    email: authEmail,
    password,
    options: {
      data: {
        username,
      },
    },
  });

  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }

  return data;
}

async function resolveEmailForUsernameLogin(username: string) {
  const normalized = normalizeUsername(username);
  const { data, error } = await supabase.rpc("get_auth_email_for_username", {
    p_username: normalized,
  });

  if (!error && typeof data === "string" && data.length > 0) {
    return data;
  }

  return usernameToEmail(username);
}

export async function signUpAndSignIn(credentials: AuthCredentials) {
  const signUpData = await signUp(credentials);

  if (signUpData.session) {
    return signUpData;
  }

  // If email confirmations are disabled (as requested), Supabase will allow
  // signing in immediately even if the signup call didn't include a session.
  return await signIn(credentials);
}

export async function signIn({ username, password }: AuthCredentials) {
  const email = await resolveEmailForUsernameLogin(username);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }

  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(getAuthErrorMessage(error));
  }
}
