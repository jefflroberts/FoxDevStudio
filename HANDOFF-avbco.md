# Handoff: getting Shutter Ace (C:\avbcodev) to run in FoxDev Studio

Last updated 2026-09-24 (second session). This file, `handoff-tools/` and
`tests/zz-avbco-run.scratch.test.ts` are committed on `avbco-integration` only (the user committed
them in `12ea0c6`). Keep them out of every topic branch and pull request.

## Resuming (do this first)

1. Read this file through.
2. `git checkout avbco-integration` and confirm HEAD is the handoff commit on top of `8dbf473`.
3. `gh pr list -R FoxDevCommunity/FoxDevStudio --state all` and check each PR's reviews and inline
   comments (`gh api repos/FoxDevCommunity/FoxDevStudio/pulls/<n>/reviews` and `/comments`). Report
   merges and comments; do not reply without asking.
4. Rebuild before running anything: `npm run build:wasm` (the generated wasm is not committed).
5. Ask the user about the pending PR split below before cutting or opening anything.
6. Then carry on from "Where the run stands".

## Pending decision: splitting the `ecf424b..8dbf473` batch

Proposed to the user at the end of the second session; no answer yet. Nothing has been cut, pushed
or opened. Topic branches off `main`:

| Branch | Holds | Stacks on |
|---|---|---|
| `evaluate-inline` | EVALUATE as an inline frame; carrying on after an error in a macro, EVALUATE or ON ERROR handler (`rest_after_error`) | `main` |
| `method-errors` | Errors reaching a TRY in the caller (`caller`/`passing`, `PassedError`, `Vm::step` keeping the fiber), the 103 limit, Exception.Procedure / Error cMethod spelling, host read errors (`$hostError`), PROGRAM()/LINENO() inside ON ERROR | #6, then `evaluate-inline` |
| `library-objects` | DODEFAULT via `codeOwner()`, AddObject of library classes, Load only for visual objects, Empty/SCATTER NAME, array functions filling a property (compiler write-back, `assignArray`), property expressions (`headerDefines.ts`, NULL, THIS, quiet TRY); the regenerated `fdvclasses.vcx` with `fdvkid` | #6 |
| `data-commands` | SKIP IN expr, SET RELATION forms, CURSORGETPROP SourceType/Database (+ backlink), GETFLDSTATE, empty-table index, FULLPATH/OPEN DATABASE on SET PATH, `data\` paths, project-folder FileOp paths, memory API growth + 2091 guard, MEMOWIDTH, SET CENTURY | `main` |
| `names-at-run-time` | VARTYPE (`NameDefined`), macro before a subscript, macro standing for arguments, MLINE/`_MLINE`, SYS(16, n) | `main` |

Notes for the split:
- `vm.rs`, `session.ts`, `compiler.rs` and `parser.rs` carry hunks for several topics; assign by
  hunk with `hunks.py`, and expect to hand-edit a few mixed hunks.
- The TS tests added to `tests/runtime/defineClass.test.ts` belong to different topics; split them
  with their code.
- Some old tests were changed on purpose to match measurements: `builtins_system.rs` (EVALUATE
  contract, SYS(16) `.FXP`), `macros.rs` (SYS(16) shape), `defineClass.test.ts` (Error cMethod
  `proc2`). They go with the topic that changed the behavior.
- Build and run the full Rust and TS suites in each worktree, plus `tests/reference` and
  `npm run argforms:check`, before opening a PR. PR bodies end with the Claude Code line.
- After the split, the next split point becomes `8dbf473` (or the handoff commit after it).

## Goal

Make `C:\avbcodev\avbco.pjx` (Shutter Ace / ShutterDesign II, a 60k-line Visual FoxPro app built on
the CodeMine framework at `C:\CODEMINE`) run under FoxDev Studio, fixing FoxDev wherever it falls
short. Every language behavior is measured against the real `vfp9.exe` first.

## Rules the user set

- **Measure first.** Measure in VFP 9 before writing behavior:
  `node scripts/vfp-expected.mjs --probe file.prg` for a question, or a golden in
  `crates/foxvm/tests/programs` (its `.expected` written by `node scripts/vfp-expected.mjs <file>.prg`).
  Probes must not name a helper `log` (collides with `LOG()`), a variable `f` (`f.x` is a field of
  work area F) or a routine `Show` (the SHOW command).
- **Probe output gotchas:**
  - The wrapper runs `main` with `DO`, so `PROGRAM(-1)` is 2 in main. Goldens cannot pin
    absolute levels; put level limits in unit tests.
  - After an error has been raised (inside or after a CATCH, in an ON ERROR handler), VFP spaces the
    items of a `?` list differently. Print one concatenated string in goldens.
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
- **The Bash tool collapses `\\` to `\` inside heredocs.** A Python edit written in a heredoc turns
  `'\\n'` into a real newline and `\\f` into a form feed. Build such strings with `chr(92)`, or
  write the script to a file first.
- A test binary built in a removed worktree keeps that worktree's `CARGO_MANIFEST_DIR` and fails to
  find its fixtures. `touch crates/foxvm/tests/*.rs crates/foxvm/src/lib.rs` rebuilds it.
- A vitest run stuck in a synchronous loop ignores `timeout`. Stop it from PowerShell:
  `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ? CommandLine -match vitest | % { Stop-Process -Id $_.ProcessId -Force }`.
  Stop leftovers before starting another harness run, or two runs write one stream file.
- Write files with LF line endings. A Python `open(p, 'w')` on Windows writes CRLF; use
  `newline=''` (or `'\n'`).
- **The full TS suite takes ~18 min.** Two files fail identically on untouched code, so exclude them:
  `npx vitest run --exclude "tests/zz-*" --exclude tests/vfp/samplesRun.test.ts --exclude tests/win32/win32api.test.ts`.
  - `win32api` crashes natively on ARM64.
  - `samplesRun` runs out of heap on `Solution/Toledo/scattername.scx`, which never finishes (not
    investigated).
  - The last full run was green: 89 files, 588 tests (5 skipped). Rust: 679 tests (`cargo test -p foxvm`).
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
| `avbco-integration` | none | **Current working branch.** All of the above together, plus the batch after `ecf424b` (not yet split). |

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
  the quiet evaluator (`evaluate_in`) still cannot suspend, so it cannot call a method.
- `AVBCO_TRACE=1` prints every event and method the session dispatches as `[trace]` lines.
- `AVBCO_STREAM=<file>` appends every output line to a file as it happens. Use it for a run that
  loops or dies before writing the report. The report keeps the first 20000 lines.
- Output lines contain CR from `CHR(13)`; pipe through `tr '\r' '|'`.
- "recursive use of an object ... unsafe aliasing" means an earlier wasm call trapped; find the
  first failure.
- `tests/zz-eval.scratch.test.ts` (untracked, never commit) runs small programs through the real
  session and prints their output: edit its `cases` object. Handy for checking FoxDev against a
  VFP probe. Note that it installs `__avbcoStep` only if the scheduler still calls that hook,
  which it no longer does.
- `python handoff-tools/find_app.py <class> [method]` prints CodeMine source from the imported
  `.fxc` JSON, whole methods now (`FIND_APP_LINES` caps it).
- The CodeMine `.fxc` files are stale (written before the importer kept ancestor copies). The
  runtime does not read `.fxc` at all; it imports each `.vcx` when `SET CLASSLIB` loads it.

**Registry state** (written by the install dialog with the user's OK):
- Key: `HKCU\Software\Classes\VirtualStore\MACHINE\SOFTWARE\WOW6432Node\Soft Classics\CodeMine`.
- Owner and organization: `na`.
- `SerialNumber`: `Serial-57517`, checked valid with vfp9.exe.
- `Paths\Local|Shared|Common`: `c:\avbcodev\data\` (where the required files are).
- Deleting `SerialNumber` brings the install dialog back.

## Where the run stands

`appApplication.Start` now gets through `CreateGlobalObjects` and `AfterCreateGlobalObjects`, and
the main menu is installed (`menu: installed` in the report). The run then ends `idle` instead of
parking in `READ EVENTS`. Next errors, in order (from `AVBCO_TRACE=1 AVBCO_STREAM=...`):

1. `CHKTOOLLAUNCHBUTTON1.SHOWCONTROL` line 6: unknown member `OAPP`. A toolbar button reads `oApp`
   off something that lacks it; find what `THIS`/`THISFORM` is there.
2. `cmEventLogCursor.CreateRemoteView` line 7: `CREATE SQL VIEW needs AS and a SELECT`. A parse
   gap; the text is built at run time (print the method).
3. Error 103 recursion through `cmMessage.AddNewObject` (lines 10 and 17) and
   `cmMessage._LoadMessage` (unknown member `CMMESSAGEVALUE`). Something a message object needs is
   missing, and FatalError's dialog then fails and recurses to the 103 limit.
4. Find why `READ EVENTS` is never reached (`BeforeMenu`, `ShowMenu`, `OpenAppToolbars`,
   `BeforeReadEvents`).

Fixed this session, in the order the run met them:
- EVALUATE() of a method call (cmEvent.Subscribe): EVALUATE runs as an inline frame, like `&macro`.
- Errors inside a called method reach a TRY in the caller (fibers know their caller).
- DODEFAULT() from a library object added into another object (cmRegistry.Init) ran nothing.
- Runaway recursion overflowed the JS stack and poisoned the VM ("recursive use of an object");
  now it is VFP's error 103 at level 127 (126 for a method).
- VARTYPE() of an undefined name, TYPE() of `o.Parent`, `SKIP ... IN o.cWorkarea`,
  `DIMENSION &name[n]`, SET MEMOWIDTH up to 8192, SET CENTURY TO (expr) ROLLOVER (expr),
  `SET RELATION OFF INTO (x) IN (y)`, a macro standing for several arguments (`f(&cList)`).
- CURSORGETPROP SourceType and Database, GETFLDSTATE(-1) and the field states, a numeric index
  built on an empty table, FULLPATH and OPEN DATABASE along SET PATH, relative file names in the
  project folder, `CREATE DATABASE data\x` (`data` read as DATABASE).
- MLINE offsets and `_MLINE`, SYS(16, n), PROGRAM() and LINENO() inside ON ERROR.
- Carrying on after an error inside a macro, EVALUATE or ON ERROR handler looped on "Stack
  underflow".
- The memory API dropped appended records, and reads then looped for ever.
- SCATTER NAME (Empty objects), AERROR and the other array functions into a property, AddObject
  of a library class, Load no longer fired for non-visual classes, class property expressions
  (header constants, `(NULL)`, THIS, and failures kept away from the program's ON ERROR).

**Estimate given to the user:** unchanged in shape. The menu is up; getting into READ EVENTS is
probably one or two sessions. Common screens (CodeMine's data manager, views, buffering) come after.

## Known gaps recorded, not fixed

Runtime behaviors that differ from VFP:
- SYS(16) gives the module name with `.FXP` but no folder (VFP: `C:\PATH\FILE.FXP`); the VM does not
  know each module's file. PROGRAM(n) and SYS(16, n) see only the running fiber's frames, so inside
  a method they start again at 1.
- An Empty object (SCATTER NAME, CREATEOBJECT("Empty")) stands on Custom here, so it carries
  Custom's members; VFP's has none (reading `.Class` is error 12).
- After an error, VFP prints `?` list items and numbers with extra spaces; not implemented.
- CREATE TABLE inside a database writes no backlink, so CURSORGETPROP("Database") of a table made
  here is empty; tables made by VFP are read correctly.
- DBC() and FULLPATH answer relative paths when SET DEFAULT has not been set (the project folder is
  implied).
- A form's own property expressions (DO FORM) are still worked out without its header's constants;
  library classes have them.
- The quiet evaluator (`evaluate_in`, used for DEFINE CLASS property expressions and the debugger)
  still cannot suspend.
- Reading a reopened table in the session hung before the memory API fix; the VM now raises 2091
  on a page that comes back short (the wording is a guard, not measured).
- The checked-in `ref_object.expected` says `PROGRAM(-1)` is 1 in main; VFP under the golden wrapper
  says 2 (`node scripts/vfp-expected.mjs --check`). Not changed.
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
- **Errors across fibers.** A method runs as a fiber of its own. The scheduler tells the VM which
  fiber a new one was started for (`setCaller`, from the fibers whose requests are being
  performed). An error nothing in the method handles (no TRY, no Error method) is marked `passes`
  when a TRY waits in a caller; the scheduler ends the method fiber (`passError`) and unwinds the
  JS stack with `PassedError` to the caller's drive loop, where the VM has already raised the error.
- **Nesting limit.** `Vm::level` counts frames across the caller chain; a call past 127 (a method
  past 126) raises 103. This is also what keeps runaway recursion from overflowing the JS stack.
- **EVALUATE** returns `BuiltinResult::Evaluate`; the VM compiles the text as an inline frame of
  the calling routine, exactly as `&expr`.
- **Host read errors.** `getProp`/`getMember` answer `{ $hostError, message }` for a HostError, and
  the VM raises it where the read was, instead of the bridge rethrowing after the call.
- Memory notes for Claude live in `~/.claude/projects/C--Users-jeffroberts-Projects-FoxDevStudio/memory/`.
