// The seeded fixture generator (R-T20). Run it with `pnpm fixtures:generate`; its output is
// committed, and CI regenerates into a temp directory and diffs (R-T21 / T-F9).
//
//   node src/fixtures/generate.mts [--out <directory>]
//
// Everything downstream of the seed is deterministic: one PRNG instance is threaded through
// every stage in a fixed order, so the same seed produces byte-identical files.

import { fileURLToPath } from "node:url";
import { planCells } from "./allocation.mts";
import { spawnChildren } from "./children.mts";
import { repairWeeklySpend } from "./curve.mts";
import { assignCells } from "./assign.mts";
import { assertFixture } from "./invariants.mts";
import { mintTasks } from "./issues.mts";
import { members } from "./people.mts";
import { mulberry32 } from "./rng.mts";
import { buildSessions } from "./rows.mts";
import { generateSlots } from "./schedule.mts";
import { SEED } from "./targets.mts";
import { writeFixture } from "./write.mts";
import { planTasks } from "./tasks.mts";

const outputDirectory = (argv: readonly string[]): string => {
  const flag = argv.indexOf("--out");
  if (flag !== -1 && argv[flag + 1] !== undefined) return argv[flag + 1];
  return fileURLToPath(new URL("./data", import.meta.url));
};

const main = (): void => {
  const rng = mulberry32(SEED);
  const slots = generateSlots(rng, members);
  const { tasks: plannedTasks } = planTasks(rng, members, slots);
  const plan = planCells(slots.length);
  const assigned = assignCells(rng, members, plannedTasks, plan);
  const tasks = mintTasks(rng, assigned);
  const roots = buildSessions(rng, members, assigned, tasks);
  // R-D21 — the fan-out is drawn last, from finished rows, so every root keeps the id, the
  // timestamps and the figures it had before children existed (ADR-0008).
  const sessions = [...roots, ...spawnChildren(rng, roots)].sort(
    (a, b) => Date.parse(a.started_at) - Date.parse(b.started_at) || a.id.localeCompare(b.id),
  );
  // R-D4 — weekly session spend follows `WEEKLY_SPEND_SHAPE`. Last, after the fan-out, because a
  // child's cost is real session spend and a repair that ran before it existed would be a repair
  // toward a total the fixture does not have. It draws no random numbers, so it cannot move
  // anything above it.
  const curve = repairWeeklySpend(sessions);
  const report = [curve.join("\n"), assertFixture({ sessions, tasks })].join("\n");
  const directory = outputDirectory(process.argv.slice(2));
  const files = writeFixture(directory, { sessions, tasks });
  process.stdout.write(`${report}\nwrote ${files} files to ${directory}\n`);
};

main();
