import type { Database } from "@/integrations/supabase/types";

export type EventRow = Database["public"]["Tables"]["events"]["Row"];

type EventFinancialInput = {
  adjustment?: number | null;
  advanceReceived?: string | null;
  advance_received?: string | null;
  cash_deposit?: number | null;
  cashDeposit?: number | null;
  cogs?: number | null;
  commission_amount?: number | null;
  commissionAmount?: number | null;
  commission_paid_from_sale?: boolean | null;
  commissionPaidFromSale?: boolean | null;
  commission_rent_with_invoice?: number | null;
  commissionRentWithInvoice?: number | null;
  commission_rent_without_invoice?: number | null;
  commissionRentWithoutInvoice?: number | null;
  paytm_commission?: number | null;
  paytmCommission?: number | null;
  ebitda?: number | null;
  event_name?: string | null;
  full_payment_received?: boolean | null;
  fullPaymentReceived?: boolean | null;
  gst_amount?: number | null;
  gstAmount?: number | null;
  id?: string;
  local_purchase?: number | null;
  logistic_expense?: number | null;
  manpower_cost?: number | null;
  miscellaneous_expense?: number | null;
  net_sales?: number | null;
  netSales?: number | null;
  online_payment?: number | null;
  onlinePayment?: number | null;
  other_consumables?: number | null;
  outstanding?: number | null;
  rent_commission?: number | null;
  staff_food_expense?: number | null;
  total_cost?: number | null;
  total_paid?: number | null;
  total_payment_received?: number | null;
  totalPayment?: number | null;
  totalPaymentReceived?: number | null;
  total_sales?: number | null;
  totalSales?: number | null;
  wastages_variance?: number | null;
};

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const numberFrom = (...values: Array<number | null | undefined>) => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return 0;
};

const booleanFrom = (...values: Array<boolean | null | undefined>) => {
  for (const value of values) {
    if (typeof value === "boolean") return value;
  }
  return false;
};

const stringFrom = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value === "string") return value;
  }
  return "";
};

export function calculateOutstanding(event: EventFinancialInput) {
  const totalSales = numberFrom(
    event.totalSales,
    event.total_sales,
    numberFrom(event.netSales, event.net_sales) + numberFrom(event.gstAmount, event.gst_amount),
  );
  const receivedAmount = numberFrom(
    event.totalPaymentReceived,
    event.total_payment_received,
    event.totalPayment,
    event.total_paid,
    numberFrom(event.cashDeposit, event.cash_deposit) + numberFrom(event.onlinePayment, event.online_payment),
  );
  const adjustment = numberFrom(event.adjustment);
  const commissionAmount = booleanFrom(event.commissionPaidFromSale, event.commission_paid_from_sale)
    ? numberFrom(event.commissionAmount, event.commission_amount)
    : 0;
  const commissionWithInvoice = numberFrom(event.commissionRentWithInvoice, event.commission_rent_with_invoice);
  const commissionWithoutInvoice = numberFrom(event.commissionRentWithoutInvoice, event.commission_rent_without_invoice);
  const paytmCommission = numberFrom(event.paytmCommission, event.paytm_commission);

  if (booleanFrom(event.fullPaymentReceived, event.full_payment_received)) return 0;

  return Math.max(
    round2(totalSales - receivedAmount - commissionAmount - commissionWithInvoice - commissionWithoutInvoice - paytmCommission - adjustment),
    0,
  );
}

