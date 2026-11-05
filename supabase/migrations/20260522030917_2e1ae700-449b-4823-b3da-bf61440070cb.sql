
CREATE OR REPLACE FUNCTION public.redeem_reward(_reward_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cost integer;
  v_available boolean;
  v_new_points integer;
  v_redemption_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT points_cost, available INTO v_cost, v_available
  FROM public.rewards
  WHERE id = _reward_id
  FOR UPDATE;

  IF v_cost IS NULL THEN
    RAISE EXCEPTION 'Reward not found';
  END IF;
  IF NOT v_available THEN
    RAISE EXCEPTION 'Reward is not available';
  END IF;

  -- Atomic conditional deduction: only updates if enough points
  UPDATE public.profiles
  SET green_points = green_points - v_cost,
      updated_at = now()
  WHERE user_id = v_uid
    AND green_points >= v_cost
  RETURNING green_points INTO v_new_points;

  IF v_new_points IS NULL THEN
    RAISE EXCEPTION 'Insufficient points';
  END IF;

  INSERT INTO public.reward_redemptions (user_id, reward_id, points_spent)
  VALUES (v_uid, _reward_id, v_cost)
  RETURNING id INTO v_redemption_id;

  RETURN jsonb_build_object(
    'redemption_id', v_redemption_id,
    'new_balance', v_new_points,
    'points_spent', v_cost
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid) TO authenticated;
