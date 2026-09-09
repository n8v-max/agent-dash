import comments from "@eslint-community/eslint-plugin-eslint-comments/configs";
import vitest from "@vitest/eslint-plugin";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import playwright from "eslint-plugin-playwright";
import sonarjs from "eslint-plugin-sonarjs";
import testingLibrary from "eslint-plugin-testing-library";

// The quality bar. Numbers here are budgets, not suggestions — they are errors so that
// exceeding one is a decision someone makes explicitly, not a warning that accumulates.
const BUDGETS = {
  fileLines: 300,
  functionLines: 75,
  cyclomaticComplexity: 10,
  cognitiveComplexity: 15,
  nestingDepth: 4,
  parameters: 4,
  nestedCallbacks: 3,
};

// R-T5 / R-T33. src/domain is the pure computation layer: rows in, numbers out. It may not
// reach for a renderer, a framework, the filesystem, or the layers built on top of it.
const DOMAIN_FORBIDDEN_MODULES = [
  { name: "react", message: "R-T5: src/domain is renderer-agnostic." },
  { name: "react-dom", message: "R-T5: src/domain is renderer-agnostic." },
  { name: "recharts", message: "R-T5: src/domain is renderer-agnostic." },
  { name: "node:fs", message: "R-T5: all fixture I/O belongs to src/data/load.ts." },
  { name: "node:fs/promises", message: "R-T5: all fixture I/O belongs to src/data/load.ts." },
  { name: "fs", message: "R-T5: all fixture I/O belongs to src/data/load.ts." },
];

const DOMAIN_FORBIDDEN_PATTERNS = [
  { group: ["next", "next/*"], message: "R-T5: src/domain is framework-free." },
  {
    group: ["@/data", "@/data/*", "@/app", "@/app/*", "@/components", "@/components/*"],
    message: "R-T5: src/domain sits below these layers and may not import them.",
  },
  {
    group: ["../data/*", "../app/*", "../components/*", "../../data/*", "../../app/*", "../../components/*"],
    message: "R-T5: src/domain sits below these layers and may not import them.",
  },
  { group: ["*.json", "**/*.json"], message: "R-T19: fixture JSON is read by src/data/load.ts only." },
];

