// The fixture validator. Every failure is a fault: it throws, it names the path it failed at,
// and it never coerces, defaults or drops a field.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AgentSession, GithubUser, Member, Model, Organization, RateCards, Repository, Task, Team, WorkType } from "@/domain/types";
import {
  arrayOf,
  FixtureFault,
  githubUserSchema,
  membersFileSchema,
  modelSchema,
  organizationSchema,
  rateCardsSchema,
  repositorySchema,
  sessionSchema,
  taskSchema,
  teamSchema,
  tokenUsageSchema,
  workTypeSchema,
} from "./schema";

const DATA_DIRECTORY = join(process.cwd(), "src", "fixtures", "data");
const readRaw = <T>(name: string): T =>
  JSON.parse(readFileSync(join(DATA_DIRECTORY, name), "utf8")) as T;

const rawSession = readRaw<AgentSession[]>(join("sessions", "api-gateway__implementation.json"))[0];
const asRecord = (value: unknown): Record<string, unknown> => ({
  ...(value as Record<string, unknown>),
});

describe("the committed fixture validates as it stands", () => {
  it("round-trips every file through its schema unchanged", () => {
    const organization = readRaw<Organization>("organization.json");
    expect(organizationSchema(organization, "organization.json")).toEqual(organization);

    const repositories = readRaw<Repository[]>("repositories.json");
    expect(arrayOf(repositorySchema)(repositories, "repositories.json")).toEqual(repositories);

    const teams = readRaw<Team[]>("teams.json");
    expect(arrayOf(teamSchema)(teams, "teams.json")).toEqual(teams);

    const directory = readRaw<{ github_users: GithubUser[]; members: Member[] }>("members.json");
    expect(membersFileSchema(directory, "members.json")).toEqual(directory);

    const tasks = readRaw<Task[]>("tasks.json");
    expect(arrayOf(taskSchema)(tasks, "tasks.json")).toEqual(tasks);

    const workTypes = readRaw<WorkType[]>("work_types.json");
    expect(arrayOf(workTypeSchema)(workTypes, "work_types.json")).toEqual(workTypes);

    const models = readRaw<Model[]>("models.json");
    expect(arrayOf(modelSchema)(models, "models.json")).toEqual(models);

    const rateCards = readRaw<RateCards>("rate_cards.json");
    expect(rateCardsSchema(rateCards, "rate_cards.json")).toEqual(rateCards);

    expect(sessionSchema(rawSession, "session")).toEqual(rawSession);
  });

  it("ignores unread fields, because the GitHub-shaped files carry a simplified envelope", () => {
    const withExtra = { ...asRecord(rawSession), etag: "W/\"abc\"", _links: {} };
    expect(sessionSchema(withExtra, "session")).toEqual(rawSession);
  });
});

describe("a fault names the path it failed at", () => {
  it("reports the field, not just the file", () => {
    expect(() => sessionSchema({ ...asRecord(rawSession), prompt_count: null }, "pair.json[3]")).toThrow(
      /pair\.json\[3\]\.prompt_count: expected a finite number, received null/,
    );
  });

  it("reports the index of the offending array element", () => {
    expect(() => arrayOf(modelSchema)([{ id: "a", vendor: "b", family: "c", tier: "fast" }, 7], "models")).toThrow(
      /models\[1\]: expected an object, received number/,
    );
  });

  it("reports the offending nested field of a nested object", () => {
    const cards = readRaw<RateCards>("rate_cards.json");
    const broken = { ...cards, token: { ...cards.token, rates: [{ model_id: 4 }] } };
    expect(() => rateCardsSchema(broken, "rate_cards.json")).toThrow(
      /rate_cards\.json\.token\.rates\[0\]\.model_id: expected string, received number/,
    );
  });

  it("throws a FixtureFault, which is an Error and carries its cause when it has one", () => {
    const thrown = new FixtureFault("boom", { cause: new Error("underlying") });
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown.name).toBe("FixtureFault");
    expect(thrown.cause).toBeInstanceOf(Error);
  });
});

