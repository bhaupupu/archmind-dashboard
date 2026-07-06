// @acme/billing-svc data access. Writes the shared `users` table (billed flag)
// and its own `invoices` table — a cross-repo schema coupling with web-app.
declare const db: { query(sql: string, params?: unknown[]): Promise<unknown> };

export function createInvoice(customerId: string, cents: number) {
  return db.query('INSERT INTO invoices (customer_id, amount_cents) VALUES ($1, $2)', [customerId, cents]);
}

export function markUserBilled(userId: string) {
  return db.query('UPDATE users SET billed = true WHERE id = $1', [userId]);
}
