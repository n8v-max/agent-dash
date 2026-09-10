// The calendar and the adoption ramp (R-D2, R-D4, R-D5). Produces the session *slots* —
// who ran a session and when — before anything is known about what the session did.
//
// **Two schedules, because there are two kinds of Member** (ticket 66). A human runs a *day*:
// `1 + Poisson(λ(t)·activity)` root sessions on a workday, capped at nine, and almost nothing at
// a weekend. A service account runs a *week*: the zero-inflated weekly Poisson the whole fixture
// used before this ticket, scaled ×3. Giving a nightly runner a workday would be a claim about
// it that is false, and giving a person a week was what held the org-wide figure at five
// sessions a day across twenty Members.

import {
  chance,
  intBetween,
  logNormal,
  pickWeighted,
  poisson,
  shuffled,
  sum,
  type Rng,
} from "./rng.mts";
import {
  DAILY_VOLUME,
  LOW_USAGE_MEMBER_ID,
  LOW_USAGE_SESSIONS,
  MADRID_OFFSET_LABEL,
  MADRID_OFFSET_MINUTES,
  SERVICE_ACCOUNT_SCALE,
  SERVICE_RAMP,
  WINDOW_DAYS,
  WINDOW_START_DAY,
} from "./targets.mts";
import type { Member } from "./types.mts";

export type Slot = { member_id: string; day_index: number; started_at_ms: number };

const DAY_MS = 86_400_000;
const WINDOW_START_MS = Date.parse(`${WINDOW_START_DAY}T00:00:00${MADRID_OFFSET_LABEL}`);
export const WEEK_COUNT = Math.ceil(WINDOW_DAYS / 7);

export const dayIso = (dayIndex: number): string =>
  new Date(WINDOW_START_MS + dayIndex * DAY_MS + MADRID_OFFSET_MINUTES * 60_000)
    .toISOString()
    .slice(0, 10);

export const monthKeyOfDay = (dayIndex: number): string => dayIso(dayIndex).slice(0, 7);

// Weeks are 7-day buckets from the window start, labelled by the calendar month of their
// first day. The window opens on a Sunday, so a full bucket is Sunday through Saturday and
// holds five workdays; the closing bucket holds six days. `WEEKLY_SPEND_SHAPE` is measured on
// exactly this bucketing, and the fixture invariant test re-derives it from the committed
// timestamps the same way.
export const weekOfDay = (dayIndex: number): number => Math.floor(dayIndex / 7);
export const weekMonthKey = (week: number): string => monthKeyOfDay(week * 7);
export const daysInWeek = (week: number): number => Math.min(7, WINDOW_DAYS - week * 7);

export const weekdayOfDay = (dayIndex: number): number =>
  new Date(WINDOW_START_MS + dayIndex * DAY_MS + MADRID_OFFSET_MINUTES * 60_000).getUTCDay();

/** Monday through Friday in the Organization's timezone — the day R-D4 states its range over. */
export const isWorkday = (dayIndex: number): boolean => {
  const weekday = weekdayOfDay(dayIndex);
  return weekday !== 0 && weekday !== 6;
};

export const daysOfWeek = (week: number): number[] =>
  Array.from({ length: daysInWeek(week) }, (_, offset) => week * 7 + offset);

/**
 * λ at a day, as a logistic in window fraction (R-D4). Flat in April, steep through June and
 * July, flat again from August — which is what makes "a plateau in August–September" a property
 * of the schedule rather than a second curve laid over it.
 */
export const lambdaAt = (dayIndex: number): number => {
  const t = dayIndex / (WINDOW_DAYS - 1);
  const { lambdaStart, lambdaEnd, midpoint, steepness } = DAILY_VOLUME;
  return (
    lambdaStart + (lambdaEnd - lambdaStart) / (1 + Math.exp(-steepness * (t - midpoint)))
  );
};

/**
 * A day's share of a full week's activity: one for a workday, `weekendRate` for a weekend day.
 * `curve.mts` spreads the weekly spend target over these, so a six-day closing bucket that still
 * holds five workdays is targeted at 97% of a full week rather than at six sevenths of one.
 */
export const dayVolumeWeight = (dayIndex: number): number =>
  isWorkday(dayIndex) ? 1 : DAILY_VOLUME.weekendRate;

export const FULL_WEEK_WEIGHT = 5 + 2 * DAILY_VOLUME.weekendRate;

