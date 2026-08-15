
UPDATE public.leagues SET name = 'Rose', slug = 'rose' WHERE tier = 4;

CREATE UNIQUE INDEX IF NOT EXISTS xp_events_user_source_key_uidx
  ON public.xp_events (user_id, source_key) WHERE source_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.award_xp(_kind text, _amount integer, _source_key text DEFAULT NULL)
RETURNS TABLE (awarded integer, total_xp integer, current_streak integer, streak_incremented boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _inserted boolean := false;
  _total integer := 0;
  _streak integer := 0;
  _bumped boolean := false;
  _today date := (now() AT TIME ZONE 'UTC')::date;
  _last date;
  _season uuid;
  _league uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _amount IS NULL OR _amount < 0 OR _amount > 500 THEN RAISE EXCEPTION 'invalid amount'; END IF;

  IF _source_key IS NULL THEN
    INSERT INTO public.xp_events (user_id, kind, amount, source_key) VALUES (_uid, _kind, _amount, NULL);
    _inserted := true;
  ELSE
    INSERT INTO public.xp_events (user_id, kind, amount, source_key)
    VALUES (_uid, _kind, _amount, _source_key)
    ON CONFLICT (user_id, source_key) WHERE source_key IS NOT NULL DO NOTHING;
    _inserted := FOUND;
  END IF;

  IF _inserted AND _amount > 0 THEN
    UPDATE public.profiles SET xp = xp + _amount, updated_at = now() WHERE id = _uid RETURNING xp INTO _total;

    SELECT id INTO _season FROM public.league_seasons WHERE is_active ORDER BY starts_at DESC LIMIT 1;
    SELECT league_id INTO _league FROM public.profiles WHERE id = _uid;
    IF _season IS NOT NULL AND _league IS NOT NULL THEN
      INSERT INTO public.leaderboard_entries (season_id, user_id, league_id, xp)
      VALUES (_season, _uid, _league, _amount)
      ON CONFLICT (season_id, user_id) DO UPDATE SET xp = public.leaderboard_entries.xp + EXCLUDED.xp, updated_at = now();
    END IF;
  ELSE
    SELECT xp INTO _total FROM public.profiles WHERE id = _uid;
  END IF;

  INSERT INTO public.streaks (user_id, current_streak, longest_streak, last_activity_date)
  VALUES (_uid, 0, 0, NULL)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT last_activity_date INTO _last FROM public.streaks WHERE user_id = _uid;
  IF _last IS DISTINCT FROM _today THEN
    UPDATE public.streaks
      SET current_streak = CASE WHEN _last = _today - 1 THEN current_streak + 1 ELSE 1 END,
          longest_streak = GREATEST(longest_streak, CASE WHEN _last = _today - 1 THEN current_streak + 1 ELSE 1 END),
          last_activity_date = _today,
          updated_at = now()
    WHERE user_id = _uid
    RETURNING current_streak INTO _streak;
    INSERT INTO public.streak_days (user_id, day) VALUES (_uid, _today) ON CONFLICT DO NOTHING;
    _bumped := true;
  ELSE
    SELECT current_streak INTO _streak FROM public.streaks WHERE user_id = _uid;
  END IF;

  RETURN QUERY SELECT CASE WHEN _inserted THEN _amount ELSE 0 END, COALESCE(_total, 0), COALESCE(_streak, 0), _bumped;
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_xp(text, integer, text) TO authenticated;

-- Seeded public content owned by the hidden admin account
INSERT INTO public.series (id, owner_id, title, description, topic, subject, cover_gradient, status, is_public, episode_count) VALUES
  ('11111111-1111-4111-8111-000000000001', '185fadaa-54e3-402d-93b0-2a0db8b44cab', 'Cells, Decoded', 'A three-part binge through the machinery of life.', 'Cell biology', 'Biology', 'from-violet-500/40 to-fuchsia-500/20', 'ready', true, 3),
  ('11111111-1111-4111-8111-000000000002', '185fadaa-54e3-402d-93b0-2a0db8b44cab', 'Algebra, Rewired', 'Equations finally start making sense.', 'Linear equations', 'Mathematics', 'from-indigo-500/40 to-sky-500/20', 'ready', true, 3),
  ('11111111-1111-4111-8111-000000000003', '185fadaa-54e3-402d-93b0-2a0db8b44cab', 'World War I: The Spark', 'How one summer redrew the map of the world.', 'World War I', 'History', 'from-rose-500/35 to-amber-500/20', 'ready', true, 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.episodes (id, series_id, owner_id, order_index, title, synopsis, duration_seconds) VALUES
  ('22222222-2222-4222-8222-000000000101', '11111111-1111-4111-8111-000000000001', '185fadaa-54e3-402d-93b0-2a0db8b44cab', 1, 'The Cell as a City', 'Meet the organelles and the jobs they hold down.', 300),
  ('22222222-2222-4222-8222-000000000102', '11111111-1111-4111-8111-000000000001', '185fadaa-54e3-402d-93b0-2a0db8b44cab', 2, 'Power Plants and Pipelines', 'Mitochondria, ATP and how energy actually moves.', 300),
  ('22222222-2222-4222-8222-000000000103', '11111111-1111-4111-8111-000000000001', '185fadaa-54e3-402d-93b0-2a0db8b44cab', 3, 'Copying the Blueprint', 'DNA replication and the elegance of mitosis.', 300),
  ('22222222-2222-4222-8222-000000000201', '11111111-1111-4111-8111-000000000002', '185fadaa-54e3-402d-93b0-2a0db8b44cab', 1, 'What an Equation Really Says', 'Balance, not magic.', 300),
  ('22222222-2222-4222-8222-000000000202', '11111111-1111-4111-8111-000000000002', '185fadaa-54e3-402d-93b0-2a0db8b44cab', 2, 'Solving in Two Moves', 'Isolate, simplify, check.', 300),
  ('22222222-2222-4222-8222-000000000203', '11111111-1111-4111-8111-000000000002', '185fadaa-54e3-402d-93b0-2a0db8b44cab', 3, 'Lines You Can See', 'Slope, intercept and graphing with confidence.', 300),
  ('22222222-2222-4222-8222-000000000301', '11111111-1111-4111-8111-000000000003', '185fadaa-54e3-402d-93b0-2a0db8b44cab', 1, 'A Continent of Alliances', 'Why Europe was a loaded spring in 1914.', 300),
  ('22222222-2222-4222-8222-000000000302', '11111111-1111-4111-8111-000000000003', '185fadaa-54e3-402d-93b0-2a0db8b44cab', 2, 'Sarajevo, June 1914', 'One motorcade, one wrong turn.', 300),
  ('22222222-2222-4222-8222-000000000303', '11111111-1111-4111-8111-000000000003', '185fadaa-54e3-402d-93b0-2a0db8b44cab', 3, 'Life in the Trenches', 'What the war felt like at ground level.', 300)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.episode_slides (episode_id, order_index, title, bullets, takeaway) VALUES
  ('22222222-2222-4222-8222-000000000101', 0, 'Welcome to the cell', '["Every living thing is built from cells","Cells are organised, not random","Structure always follows function"]'::jsonb, 'A cell is a tiny, tightly run city.'),
  ('22222222-2222-4222-8222-000000000101', 1, 'City hall: the nucleus', '["Holds DNA, the master instructions","Controls which proteins get made","Wrapped in a double membrane"]'::jsonb, 'The nucleus decides, it does not build.'),
  ('22222222-2222-4222-8222-000000000101', 2, 'Factories and roads', '["Ribosomes assemble proteins","The ER folds and ships them","Golgi labels and sends packages"]'::jsonb, 'Proteins are made, folded, then delivered.'),
  ('22222222-2222-4222-8222-000000000101', 3, 'Walls and waste', '["The membrane chooses what enters","Lysosomes recycle broken parts","Cytoskeleton holds the shape"]'::jsonb, 'Borders and cleanup keep the city alive.'),
  ('22222222-2222-4222-8222-000000000102', 0, 'Energy has a currency', '["ATP is the cell\u2019s cash","Food is not usable directly","Energy must be converted"]'::jsonb, 'Cells spend ATP, not sugar.'),
  ('22222222-2222-4222-8222-000000000102', 1, 'Inside the mitochondrion', '["Folded inner membrane = more surface","Cristae host the electron chain","More energy demand = more mitochondria"]'::jsonb, 'Folds mean throughput.'),
  ('22222222-2222-4222-8222-000000000102', 2, 'Respiration in three acts', '["Glycolysis splits glucose","Krebs cycle harvests carriers","Electron transport makes most ATP"]'::jsonb, 'Three linked stages, one payoff.'),
  ('22222222-2222-4222-8222-000000000102', 3, 'When oxygen runs out', '["Fermentation keeps glycolysis going","Far less ATP per glucose","Lactate builds up in muscle"]'::jsonb, 'No oxygen means a worse exchange rate.'),
  ('22222222-2222-4222-8222-000000000103', 0, 'Why copy at all', '["Growth needs new cells","Damaged cells get replaced","Each new cell needs full DNA"]'::jsonb, 'Copy first, divide second.'),
  ('22222222-2222-4222-8222-000000000103', 1, 'Unzip and rebuild', '["Helicase separates the strands","Polymerase adds matching bases","Base pairing keeps it accurate"]'::jsonb, 'Complementary bases make copying reliable.'),
  ('22222222-2222-4222-8222-000000000103', 2, 'Mitosis, stage by stage', '["Prophase: chromosomes condense","Metaphase: they line up","Anaphase and telophase: split and finish"]'::jsonb, 'Line up, pull apart, wrap up.'),
  ('22222222-2222-4222-8222-000000000103', 3, 'Checkpoints matter', '["Cells pause to check for errors","Mistakes can cause disease","Repair beats replication speed"]'::jsonb, 'Accuracy is worth the wait.'),
  ('22222222-2222-4222-8222-000000000201', 0, 'An equation is a balance', '["Both sides must stay equal","Whatever you do, do to both sides","The equals sign is a promise"]'::jsonb, 'Keep the scale level.'),
  ('22222222-2222-4222-8222-000000000201', 1, 'Variables are placeholders', '["x is a number you do not know yet","Letters are not scary, just unknown","Solving = revealing the number"]'::jsonb, 'x is a name, not a mystery.'),
  ('22222222-2222-4222-8222-000000000201', 2, 'Inverse operations', '["Addition undoes subtraction","Multiplication undoes division","Undo in reverse order"]'::jsonb, 'Peel the onion backwards.'),
  ('22222222-2222-4222-8222-000000000201', 3, 'Always check', '["Substitute your answer back","If both sides match, you are right","Checking is not optional"]'::jsonb, 'A checked answer is a finished answer.'),
  ('22222222-2222-4222-8222-000000000202', 0, 'Simplify first', '["Combine like terms","Clear brackets carefully","Fewer terms, fewer mistakes"]'::jsonb, 'Tidy before you solve.'),
  ('22222222-2222-4222-8222-000000000202', 1, 'Isolate the variable', '["Move constants away first","Then remove coefficients","One clean step at a time"]'::jsonb, 'Get x alone, then read the answer.'),
  ('22222222-2222-4222-8222-000000000202', 2, 'Fractions are friendly', '["Multiply through by the denominator","Whole numbers are easier to handle","Keep the balance"]'::jsonb, 'Clear denominators early.'),
  ('22222222-2222-4222-8222-000000000202', 3, 'Common traps', '["Sign errors dominate","Distribute to every term","Do not divide by zero"]'::jsonb, 'Most lost marks are sign slips.'),
  ('22222222-2222-4222-8222-000000000203', 0, 'From equation to picture', '["y = mx + b draws a line","m is steepness","b is where it crosses y"]'::jsonb, 'Two numbers describe a whole line.'),
  ('22222222-2222-4222-8222-000000000203', 1, 'Reading slope', '["Rise over run","Positive climbs, negative falls","Zero slope is flat"]'::jsonb, 'Slope is a rate of change.'),
  ('22222222-2222-4222-8222-000000000203', 2, 'Plot in three steps', '["Start at the intercept","Use slope to step to a second point","Draw the line through both"]'::jsonb, 'Two points are enough.'),
  ('22222222-2222-4222-8222-000000000203', 3, 'Lines that meet', '["Intersection solves both equations","Parallel lines never meet","Same line = infinite solutions"]'::jsonb, 'Graphs make systems visible.'),
  ('22222222-2222-4222-8222-000000000301', 0, 'Europe in 1914', '["Empires competing for power","Rapid industrial and military growth","National pride ran hot"]'::jsonb, 'Tension was structural, not accidental.'),
  ('22222222-2222-4222-8222-000000000301', 1, 'Two alliance blocks', '["Triple Alliance and Triple Entente","A local fight could pull in everyone","Treaties promised support"]'::jsonb, 'Alliances turned a crisis into a war.'),
  ('22222222-2222-4222-8222-000000000301', 2, 'Arms and plans', '["Naval race between Britain and Germany","Pre-written invasion timetables","Mobilisation was hard to reverse"]'::jsonb, 'Rigid plans removed room to pause.'),
  ('22222222-2222-4222-8222-000000000301', 3, 'The Balkans', '["Declining Ottoman power","Competing national ambitions","Called the powder keg of Europe"]'::jsonb, 'The spark had a very likely address.'),
  ('22222222-2222-4222-8222-000000000302', 0, 'A royal visit', '["Franz Ferdinand tours Sarajevo","Security was thin","The date was politically charged"]'::jsonb, 'A risky visit at a bad moment.'),
  ('22222222-2222-4222-8222-000000000302', 1, 'The assassination', '["Gavrilo Princip fires the shots","Both the Archduke and his wife die","Austria blames Serbia"]'::jsonb, 'One act, continental consequences.'),
  ('22222222-2222-4222-8222-000000000302', 2, 'The July Crisis', '["Harsh ultimatum to Serbia","Partial acceptance rejected","Declarations follow in days"]'::jsonb, 'Diplomacy ran out of time.'),
  ('22222222-2222-4222-8222-000000000302', 3, 'Dominoes fall', '["Russia mobilises for Serbia","Germany backs Austria","Britain enters over Belgium"]'::jsonb, 'A regional quarrel became a world war.'),
  ('22222222-2222-4222-8222-000000000303', 0, 'Stalemate', '["Machine guns favour defence","Front lines barely move","Trenches stretch for hundreds of miles"]'::jsonb, 'Technology outran tactics.'),
  ('22222222-2222-4222-8222-000000000303', 1, 'Daily life', '["Mud, rats and constant noise","Rotations between front and reserve","Boredom broken by terror"]'::jsonb, 'Waiting was most of the war.'),
  ('22222222-2222-4222-8222-000000000303', 2, 'New weapons', '["Poison gas and artillery barrages","Tanks arrive late","Aircraft used for scouting"]'::jsonb, 'Industry reshaped the battlefield.'),
  ('22222222-2222-4222-8222-000000000303', 3, 'The cost', '["Millions dead and wounded","Empires collapsed","A fragile peace followed"]'::jsonb, 'The war ended, the consequences did not.')
ON CONFLICT DO NOTHING;

INSERT INTO public.episode_questions (episode_id, order_index, prompt, options, correct_index, explanation, seconds) VALUES
  ('22222222-2222-4222-8222-000000000101', 0, 'Which structure stores the cell''s instructions?', '["Nucleus","Ribosome","Lysosome","Golgi body"]'::jsonb, 0, 'The nucleus holds DNA, the master set of instructions.', 25),
  ('22222222-2222-4222-8222-000000000101', 1, 'What is the main job of the cell membrane?', '["Making energy","Controlling what enters and leaves","Copying DNA","Digesting waste"]'::jsonb, 1, 'The membrane is selectively permeable, so it acts as a gatekeeper.', 25),
  ('22222222-2222-4222-8222-000000000102', 0, 'What molecule do cells actually spend as energy?', '["Glucose","ATP","Oxygen","DNA"]'::jsonb, 1, 'Glucose is fuel, but ATP is the usable currency.', 25),
  ('22222222-2222-4222-8222-000000000102', 1, 'Why is the inner mitochondrial membrane folded?', '["To store DNA","To increase surface area","To keep out oxygen","To make it stronger"]'::jsonb, 1, 'More surface area means more room for energy-releasing reactions.', 25),
  ('22222222-2222-4222-8222-000000000103', 0, 'What separates the two DNA strands before copying?', '["Helicase","Polymerase","Ribosome","Lysosome"]'::jsonb, 0, 'Helicase unwinds and unzips the double helix.', 25),
  ('22222222-2222-4222-8222-000000000103', 1, 'During metaphase, chromosomes...', '["Condense","Line up in the middle","Move apart","Disappear"]'::jsonb, 1, 'Metaphase is the line-up stage before separation.', 25),
  ('22222222-2222-4222-8222-000000000201', 0, 'Solve: x + 7 = 12', '["4","5","19","7"]'::jsonb, 1, 'Subtract 7 from both sides: x = 5.', 20),
  ('22222222-2222-4222-8222-000000000201', 1, 'Doing something to one side of an equation means you must...', '["Do nothing else","Do the same to the other side","Change the variable","Start over"]'::jsonb, 1, 'Equations stay true only if both sides are treated equally.', 20),
  ('22222222-2222-4222-8222-000000000202', 0, 'Solve: 3x = 21', '["6","7","18","24"]'::jsonb, 1, 'Divide both sides by 3: x = 7.', 20),
  ('22222222-2222-4222-8222-000000000202', 1, 'Expand 2(x + 4)', '["2x + 4","2x + 8","x + 8","2x + 6"]'::jsonb, 1, 'Distribute the 2 to both terms: 2x + 8.', 20),
  ('22222222-2222-4222-8222-000000000203', 0, 'In y = mx + b, what does b represent?', '["Slope","y-intercept","x-intercept","Gradient"]'::jsonb, 1, 'b is where the line crosses the y-axis.', 20),
  ('22222222-2222-4222-8222-000000000203', 1, 'A line with slope 0 is...', '["Vertical","Horizontal","Diagonal","Curved"]'::jsonb, 1, 'No rise over any run means a flat, horizontal line.', 20),
  ('22222222-2222-4222-8222-000000000301', 0, 'Which region was known as the powder keg of Europe?', '["Scandinavia","The Balkans","Iberia","The Baltics"]'::jsonb, 1, 'Competing ambitions and declining Ottoman power made the Balkans volatile.', 25),
  ('22222222-2222-4222-8222-000000000301', 1, 'Alliances made war more likely because they...', '["Reduced armies","Pulled many countries into one dispute","Ended treaties","Slowed mobilisation"]'::jsonb, 1, 'A local conflict triggered obligations across the continent.', 25),
  ('22222222-2222-4222-8222-000000000302', 0, 'Who was assassinated in Sarajevo in 1914?', '["Kaiser Wilhelm II","Archduke Franz Ferdinand","Tsar Nicholas II","Gavrilo Princip"]'::jsonb, 1, 'The heir to the Austro-Hungarian throne was killed on 28 June 1914.', 25),
  ('22222222-2222-4222-8222-000000000302', 1, 'Britain entered the war chiefly over the invasion of...', '["Serbia","Belgium","Russia","Italy"]'::jsonb, 1, 'Britain had guaranteed Belgian neutrality.', 25),
  ('22222222-2222-4222-8222-000000000303', 0, 'Why did the Western Front become a stalemate?', '["Poor weather","Defensive weapons outclassed attacks","No soldiers","Lack of maps"]'::jsonb, 1, 'Machine guns and artillery made attacking across open ground brutal.', 25),
  ('22222222-2222-4222-8222-000000000303', 1, 'Which weapon arrived late in the war?', '["Machine gun","Tank","Artillery","Rifle"]'::jsonb, 1, 'Tanks appeared from 1916 and were unreliable at first.', 25)
ON CONFLICT DO NOTHING;