// Amendment item 3. Nondeterminism is a *global*, so no-restricted-imports cannot see it.
// P5: every function taking "now" takes it as an argument. Note the arity guard on Date —
// `new Date(row.started_at)` is deterministic and is what periods.ts is built from; it is
// the zero-argument form that reads the wall clock.
const DOMAIN_FORBIDDEN_SYNTAX = [
  {
    selector: 'NewExpression[callee.name="Date"][arguments.length=0]',
    message: "P5: no wall clock in src/domain — take `now` as an argument.",
  },
  {
    selector: 'CallExpression[callee.object.name="Date"][callee.property.name="now"]',
    message: "P5: no wall clock in src/domain — take `now` as an argument.",
  },
  {
    selector: 'CallExpression[callee.object.name="Math"][callee.property.name="random"]',
    message: "P3: src/domain is deterministic — no Math.random().",
  },
  {
    selector: 'MemberExpression[object.name="process"][property.name="env"]',
    message: "R-T5: src/domain reads no environment — pass configuration in.",
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // ~217 rules: cognitive complexity, duplicated function bodies, dead stores, nested
  // conditionals. This is the template that sets the bar; the block below adds the
  // size/shape budgets SonarJS deliberately leaves to the host project.
  sonarjs.configs.recommended,

  // Amendment item 5. A disable comment is a decision; it has to be narrow and it has to
  // say why. Applied everywhere, because a cheap path to green anywhere is a cheap path.
  comments.recommended,
  {
    name: "agent-dash/disable-comments-are-arguments",
    rules: {
      "@eslint-community/eslint-comments/no-unlimited-disable": "error",
      "@eslint-community/eslint-comments/require-description": [
        "error",
        { ignore: [] },
      ],
    },
  },

  {
    name: "agent-dash/quality-budgets",
    // `.mts` is in the glob because the fixture generator is written in it: it runs directly
    // on Node 24, and code that is exempt from the budgets is code that grows past them.
    files: ["src/**/*.{ts,tsx,mts}"],
    rules: {
      "max-lines": [
        "error",
        { max: BUDGETS.fileLines, skipBlankLines: true, skipComments: true },
      ],
      "max-lines-per-function": [
        "error",
        { max: BUDGETS.functionLines, skipBlankLines: true, skipComments: true },
      ],
      complexity: ["error", { max: BUDGETS.cyclomaticComplexity }],
      "max-depth": ["error", BUDGETS.nestingDepth],
      "max-params": ["error", BUDGETS.parameters],
      "max-nested-callbacks": ["error", BUDGETS.nestedCallbacks],
      "sonarjs/cognitive-complexity": ["error", BUDGETS.cognitiveComplexity],
    },
  },

  {
    name: "agent-dash/naming",
    files: ["src/**/*.{ts,tsx,mts}"],
    rules: {
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "default", format: ["camelCase"], leadingUnderscore: "allow" },
        // PascalCase is allowed for every value binding because React components are
        // values; narrowing this to `types: ["function"]` would need type-aware linting.
        {
          selector: ["variable", "function"],
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
        },
        { selector: "typeLike", format: ["PascalCase"] },
        { selector: "enumMember", format: ["PascalCase"] },
        // Fixture and API payload keys are snake_case by domain convention
        // (execution_mode, accepted_at). Shapes are data, not identifiers.
        { selector: ["objectLiteralProperty", "typeProperty"], format: null },
        { selector: "import", format: ["camelCase", "PascalCase"] },
      ],
    },
  },

  {
    name: "agent-dash/layering",
    rules: {
      // The computation/rendering seam (technical-spec § 3.1). Aggregation stays
      // unit-testable by being unable to reach for the layers above it.
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./src/domain",
              from: "./src/app",
              message: "R-T5: src/domain is the pure computation layer — it must not import from routes.",
            },
            {
              target: "./src/domain",
              from: "./src/components",
              message: "R-T5: src/domain is the pure computation layer — it must not import components.",
            },
            {
              target: "./src/domain",
              from: "./src/data",
              message: "R-T5: src/domain sits below the I/O boundary — src/data calls it, never the reverse.",
            },
            {
              target: "./src/domain",
              from: "./src/fixtures",
              message: "R-T5: src/domain receives rows as arguments; it never reaches the fixture generator.",
            },
          ],
        },
      ],
    },
  },

  {
    name: "agent-dash/computation-layer-is-framework-free",
    files: ["src/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: DOMAIN_FORBIDDEN_MODULES, patterns: DOMAIN_FORBIDDEN_PATTERNS },
      ],
      "no-restricted-globals": [
        "error",
        { name: "process", message: "R-T5: src/domain reads no environment — pass configuration in." },
      ],
      "no-restricted-syntax": ["error", ...DOMAIN_FORBIDDEN_SYNTAX],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": "error",
    },
  },

  {
    // Amendment item 2. R-T33 guards the seam from below; this guards it from above.
    // Without it a panel can import `aggregate()` and call it in render — "the weaker
    // version" technical-spec § 3.1 rejects, because computation reachable from React
    // gets tested through React. `allowTypeImports` keeps the ViewModel *type* available,
    // which is all a component legitimately needs (R-T6).
    name: "agent-dash/rendering-layer-cannot-compute",
    files: ["src/components/**/*.{ts,tsx}", "src/app/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/domain", "@/domain/*", "../domain/*", "../../domain/*", "../../../domain/*"],
              allowTypeImports: true,
              message:
                "R-T6: components render ViewModels, they do not compute. Types only — src/data/queries.ts is the sole runtime path into the domain.",
            },
          ],
        },
      ],
    },
  },

  {
    // Amendment item 4. resolveJsonModule is on, so without this any module can import a
    // fixture straight off disk and skip src/data/schema.ts. Boundary 1 has to be the only
    // door, or the validation is optional.
    name: "agent-dash/fixture-io-is-localised",
    files: ["src/**/*.{ts,tsx}"],
    // src/domain is excluded because it carries its own, stricter no-restricted-imports
    // above. Flat config *replaces* a rule's options rather than merging them, so a second
    // block matching the same files would silently drop the domain boundary. That failure
    // is invisible — the rule still reports, just not the things it was added for.
    ignores: ["src/data/**", "src/fixtures/**", "src/domain/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "node:fs", message: "R-T19: fixture I/O belongs to src/data/load.ts." },
            { name: "node:fs/promises", message: "R-T19: fixture I/O belongs to src/data/load.ts." },
            { name: "fs", message: "R-T19: fixture I/O belongs to src/data/load.ts." },
          ],
          patterns: [
            {
              group: ["*.json", "**/*.json"],
              message:
                "R-T19: fixture JSON is parsed and validated by src/data/load.ts — importing it directly bypasses the schema.",
            },
          ],
        },
      ],
    },
  },

  {
    // Amendment item 7. R-T8: shadcn's default legend uses key={index}, which reconciles
    // "Team A" into "Team B" in place across a roll-up switch. T-C3 catches it in one
    // component; this catches it in every module.
    name: "agent-dash/stable-series-identity",
    files: ["src/**/*.tsx"],
    rules: {
      "react/no-array-index-key": "error",
    },
  },

  {
    name: "agent-dash/unit-tests",
    files: ["src/**/*.{test,spec}.{ts,tsx}", "vitest.setup.ts"],
    extends: [vitest.configs.recommended, testingLibrary.configs["flat/react"]],
    rules: {
      // describe/it trees are nested callbacks by construction, and a thorough suite
      // is long on purpose. Budgets that punish thorough tests are the wrong incentive.
      "max-lines": "off",
      "max-lines-per-function": "off",
      "max-nested-callbacks": "off",
      "sonarjs/no-identical-functions": "off",
      "sonarjs/no-duplicate-string": "off",
      "vitest/expect-expect": "error",
      "vitest/no-focused-tests": "error",
      // Amendment item 5: was `warn`. A skipped test kept CI green, which is the cheapest
      // path to green in the repo and the one nobody is watching on an unattended build.
      "vitest/no-disabled-tests": "error",
      "vitest/no-identical-title": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": "error",
      // RTL only auto-registers cleanup when a global `afterEach` exists. Vitest globals
      // are off here (explicit imports type better), so vitest.setup.ts cleans up by hand.
      "testing-library/no-manual-cleanup": "off",
    },
  },

  {
    name: "agent-dash/e2e-tests",
    files: ["e2e/**/*.ts"],
    extends: [playwright.configs["flat/recommended"]],
    rules: {
      "max-lines-per-function": "off",
      "max-nested-callbacks": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": "error",
    },
  },

  {
    name: "agent-dash/global-tweaks",
    rules: {
      // An unfinished-work marker is a note, not a build failure: visible, never blocking.
      "sonarjs/todo-tag": "warn",
      "sonarjs/fixme-tag": "warn",
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated test output:
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    // Stryker's sandbox is a copy of src/ with `@ts-nocheck` prepended and mutants spliced in;
    // it is deleted after a run, but a cancelled run leaves it behind and it must never be linted.
    ".stryker-tmp/**",
    "reports/**",
    // shadcn primitives are vendored, not authored here.
    "src/components/ui/**",
  ]),
]);

export default eslintConfig;
