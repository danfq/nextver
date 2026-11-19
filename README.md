# @danfq/nextver

Compute the next semantic version and grouped release notes from [Conventional Commits](https://www.conventionalcommits.org), built for GitHub Actions.

- **Zero runtime dependencies.** Just `git` and Node 18.3+ (or Bun).
- **Whole-range bumps.** Every commit since the last tag counts, so an earlier `feat` still drives a minor even when the latest commit is a `fix`.
- **Curated notes.** Breaking changes lead, then Features, Fixes, Performance, Refactoring and Documentation. Pairs with GitHub's `--generate-notes`, which adds "What's Changed" and "Full Changelog" below.
- **Actions-aware.** Writes `version`, `tag`, `bump`, `previous` and `skip` to `$GITHUB_OUTPUT` when present.

It does not commit, tag, push or publish. It computes the release and leaves those steps to your workflow.

## How it works

1. Finds the latest tag matching the prefix (`v*` by default).
2. Reads every non-merge commit since that tag (or the whole history when there is none), ignoring its own `chore(release)` commits.
3. Picks the bump:
   - **major** when any commit is breaking (`feat!:` or a `BREAKING CHANGE` footer)
   - **minor** when any commit is a `feat`
   - **patch** otherwise
4. Writes the new version to `package.json` and the notes to `RELEASE_NOTES.md`.

## Install

```bash
npm install --save-dev @danfq/nextver
```

Or run it without installing, through `npx @danfq/nextver` or `bunx @danfq/nextver`.

## Usage

```bash
nextver [options]
```

| Option              | Default            | Description                                                         |
| ------------------- | ------------------ | ------------------------------------------------------------------- |
| `--manifest <file>` | `package.json`     | Manifest holding the version                                        |
| `--notes <file>`    | `RELEASE_NOTES.md` | File the release notes are written to                               |
| `--prefix <text>`   | `v`                | Tag prefix                                                          |
| `--skip-empty`      | off                | Exit successfully with `skip=true` when there is nothing to release |
| `--dry-run`         | off                | Print the computed release without writing any file                 |

Without `--skip-empty`, a run with nothing to release exits with code `1`.

### GitHub Actions

The checkout needs the full history and tags.

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0

- name: Compute version and notes
  id: version
  run: npx @danfq/nextver

- name: Commit and tag release
  run: |
    git config user.name "github-actions[bot]"
    git config user.email "github-actions[bot]@users.noreply.github.com"
    git commit -am "chore(release): ${{ steps.version.outputs.tag }}"
    git tag -a "${{ steps.version.outputs.tag }}" -m "${{ steps.version.outputs.tag }}"
    git push origin "HEAD:${{ github.ref_name }}" --follow-tags

- name: Create GitHub release
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    gh release create "${{ steps.version.outputs.tag }}" \
      --title "${{ steps.version.outputs.tag }}" \
      --notes-file RELEASE_NOTES.md \
      --generate-notes
```

To release on every push instead of on demand, pass `--skip-empty` and guard the following steps with `if: steps.version.outputs.skip == 'false'`.

### Programmatic

```ts
import { release } from "@danfq/nextver"

const result = await release({ dryRun: true })

if (!result.skipped) console.log(result.version, result.notes)
```

The building blocks are exported too: `parseCommits`, `releasable`, `resolveBump`, `applyBump`, `renderNotes`, `lastTag` and `commitsSince`.

## License

MIT
