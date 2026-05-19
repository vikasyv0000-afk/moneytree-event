import type { QueryClient } from "@tanstack/react-query";
import { normalizeEventFinancials, type EventRow } from "@/lib/event-financials";

const upsertEvent = (events: EventRow[] | undefined, event: EventRow) => {
  if (!events) return [event];

  const next = events.filter((entry) => entry.id !== event.id);
  next.unshift(event);
  return next;
};

export function syncEventCaches(queryClient: QueryClient, event: EventRow) {
  const normalizedEvent = normalizeEventFinancials(event) as EventRow;

  queryClient.setQueryData(["event", normalizedEvent.id], normalizedEvent);
  queryClient.setQueryData(["events"], (current: EventRow[] | undefined) => upsertEvent(current, normalizedEvent));
  queryClient.setQueryData(["events-dashboard"], (current: EventRow[] | undefined) => upsertEvent(current, normalizedEvent));

  return normalizedEvent;
}

export function removeEventFromCaches(queryClient: QueryClient, eventId: string) {
  queryClient.removeQueries({ queryKey: ["event", eventId] });
  queryClient.setQueryData(["events"], (current: EventRow[] | undefined) => current?.filter((event) => event.id !== eventId) ?? []);
  queryClient.setQueryData(["events-dashboard"], (current: EventRow[] | undefined) => current?.filter((event) => event.id !== eventId) ?? []);
}

export function invalidateEventQueries(queryClient: QueryClient, eventId?: string) {
  if (eventId) {
    queryClient.invalidateQueries({ queryKey: ["event", eventId] });
  }

  queryClient.invalidateQueries({ queryKey: ["events"] });
  queryClient.invalidateQueries({ queryKey: ["events-dashboard"] });
}