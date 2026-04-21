<div align="center">
  <img src="http://googleusercontent.com/image_generation_content/6" alt="Bonfire Fitness Logo" width="200" style="border-radius: 20px; margin-bottom: 20px;" />
  
  # Bonfire Fitness

  **Nekompromisní tréninkový deník pro silový trénink.**
</div>

---

## O projektu

Bonfire Fitness je multiplatformní aplikace (iOS, Android, Web) vytvořená pro kompletní správu a tracking silových tréninků. Aplikace klade důraz na čisté uživatelské rozhraní, rychlé zadávání dat během cvičení a vizuálně atraktivní dark mode design, který neruší při tréninku.

## Hlavní funkce

* **Management tréninků:** Prohlížení a úprava předpřipravených tréninkových šablon a cílů.
* **Aktivní trénink (Live Tracking):** Interaktivní rozhraní pro aktuální trénink s možností odškrtávání sérií, zápisu reálných vah, počtu opakování a RPE (náročnosti).
* **Úpravy za pochodu:** Integrovaný systém pro okamžité vyhledávání a přidávání extra cviků do právě probíhajícího tréninku bez trvalého narušení uložené šablony.
* **Databáze cviků:** Kategorizovaný seznam dostupných cviků s možností filtrování.
* **Historie a logování:** Bezpečné ukládání kompletních logů do cloudové databáze pro pozdější analýzu progresu.

## Tech Stack

* **Frontend:** React Native & Expo (EAS Build)
* **Styling:** NativeWind (Tailwind CSS)
* **Backend & Databáze:** Supabase (PostgreSQL)
* **Správa balíčků:** Yarn (vynuceno přes resolutions pro stabilitu webových buildů)
* **Web Deployment:** Vercel

---

## Místní vývoj a spuštění

Pro spuštění projektu na vašem lokálním počítači postupujte podle následujících kroků.

### 1. Naklonování repozitáře
```bash
git clone [https://github.com/gr0nn1x/bonfire.git](https://github.com/gr0nn1x/bonfire.git)
cd bonfire