export function calculateEventFinancials(event: EventFinancialInput) {
  const totalSales = round2(
    numberFrom(
      event.totalSales,
      event.total_sales,
      numberFrom(event.netSales, event.net_sales) + numberFrom(event.gstAmount, event.gst_amount),
    ),
  );
  const totalCost = round2(
    numberFrom(
      event.total_cost,
      numberFrom(event.cogs),
      numberFrom(event.cogs) +
        numberFrom(event.other_consumables) +
        numberFrom(event.wastages_variance) +
        numberFrom(event.manpower_cost) +
        numberFrom(event.logistic_expense) +
        numberFrom(event.staff_food_expense) +
        numberFrom(event.local_purchase) +
        numberFrom(event.rent_commission) +
        numberFrom(event.miscellaneous_expense),
    ),
  );
  const ebitda = round2(numberFrom(event.netSales, event.net_sales) - totalCost);
  const ebitdaPercent = numberFrom(event.netSales, event.net_sales) > 0
    ? round2((ebitda / numberFrom(event.netSales, event.net_sales)) * 100)
    : 0;
  const totalPayment = round2(
    numberFrom(
      event.totalPaymentReceived,
      event.total_payment_received,
      event.totalPayment,
      event.total_paid,
      numberFrom(event.cashDeposit, event.cash_deposit) + numberFrom(event.onlinePayment, event.online_payment),
    ),
  );
  const outstanding = calculateOutstanding({ ...event, totalSales, totalPaymentReceived: totalPayment });
  const paymentStatus = booleanFrom(event.fullPaymentReceived, event.full_payment_received)
    ? "Full Paid"
    : totalPayment > 0 || stringFrom(event.advanceReceived, event.advance_received) === "Yes"
      ? "Partial"
      : "Pending";

  return {
    totalSales,
    totalCost,
    ebitda,
    ebitdaPercent,
    totalPayment,
    outstanding,
    paymentStatus,
  };
}

export function normalizeEventFinancials<T extends Partial<EventRow>>(event: T) {
  const financials = calculateEventFinancials(event);

  return {
    ...event,
    ebitda: financials.ebitda,
    ebitda_percent: financials.ebitdaPercent,
    outstanding: financials.outstanding,
    payment_status: financials.paymentStatus,
    profit: financials.ebitda,
    total_expenses: financials.totalCost,
    total_paid: financials.totalPayment,
    total_payment_received: financials.totalPayment,
    total_revenue: financials.totalSales,
    total_sales: financials.totalSales,
  };
}

export function logOutstandingMismatch(context: string, event: EventFinancialInput) {
  if (!import.meta.env.DEV) return;

  const calculatedOutstanding = calculateOutstanding(event);
  const databaseOutstanding = round2(numberFrom(event.outstanding));

  if (Math.abs(calculatedOutstanding - databaseOutstanding) < 0.01) return;

  console.debug(`[events:${context}] outstanding mismatch`, {
    adjustment: numberFrom(event.adjustment),
    calculated_outstanding: calculatedOutstanding,
    database_outstanding: databaseOutstanding,
    eventId: event.id,
    eventName: event.event_name,
    paid_amount: numberFrom(
      event.totalPaymentReceived,
      event.total_payment_received,
      event.totalPayment,
      event.total_paid,
      numberFrom(event.cashDeposit, event.cash_deposit) + numberFrom(event.onlinePayment, event.online_payment),
    ),
    total_sales: numberFrom(
      event.totalSales,
      event.total_sales,
      numberFrom(event.netSales, event.net_sales) + numberFrom(event.gstAmount, event.gst_amount),
    ),
  });
}

export function logOutstandingSync(context: string, event: EventFinancialInput) {
  if (!import.meta.env.DEV) return;

  console.debug(`[events:${context}] outstanding sync`, {
    adjustment: numberFrom(event.adjustment),
    calculated_outstanding: calculateOutstanding(event),
    database_outstanding: round2(numberFrom(event.outstanding)),
    eventId: event.id,
    eventName: event.event_name,
    paid_amount: numberFrom(
      event.totalPaymentReceived,
      event.total_payment_received,
      event.totalPayment,
      event.total_paid,
      numberFrom(event.cashDeposit, event.cash_deposit) + numberFrom(event.onlinePayment, event.online_payment),
    ),
    total_sales: numberFrom(
      event.totalSales,
      event.total_sales,
      numberFrom(event.netSales, event.net_sales) + numberFrom(event.gstAmount, event.gst_amount),
    ),
  });
}