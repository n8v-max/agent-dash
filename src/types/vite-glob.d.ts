// The one Vite type the test suite needs, declared rather than pulled in.
//
// `import.meta.glob` is how a test reads its *own* directory's sources — `src/components/**` may
// not import `node:fs` (the fixture-I/O boundary is `src/data/load.ts`, and that rule is blunt on
// purpose), so a static assertion over a directory has no other handle. `vite/client` would
// supply this type, but `vite` is a transitive dependency of Vitest and is not resolvable from
// the project root, so the narrow declaration lives here instead of a broad triple-slash
// reference to a package that is not a dependency.

interface ImportMeta {
  /** Eager, raw-text glob. The only form used, and therefore the only form typed. */
  glob(
    pattern: string,
    options: { query: "?raw"; import: "default"; eager: true },
  ): Readonly<Record<string, string>>;
}