// Every timestamp is written in Europe/Madrid local time with its offset. That offset is
// verified against Intl for every day in the window rather than assumed: R-D5 depends on
// 22:00–24:00 local landing on the previous UTC day, which a DST transition would break.
export const madridOffsetMinutes = (epochMs: number): number => {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    timeZoneName: "longOffset",
  }).format(new Date(epochMs));
  const match = /GMT([+-])(\d{2}):(\d{2})/u.exec(formatted);
  if (match === null) throw new Error(`unreadable Madrid offset: ${formatted}`);
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
};

export const isoInMadrid = (epochMs: number): string =>
  `${new Date(epochMs + MADRID_OFFSET_MINUTES * 60_000).toISOString().slice(0, 19)}${MADRID_OFFSET_LABEL}`;

const localMs = (dayIndex: number, hour: number, minute: number, second: number): number =>
  WINDOW_START_MS + dayIndex * DAY_MS + ((hour * 60 + minute) * 60 + second) * 1000;

// R-D5 — the late tail is seeded on purpose, and it is seeded at *both* edges of the day.
//
// The requirement names 22:00–24:00 Europe/Madrid and those rows are here. Its stated reason
// — "so they land on the previous UTC day" — does not hold for a UTC+2 zone: 23:00 Madrid is
// 21:00 UTC on the same date. The rows whose UTC date really does differ are the ones just
// after local midnight, so the 00:00–02:00 slice is seeded as well. Both are kept: the first
// because R-D5 names it, the second because it is the case that actually exercises the
// declared-timezone decision. The specs are not edited to match; the discrepancy is reported.
const HUMAN_HOURS: readonly (readonly [readonly [number, number], number])[] = [
  [[0, 1], 0.015],
  [[8, 9], 0.06],
  [[9, 13], 0.39],
  [[14, 18], 0.355],
  [[19, 21], 0.12],
  [[22, 23], 0.06],
];

const BOT_HOURS: Record<string, readonly (readonly [readonly [number, number], number])[]> = {
  mem_deploybot: [
    [[10, 13], 0.4],
    [[15, 19], 0.45],
    [[22, 23], 0.15],
  ],
  mem_nightlybot: [
    [[0, 1], 0.3],
    [[2, 5], 0.5],
    [[22, 23], 0.2],
  ],
};

const startOfSession = (rng: Rng, member: Member, dayIndex: number): number => {
  const table = BOT_HOURS[member.id] ?? HUMAN_HOURS;
  const [from, to] = pickWeighted(rng, table);
  return localMs(dayIndex, intBetween(rng, from, to), intBetween(rng, 0, 59), intBetween(rng, 0, 59));
};

const dayInWeek = (rng: Rng, week: number): number => {
  const span = daysInWeek(week);
  const offsets = Array.from({ length: span }, (_, offset) => week * 7 + offset);
  return pickWeighted(
    rng,
    offsets.map((day) => [day, weekdayOfDay(day) === 0 || weekdayOfDay(day) === 6 ? 1 : 7] as const),
  );
};

// The two service accounts run on a schedule, not on a person's week, so they sit beside the
// human model rather than being drawn from it. R-D13 needs the deploy account to carry enough
// deploys for "a service account running interactive sessions" to be a visible cell.
const SERVICE_ACCOUNT_ACTIVITY: Record<string, number> = {
  mem_deploybot: 1.9,
  mem_nightlybot: 1.1,
};

// ×3 on the mean **and** on the cap together (ticket 66). Scaling the mean alone would have
// pinned both accounts to the old cap every week from June on, turning a Poisson draw into a
// constant — the shape is what is being kept, and only the height moves.
const rampAt = (week: number) => {
  const t = week / (WEEK_COUNT - 1);
  const mean = SERVICE_RAMP.meanStart + (SERVICE_RAMP.meanEnd - SERVICE_RAMP.meanStart) * t;
  const capAt = SERVICE_RAMP.capStart + (SERVICE_RAMP.capEnd - SERVICE_RAMP.capStart) * t;
  return {
    mean: mean * SERVICE_ACCOUNT_SCALE,
    zero:
      SERVICE_RAMP.zeroInflationStart +
      (SERVICE_RAMP.zeroInflationEnd - SERVICE_RAMP.zeroInflationStart) * t,
    cap: Math.round(capAt * SERVICE_ACCOUNT_SCALE),
  };
};

