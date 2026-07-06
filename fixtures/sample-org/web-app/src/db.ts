// @acme/web-app data access (illustrative SQL). Reads the shared `users` table.
declare const db: { query(sql: string, params?: unknown[]): Promise<unknown> };

export function getUser(id: string) {
  return db.query('SELECT id, name FROM users WHERE id = $1', [id]);
}

export function createSession(userId: string, token: string) {
  return db.query('INSERT INTO sessions (user_id, token) VALUES ($1, $2)', [userId, token]);
}
