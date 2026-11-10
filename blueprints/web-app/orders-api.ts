/**
 * Stands in for your real order system: the kind of internal API an agent should get
 * facts from, instead of guessing them. The REST tool in reply.halo calls it with a
 * bearer token that lives in the server's environment, never in a prompt.
 *
 * It also does the date arithmetic. "Is this order late?" is a business rule with an
 * exact answer, so code computes `business_days_in_transit` and the model only reads it.
 */

export interface Order {
  id: string;
  shipped_on?: string;
  delivered_on?: string;
  status: string;
  [key: string]: unknown;
}

/** Weekdays after `from` up to and including `to`. */
export function businessDaysBetween(from: Date, to: Date): number {
  let days = 0;
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  while (d.getTime() < end) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) days++;
  }
  return days;
}

export function ordersApi(orders: Record<string, Order>, token: string, now: () => Date = () => new Date()) {
  return (req: Request): Response => {
    if (req.headers.get("authorization") !== `Bearer ${token}`) return new Response("Unauthorized", { status: 401 });
    const id = new URL(req.url).searchParams.get("id") ?? "";
    const order = Object.hasOwn(orders, id) ? orders[id] : undefined;
    if (!order) return Response.json({ error: "No such order" }, { status: 404 });
    const inTransit = order.status === "in_transit" && order.shipped_on ? businessDaysBetween(new Date(order.shipped_on), now()) : null;
    return Response.json({ ...order, today: now().toISOString().slice(0, 10), business_days_in_transit: inTransit });
  };
}
