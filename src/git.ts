import { execFile } from "node:child_process"
import { promisify } from "node:util"

import { parseCommits, RS, US, type Commit } from "./core"

const exec = promisify(execFile)

/**
 * runs a git command and returns its stdout
 *
 * @param args git arguments
 * @param cwd repository directory
 *
 * @returns stdout
 */
const git = async (args: string[], cwd: string): Promise<string> => {
  // long histories easily outgrow the default 1mb buffer
  const { stdout } = await exec("git", args, { cwd, maxBuffer: 64 * 1024 * 1024 })
  return stdout
}

/**
 * reads the most recent release tag, or null when none exists yet
 *
 * @param prefix tag prefix, e.g. "v"
 * @param cwd repository directory
 *
 * @returns latest matching tag or null
 */
export const lastTag = async (prefix: string, cwd: string): Promise<string | null> => {
  const out = await git(["tag", "--list", `${prefix}*`, "--sort=-v:refname"], cwd)
  const tags = out.split("\n").filter(Boolean)
  return tags[0] ?? null
}

/**
 * collects the commits since `from` (exclusive), or the whole history when null
 *
 * @param from tag to start from, exclusive
 * @param cwd repository directory
 *
 * @returns parsed conventional commits
 */
export const commitsSince = async (from: string | null, cwd: string): Promise<Commit[]> => {
  const range = from ? `${from}..HEAD` : "HEAD"
  const format = `%H${US}%s${US}%b${RS}`
  const out = await git(["log", range, "--no-merges", `--pretty=format:${format}`], cwd)

  return parseCommits(out)
}
