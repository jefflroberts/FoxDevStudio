# Handoff: getting Shutter Ace (C:\avbcodev) to run in FoxDev Studio

Last updated 2026-09-24. Not committed (nor is `handoff-tools/` or
`tests/zz-avbco-run.scratch.test.ts`); never commit them.

## Goal

Make `C:\avbcodev\avbco.pjx` (Shutter Ace / ShutterDesign II, a 60k-line Visual FoxPro app built on
the CodeMine framework at `C:\CODEMINE`) run under FoxDev Studio, fixing FoxDev wherever it falls
short. Every language behavior is measured against the real `vfp9.exe` first.

## Rules the user set

- **Measure first.** Measure in VFP 9 before writing behavior:
  `node scripts/vfp-expected.mjs --probe file.prg` for a question, or a golden in
  `crates/foxvm/tests/programs` (its `.expected` written by `node scripts/vfp-expected.mjs <file>.prg`).
  Probes must not name a helper `log` (collides with `LOG()`).
- **Keep `C:\avbcodev` and its data untouched.** The registry values the install dialog wrote were
  written with the user's OK.
- **GitHub.** The maintainer welcomes pull requests ("Please keep them coming!" on #2). The user
  chose topic-sized PRs off `main`. Confirm before opening issues or posting comments.
- **Commits.** End commit messages with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; PR bodies end with the Claude Code line.

## Machine quirks (Windows on ARM64, under Parallels)

- In Bash, prefix every build or test:
  `export PATH="/c/Program Files/nodejs:$USERPROFILE/.cargo/bin:$PATH" RUSTUP_TOOLCHAIN=stable-x86_64-pc-windows-msvc`
- After any Rust change: `npm run build:wasm`. After any change to `native/fllhost/fllhost.c`:
  `npm run build:fllhost` (it also builds the test libraries in `tests/fll/build`).
- Launch the IDE with `npx electron-vite dev`, not `npm run dev` (the COM addon can't build here).
  `npm install` needs `--ignore-scripts`.
- **Never run `cargo fmt` wholesale.** It reformats ~70 files in this repo. Tidy by hand.
- Write files with LF line endings. A Python `open(p, 'w')` on Windows writes CRLF; use
  `newline=''` (or `'\n'`).
- **The full TS suite takes ~18 min.** Two files fail identically on untouched code, so exclude them:
  `npx vitest run --exclude "tests/zz-*" --exclude tests/vfp/samplesRun.test.ts --exclude tests/win32/win32api.test.ts`.
  - `win32api` crashes natively on ARM64.
  - `samplesRun` runs out of heap on `Solution/Toledo/scattername.scx`, which never finishes (not
    investigated).
  - The last full run was green: 87 files, 571 tests. Rust: 674 tests (`cargo test -p foxvm`).
- **Before a PR, also run:**
  - `npx vitest run tests/reference`. If it fails, regenerate the coverage doc with
    `REGEN_DOCS=1 npx vitest run tests/reference/coverage.test.ts`.
  - `npm run argforms:check`.

## Branches and pull requests

| Branch | PR | Holds |
|---|---|---|
| `sql-forms-real-apps` | #2 | Five SQL/name forms |
| `set-procedure` | #5 | SET PROCEDURE, `DO name+"x"` (fixes #1, closes #3) |
| `runtime-classes` | #6 | DODEFAULT, Error methods, @var, class library search, importer inheritance |
| `screen-and-objects` | #7 | Access/Assign, _SCREEN/_VFP, released forms, FOR EACH over Forms |
| `fll-references` | #8 | FLL reference parameters, integer wrap (on top of #6) |
| `language-forms` | #9 | Class property expressions, class-body arrays, SYS(2007), SET words |
| `select-clause-order` | #10 | SELECT clauses in any order, _TALLY (on top of #2) |
| `startup-environment` | #11 | VERSION(2), SET LIBRARY paths, POPUP(), #INCLUDE loops |
| `avbco-integration` | none | **Current working branch.** All of the above together, at `ecf424b`. |

New work goes on `avbco-integration` first. When a batch is done, cut it into a topic branch off
`main`:
1. `git diff <last-split-point> HEAD > all.patch`. The last split point is `ecf424b`.
2. `python handoff-tools/hunks.py list all.patch` to number the hunks.
3. Write a topics JSON, then `hunks.py write` to make one patch per topic.
4. Apply each patch in a scratch `git worktree` on `main`, build it, and test it.

In the worktree:
- Junction `node_modules` to this checkout's, and remove the junction with `cmd /c rmdir` before
  `git worktree remove`, or the removal deletes the real `node_modules` through it.
- Set `CARGO_TARGET_DIR` to this checkout's `target` to reuse the build.

Check PR state with `gh pr list -R FoxDevCommunity/FoxDevStudio`. If a PR is merged or reviewed,
rebase or answer as needed; a merged #6 or #2 makes #8 or #10 show only their own commit.

## How to run it

**IDE:**
1. `git checkout avbco-integration`, `npm run build:wasm`, `npm run build:fllhost`.
2. `npx electron-vite dev`.
3. Open `C:\avbcodev\avbco.fxproject` and press F5.

The IDE really writes files, so saved data goes into `C:\avbcodev\data`.

**Headless harness** (what Claude drives):
`tests/zz-avbco-run.scratch.test.ts` does exactly what F5 does:
- It uses the real project store, project source, session, 32-bit FLL host and DLL service.
- Files are read from disk on demand; file writes stay in memory, but registry writes are real.
- Every dialog is answered and every error recorded.

```
R=<report file>; AVBCO_REPORT="$R" AVBCO_MAX_ERRORS=10 npx vitest run tests/zz-avbco-run.scratch.test.ts
```

- `AVBCO_INSTALL=1` drives the first-run install dialog; `=show` stops before Finish.
- `AVBCO_EVAL` takes expressions, one per line, to evaluate while the app waits. Plain reads only:
  calling an object's methods from the quiet evaluator hangs, and `EXECSCRIPT()` works for
  `@var` calls.
- Output lines contain CR from `CHR(13)`; pipe through `tr '\r' '|'`.
- "recursive use of an object ... unsafe aliasing" means an earlier wasm call trapped; find the
  first failure.
- `python handoff-tools/find_app.py <class> [method]` prints CodeMine source from the imported
  `.fxc` JSON.

**Registry state** (written by the install dialog with the user's OK):
- Key: `HKCU\Software\Classes\VirtualStore\MACHINE\SOFTWARE\WOW6432Node\Soft Classics\CodeMine`.
- Owner and organization: `na`.
- `SerialNumber`: `Serial-57517`, checked valid with vfp9.exe.
- `Paths\Local|Shared|Common`: `c:\avbcodev\data\` (where the required files are).
- Deleting `SerialNumber` brings the install dialog back.

## Where the run stands

In `appApplication.Start` (`handoff-tools/find_app.py appapplication start`), the run gets past:
- the version check, splash, core libraries and install check (lines 13-68);
- the search path and `LoadLibraries` (73-80).

It stops inside `CreateGlobalObjects` (line 85). The state manager, message manager and security
objects exist. Next errors, in order:

1. **`CMEVENT.SUBSCRIBE` line 20: "suspending inside EVALUATE()". Start here.** EVALUATE() of an
   expression that calls an object's method needs a host request, and `eval_in_frame` (vm.rs)
   refuses to suspend. This is the real architecture problem: EVALUATE (and macro expansion `&`,
   and the quiet evaluator) must be able to suspend and resume like any other call, probably by
   running the inline frame on the fiber and letting the pending host request complete before
   returning its value. Measure first what CodeMine's `cmEvent.Subscribe` evaluates
   (`find_app.py cmevent subscribe`).
2. `CMREGISTRY.GETCURSOR` line 8: unknown member `ACURSORNAMES`.
3. `CMMESSAGE.FATALERROR` line 8: `NSTATUS is not an object`, repeated. Probably fallout from 1-2.

After `CreateGlobalObjects`, startup still has to get through:
- `SetTitle`, `ShowMainWindow`, `CreateStates`;
- `BeforeMenu`, `ShowMenu`, `OpenAppToolbars`;
- `READ EVENTS`, with the main menu up.

**Estimate given to the user:**
- A few sessions to reach the main menu, the EVALUATE work being the big one.
- Several more for common screens to work: CodeMine's data manager, views, buffering. 11 of 47
  forms and class libraries still don't compile cleanly.
- QuickBooks (COM), reports, ImageMaker.dll and printing are separate subsystems and further off.

## Known gaps recorded, not fixed

Runtime behaviors that differ from VFP:
- SYS(16) ignores its level and gives no file path (VFP: `PROCEDURE NAME C:\PATH\FILE.FXP`); the VM
  does not know each module's file.
- A DEFINE CLASS property expression calling a program's own function is evaluated here; VFP
  refuses it (error 31).
- Class-body arrays keep only their first dimension; `a[2,2] = x` is skipped with a warning.
- `_VFP.Height` etc. read back what was written but do not move `_SCREEN`.
- Reading `_SCREEN.Forms` as a value raises 1925 here; VFP says 1924.
- An object renamed at run time answers to its new Name but is not reachable by it.
- `THIS_ACCESS` is not implemented; `Prop_Access`/`Prop_Assign` are.
- A property holding an array of objects is not nulled when a form in it is released.
- `ca::Method()` from a method of a different name runs the parent's version of the running method.
- Program classes: default `Name` and `ParentClass` unset.
- A LOCAL shadows a same-named field (VFP reads the field).
- `_TALLY` is set by SELECT only.

Importer and IDE:
- Hidden ancestor copies (`Init#1`) show in the designer's method list after a re-import.
- The importer writes `.fxc` files beside libraries outside the project (e.g. into `C:\codemine`)
  and fails with EPERM under Program Files.

Tests:
- `Toledo/scattername.scx` never finishes in `samplesRun`.

## Design notes worth keeping

- **DODEFAULT.** The importer keeps overridden `.vcx` methods as `Name#1`, `Name#2` (nearest
  ancestor first), each compiled with its own class's header. The VM sends the running method's
  full compiled name in `CallParentMethod.from`. The session runs `Name#n+1`, or walks DEFINE CLASS
  parents from the writing class, answering .T. when nothing is above.
- **Access/Assign.** Handled in the VM's GetMember, LoadField and SetMember through the optional
  host read `hasCodeMethod`. Inside `Prop_Access`/`Prop_Assign`, `THIS.Prop` is the property itself.
- **FLL references.** The wire tag `R` wraps a referenced argument; fllhost hands the library a
  Locator and serves `_Load` (30) and `_Store` (29). Stored values come back in the reply and
  `wasm.rs` writes them into the `Value::Ref` cells.
- **Class property expressions.** Kept as source (`ClassProto.expressions`), collected by
  `buildClassInstance`, and evaluated by `workOutProperties` in the caller's frame
  (`vm.evaluateIn(ctx.fiber, -1, ...)`).
- Memory notes for Claude live in `~/.claude/projects/C--Users-jeffroberts-Projects-FoxDevStudio/memory/`.
