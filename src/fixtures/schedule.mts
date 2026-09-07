// The calendar and the adoption ramp (R-D2, R-D4, R-D5). Produces the session *slots* —
// who ran a session and when — before anything is known about what the session did.

import { chance, intBetween, logNormal, pickWeighted, poisson, shuffled, type Rng } from "./rng.mts";
import {
  LOW_USAGE_MEMBER_ID,
  LOW_USAGE_SESSIONS,
  MADRID_OFFSET_LABEL,
  MADRID_OFFSET_MINUTES,
  RAMP,
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
// first day. R-D4's "per Member per week" is measured on exactly this bucketing, and the
// fixture invariant test re-derives it from the committed timestamps the same way.
export const weekOfDay = (dayIndex: number): number => Math.floor(dayIndex / 7);
export const weekMonthKey = (week: number): string => monthKeyOfDay(week * 7);
export const daysInWeek = (week: number): number => Math.min(7, WINDOW_DAYS - week * 7);

export const weekdayOfDay = (dayIndex: number): number =>
  new Date(WINDOW_START_MS + dayIndex * DAY_MS + MADRID_OFFSET_MINUTES * 60_000).getUTCDay();

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

// The two service accounts run on a schedule, not on a person's week, so they sit above the
// human ramp rather than being drawn from it. R-D13 needs the deploy account to carry enough
// deploys for "a service account running interactive sessions" to be a visible cell.
const SERVICE_ACCOUNT_ACTIVITY: Record<string, number> = {
  mem_deploybot: 1.9,
  mem_nightlybot: 1.1,
};

const rampAt = (week: number) => {
  const t = week / (WEEK_COUNT - 1);
  return {
    mean: RAMP.meanStart + (RAMP.meanEnd - RAMP.meanStart) * t,
    zero: RAMP.zeroInflationStart + (RAMP.zeroInflationEnd - RAMP.zeroInflationStart) * t,
    cap: Math.round(RAMP.capStart + (RAMP.capEnd - RAMP.capStart) * t),
  };
};

// A short week is a *less likely* week, not a week with a smaller busy day: the window's
// last bucket holds three days, and scaling the Poisson mean alone would still have handed
// every active Member a session in it, tipping September's daily rate above August's.
const weeklyCount = (rng: Rng, week: number, activity: number): number => {
  const { mean, zero, cap } = rampAt(week);
  const active = (1 - zero) * (daysInWeek(week) / 7);
  if (!chance(rng, active)) return 0;
  const lambda = (mean * activity) / (1 - zero);
  return Math.min(cap, 1 + poisson(rng, Math.max(0, lambda - 1)));
};

// R-D10 — one human Member holds a seat against near-zero usage. Trimming here rather than
// suppressing the ramp keeps their few sessions spread across the window instead of bunched
// in the first weeks, which is what a mostly-idle seat actually looks like.
const trimLowUsage = (rng: Rng, slots: readonly Slot[]): Slot[] => {
  const mine = slots.filter((slot) => slot.member_id === LOW_USAGE_MEMBER_ID);
  const keep = new Set(
    shuffled(rng, mine)
      .slice(0, LOW_USAGE_SESSIONS)
      .map((slot) => slot.started_at_ms),
  );
  return slots.filter(
    (slot) => slot.member_id !== LOW_USAGE_MEMBER_ID || keep.has(slot.started_at_ms),
  );
};

export const generateSlots = (rng: Rng, members: readonly Member[]): Slot[] => {
  const activity = new Map(
    members.map((member) => [
      member.id,
      logNormal(rng, 1, RAMP.memberActivitySigma) * (SERVICE_ACCOUNT_ACTIVITY[member.id] ?? 1),
    ]),
  );
  const slots: Slot[] = [];
  for (const member of members) {
    for (let week = 0; week < WEEK_COUNT; week += 1) {
      const count = weeklyCount(rng, week, activity.get(member.id) ?? 1);
      for (let i = 0; i < count; i += 1) {
        const dayIndex = dayInWeek(rng, week);
        slots.push({
          member_id: member.id,
          day_index: dayIndex,
          started_at_ms: startOfSession(rng, member, dayIndex),
        });
      }
    }
  }
  return trimLowUsage(rng, slots).sort(
    (a, b) => a.started_at_ms - b.started_at_ms || a.member_id.localeCompare(b.member_id),
  );
};
