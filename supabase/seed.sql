insert into public.exercises (name, muscle_group, description)
values
  ('Bench Press', 'chest', 'Zakladni tlakovy cvik na prsa.'),
  ('Back Squat', 'legs', 'Zakladni drep s cinkou na zadech.'),
  ('Deadlift', 'back', 'Tahovy cvik pro zada, hýzde a zadni retezec.'),
  ('Overhead Press', 'shoulders', 'Tlaky nad hlavou ve stoje.'),
  ('Barbell Row', 'back', 'Predkloneny pritah s velkou cinkou.'),
  ('Pull-Up', 'back', 'Shyb nadhmatem.'),
  ('Dip', 'chest', 'Kliky na bradlech.'),
  ('Walking Lunge', 'legs', 'Vypady v chuzi.'),
  ('Romanian Deadlift', 'legs', 'Rumunsky mrtvy tah pro hamstringy.'),
  ('Plank', 'core', 'Izometricky cvik pro stred tela.')
on conflict (name) do nothing;
