/**
 * pure release logic
 *
 * parsing, bump resolution and notes rendering, kept free of git and the
 * filesystem so it can be tested without a repository
 *
 * @see https://www.conventionalcommits.org
 */

/** conventional commit shape */
export type Commit = {
  type: string
  scope: string | null
  breaking: boolean
  subject: string
  hash: string
}

/** semantic bump kind, ordered by weight */
export type Bump = "major" | "minor" | "patch"

/** unit separator used to split the git log fields safely */
export const US = "\x1f"

/** record separator used to split the git log entries safely */
export const RS = "\x1e"

// conventional commit parser: type(scope)!: subject
const COMMIT_RE = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/

/** commit type to human readable section title, order defines section order */
export const SECTIONS: Record<string, string> = {
  feat: "Features",
  fix: "Fixes",
  perf: "Performance",
  refactor: "Refactoring",
  docs: "Documentation",
}

/**
 * parses a git log payload into conventional commits
 *
 * @param raw git log output in the `%H US %s US %b RS` format
 *
 * @returns parsed conventional commits
 */
export const parseCommits = (raw: string): Commit[] => {
  return raw
    .split(RS)
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [hash, subject, body] = record.split(US)
      const match = subject.match(COMMIT_RE)

      // keep unconventional commits around under the "other" bucket
      if (!match) {
        return { type: "other", scope: null, breaking: false, subject, hash }
      }

      const [, type, scope, bang, description] = match
      const breaking = Boolean(bang) || /BREAKING CHANGE/.test(body ?? "")

      return { type, scope: scope ?? null, breaking, subject: description, hash }
    })
}

/**
 * drops the release commits this tool makes itself
 *
 * keeps a push triggered workflow from releasing its own "chore(release)" commit
 *
 * @param commits parsed commits
 *
 * @returns the commits worth releasing
 */
export const releasable = (commits: Commit[]): Commit[] =>
  commits.filter((commit) => !(commit.type === "chore" && commit.scope === "release"))

/**
 * decides the bump from the commit set
 *
 * breaking wins, then feat, then everything else is a patch since the release was requested on purpose
 *
 * the whole commit set is considered, so an earlier breaking change or feature
 * still drives the bump even when the latest commit is only a fix
 *
 * @param commits parsed commits
 *
 * @returns the bump to apply
 */
export const resolveBump = (commits: Commit[]): Bump => {
  if (commits.some((commit) => commit.breaking)) return "major"
  if (commits.some((commit) => commit.type === "feat")) return "minor"
  return "patch"
}

/**
 * applies a bump to a semver string
 *
 * @param version current version
 * @param bump bump to apply
 *
 * @returns the next version
 */
export const applyBump = (version: string, bump: Bump): string => {
  const [major, minor, patch] = version.split(".").map((part) => Number(part) || 0)

  switch (bump) {
    case "major":
      return `${major + 1}.0.0`
    case "minor":
      return `${major}.${minor + 1}.0`
    case "patch":
      return `${major}.${minor}.${patch + 1}`
  }
}

/**
 * formats a single commit line with an optional scope prefix
 *
 * @param commit commit to format
 *
 * @returns bullet text
 */
export const formatCommit = (commit: Commit): string => {
  const scope = commit.scope ? `**${commit.scope}:** ` : ""
  return `${scope}${commit.subject} (${commit.hash.slice(0, 7)})`
}

/**
 * builds the grouped markdown body for the release
 *
 * github auto generates the "What's Changed" and "Full Changelog" sections, so this only
 * owns the curated, human readable summary that sits on top
 *
 * @param commits parsed commits
 *
 * @returns markdown notes
 */
export const renderNotes = (commits: Commit[]): string => {
  const lines: string[] = []

  // breaking changes always lead
  const breaking = commits.filter((commit) => commit.breaking)
  if (breaking.length > 0) {
    lines.push("## Breaking Changes", "")
    for (const commit of breaking) lines.push(`- ${formatCommit(commit)}`)
    lines.push("")
  }

  // one section per known type, skipping breaking ones already listed above
  for (const [type, title] of Object.entries(SECTIONS)) {
    const group = commits.filter((commit) => commit.type === type && !commit.breaking)
    if (group.length === 0) continue

    lines.push(`## ${title}`, "")
    for (const commit of group) lines.push(`- ${formatCommit(commit)}`)
    lines.push("")
  }

  return lines.join("\n").trim()
}
