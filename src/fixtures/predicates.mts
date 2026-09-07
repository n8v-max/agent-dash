// Shared row predicates. They exist so the generator's assertions and the fixture invariant
// tests recognise the same rows: a CPU-heavy session is not a flag in the schema (R-T10 has
// no such field, and inventing one would put a generator concept into the domain type) — it
// is a *shape*, and this is the one definition of that shape.

import type { AgentSession } from "./types.mts";

export const tokensProcessed = (row: AgentSession): number =>
  row.token_usage.reduce(
    (total, usage) =>
      total + usage.uncached_input + usage.cache_read + usage.cache_write + usage.output,
    0,
  );

// R-D11 — long on `compute`, almost no tokens. Invisible to a token view, visible in Cost.
export const CPU_HEAVY_MINIMUM_SECONDS = 4 * 3600;
export const CPU_HEAVY_TOKEN_CEILING = 60_000;

export const isCpuHeavy = (row: AgentSession): boolean =>
  row.machine_spec === "compute" &&
  row.machine_allocation_duration_s >= CPU_HEAVY_MINIMUM_SECONDS &&
  tokensProcessed(row) <= CPU_HEAVY_TOKEN_CEILING;

// R-D5 — timestamps are written in Madrid local time with the offset, so the local hour
// reads straight off the string. Two edges matter: the 22:00–24:00 slice the requirement
// names, and the slice just after local midnight, whose UTC date is the previous day.
export const startsLateEvening = (row: AgentSession): boolean =>
  Number(row.started_at.slice(11, 13)) >= 22;

export const crossesUtcDay = (row: AgentSession): boolean =>
  new Date(row.started_at).toISOString().slice(0, 10) !== row.started_at.slice(0, 10);
