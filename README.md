# Bonfire Fitness

Starter pro multiplatformni fitness appku nad Expo, Supabase, NativeWind a TanStack Query.

## Co je hotove

- Expo Router skeleton s `auth` a `tabs` flow
- Strict TypeScript konfigurace
- NativeWind styling
- Supabase Auth helpery
- SQL schema pro Supabase
- Zakladni obrazovka pro tvorbu workout planu

## Rychly start

1. Nainstaluj Node.js 20 LTS.
2. V repu spust `npm install`.
3. Zkopiruj `.env.example` do `.env`.
4. Vypln `EXPO_PUBLIC_SUPABASE_URL` a `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
5. V Supabase SQL editoru spust obsah `supabase/schema.sql`.
6. V Supabase Authentication zapni Email provider.
7. Spust `npm run start`.

## Co zalozit v Supabase

1. Jdi na [https://supabase.com](https://supabase.com) a vytvor projekt.
2. Pockej, az projekt dobehne.
3. V menu otevri `Project Settings > API`.
4. Zkopiruj `Project URL` a `anon public key`.
5. Vloz je do `.env`.

## Doporucene dalsi kroky

1. Vlozit seed cviku do `exercises`.
2. Pridat seznam cviku misto rucniho zadavani `exercise_id`.
3. Pridat workout logger s realtime seriemi.
4. Pridat leaderboard a social feed.
5. Pridat heatmapu a 1RM grafy.
