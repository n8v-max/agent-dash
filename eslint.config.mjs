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

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // ~217 rules: cognitive complexity, duplicated function bodies, dead stores, nested
  // conditionals. This is the template that sets the bar; the block below adds the
  // size/shape budgets SonarJS deliberately leaves to the host project.
  sonarjs.configs.recommended,

  {
    name: "agent-dash/quality-budgets",
    files: ["src/**/*.{ts,tsx}"],
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
    files: ["src/**/*.{ts,tsx}"],
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
      // The computation/rendering seam. Aggregation logic stays unit-testable by
      // being unable to reach for the UI layer.
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./src/lib",
              from: "./src/app",
              message:
                "src/lib is the pure computation layer — it must not import from routes.",
            },
            {
              target: "./src/lib",
              from: "./src/components",
              message:
                "src/lib is the pure computation layer — it must not import components.",
            },
          ],
        },
      ],
    },
  },

  {
    name: "agent-dash/computation-layer-is-framework-free",
    files: ["src/lib/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "react", message: "Keep src/lib renderer-agnostic." },
            { name: "react-dom", message: "Keep src/lib renderer-agnostic." },
            { name: "recharts", message: "Keep src/lib renderer-agnostic." },
          ],
          patterns: [
            { group: ["next", "next/*"], message: "Keep src/lib framework-free." },
          ],
        },
      ],
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
      "vitest/no-disabled-tests": "warn",
      "vitest/no-identical-title": "error",
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
  ]),
]);

export default eslintConfig;
