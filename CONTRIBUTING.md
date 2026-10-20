# Contributing

## How it relates to tsquare

This package depends on [`tsquare`](https://www.npmjs.com/package/tsquare), a released version, and gets everything from it: `compileWireframe`, `renderWireframeSvg` and `boardLayout`. In an app, the bundler picks tsquare's browser build (its `browser` export condition). The language and the renderer live in [tsquare-js/tsquare](https://github.com/tsquare-js/tsquare).

To try an unreleased tsquare change, install a local checkout without saving it: `npm install ../tsquare --no-save` (build it first), then `npm run build`. `npm ci` puts the released version back.

## Develop

```bash
npm install     # builds dist/ through "prepare"
npm test        # jsdom + React's client renderer + react-markdown
npm run typecheck
```

## Release

1. In a PR, bump the version (`npm version <x.y.z> --no-git-tag-version`) and add a `## <x.y.z>` section to `CHANGELOG.md`; it becomes the release notes. Merge it.
2. Tag `main` and push the tag: `git tag v<x.y.z> origin/main && git push origin v<x.y.z>`.

The release workflow checks the tag against `package.json` and the changelog, builds and tests, publishes to npm with trusted publishing (no token), and creates the GitHub release.

**One-time setup** (after the first version, which was published by hand with `npm publish --access public`): on npmjs.com, `@tsquare-js/react` → **Settings** → **Trusted Publisher** → GitHub Actions, organization `tsquare-js`, repository `react`, workflow `release.yml`, no environment, and allow `npm publish`.
