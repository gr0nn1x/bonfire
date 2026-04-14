create extension if not exists "pgcrypto";

create type public.muscle_group as enum (
  'chest',
  'back',
  'legs',
  'shoulders',
  'arms',
  'core',
  'full_body',
  'cardio'
);

create type public.friendship_status as enum ('pending', 'accepted');

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  bio text,
  avatar_url text,
  strength_points integer not null default 0 check (strength_points >= 0),
  level integer not null default 1 check (level >= 1),
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  muscle_group public.muscle_group not null,
  description text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  is_public boolean not null default false,
  duration_weeks integer not null default 1 check (duration_weeks >= 1),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.plan_days (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.workout_plans (id) on delete cascade,
  day_number integer not null check (day_number >= 1),
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  sets integer not null check (sets >= 1),
  reps integer not null check (reps >= 1),
  weight numeric(6,2) not null default 0 check (weight >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  unique (plan_id, day_number, exercise_id)
);

create table if not exists public.user_schedule (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_id uuid not null references public.workout_plans (id) on delete cascade,
  start_date date not null,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, plan_id, start_date)
);

create table if not exists public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  date timestamptz not null default timezone('utc', now()),
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  weight_lifted numeric(6,2) not null check (weight_lifted >= 0),
  reps_done integer not null check (reps_done >= 1),
  volume numeric generated always as (weight_lifted * reps_done) stored,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.friendships (
  user_id uuid not null references public.profiles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  title text not null unique,
  description text not null,
  icon_url text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  unlocked_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, achievement_id)
);

create table if not exists public.activity_feed (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_type text not null,
  title text not null,
  body text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_workout_plans_public
  on public.workout_plans (is_public, created_at desc);

create index if not exists idx_plan_days_plan
  on public.plan_days (plan_id, day_number);

create index if not exists idx_user_schedule_user_active
  on public.user_schedule (user_id, active);

create index if not exists idx_workout_logs_user_date
  on public.workout_logs (user_id, date desc);

create index if not exists idx_friendships_friend
  on public.friendships (friend_id, status);

create index if not exists idx_activity_feed_created
  on public.activity_feed (created_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_workout_plans_updated_at on public.workout_plans;
create trigger set_workout_plans_updated_at
  before update on public.workout_plans
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_friendships_updated_at on public.friendships;
create trigger set_friendships_updated_at
  before update on public.friendships
  for each row execute procedure public.set_updated_at();

create or replace function public.refresh_strength_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user uuid;
  total_volume numeric;
  computed_points integer;
begin
  target_user := coalesce(new.user_id, old.user_id);

  select coalesce(sum(volume), 0)
  into total_volume
  from public.workout_logs
  where user_id = target_user;

  computed_points := floor(total_volume / 10.0);

  update public.profiles
  set
    strength_points = computed_points,
    level = greatest(1, floor(computed_points / 1000.0) + 1)
  where id = target_user;

  return coalesce(new, old);
end;
$$;

drop trigger if exists workout_logs_refresh_strength_points on public.workout_logs;
create trigger workout_logs_refresh_strength_points
  after insert or update or delete on public.workout_logs
  for each row execute procedure public.refresh_strength_points();

create or replace function public.create_pr_feed_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_best numeric;
  exercise_name text;
begin
  select max(weight_lifted)
  into previous_best
  from public.workout_logs
  where user_id = new.user_id
    and exercise_id = new.exercise_id
    and id <> new.id;

  if previous_best is null or new.weight_lifted > previous_best then
    select name into exercise_name
    from public.exercises
    where id = new.exercise_id;

    insert into public.activity_feed (user_id, event_type, title, body, metadata)
    values (
      new.user_id,
      'personal_record',
      'Novy osobak',
      coalesce(exercise_name, 'Cviku') || ' - ' || new.weight_lifted || ' kg',
      jsonb_build_object(
        'exercise_id', new.exercise_id,
        'weight_lifted', new.weight_lifted,
        'reps_done', new.reps_done
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists workout_logs_create_pr_feed on public.workout_logs;
create trigger workout_logs_create_pr_feed
  after insert on public.workout_logs
  for each row execute procedure public.create_pr_feed_event();

alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_plans enable row level security;
alter table public.plan_days enable row level security;
alter table public.user_schedule enable row level security;
alter table public.workout_logs enable row level security;
alter table public.friendships enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.activity_feed enable row level security;

create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

create policy "Exercises are readable by authenticated users"
  on public.exercises for select
  to authenticated
  using (true);

create policy "Authenticated users can read public plans or their own"
  on public.workout_plans for select
  to authenticated
  using (is_public or creator_id = auth.uid());

create policy "Users can manage own workout plans"
  on public.workout_plans for all
  to authenticated
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid());

create policy "Users can read plan days for visible plans"
  on public.plan_days for select
  to authenticated
  using (
    exists (
      select 1
      from public.workout_plans wp
      where wp.id = plan_id
        and (wp.is_public or wp.creator_id = auth.uid())
    )
  );

create policy "Users can manage plan days for owned plans"
  on public.plan_days for all
  to authenticated
  using (
    exists (
      select 1
      from public.workout_plans wp
      where wp.id = plan_id
        and wp.creator_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.workout_plans wp
      where wp.id = plan_id
        and wp.creator_id = auth.uid()
    )
  );

create policy "Users can manage own schedule"
  on public.user_schedule for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can manage own workout logs"
  on public.workout_logs for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can read own and friends accepted relationships"
  on public.friendships for select
  to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid());

create policy "Users can create friendship requests"
  on public.friendships for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update friendship rows they belong to"
  on public.friendships for update
  to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid());

create policy "Achievements are globally readable"
  on public.achievements for select
  to authenticated
  using (true);

create policy "Users can read own achievements"
  on public.user_achievements for select
  to authenticated
  using (user_id = auth.uid());

create policy "Service role manages user achievements"
  on public.user_achievements for insert
  to service_role
  with check (true);

create policy "Users can read feed events"
  on public.activity_feed for select
  to authenticated
  using (true);
