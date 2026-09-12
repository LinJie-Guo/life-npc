import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pool } from "./db";
const c = await pool.getConnection();
try {
  const [locks] = await c.query(
    "SELECT GET_LOCK('life_npc_migrations',30) AS acquired",
  );
  if (!(locks as { acquired: number }[])[0].acquired)
    throw new Error("Migration lock unavailable");
  await c.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(100) PRIMARY KEY, checksum CHAR(64) NOT NULL, applied BIGINT NOT NULL) ENGINE=InnoDB",
  );
  for (const name of (await readdir(new URL("./migrations/", import.meta.url)))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(
      new URL("./migrations/" + name, import.meta.url),
      "utf8",
    );
    const checksum = createHash("sha256").update(sql).digest("hex");
    const [found] = await c.query(
      "SELECT checksum FROM schema_migrations WHERE name=?",
      [name],
    );
    if ((found as { checksum: string }[]).length) {
      if ((found as { checksum: string }[])[0].checksum !== checksum)
        throw new Error("Changed migration: " + name);
      continue;
    }
    for (const statement of sql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean))
      await c.query(statement);
    await c.query("INSERT INTO schema_migrations VALUES(?,?,?)", [
      name,
      checksum,
      Date.now(),
    ]);
    console.log("Applied", name);
  }
} finally {
  await c.query("SELECT RELEASE_LOCK('life_npc_migrations')");
  c.release();
  await pool.end();
}
