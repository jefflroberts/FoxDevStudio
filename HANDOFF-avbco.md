# Handoff: getting Shutter Ace (C:\avbcodev) to run in FoxDev Studio

Last updated 2026-09-25 (third session), at the move from the ARM64 Parallels machine to an Intel
Windows 11 machine. This file, `handoff-tools/` and `tests/zz-avbco-run.scratch.test.ts` are
committed on `avbco-integration` only. Keep them out of every topic branch and pull request.

Claude's own memory notes lived in `~/.claude/projects/.../memory/` on the old machine and do not
travel. Everything they held that matters is in this file.

## Resuming (do this first)

1. Read this file through.
2. Set up the new machine: see "New machine setup" below.
3. `git fetch fork` and `git checkout avbco-integration`; HEAD should be the handoff commit of
   2026-09-25. Also fetch `fork/runtime-classes-next` (see "Where #6 stands").
4. `gh pr list -R FoxDevCommunity/FoxDevStudio --state all` and check each open PR's reviews and
   inline comments (`gh api repos/FoxDevCommunity/FoxDevStudio/pulls/<n>/reviews` and `/comments`).
   Report merges and comments to the user; do not reply without asking.
5. Rebuild before running anything: `npm run build:wasm` (the generated wasm is not committed) and
   `npm run build:fllhost`.
6. Then pick up "Next steps".

## Next steps (in order)

1. **Finish #6.** The fixes it needs are on `runtime-classes-next` in the fork, not yet on
   `runtime-classes` (the PR's branch). See "Where #6 stands". Before pushing:
   - Answer the `frmMember.scx` question: in VFP 9, `o = CREATEOBJECT("form")` then
     `? VARTYPE(o.vParent)` - does it print `U` or raise an error (1925)? The user may run it, or
     measure it with `node scripts/vfp-expected.mjs --probe` if VFP is on the new machine. Implement
     what it does; frmMember's cboChoices1.InteractiveChange does `IF VARTYPE(.vParent)=="O"` inside
     `WITH ThisForm`.
   - Re-run samplesRun on the branch (see "Sample forms").
   - Then `git push --force-with-lease=runtime-classes:fork/runtime-classes fork runtime-classes-next:runtime-classes`
     (or reset `runtime-classes` to it first), and post a comment on #6 - the user approves its text
     first. It should say: DODEFAULT now running parent code made Foundation Class sample forms
     reach code they never ran on main; what was fixed (listed below); and the frmMember outcome.
2. **Rebase #8** (`fll-references`) onto the new #6 and push it to the fork; comment only with
   approval.
3. **PR the class-body array fix** (`c587cc1` on `avbco-integration`): main has the same bug. Cut a
   topic branch off `main`; the test in `defineClass.test.ts` uses a `printedWords` helper that
   main's copy of the file lacks, so adapt it. Show the user the PR text first.
4. **Follow-up promised on #7:** time a property-heavy loop before and after #7 (every property read
   now makes a `has_code_method` host call). If it shows, a per-object flag set once by the host.
5. **The pending batch split** (below), then back to the Shutter Ace run ("Where the run stands").

## Rules the user set

- **Measure first.** Measure in VFP 9 before writing behavior:
  `node scripts/vfp-expected.mjs --probe file.prg` for a question, or a golden in
  `crates/foxvm/tests/programs` (its `.expected` written by `node scripts/vfp-expected.mjs <file>.prg`).
  When something is inferred from Microsoft's own code instead of measured, say so in the comment.
  Probes must not name a helper `log` (collides with `LOG()`), a variable `f` (`f.x` is a field of
  work area F) or a routine `Show` (the SHOW command).
- **Probe output gotchas:**
  - The wrapper runs `main` with `DO`, so `PROGRAM(-1)` is 2 in main. Goldens cannot pin
    absolute levels; put level limits in unit tests.
  - After an error has been raised (inside or after a CATCH, in an ON ERROR handler), VFP spaces the
    items of a `?` list differently. Print one concatenated string in goldens.
- **Keep `C:\avbcodev` and its data untouched.** Registry writes only with the user's OK.
- **GitHub.**
  - The maintainer (RandomChirp) welcomes PRs; the user chose topic-sized PRs off `main`.
  - Push only to the `fork` remote (`jefflroberts/FoxDevStudio`). Force-pushing there is fine, with
    `--force-with-lease`. Never push to `origin` (FoxDevCommunity).
  - Every PR comment, issue and PR body is shown to the user and approved before it is posted.
  - New work lands on `avbco-integration` first, then goes to a topic branch and PR.
