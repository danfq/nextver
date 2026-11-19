import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { execFileSync } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { release } from "../src/release"

let cwd: string

// run git inside the scratch repository
const git = (...args: string[]) => execFileSync("git", args, { cwd, stdio: "pipe" })

// commit an empty change with the given message
const commit = (message: string) => git("commit", "--allow-empty", "-m", message)

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), "nextver-"))
  git("init", "-q")
  git("config", "user.name", "test")
  git("config", "user.email", "test@example.com")
  git("config", "commit.gpgsign", "false")
  git("config", "tag.gpgsign", "false")

  await writeFile(join(cwd, "package.json"), `${JSON.stringify({ name: "x", version: "1.2.3" }, null, 2)}\n`)
  commit("chore: init")
  git("tag", "v1.2.3")
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

describe("release", () => {
  test("bumps from the commits since the last tag and writes the files", async () => {
    commit("fix: a bug")
    commit("feat(api): a feature")

    const result = await release({ cwd })

    expect(result).toMatchObject({ skipped: false, previous: "v1.2.3", version: "1.3.0", tag: "v1.3.0" })
    expect(JSON.parse(await readFile(join(cwd, "package.json"), "utf8")).version).toBe("1.3.0")
    expect(await readFile(join(cwd, "RELEASE_NOTES.md"), "utf8")).toContain("**api:** a feature")
  })

  test("skips when only release commits follow the last tag", async () => {
    commit("chore(release): v1.2.3")
    expect(await release({ cwd })).toEqual({ skipped: true, previous: "v1.2.3" })
  })

  test("writes nothing on a dry run", async () => {
    commit("fix: a bug")

    const result = await release({ cwd, dryRun: true })

    expect(result).toMatchObject({ version: "1.2.4" })
    expect(JSON.parse(await readFile(join(cwd, "package.json"), "utf8")).version).toBe("1.2.3")
  })
})
