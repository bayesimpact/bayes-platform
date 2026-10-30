#!/usr/bin/env node

// One exported component per file, named like the file: `ProjectCard.tsx` exports `ProjectCard`
// and no other component. Biome's GritQL plugins cannot read a file's name, so this script checks
// it. The components shadcn's CLI generates into `src/components/ui/` keep shadcn's own layout.
//
// Run it with `npm run check:components -w @caseai-connect/desk`, which `check` runs.

import { globSync, readFileSync } from "node:fs"
import { basename, dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const deskRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
// Component files are named in PascalCase.tsx; the test reads the name, since a glob ignores case
// on macOS.
const componentFiles = globSync("src/**/*.tsx", { cwd: deskRoot }).filter(
  (file) => /^[A-Z]\w*\.tsx$/.test(basename(file)) && !file.startsWith("src/components/ui/"),
)
// A component is a PascalCase function or constant, which leaves SCREAMING_CASE constants out.
const exportedComponent = /^export (?:async )?(?:function|const|class) ([A-Z][a-z]\w*)/gm

const problems = componentFiles.flatMap((file) => {
  const fileComponent = basename(file, ".tsx")
  const source = readFileSync(join(deskRoot, file), "utf8")
  return [...source.matchAll(exportedComponent)]
    .map((match) => match[1])
    .filter((component) => component !== fileComponent)
    .map(
      (component) => `${file} exports ${component}, where it should export ${fileComponent} only`,
    )
})

if (problems.length > 0) {
  console.error(
    `One exported component per file, named like the file. Move each other component to a file of its own:\n${problems.map((problem) => `  ${problem}`).join("\n")}`,
  )
  process.exit(1)
}