// A short week is a *less likely* week, not a week with a smaller busy day: the window's
// last bucket holds six days, and scaling the Poisson mean alone would still have handed
// every active account a session in it, tipping September's daily rate above August's.
const weeklyCount = (rng: Rng, week: number, activity: number): number => {
  const { mean, zero, cap } = rampAt(week);
  const active = (1 - zero) * (daysInWeek(week) / 7);
  if (!chance(rng, active)) return 0;
  const lambda = (mean * activity) / (1 - zero);
  return Math.min(cap, 1 + poisson(rng, Math.max(0, lambda - 1)));
};

/**
 * **R-D4 — one to nine root sessions per human Member per workday.** A workday is floored at one
 * and capped at nine; a weekend day is an ordinary Poisson at 15% of the rate, so most of them
 * are empty and none of them is guaranteed.
 */
const dailyCount = (rng: Rng, dayIndex: number, activity: number): number => {
  const lambda = lambdaAt(dayIndex) * activity;
  if (!isWorkday(dayIndex)) return poisson(rng, lambda * DAILY_VOLUME.weekendRate);
  return Math.min(DAILY_VOLUME.cap, 1 + poisson(rng, lambda));
};

// R-D10 — one human Member holds a seat against near-zero usage. Trimming here rather than
// suppressing the ramp keeps their few sessions spread across the window instead of bunched
// in the first weeks, which is what a mostly-idle seat actually looks like.
const trimLowUsage = (rng: Rng, slots: readonly Slot[]): Slot[] => {
  const mine = slots.filter((slot) => slot.member_id === LOW_USAGE_MEMBER_ID);
  // Kept by **slot identity**, not by timestamp. At nine sessions a day two of a Member's slots
  // can land on the same second, and a timestamp key would then keep four slots where it was
  // asked for three — a bug that could not happen at the old volume and would be silent at this
  // one, because the only symptom is a seat holder with one session too many.
  const keep = new Set(shuffled(rng, mine).slice(0, LOW_USAGE_SESSIONS));
  return slots.filter((slot) => slot.member_id !== LOW_USAGE_MEMBER_ID || keep.has(slot));
};

/**
 * The per-Member activity multipliers, **normalised to mean 1 over the humans**. Without the
 * normalisation a log-normal's mean sits 13% above its median at σ = 0.5, so the org-wide session
 * count would be a property of the draw rather than of λ, and every retune of the ramp would have
 * to be found by trial. Service accounts carry their own multiplier on top and are not in the
 * normalising population — they are not a share of the human rate.
 */
const activityOf = (rng: Rng, members: readonly Member[]): Map<string, number> => {
  const drawn = members.map(() => logNormal(rng, 1, DAILY_VOLUME.memberActivitySigma));
  const human = members.map((member, at) => ({ member, value: drawn[at] })).filter(
    (entry) => entry.member.kind === "human",
  );
  const mean = sum(human.map((entry) => entry.value)) / human.length;
  return new Map(
    members.map((member, at) => [
      member.id,
      (drawn[at] / mean) * (SERVICE_ACCOUNT_ACTIVITY[member.id] ?? 1),
    ]),
  );
};

export const generateSlots = (rng: Rng, members: readonly Member[]): Slot[] => {
  const activity = activityOf(rng, members);
  const slots: Slot[] = [];
  const push = (member: Member, dayIndex: number, count: number): void => {
    for (let at = 0; at < count; at += 1) {
      slots.push({
        member_id: member.id,
        day_index: dayIndex,
        started_at_ms: startOfSession(rng, member, dayIndex),
      });
    }
  };
  for (const member of members) {
    const mine = activity.get(member.id) ?? 1;
    if (member.kind === "service_account") {
      for (let week = 0; week < WEEK_COUNT; week += 1) {
        const count = weeklyCount(rng, week, mine);
        for (let at = 0; at < count; at += 1) push(member, dayInWeek(rng, week), 1);
      }
      continue;
    }
    for (let dayIndex = 0; dayIndex < WINDOW_DAYS; dayIndex += 1) {
      push(member, dayIndex, dailyCount(rng, dayIndex, mine));
    }
  }
  return trimLowUsage(rng, slots).sort(
    (a, b) => a.started_at_ms - b.started_at_ms || a.member_id.localeCompare(b.member_id),
  );
};
