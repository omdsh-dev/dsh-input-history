# dsh-input-history

[简体中文](./README.md) | **English**

DSH Web input history plugin: recall and cycle through already-sent messages with **Ctrl+Up / Ctrl+Down**, just like a terminal — with zero core changes.

> **Pick the plugin version that matches your DSH** (a mismatch crashes: common symptom `useConversation is not a function`)
> - DSH **0.1.1-rc.2** (npm latest): install the **old** version `'@dsh-external/dsh-input-history@github:omdsh-dev/dsh-input-history#v0.1.2'`
> - DSH **0.1.2-alpha.1 / alpha.2 / alpha.3 / alpha.4 / alpha.5 / rc.1**: install the **new** version (the default command below)
## Installation (profile mode)

```sh
# Option 1: pinned-tag git dependency (public mirror, recommended; github:omdsh-dev/dsh-input-history also works)
dsh plugin --profile web add '@dsh-external/dsh-input-history@github:omdsh-dev/dsh-input-history#v0.1.9'

# Option 2: local link (development)
git clone https://github.com/omdsh-dev/dsh-input-history.git
cd dsh-input-history && pnpm install && pnpm run build
dsh plugin --profile web add link:/path/to/dsh-input-history
```

Config line (`$DSH_HOME/profiles/web/cordis.patch.yml`, hot-reloaded, no restart needed):

```yaml
- insert:
    - id: dsh-input-history
      name: '@dsh-external/dsh-input-history'
```

> **Install tips**: pnpm 11 may block node-pty build scripts on first install — run `pnpm approve-builds --all` under `~/.dsh/profiles/web` and re-run the install; then **hard-refresh the browser** (Ctrl/Cmd+Shift+R).

### Prompt install (let DSH install it)

Paste this prompt into any DSH session and the agent installs it for you:

> Install the dsh-input-history plugin (DSH input-history recall plugin (terminal-style Ctrl+Up/Ctrl+Down)):
> 1. Run `dsh plugin --profile web add '@dsh-external/dsh-input-history@github:omdsh-dev/dsh-input-history#v0.1.9'` (the first run may fail because pnpm 11 blocks node-pty build scripts)
> 2. Under `~/.dsh/profiles/web`, run `pnpm approve-builds --all` (approve the build scripts)
> 3. Re-run the install command from step 1
> 4. Remind me to hard-refresh the browser (Ctrl/Cmd+Shift+R)
> On errors, first check the FAQ/known limitations in the README at <https://github.com/omdsh-dev/dsh-input-history>.


, all 18 unit tests, and the build are green).

**npm release compatibility**: compatible with the DSH npm release `@deepseek-ai/dsh@0.0.1-rc.5` (dist-tag `next`, i.e. the npm release of the final snapshot snapshot0812; `npm exec -p @deepseek-ai/dsh@0.0.1-rc.5 -- dsh --profile web --port <port>` lets you reach and start the specified version, lib production mode), while remaining compatible with `@deepseek-ai/dsh@0.0.1-rc.2` (the npm release of snapshot0811). Verified (npm rc.5 baseline): after `dsh web` starts, the `window.__DSH_BOOT__` manifest includes this plugin (inject: `dsh-client-runtime`/`dsh-client-ui-conversation`), and `/plugins/@dsh-external/dsh-input-history/client.js` returns 200; src typechecks clean against the rc.5 baseline build artifacts (this plugin has migrated its cordis type imports and peer to `@deepseek-ai/cordis`, see below). Note: starting with 0811, the vendored cordis was renamed to `@deepseek-ai/cordis` (the npm releases no longer publish a vendored package under the name `cordis`), and this plugin has migrated (peer declares `@deepseek-ai/cordis: ^4.0.1-rc.1`, which is `4.0.1-rc.4` on the npm rc.5 baseline), so a plain `npm install` no longer reports ERESOLVE.

### 0809 compatibility notes (real-machine verified)

- **Loading mechanism change**: 0809 reworked the client plugin mechanism — the old `dsh.plugin.json` manifest + `resolveClientPath` (`packages/plugin/plugin`) has been removed, replaced by the **`dshClient` declaration in package.json** (`platform: 'web'`, optional `inject`/`immediately`) + `exports["./client"]` pointing at the build artifact; the host scans loader entries to compose the boot graph, and the Web client fetches from `/plugins/<id>/client.js`. This plugin's package.json already satisfies that declaration and needs no change.
- The relied-upon official input façade `conversation.input.for(actx).setDraft()` and the `ConversationSnapshot.nodes` session snapshot are preserved on 0809 with unchanged contracts; the keyboard capture interception depends on no slots.
- **Build requirement**: the 0809 host validates the `dshClient` package's build artifacts at activation; if missing, it throws `ClientPackageCompositionError` and **refuses to start `dsh web`** — after upgrading the snapshot or changing the source you must re-run `pnpm run build` before starting, otherwise the browser fetches the stale `lib/client.js`.

