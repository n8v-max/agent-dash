// R-D23 — **the token scale** (ticket 68), measured the three ways the requirement states it.
//
// It sits beside `distributions.mts` rather than inside it because it is a different kind of
// claim about a different grain: everything there is a share or a rate over sessions, and this
// is a *level* — how many tokens a session draws, and what a Member's month adds up to.

import { check, tokenFigure } from "./check.mts";
import { members } from "./people.mts";
import { isCpuHeavy, tokensProcessed } from "./predicates.mts";
import { median, quantile } from "./rng.mts";
import { monthKeyOfDay } from "./schedule.mts";
import {
  MEMBER_MONTH_LEADER_MONTHS,
  MEMBER_MONTH_LEADER_TOKENS,
  MEMBER_MONTH_TOKENS,
  MEMBER_MONTH_TOKENS_BY_MONTH,
  TOKEN_APPETITE_HEAVY,
  TOKEN_FLOOR,
  WINDOW_DAYS,
} from "./targets.mts";
import type { AgentSession } from "./types.mts";

// The three claims, and each one fails differently.
//
//   * the *floor* — no attempt processes fewer than 75,000 tokens, R-D11's ~20 token-light rows
//     excepted. Asserted over stored roots, hidden ones included, because it is a property of
//     the row and not of a reading of it. A child is not an attempt: it holds a fraction of its
//     root's draw by construction (R-D21), and its tokens reach every total through that root.
//   * the *median Member-month* — ~100M for a human, over the months lying wholly inside the
//     window. April opens on the 12th and September closes on the 25th, so neither is a month
//     anybody could read a monthly figure off, and neither is asserted. The ticket's 80–130M is
//     asserted over the four months' Member-months **pooled** and each month's own median over
//     a wider band; `MEMBER_MONTH_TOKENS` carries the arithmetic for why.
//   * the *leaders* — at least one human Member-month above a billion in each of the last three
//     full months. That is the finding `/demo/people` sorted by Tokens shows, and it is what the
//     heavy-tail factors in `targets.mts` exist for.
const daysInMonth = (monthKey: string): number =>
  new Date(Date.UTC(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)), 0)).getUTCDate();

/** The months lying wholly inside the window — the ones a Member-month figure is readable in. */
const fullMonths = (): string[] => {
  const held = new Map<string, number>();
  for (let day = 0; day < WINDOW_DAYS; day += 1) {
    const key = monthKeyOfDay(day);
    held.set(key, (held.get(key) ?? 0) + 1);
  }
  return [...held.entries()]
    .filter(([key, days]) => days === daysInMonth(key))
    .map(([key]) => key)
    .sort();
};

export const tokenScaleLines = (
  storedRoots: readonly AgentSession[],
  roots: readonly AgentSession[],
): string[] => {
  const heavy = Object.values(TOKEN_APPETITE_HEAVY);
  check(
    heavy.length >= 3 && heavy.length <= 4 && heavy.every((factor) => factor >= 6 && factor <= 12),
    `R-D23: the heavy tail is ${heavy.length} Members at ×${heavy.join("/")}, not three or four at ×6–12`,
  );
  const belowFloor = storedRoots.filter(
    (row) => !isCpuHeavy(row) && tokensProcessed(row) < TOKEN_FLOOR,
  );
  check(
    belowFloor.length === 0,
    `R-D23: ${belowFloor.length} attempts drew fewer than ${TOKEN_FLOOR} tokens (${belowFloor[0]?.id})`,
  );
  const humans = new Set(members.filter((member) => member.kind === "human").map((m) => m.id));
  const monthly = fullMonths().map((month) => {
    const held = new Map<string, number>();
    for (const row of roots) {
      if (!humans.has(row.member_id) || !row.started_at.startsWith(month)) continue;
      held.set(row.member_id, (held.get(row.member_id) ?? 0) + tokensProcessed(row));
    }
    const totals = [...held.values()];
    return { month, totals, median: median(totals), max: Math.max(...totals) };
  });
  // The level, over the pooled Member-months of every full month - seventy figures, which is
  // enough of them for a median to be a statistic rather than whichever Member happened to fall
  // in the middle of one month's eighteen.
  const pooled = median(monthly.flatMap((entry) => entry.totals));
  check(
    pooled >= MEMBER_MONTH_TOKENS.min && pooled <= MEMBER_MONTH_TOKENS.max,
    `R-D23: the median human Member-month is ${tokenFigure(pooled)}, outside ${tokenFigure(
      MEMBER_MONTH_TOKENS.min,
    )}–${tokenFigure(MEMBER_MONTH_TOKENS.max)}`,
  );
  for (const { month, median: middle } of monthly) {
    check(
      middle >= MEMBER_MONTH_TOKENS_BY_MONTH.min && middle <= MEMBER_MONTH_TOKENS_BY_MONTH.max,
      `R-D23: the median human Member-month in ${month} is ${tokenFigure(
        middle,
      )}, outside ${tokenFigure(MEMBER_MONTH_TOKENS_BY_MONTH.min)}–${tokenFigure(
        MEMBER_MONTH_TOKENS_BY_MONTH.max,
      )}`,
    );
  }
  for (const { month, max } of monthly.slice(-MEMBER_MONTH_LEADER_MONTHS)) {
    check(
      max >= MEMBER_MONTH_LEADER_TOKENS,
      `R-D23: the busiest human Member-month in ${month} is ${tokenFigure(max)}, below the ${tokenFigure(
        MEMBER_MONTH_LEADER_TOKENS,
      )} a leader reaches`,
    );
  }
  const sessions = roots.map(tokensProcessed);
  const leaders = monthly[monthly.length - 1];
  return [
    `R-D23 median human Member-month ${tokenFigure(pooled)} over ${
      monthly.flatMap((entry) => entry.totals).length
    } Member-months in ${monthly.length} full months`,
    `R-D23 session tokens: median ${tokenFigure(median(sessions))} · p95 ${tokenFigure(
      quantile(sessions, 0.95),
    )} · min ${tokenFigure(Math.min(...sessions))} · max ${tokenFigure(Math.max(...sessions))}`,
    `R-D23 human Member-month tokens by full month: ${monthly
      .map(({ month, median: middle, max }) => `${month} ${tokenFigure(middle)}/${tokenFigure(max)}`)
      .join(" · ")} (median/max)`,
    `R-D23 the busiest Member-month is ${(leaders.max / leaders.median).toFixed(1)}× the median one`,
  ];
};
