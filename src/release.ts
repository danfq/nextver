import { appendFile, readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

import { applyBump, releasable, renderNotes, resolveBump, type Bump } from "./core"
import { commitsSince, lastTag } from "./git"

/** release options, every field is optional */
export type ReleaseOptions = {
  /** repository directory, defaults to the current one */
  cwd?: string
  /** manifest holding the version, relative to cwd */
  manifest?: string
  /** file the notes are written to, relative to cwd */
  notes?: string
  /** tag prefix used to find the previous release and build the new tag */
  prefix?: string
  /** compute everything without writing any file */
  dryRun?: boolean
}

/** outcome of a release run */
export type ReleaseResult =
  | { skipped: true; previous: string | null }
  | {
      skipped: false
      previous: string | null
      current: string
      version: string
      tag: string
      bump: Bump
      notes: string
      commits: number
    }

/**
 * exposes a value to later workflow steps via $GITHUB_OUTPUT when running in actions
 *
 * @param key output name
 * @param value output value
 */
const output = async (key: string, value: string) => {
  const file = process.env.GITHUB_OUTPUT
  if (!file) return
  await appendFile(file, `${key}=${value}\n`)
}

/**
 * computes the next version from the commits since the last release and writes
 * the bump, the new version and the grouped release notes
 *
 * @param options release options
 *
 * @returns the computed release, or a skip when there is nothing to release
 */
export const release = async (options: ReleaseOptions = {}): Promise<ReleaseResult> => {
  const { cwd = process.cwd(), manifest = "package.json", notes = "RELEASE_NOTES.md", prefix = "v" } = options
  const dryRun = options.dryRun ?? false

  // resolve the previous tag and the commits since
  const previous = await lastTag(prefix, cwd)
  const commits = releasable(await commitsSince(previous, cwd))

  if (commits.length === 0) {
    if (!dryRun) await output("skip", "true")
    return { skipped: true, previous }
  }

  // read the current version from the manifest
  const manifestPath = resolve(cwd, manifest)
  const pkg = JSON.parse(await readFile(manifestPath, "utf8"))
  const current: string = pkg.version ?? "0.0.0"

  const bump = resolveBump(commits)
  const version = applyBump(current, bump)
  const tag = `${prefix}${version}`
  const body = renderNotes(commits)

  if (!dryRun) {
    // persist the new version in the manifest
    await writeFile(manifestPath, `${JSON.stringify({ ...pkg, version }, null, 2)}\n`)

    // write the curated notes for the release step to pick up
    await writeFile(resolve(cwd, notes), `${body}\n`)

    // hand the computed values to the workflow
    await output("version", version)
    await output("tag", tag)
    await output("bump", bump)
    await output("previous", previous ?? "")
    await output("skip", "false")
  }

  return { skipped: false, previous, current, version, tag, bump, notes: body, commits: commits.length }
}
