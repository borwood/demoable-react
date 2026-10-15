# Package release

The repository README describes the runnable project. npm displays the README at the root of the published package, so release packaging copies `docs/npm/README.md` into an isolated staging directory as `README.md`. It never replaces the repository README. npm selects the distribution files from `package.json`; lifecycle scripts are disabled during packing. The staging directory is removed on success or failure.

This checkout prepares version 0.2.0; check the npm registry for availability before publishing. Published versions cannot be replaced. With dependencies installed (`npm ci`), create an output directory outside the checkout and run the single release command:

```sh
npm run pack:release -- C:/path/to/output
```

The command builds the library and prints the exact archive path and npm integrity metadata. Inspect that archive's `package/README.md` and file list. Run the configured checks (`npm run typecheck`, `npm run test:integration`, `npm run build`, `npm run test:consumer`, `npm run test:browser`); the consumer checks use the same staged pack helper with React 18 and 19. Integration coverage compares the actual archive README and preserves the repository README on success and failure.

Validate the exact candidate without uploading:

```sh
npm publish C:/path/to/output/borwood-demoable-react-0.2.0.tgz --dry-run --access public
```

After reviewing that artifact and authenticating to the intended npm account, publish that same tarball explicitly:

```sh
npm publish C:/path/to/output/borwood-demoable-react-0.2.0.tgz --access public
```

Do not publish the checkout directory: its README is intentionally different. Retain the reviewed archive and its hash until registry publication is verified. A dry run does not establish authentication or upload success. README changes on npm require a new package version; updating GitHub alone does not update npm's package page.