- **Commits.** End commit messages with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; PR bodies end with the Claude Code line.

## Branches and pull requests (2026-09-25)

| Branch | PR | State |
|---|---|---|
| `sql-forms-real-apps` | #2 | Merged |
| `set-procedure` | #5 | Merged |
| `language-forms` | #9 | Merged |
| `select-clause-order` | #10 | Merged |
| `startup-environment` | #11 | Merged |
| `runtime-classes` | #6 | Open. Review fixes pushed and answered 2026-09-24/25; **more fixes waiting on `runtime-classes-next`** |
| `screen-and-objects` | #7 | Open. Array Access fix pushed and answered; awaiting re-review |
| `fll-references` | #8 | Open. Rebased on #6's first round of fixes; needs rebasing again after #6 |
| `runtime-classes-next` | none | #6 plus the sample-form fixes; becomes `runtime-classes` once finished |
| `avbco-integration` | none | Working branch: everything together, plus the unsplit batch |

What the reviews asked and what was done:
- #6: the Error-method skip applies only when the program called Error; when the runtime called it,
  an error inside goes to the default handler and ON ERROR is not asked (gated on `in_class_error`).
  Dead `Instr::DoDefault` removed.
- #7: an array property's Access method gets the subscript (`GetMemberIndex`); `ALEN` reads the
  array past it (`GetProp`); `obj.aProp("x")` calls Access with "x"; the whole array named calls it
  with 1.
- #8: waited on #6, then a rebase.
- #9 review note (not blocking): SYS(2007) takes the low byte of each char; a comment would help.
- #10 note: `_TALLY` for INSERT/UPDATE/DELETE is a later PR.

## Where #6 stands

The reviewer ran samplesRun on #7, not on #6. With DODEFAULT working, Foundation Class sample forms
run parent-class code that main never ran, and five of them (automate, graphrec, dataedit, movers,
frmMember) stopped where main opens them. `runtime-classes-next` = `runtime-classes` + three commits:

- `f3c8179`: SET CLASSLIB searches SET PATH as FILE() does (`LoadClassLib.search`); `CREATE()` is
  CREATEOBJECT despite the shared prefix (`ABBREVIATION_WINNERS`); assigning a value to an array
  variable fills every element (`write_through`); a 1-D array answers `[row, 1]`; a data
  environment lists its cursors for AMEMBERS (`DataObject.list`); the in-memory file API lists a
  folder whatever its case.
- `fd48f30`: AMEMBERS on a top-level form (its Parent refuses a read; `readForListing`); a list's
  `Picture[0]` sets every item's picture (inferred from the table mover, not measured);
  `tests/runtime/foundationClassForms.test.ts`.
- `fb51014`: CURSORGETPROP("SourceType") = 3 (measured, carried from `8dbf473`); the in-memory
  file API grows a table written past its end (carried from `8dbf473`; without it scattername.scx
  loops for ever and the test process runs out of memory); `samples-run-known.txt` updated.

Verified on that branch: 674 Rust tests, 556 vitest tests, typecheck and lint clean, and samplesRun
(all 160 forms timed) matching its known list except `foxmedia.scx` (needs the COM addon) and
`frmMember.scx` (the open question).

The same fixes are on `avbco-integration` as `a8b95f7`, `a91350b`, `c8700c2`. When the batch below
is split, leave them out: they go with #6.

## Sample forms (tests/vfp/samplesRun.test.ts)

Opens every `.scx` under `Samples\Solution` (needs VFP 9 installed at
`C:\Program Files (x86)\Microsoft Visual FoxPro 9`) and fails on any complaint not listed in
`tests/vfp/samples-run-known.txt`. CI cannot run it, so run it before pushing anything that touches
the runtime.

- `RUN_REPORT=<file>` writes every complaint; diff it against the known list (sorted, without `#`
  lines) with `comm`.
- `RUN_ONLY=<stem>` opens one form; `RUN_TIMES=1` prints each form's time.
- A full run is 160 forms in about 140 s. **Count the timed forms**: a crashed run leaves the
  later forms silent, which looks like "they open now" in a report diff.
