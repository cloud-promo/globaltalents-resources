// Base PostgreSQL locale pour le développement (n'est pas utilisée en production).
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";

const dir = process.env.PGDATA_DIR || "/home/claude/.gtr-pgdata";
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: "gtr",
  password: "gtr",
  port: 54329,
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C.UTF-8"],
});

if (!fs.existsSync(dir + "/PG_VERSION")) {
  await pg.initialise();
}
await pg.start();
try {
  await pg.createDatabase("gtr");
} catch {
  /* existe déjà */
}
console.log("PostgreSQL local prêt : postgres://gtr:gtr@localhost:54329/gtr");
process.on("SIGTERM", async () => {
  await pg.stop();
  process.exit(0);
});
setInterval(() => {}, 1 << 30);
