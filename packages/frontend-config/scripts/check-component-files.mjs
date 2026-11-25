#!/usr/bin/env node

// One exported component per file, named like the file: `ProjectCard.tsx` exports `ProjectCard`
// and no other component. Biome's GritQL plugins cannot read a file's name, so this script checks
// it. The components shadcn's CLI generates into `src/components/ui/` keep shadcn's own layout.
//
// Each app of the stack runs it on its own folder, as `check-component-files`:
// `npm run check:components -w <app>`, which the app's `check` runs.

import { globSync, readFileSync } from "node:fs"
import { basename, join } from "node:path"

// npm runs a workspace's script in the workspace's folder: the app's root.
const appRoot = process.cwd()
// Component files are named in PascalCase.tsx; the test reads the name, since a glob ignores case
// on macOS.
const componentFiles = globSync("src/**/*.tsx", { cwd: appRoot }).filter(
  (file) => /^[A-Z]\w*\.tsx$/.test(basename(file)) && !file.startsWith("src/components/ui/"),
)
// Run outside an app, the check would find nothing and pass: it fails instead.
if (componentFiles.length === 0) {
  console.error(
    `No component file under ${join(appRoot, "src")}: run the check from an app's root.`,
  )
  process.exit(1)
}
// A component is a PascalCase function or constant, which leaves SCREAMING_CASE constants out.
const exportedComponent = /^export (?:async )?(?:function|const|class) ([A-Z][a-z]\w*)/gm

const problems = componentFiles.flatMap((file) => {
  const fileComponent = basename(file, ".tsx")
  const source = readFileSync(join(appRoot, file), "utf8")
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
