/**
 * The content waves from the command line (docs/content/waves.md). Counts only in the output.
 *
 *   tsx scripts/sources/run.ts candidates <wave> [source…]   stop 1: metadata, licence and filter; counts.json
 *   tsx scripts/sources/run.ts prep <wave> <source…>          stop 2: download, master, screen, checks
 */
import { candidates, prep } from "./_pipeline";
import { archiveorg } from "./archiveorg";
import { artic } from "./artic";
import { cleveland } from "./cleveland";
import { met } from "./met";
import { smithsonian } from "./smithsonian";
import { wikimedia } from "./wikimedia";
import { WORLDS } from "./worlds";
import type { SourceId } from "./ranges";

const ADAPTERS = { met, artic, cleveland, wikimedia, smithsonian, archiveorg };
/** Most candidates kept per source at stop 1 (the owner can change the ceiling). */
const CAP = Number(process.env.CAP ?? 400);

async function main() {
  const [cmd, w, ...names] = process.argv.slice(2);
  const world = WORLDS[Number(w)];
  if (!world) throw new Error(`no world for wave ${w}`);
  const list = (names.length ? names : Object.keys(ADAPTERS)) as (keyof typeof ADAPTERS)[];
  for (const name of list) {
    if (cmd === "candidates") {
      const c = await candidates(ADAPTERS[name], world, CAP).catch((e) => (console.log(`${name}: failed (${String(e).slice(0, 120)})`), null));
      if (c) console.log(`${name}: found ${c.found} · licensed ${c.licensed} · passed ${c.filtered} · candidates ${c.final}`);
    } else if (cmd === "prep") console.log(name, await prep(name as SourceId, world.wave, { limit: Number(process.env[`LIMIT_${name.toUpperCase()}`] ?? process.env.LIMIT ?? Infinity) }));
  }
}
main().catch((e) => (console.error(e), process.exit(1)));
