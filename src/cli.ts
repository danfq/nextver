import { parseArgs } from "node:util"

import { release } from "./release"

/**
 * command line entry
 *
 * @example npx @danfq/nextver --dry-run
 */

const USAGE = `Usage: nextver [options]

Options:
  --manifest <file>  Manifest holding the version (default: package.json)
  --notes <file>     File the release notes are written to (default: RELEASE_NOTES.md)
  --prefix <text>    Tag prefix (default: v)
  --skip-empty       Exit successfully with skip=true when there is nothing to release
  --dry-run          Print the computed release without writing any file
  -h, --help         Show this help`

const { values } = parseArgs({
  options: {
    manifest: { type: "string" },
    notes: { type: "string" },
    prefix: { type: "string" },
    "skip-empty": { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
})

if (values.help) {
  console.info(USAGE)
  process.exit(0)
}

try {
  const result = await release({
    manifest: values.manifest,
    notes: values.notes,
    prefix: values.prefix,
    dryRun: values["dry-run"],
  })

  // nothing new, fail unless the caller expects empty runs (e.g. a push trigger)
  if (result.skipped) {
    const log = values["skip-empty"] ? console.info : console.error
    log("No commits since the last release. Nothing to do.")
    process.exit(values["skip-empty"] ? 0 : 1)
  }

  console.info(`Bump: ${result.bump}`)
  console.info(`Version: ${result.current} -> ${result.version}`)
  console.info(`Tag: ${result.tag}`)
  console.info(`Commits: ${result.commits}`)

  if (values["dry-run"]) console.info(`\n${result.notes}`)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