- Each form gets 4 s; forms that need COM, a modal or READ EVENTS use it all.
- To read a class library's code, use the VM's reader from a scratch vitest file:
  `vm.read_dbf(bytes, memo)` on the `.vcx`/`.vct` (fields OBJNAME, CLASS, PARENT, METHODS). Raw
  greps of a `.vct` pick up stale memo blocks.
- On `avbco-integration`, samplesRun differs from main's list by: aa_fun (#7 is not merged there),
  foxmedia (COM), caxml and scattername (stop later), frmMember (open question).

## New machine setup (Intel Windows 11)

The user copies the app folders by hand and brings `C:\Users\jeffroberts\Projects\avbco-transfer`
from the old machine: the registry exports and a README with the same list as here. Run
`powershell -ExecutionPolicy Bypass -File handoff-tools\check-machine.ps1` from the repo root; it
checks everything below and names what is missing (it passed 26/26 on the old machine).

**Folders, at the same paths** (class libraries name some by absolute path):
- `C:\avbcodev` - the app (about 280 MB).
- `C:\CODEMINE` - the framework, `common50\` and `custom\` (about 40 MB).
- `C:\fox\xsource` - Microsoft's VFP source (26 MB). `Source\appmain.vcx` and `avbco.pjx` name
  `C:\fox\xsource\VFPSource\builders\wbpick.vcx`, `...\Wizards\wzcommon\wizctrl.vcx`,
  `builder.prg` and `wbmain.prg`. Nothing else under `C:\fox` (110 GB of other projects) is
  needed; `C:\fox\Thor`, `shutter_data` and `10-15` appear only in `CMDBAK.prg`, a saved command
  history.
- Visual FoxPro 9 SP2 at `C:\Program Files (x86)\Microsoft Visual FoxPro 9`. FoxDev reads HOME()
  from VFP's registry entry, the app uses its `Ffc`, `Gallery` and `Wizards`, and probes and
  samplesRun need `vfp9.exe` and `Samples`.

**Registry:** `reg import codemine-virtualstore.reg` (and `codemine-window-position.reg`) from the
transfer folder, in a normal prompt. It restores the CodeMine registration (owner and organization
`na`, the serial number, `Paths\Local|Shared|Common` = `c:\avbcodev\data\`) under
`HKCU\Software\Classes\VirtualStore\MACHINE\SOFTWARE\WOW6432Node\Soft Classics\CodeMine`. It is
there because CodeMine reads the registry from `codemine.fll`, which runs in FoxDev's 32-bit
`fllhost.exe`, and Windows keeps a 32-bit program's `HKLM\SOFTWARE` writes in that VirtualStore.
Without it the app shows its install dialog again (`AVBCO_INSTALL=1` drives it; user's OK first).
Never put the serial number in the repo: the fork is public.

**Repo:** clone the fork fresh; do not copy `node_modules` or `target` (ARM64 binaries).
```
git clone https://github.com/jefflroberts/FoxDevStudio.git && cd FoxDevStudio
git remote rename origin fork
git remote add origin https://github.com/FoxDevCommunity/FoxDevStudio
git fetch --all && git checkout avbco-integration
npm install && npm run build:wasm && npm run build:fllhost
```

**Tools:** Node 24, Rust stable (MSVC) with the `wasm32-unknown-unknown` target, Visual Studio
Build Tools with "Desktop development with C++" (x86 and x64), Python 3, `gh` (`gh auth login`).

### ARM64 to Intel: what changes

Nothing in the repo is tied to ARM64: `rust-toolchain.toml` pins only the channel and the wasm
target, `build-fllhost.mjs` builds x86 on any Windows, and the CI workflow picks its own arch.
What changes is the machine setup:

- Drop the old workarounds: no `RUSTUP_TOOLCHAIN=stable-x86_64-pc-windows-msvc` prefix, no
  `--ignore-scripts`, no hand-placed wasm-pack binary. Plain `npm install`, `cargo test -p foxvm`
  and `npm run check` should work natively, and much faster (the wasm build took ~3 min and the
  full TS suite ~18 min under emulation).
- The COM addon (foxole) should build, so `npm run dev` works (no need for
  `npx electron-vite dev`) and COM is live in tests. Expect samplesRun to change: `foxmedia.scx`
  and other COM forms may get further and report different lines. Check each against main before
  editing `samples-run-known.txt`; the reviewer's environment had no COM addon either.
- `tests/win32/win32api.test.ts` crashed natively on ARM64; it should run on Intel. Stop
  excluding it and see.
- `DECLARE ... DLL` calls run in Electron's main process (koffi), 64-bit on both machines, so
  registry views and API behavior do not change. FLLs run in the 32-bit `fllhost.exe` on both.
- After the first native build, run the whole Rust and TS suites plus samplesRun once on
  `avbco-integration` for a new baseline before changing anything; the 4 s per-form budget in
  samplesRun may behave differently on a faster machine.

## General working notes

- **Never run `cargo fmt` wholesale.** It reformats ~70 files in this repo. Tidy by hand.
- **The Bash tool collapses `\\` to `\` inside heredocs.** A Python edit written in a heredoc turns
  `'\\n'` into a real newline. Build such strings with `chr(92)` or `String.fromCharCode(10)`, or
  use the Edit tool.
- Vitest swallows `console.log`; write probe output to a file.
- A test binary built in a removed worktree keeps that worktree's `CARGO_MANIFEST_DIR` and fails to
  find its fixtures. `touch crates/foxvm/tests/*.rs crates/foxvm/src/lib.rs` rebuilds it.
- A vitest run stuck in a loop ignores `timeout`. Stop it from PowerShell:
  `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ? CommandLine -match vitest | % { Stop-Process -Id $_.ProcessId -Force }`.
- Write files with LF line endings (`newline=''` in Python).
- Full TS suite: `npx vitest run --exclude "tests/zz-*" --exclude tests/vfp/samplesRun.test.ts`
  (on ARM64 also `--exclude tests/win32/win32api.test.ts`, which crashed natively there). Running
  the whole suite without excluding `tests/zz-*` runs the Shutter Ace harness, which writes
  `avbco-run-report.txt` into the repo root unless `AVBCO_REPORT` points elsewhere.
- Last green runs (2026-09-25): `avbco-integration` 595 vitest tests (one more added since, run on its own), 679 Rust tests.
- **Before a PR, also run** `npx vitest run tests/reference` (if it fails,
  `REGEN_DOCS=1 npx vitest run tests/reference/coverage.test.ts`), `npm run argforms:check` and
  samplesRun.
- In a scratch `git worktree`: junction `node_modules` to this checkout's
  (`cmd /c mklink /J ..\wt\node_modules node_modules`) and remove the junction alone
  (`[System.IO.Directory]::Delete(path, $false)` or `cmd /c rmdir`) before `git worktree remove`,
  or the removal deletes the real `node_modules` through it. Set `CARGO_TARGET_DIR` to reuse a build.

## Old machine quirks (Windows on ARM64, under Parallels)

- Every build or test needed
  `export PATH="/c/Program Files/nodejs:$USERPROFILE/.cargo/bin:$PATH" RUSTUP_TOOLCHAIN=stable-x86_64-pc-windows-msvc`;
  `cargo test -p foxvm` worked with that toolchain.
- `npm install --ignore-scripts`, plus the x86_64 wasm-pack exe dropped into
  `node_modules/wasm-pack/binary/`. The COM addon could not build, so the IDE ran with
  `npx electron-vite dev`.

## Pending decision: splitting the `ecf424b..8dbf473` batch

Proposed to the user at the end of the second session; no answer yet. Nothing has been cut, pushed
or opened. Topic branches off `main`:

| Branch | Holds | Stacks on |
|---|---|---|
| `evaluate-inline` | EVALUATE as an inline frame; carrying on after an error in a macro, EVALUATE or ON ERROR handler (`rest_after_error`) | `main` |
| `method-errors` | Errors reaching a TRY in the caller (`caller`/`passing`, `PassedError`, `Vm::step` keeping the fiber), the 103 limit, Exception.Procedure / Error cMethod spelling, host read errors (`$hostError`), PROGRAM()/LINENO() inside ON ERROR | #6, then `evaluate-inline` |
| `library-objects` | DODEFAULT via `codeOwner()`, AddObject of library classes, Load only for visual objects, Empty/SCATTER NAME, array functions filling a property (compiler write-back, `assignArray`), property expressions (`headerDefines.ts`, NULL, THIS, quiet TRY); the regenerated `fdvclasses.vcx` with `fdvkid` | #6 |
| `data-commands` | SKIP IN expr, SET RELATION forms, CURSORGETPROP Database (+ backlink), GETFLDSTATE, empty-table index, FULLPATH/OPEN DATABASE on SET PATH, `data\` paths, project-folder FileOp paths, 2091 guard, MEMOWIDTH, SET CENTURY | `main` |
| `names-at-run-time` | VARTYPE (`NameDefined`), macro before a subscript, macro standing for arguments, MLINE/`_MLINE`, SYS(16, n) | `main` |

CURSORGETPROP SourceType and the memory API growth moved to #6 (above); leave them out of
`data-commands`.

Notes for the split:
- `vm.rs`, `session.ts`, `compiler.rs` and `parser.rs` carry hunks for several topics; assign by
  hunk with `hunks.py`, and expect to hand-edit a few mixed hunks.
- The TS tests added to `tests/runtime/defineClass.test.ts` belong to different topics; split them
  with their code.
- Some old tests were changed on purpose to match measurements: `builtins_system.rs` (EVALUATE
  contract, SYS(16) `.FXP`), `macros.rs` (SYS(16) shape), `defineClass.test.ts` (Error cMethod
  `proc2`). They go with the topic that changed the behavior.
- Build and run the full Rust and TS suites and samplesRun in each worktree, plus `tests/reference`
  and `npm run argforms:check`, before opening a PR.

How to cut a batch into a topic branch:
1. `git diff <last-split-point> HEAD > all.patch`. The last split point is `ecf424b`.
2. `python handoff-tools/hunks.py list all.patch` to number the hunks.
3. Write a topics JSON, then `hunks.py write` to make one patch per topic.
4. Apply each patch in a scratch `git worktree` on `main`, build it, and test it.

## Goal

Make `C:\avbcodev\avbco.pjx` (Shutter Ace / ShutterDesign II, a 60k-line Visual FoxPro app built on
the CodeMine framework at `C:\CODEMINE`) run under FoxDev Studio, fixing FoxDev wherever it falls
short. Every language behavior is measured against the real `vfp9.exe` first.

## How to run it

**IDE:**
1. `git checkout avbco-integration`, `npm run build:wasm`, `npm run build:fllhost`.
2. `npm run dev` (on the old machine: `npx electron-vite dev`).
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
- `tests/zz-eval.scratch.test.ts` (untracked on the old machine, never committed, so it is not on
  the new one) ran small programs through the real session. Recreate a scratch file like it when
  needed: `useSessionStore.getState().execute(source, text)`, then read `output`; wait for
  `errorReport` instead of awaiting when a program may stop at the error dialog.
- `python handoff-tools/find_app.py <class> [method]` prints CodeMine source from the imported
  `.fxc` JSON, whole methods (`FIND_APP_LINES` caps it).
- The CodeMine `.fxc` files are stale (written before the importer kept ancestor copies). The
  runtime does not read `.fxc` at all; it imports each `.vcx` when `SET CLASSLIB` loads it.

## Where the run stands

`appApplication.Start` gets through `CreateGlobalObjects` and `AfterCreateGlobalObjects`, and the
main menu is installed (`menu: installed` in the report). The run then ends `idle` instead of
parking in `READ EVENTS`. Next errors, in order (from `AVBCO_TRACE=1 AVBCO_STREAM=...`), as of the
second session (this session worked on PRs and sample forms, not on the app run; re-run the harness
first, since the sample-form fixes may change what it meets):

1. `CHKTOOLLAUNCHBUTTON1.SHOWCONTROL` line 6: unknown member `OAPP`. A toolbar button reads `oApp`
   off something that lacks it; find what `THIS`/`THISFORM` is there.
2. `cmEventLogCursor.CreateRemoteView` line 7: `CREATE SQL VIEW needs AS and a SELECT`. A parse
   gap; the text is built at run time (print the method).
3. Error 103 recursion through `cmMessage.AddNewObject` (lines 10 and 17) and
   `cmMessage._LoadMessage` (unknown member `CMMESSAGEVALUE`). Something a message object needs is
   missing, and FatalError's dialog then fails and recurses to the 103 limit.
4. Find why `READ EVENTS` is never reached (`BeforeMenu`, `ShowMenu`, `OpenAppToolbars`,
   `BeforeReadEvents`).

**Estimate given to the user:** getting into READ EVENTS is probably one or two sessions. Common
screens (CodeMine's data manager, views, buffering) come after.

## Known gaps recorded, not fixed

Runtime behaviors that differ from VFP:
- `VARTYPE()` of a missing property (frmMember.scx): U or error? Not measured yet (Next steps 1).
- `SCATTER NAME thisform ADDITIVE` is not implemented (scattername.scx: 1930 on
  `avbco-integration`, "Class definition EMPTY" on #6).
- An array property with `SET COMPATIBLE ON` should be replaced by a scalar on assignment; the new
  fill-every-element rule ignores COMPATIBLE.
- Only CREATEOBJECT is listed in `ABBREVIATION_WINNERS`; other ambiguous four-letter abbreviations
  (SUBS, STRT, ...) still refuse. Add them when a program needs them, with evidence.
- SYS(16) gives the module name with `.FXP` but no folder (VFP: `C:\PATH\FILE.FXP`); the VM does not
  know each module's file. PROGRAM(n) and SYS(16, n) see only the running fiber's frames, so inside
  a method they start again at 1.
- An Empty object (SCATTER NAME, CREATEOBJECT("Empty")) stands on Custom here, so it carries
  Custom's members; VFP's has none (reading `.Class` is error 12).
- After an error, VFP prints `?` list items and numbers with extra spaces; not implemented.
- CREATE TABLE inside a database writes no backlink, so CURSORGETPROP("Database") of a table made
  here is empty; tables made by VFP are read correctly.
- DBC() and FULLPATH answer relative paths when SET DEFAULT has not been set.
- A form's own property expressions (DO FORM) are still worked out without its header's constants;
  library classes have them.
- The quiet evaluator (`evaluate_in`) still cannot suspend.
- The VM raises 2091 on a table page that comes back short (the wording is a guard, not measured).
- The checked-in `ref_object.expected` says `PROGRAM(-1)` is 1 in main; VFP under the golden wrapper
  says 2. Not changed.
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

## Design notes worth keeping

- **DODEFAULT.** The importer keeps overridden `.vcx` methods as `Name#1`, `Name#2` (nearest
  ancestor first), each compiled with its own class's header. The VM sends the running method's
  full compiled name in `CallParentMethod.from`. The session runs `Name#n+1`, or walks DEFINE CLASS
  parents from the writing class, answering .T. when nothing is above.
- **Access/Assign.** Handled in the VM's GetMember, GetMemberIndex, LoadField, CallMethod and
  SetMember through the optional host read `hasCodeMethod`. Inside `Prop_Access`/`Prop_Assign`,
  `THIS.Prop` is the property itself.
- **Error methods.** `in_class_error` holds an object while the runtime runs its Error method; an
  error inside is skipped only when the program called Error.
- **FLL references.** The wire tag `R` wraps a referenced argument; fllhost hands the library a
  Locator and serves `_Load` (30) and `_Store` (29). Stored values come back in the reply and
  `wasm.rs` writes them into the `Value::Ref` cells.
- **Class property expressions.** Kept as source (`ClassProto.expressions`), collected by
  `buildClassInstance`, and evaluated by `workOutProperties` in the caller's frame.
- **Class-body arrays.** Folded into a `Constant::Array` by the compiler; the session gives the
  object those values with `assignArray` (`c587cc1`; before it every element was .F.).
- **Errors across fibers.** A method runs as a fiber of its own. The scheduler tells the VM which
  fiber a new one was started for (`setCaller`). An error nothing in the method handles is marked
  `passes` when a TRY waits in a caller; the scheduler ends the method fiber (`passError`) and
  unwinds the JS stack with `PassedError` to the caller's drive loop.
- **Nesting limit.** `Vm::level` counts frames across the caller chain; a call past 127 (a method
  past 126) raises 103.
- **EVALUATE** returns `BuiltinResult::Evaluate`; the VM compiles the text as an inline frame of
  the calling routine, exactly as `&expr`.
- **Host read errors.** `getProp`/`getMember` answer `{ $hostError, message }` for a HostError, and
  the VM raises it where the read was.
