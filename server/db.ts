import mysql, {
  type PoolConnection,
  type RowDataPacket,
  type ResultSetHeader,
} from "mysql2/promise";
import { AsyncLocalStorage } from "node:async_hooks";
export const pool = mysql.createPool({
  uri: process.env.MYSQL_URL,
  connectionLimit: 10,
  charset: "utf8mb4",
  timezone: "Z",
  supportBigNumbers: true,
  bigNumberStrings: false,
  multipleStatements: false,
  ...(process.env.MYSQL_SSL === "true"
    ? { ssl: { rejectUnauthorized: true } }
    : {}),
});
const current = new AsyncLocalStorage<PoolConnection>();
export async function rows<T>(sql: string, args: unknown[] = []): Promise<T[]> {
  const [result] = await (current.getStore() || pool).query<RowDataPacket[]>(
    sql,
    args,
  );
  return result as T[];
}
export async function one<T>(
  sql: string,
  args: unknown[] = [],
): Promise<T | null> {
  return (await rows<T>(sql, args))[0] || null;
}
export async function execute(sql: string, args: unknown[] = []) {
  const [result] = await (current.getStore() || pool).query<ResultSetHeader>(
    sql,
    args,
  );
  return result;
}
export async function transaction<T>(fn: () => Promise<T>): Promise<T> {
  if (current.getStore()) return fn();
  const conn = await pool.getConnection();
  try {
    await conn.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
    await conn.beginTransaction();
    const result = await current.run(conn, fn);
    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
// Compatibility repository for the retained exploration module, using the same MySQL transaction.
class Statement {
  constructor(
    private sql: string,
    private args: unknown[] = [],
  ) {}
  bind(...args: unknown[]) {
    return new Statement(this.sql, args);
  }
  first<T>() {
    return one<T>(this.sql, this.args);
  }
  async all<T>() {
    return { results: await rows<T>(this.sql, this.args) };
  }
  run() {
    return execute(this.sql, this.args);
  }
}
export function database() {
  return {
    prepare: (sql: string) => new Statement(sql),
    batch: (stmts: Statement[]) =>
      transaction(async () => {
        const result = [];
        for (const s of stmts) result.push(await s.run());
        return result;
      }),
  };
}
