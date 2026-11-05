ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_home_city_format
  CHECK (
    home_city IS NULL
    OR (
      char_length(btrim(home_city)) BETWEEN 2 AND 80
      AND home_city ~ '^[[:alpha:]][[:alpha:][:space:].''\-]*$'
    )
  );