### 0810 compatibility notes (snapshot0810)

- **Metadata discovery change**: 0810's ClientModuleHostService scans the package.json of loaded plugins at startup, but only reads the **nested `dsh.client`** (`resolveMeta` in `packages/client/modules/src/index.ts`, `pkg.dsh.client`); an unreadable top-level `dshClient` field is silently dropped from the boot graph — no log, no error, "starts fine but none of the plugins". This plugin has migrated from the top-level `dshClient` to the nested `dsh.client` (inject preserved as-is); the `lib/client.js` build artifact is unchanged (package.json does not participate in compilation), so with a symlink install, editing the source repo takes effect immediately — no reinstall needed.

### 0811 compatibility notes (snapshot0811, real-machine verified)

- **cordis rename (the only official change in this snapshot affecting this plugin)**: 0811 renamed the vendored cordis from `cordis@4.0.0-rc.7` to **`@deepseek-ai/cordis@4.0.1-rc.1`** (all official client packages now import from `@deepseek-ai/cordis` accordingly). This plugin has only type-only imports of cordis (`import type { Context } from 'cordis'` in `src/index.ts` and `src/invariant.ts`), and the **build artifacts (lib/*.js) have zero cordis runtime imports** — the rename does not affect the runtime loading of the already-built bundle; however, when typechecking the source against the npm rc.2 baseline, the bare `cordis` import reports TS2307 (and only there), and **after migrating the type imports to `from '@deepseek-ai/cordis'` it is fully clean**. It is recommended to also migrate `peerDependencies.cordis` to `@deepseek-ai/cordis: ^4.0.1-rc.1`.
- **Real-machine boot verification**: after starting web on snapshot0811 (`snapshots/20260811T152241Z`), the `window.__DSH_BOOT__` manifest contains `@dsh-external/dsh-input-history` (inject: `dsh-client-runtime`/`dsh-client-ui-conversation`), and `/plugins/@dsh-external/dsh-input-history/client.js` returns 200; typecheck (including tests) passes against the 0811 baseline. The relied-upon input façade `conversation.input.for(actx).setDraft()` and `ConversationSnapshot.nodes` contracts remain unchanged on 0811 (the 0811 session snapshot only adds a `views` field, which does not affect reading nodes).

### 0812/final snapshot compatibility notes (snapshots/20260812T172954Z-final, real-machine verified)

- **cordis rename finalized**: this plugin has migrated its type-only imports (`import type { Context } from '@deepseek-ai/cordis'` in `src/index.ts` and `src/invariant.ts`) and `peerDependencies` to `@deepseek-ai/cordis` (`^4.0.1-rc.1`; `@deepseek-ai/cordis@4.0.1-rc.4` on the npm rc.5 baseline) — the build artifacts (lib/*.js) still have zero cordis runtime imports, npm rc.5 consumers typecheck clean, and `npm install` needs no `--legacy-peer-deps`.
- **invariants source package move (only affects local typecheck)**: the final snapshot moved the `@deepseek-ai/dsh-invariants` source package from `packages/support/invariants` to `packages/runtime-diagnostics/invariants`, and the devDependencies paths have been updated accordingly; the service name `invariants` and the registration protocol are unchanged, so runtime is unaffected.
- **Real-machine boot verification**: after starting web on the final snapshot (`snapshots/20260812T172954Z-final`), the `window.__DSH_BOOT__` manifest contains `@dsh-external/dsh-input-history`, and `/plugins/@dsh-external/dsh-input-history/client.js` returns 200; the boot manifest likewise contains this plugin after an npm rc.5 consumer starts `dsh web`. The relied-upon input façade `conversation.input.for(actx).setDraft()` and `ConversationSnapshot.nodes` contracts remain unchanged on the final snapshot and rc.5 (neither the `views` field added in 0811 nor `InputState.imageIds` affects the nodes/draft contracts this plugin reads). Typecheck, build, and 18 unit tests pass against the final snapshot baseline.

### dsh-v0.1.2-rc.1 compatibility notes (v0.1.8)

- **Verification**: alpha.5 → rc.1 is version-bump-only upstream (252 files, zero code diff); verified live on rc.1, no code changes needed. The alpha.1–alpha.5 range above remains compatible

### dsh-v0.1.2-alpha.1 compatibility notes (v0.1.4)

- **Service-face migration**: the old `@deepseek-ai/dsh-client-runtime/client` package was removed. This plugin's types moved to `@deepseek-ai/cordis` (Context), `@deepseek-ai/dsh-api-session-controller/client` (ISessions) and `@deepseek-ai/dsh-client-ui-conversation/client` (IConversation/SessionInput/ConversationNode), with the chat view snapshot type pulled through `@deepseek-ai/dsh-client-ui-chat/client`'s declaration merge.
- **History-source migration**: the conversation snapshot no longer carries `nodes`. History extraction now goes through the Conversation assembly service: `ctx.uiConversation.binding(sessionId).snapshot.getSnapshot().views.get('chat')?.legacy.nodes` (the chat view's legacy compatibility projection; the user node shape is unchanged, so the `kind === 'user'` filter and text-block concatenation need no edits).
- **Input façade preserved**: `conversation.input.for(actx).setDraft()` and `input.state.getSnapshot().draft` remain on the ui-conversation Lexical input shell (SessionInputShell); `setDraft` itself places the caret at the end, so the plugin no longer moves it by hand.
- **Editor DOM change**: the composer changed from a textarea to a contenteditable div (`data-composer-input`, still inside `data-input-scroll`). The target check is relaxed to "an element inside `data-input-scroll`"; draft reads always take the input machine's published clipboard projection (contenteditable DOM text cannot restore reference chips).
- **Registration form**: the plugin exports `inject = ['sessions', 'uiConversation', 'conversation']` and reads `ctx.sessions` / `ctx.uiConversation` directly in `apply`, no longer using the `ctx.inject([...], scope => ...)` wrapper; `dsh.client.inject` is updated to the api-session-controller / ui-chat / ui-conversation package-name edges.

## Features

- **Ctrl+Up**: fills the input box with the most recently sent user message; pressing it repeatedly walks upward through older messages
- **Ctrl+Down**: walks back down to newer messages; when you return to the newest position, it restores the unsent draft you had before pressing Ctrl+Up
- Bare arrow keys, Enter, Ctrl+Z/Y, the slash menu, and everything else pass through untouched — cursor movement in multi-line input is unaffected (matching the constraints of [dsh-external/issues#153](https://github.com/dsh-external/issues/issues/153))
- History comes from the user messages in the current session snapshot (adjacent duplicates automatically removed, blanks skipped) and remains available after refreshing the page
- The browse state automatically resets once the input box is manually edited, pasted into, or its draft is cleared by sending

## Installation (profile mode)

```sh
# Option 1: pinned-tag git dependency (public mirror, recommended; github:omdsh-dev/dsh-input-history also works)
dsh plugin --profile web add '@dsh-external/dsh-input-history@github:omdsh-dev/dsh-input-history#v0.1.9'

# Option 2: local link (development)
git clone https://github.com/omdsh-dev/dsh-input-history.git
cd dsh-input-history && pnpm install && pnpm run build
dsh plugin --profile web add link:/path/to/dsh-input-history
```

Config line (`$DSH_HOME/profiles/web/cordis.patch.yml`, hot-reloaded, no restart needed):

```yaml
- insert:
    - id: dsh-input-history
      name: '@dsh-external/dsh-input-history'
```

> **Install tips**: pnpm 11 may block node-pty build scripts on first install — run `pnpm approve-builds --all` under `~/.dsh/profiles/web` and re-run the install; then **hard-refresh the browser** (Ctrl/Cmd+Shift+R).

### Prompt install (let DSH install it)

Paste this prompt into any DSH session and the agent installs it for you:

> Install the dsh-input-history plugin (DSH input-history recall plugin (terminal-style Ctrl+Up/Ctrl+Down)):
> 1. Run `dsh plugin --profile web add '@dsh-external/dsh-input-history@github:omdsh-dev/dsh-input-history#v0.1.9'` (the first run may fail because pnpm 11 blocks node-pty build scripts)
> 2. Under `~/.dsh/profiles/web`, run `pnpm approve-builds --all` (approve the build scripts)
> 3. Re-run the install command from step 1
> 4. Remind me to hard-refresh the browser (Ctrl/Cmd+Shift+R)
> On errors, first check the FAQ/known limitations in the README at <https://github.com/omdsh-dev/dsh-input-history>.

## Build

```sh
pnpm install
pnpm run build      # lib/index.js + lib/invariant.js + lib/client.js
pnpm run test       # 纯逻辑单测
pnpm run typecheck
```

## Design notes

- Pure browser-side implementation: no server-side behavior (`src/index.ts` is a shell), and nothing is injected into the model or the session log
- History data is derived from `ConversationSnapshot.nodes` (text blocks with `kind === 'user'`); no second copy of state is maintained
- Keyboard events are intercepted at the document capture phase and only take effect when they match `Ctrl+ArrowUp/ArrowDown` and the focus is in the conversation input box (inside `data-input-scroll`)
- Draft writes go through the official input façade `conversation.input.for(actx).setDraft()` and are compatible with undo/send transactions

## Known Limitations and Deferred Work

- History only covers the current session (per issue #153 semantics); cross-session/cross-device history sharing is not implemented
- Messages older than the snapshot window are not in scope for recall (the window always contains the most recently sent messages, so the practical impact is small)
- The Cmd modifier key on macOS is not bound (could be extended into a config option)
- The browse state resets after switching sessions; it does not carry across sessions