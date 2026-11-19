import { describe, expect, test } from "bun:test"

import {
  applyBump,
  parseCommits,
  releasable,
  renderNotes,
  resolveBump,
  RS,
  US,
  type Commit,
} from "../src/core"

// build a minimal commit for the bump tests
const commit = (type: string, breaking = false, scope: string | null = null): Commit => ({
  type,
  scope,
  breaking,
  subject: "subject",
  hash: "abc1234",
})

// mimic one git log record: hash US subject US body
const record = (hash: string, subject: string, body = "") => `${hash}${US}${subject}${US}${body}`

describe("resolveBump", () => {
  test("is a patch when there are only fixes and chores", () => {
    expect(resolveBump([commit("fix"), commit("chore")])).toBe("patch")
  })

  test("is a minor when any commit is a feat, even when the latest is only a fix", () => {
    // git log lists the latest first, so the feat sits behind a newer fix here
    expect(resolveBump([commit("fix"), commit("feat")])).toBe("minor")
  })

  test("is a major when any commit is breaking, even when the latest is only a feat", () => {
    expect(resolveBump([commit("feat"), commit("fix", true)])).toBe("major")
  })
})

describe("parseCommits", () => {
  test("parses every commit in the range, not just the first", () => {
    const raw = [
      record("h1", "feat(api)!: drop v0"),
      record("h2", "fix: a bug", "closes #1"),
      record("h3", "weird message"),
    ]
      .map((entry) => `${entry}${RS}`)
      .join("\n")

    const commits = parseCommits(raw)

    expect(commits).toHaveLength(3)
    expect(commits[0]).toMatchObject({ type: "feat", scope: "api", breaking: true, subject: "drop v0" })
    expect(commits[1]).toMatchObject({ type: "fix", scope: null, breaking: false, subject: "a bug" })
    expect(commits[2]).toMatchObject({ type: "other", subject: "weird message" })
  })

  test("detects a breaking change from the body", () => {
    const raw = `${record("h4", "feat: thing", "BREAKING CHANGE: removes x")}${RS}`
    expect(parseCommits(raw)[0].breaking).toBe(true)
  })
})

describe("applyBump", () => {
  test("a major resets the minor and patch", () => {
    expect(applyBump("1.6.2", "major")).toBe("2.0.0")
  })

  test("a minor resets the patch", () => {
    expect(applyBump("1.6.2", "minor")).toBe("1.7.0")
  })

  test("a patch increments the patch", () => {
    expect(applyBump("1.6.2", "patch")).toBe("1.6.3")
  })
})

describe("releasable", () => {
  test("drops release commits but keeps other chores", () => {
    const commits = [commit("chore", false, "release"), commit("chore", false, "deps"), commit("fix")]
    expect(releasable(commits)).toHaveLength(2)
  })
})

describe("renderNotes", () => {
  test("leads with breaking changes and groups the rest by type", () => {
    const notes = renderNotes([
      { ...commit("fix", false, "api"), subject: "a bug" },
      { ...commit("feat", true), subject: "drop v0" },
      { ...commit("chore"), subject: "ignored" },
    ])

    expect(notes).toBe(
      [
        "## Breaking Changes",
        "",
        "- drop v0 (abc1234)",
        "",
        "## Fixes",
        "",
        "- **api:** a bug (abc1234)",
      ].join("\n")
    )
  })
})