describe("the shapes it refuses", () => {
  it("refuses a missing field rather than defaulting it", () => {
    const withoutCost = asRecord(rawSession);
    delete withoutCost.cost;
    expect(() => sessionSchema(withoutCost, "session")).toThrow(/cost: expected a finite number, received undefined/);
  });

  it("refuses a non-object where an object belongs", () => {
    expect(() => organizationSchema([], "organization.json")).toThrow(/expected an object, received array/);
    expect(() => organizationSchema(null, "organization.json")).toThrow(/expected an object, received null/);
  });

  it("refuses a non-array where an array belongs", () => {
    expect(() => arrayOf(teamSchema)({}, "teams.json")).toThrow(/expected an array, received object/);
  });

  it("refuses NaN and Infinity, which JSON cannot hold but a hand edit can produce", () => {
    expect(() => sessionSchema({ ...asRecord(rawSession), cost: Number.NaN }, "s")).toThrow(/finite number/);
    expect(() => sessionSchema({ ...asRecord(rawSession), cost: Number.POSITIVE_INFINITY }, "s")).toThrow(/finite number/);
  });

  it("refuses a negative count, duration or amount — corrupt, not small", () => {
    expect(() => sessionSchema({ ...asRecord(rawSession), idle_duration_s: -1 }, "s")).toThrow(
      /idle_duration_s: expected a non-negative number, received -1/,
    );
    expect(() => tokenUsageSchema({ model_id: "m", uncached_input: -3, cache_read: 0, cache_write: 0, output: 0 }, "u")).toThrow(
      /non-negative/,
    );
  });

  it("refuses a value outside a closed vocabulary, and says what was allowed", () => {
    expect(() => sessionSchema({ ...asRecord(rawSession), execution_mode: "supervised" }, "s")).toThrow(
      /execution_mode: expected one of interactive \| headless, received "supervised"/,
    );
    expect(() => workTypeSchema({ ...readRaw<WorkType[]>("work_types.json")[0], key: "research" }, "w")).toThrow(
      /expected one of implementation \| refactor \| bugfix \| review \| deploy/,
    );
  });

  it("refuses an unknown artefact kind, which would vanish from every comparability check", () => {
    expect(() => sessionSchema({ ...asRecord(rawSession), artefacts: { deployment: 2 } }, "s")).toThrow(
      /artefacts key: expected one of pull_request \| commit \| file_changed \| line_changed \| pr_comment/,
    );
  });

  it("accepts a partial artefact map, because a WorkType declares which kinds it may produce", () => {
    const parsed = sessionSchema({ ...asRecord(rawSession), artefacts: { commit: 3 } }, "s");
    expect(parsed.artefacts).toEqual({ commit: 3 });
    expect(sessionSchema({ ...asRecord(rawSession), artefacts: {} }, "s").artefacts).toEqual({});
  });

  it("accepts a null email on a GitHub user and refuses a non-string one", () => {
    expect(githubUserSchema({ id: 1, login: "a", full_name: "A", email: null }, "u").email).toBeNull();
    expect(() => githubUserSchema({ id: 1, login: "a", full_name: "A", email: 7 }, "u")).toThrow(
      /u\.email: expected string, received number/,
    );
  });

  it("refuses a non-numeric rate-card derivation value", () => {
    const cards = readRaw<RateCards>("rate_cards.json");
    const broken = { ...cards, token: { ...cards.token, derivation: { output: "5x" } } };
    expect(() => rateCardsSchema(broken, "cards")).toThrow(/derivation\.output: expected a finite number/);
  });

  it("refuses a boolean field that arrived as a string", () => {
    expect(() => sessionSchema({ ...asRecord(rawSession), accepted: "true" }, "s")).toThrow(
      /accepted: expected boolean, received string/,
    );
  });
});
