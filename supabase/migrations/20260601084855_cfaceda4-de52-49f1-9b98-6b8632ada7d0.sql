UPDATE public.events SET
  total_sales = ROUND((COALESCE(net_sales,0) + COALESCE(gst_amount,0))::numeric, 2),
  total_revenue = ROUND((COALESCE(net_sales,0) + COALESCE(gst_amount,0))::numeric, 2),
  total_cost = ROUND((COALESCE(cogs,0) + COALESCE(other_consumables,0) + COALESCE(wastages_variance,0)
    + COALESCE(manpower_cost,0) + COALESCE(logistic_expense,0) + COALESCE(staff_food_expense,0)
    + COALESCE(local_purchase,0) + COALESCE(rent_commission,0) + COALESCE(miscellaneous_expense,0))::numeric, 2),
  total_expenses = ROUND((COALESCE(cogs,0) + COALESCE(manpower_cost,0) + COALESCE(logistic_expense,0)
    + COALESCE(staff_food_expense,0) + COALESCE(local_purchase,0)
    + COALESCE(rent_commission,0) + COALESCE(miscellaneous_expense,0))::numeric, 2),
  ebitda = ROUND(((COALESCE(net_sales,0) + COALESCE(gst_amount,0))
    - (COALESCE(cogs,0) + COALESCE(manpower_cost,0) + COALESCE(logistic_expense,0)
      + COALESCE(staff_food_expense,0) + COALESCE(local_purchase,0)
      + COALESCE(rent_commission,0) + COALESCE(miscellaneous_expense,0)))::numeric, 2),
  ebitda_percent = CASE
    WHEN (COALESCE(net_sales,0) + COALESCE(gst_amount,0)) > 0
    THEN ROUND((((COALESCE(net_sales,0) + COALESCE(gst_amount,0))
      - (COALESCE(cogs,0) + COALESCE(manpower_cost,0) + COALESCE(logistic_expense,0)
        + COALESCE(staff_food_expense,0) + COALESCE(local_purchase,0)
        + COALESCE(rent_commission,0) + COALESCE(miscellaneous_expense,0)))
      / (COALESCE(net_sales,0) + COALESCE(gst_amount,0)) * 100)::numeric, 2)
    ELSE 0
  END;
