/**
 * Scratch: "Run Main" on the imported Shutter Ace project, headless, the way F5 does it - the
 * real project store, the real project source (headers included), the real session and the
 * real 32-bit library host - with files read from disk on demand and every write kept in
 * memory, so C:\avbcodev and its data are never touched. Every dialog is answered and every
 * error recorded with where it came from.
 *
 *   AVBCO_REPORT=<file> npx vitest run tests/zz-avbco-run.scratch.test.ts
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, it } from 'vitest';
import { createMemoryApi, type MemoryApi } from '@renderer/api/memoryApi';
import { setApi } from '@renderer/api/foxdev';
import { useProjectStore } from '@renderer/stores/projectStore';
import { useSessionStore } from '@renderer/runtime/session';
import { createProjectSource } from '@renderer/runtime/projectSource';
import { loadFoxVm } from '../src/wasm/foxvm/loader';

const PROJECT = 'C:/avbcodev/avbco.fxproject';
const REPORT = process.env['AVBCO_REPORT'] ?? resolve('avbco-run-report.txt');
const MAX_ERRORS = Number(process.env['AVBCO_MAX_ERRORS'] ?? 25);
const TEXT = new Set(['prg', 'mpr', 'qpr', 'txt', 'h', 'ini', 'log', 'fpw', 'fxproject', 'fxf', 'fxc', 'fxm', 'json']);

const fileServicePath = '../src/main/services/fileService';
const { decodeText } = (await import(/* @vite-ignore */ fileServicePath)) as { decodeText: (b: Uint8Array) => string };
const dllServicePath = '../src/main/services/dllService';
const { createDllService } = (await import(/* @vite-ignore */ dllServicePath)) as {
  createDllService: () => { available(): boolean; call(request: unknown): unknown };
};

const norm = (p: string) => p.replace(/\\/g, '/');
const extOf = (p: string) => p.slice(p.lastIndexOf('.') + 1).toLowerCase();
const isFile = (p: string) => {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
};

/** The memory API, filled from disk the first time anything asks for a file. */
const vcxReads: string[] = [];
function diskBacked(api: MemoryApi): MemoryApi {
  const loaded = new Set<string>();
  const pull = (raw: string): void => {
    const path = norm(raw);
    const key = path.toLowerCase();
    if (loaded.has(key)) return;
    loaded.add(key);
    if (api.files$.has(path) || api.binary$.has(path) || !isFile(path)) return;
    const bytes = new Uint8Array(readFileSync(path));
    if (TEXT.has(extOf(path))) api.files$.set(path, decodeText(bytes));
    else api.binary$.set(path, bytes);
  };
  // a table comes with its memo, its index and, for a database, the container's own two
  const siblings = (raw: string): void => {
    const path = norm(raw);
    const dot = path.lastIndexOf('.');
    const stem = dot > path.lastIndexOf('/') ? path.slice(0, dot) : path;
    for (const ext of ['dbf', 'fpt', 'cdx', 'dbc', 'dct', 'dcx']) pull(`${stem}.${ext}`);
  };

  const files = api.files;
  api.files = {
    ...files,
    readText: (p) => (pull(p), files.readText(p)),
    readBytes: (p) => {
      if (/\.vcx$/i.test(p) && !vcxReads.includes(p)) vcxReads.push(p);
      pull(p);
      return files.readBytes(p);
    },
    exists: async (p) => (pull(p), (await files.exists(p)) || isFile(norm(p))),
    listDir: async (p) => {
      const dir = norm(p);
      const own = await files.listDir(p);
      const disk = existsSync(dir) ? readdirSync(dir) : [];
      return [...new Set([...own, ...disk])];
    },
  };
  const data = api.data;
  api.data = { ...data, open: (p, exclusive) => (siblings(p), data.open(p, exclusive)) };
  const project = api.project;
  api.project = { ...project, open: (p) => (pull(p), project.open(p)) };
  return api;
}

interface Reported {
  code: number;
  program: string;
  line: number;
  message: string;
}

const settle = () => new Promise((r) => setTimeout(r, 0));

beforeAll(async () => {
  await loadFoxVm();
}, 60_000);

describe('Shutter Ace', () => {
  it('runs main and reports what stops it', async () => {
    const traces: string[] = [];
    (globalThis as { __avbcoTrace?: (e: unknown) => void }).__avbcoTrace = (e) =>
      traces.push(e instanceof Error ? (e.stack ?? e.message) : String(e));
    const api = diskBacked(createMemoryApi());
    api.classLibraryDir$ = resolve('resources/ffc');
    // DECLARE ... DLL through the service the application itself uses, as the samples test does
    const dll = createDllService();
    api.dll = { available: async () => dll.available(), call: async (request) => dll.call(request) as never };
    setApi(api);

    const opened = await useProjectStore.getState().openProject(PROJECT);
    const doc = useProjectStore.getState().doc;
    const main = doc?.main ?? '';

    const errors: Reported[] = [];
    const dialogs: string[] = [];
    const stop = useSessionStore.subscribe((state) => {
      if (state.dialog) {
        const { kind, text, resolve: answer } = state.dialog;
        useSessionStore.setState({ dialog: null });
        dialogs.push(`${kind}: ${text}`);
        answer(kind === 'message' ? 1 : '');
      }
      if (state.errorReport) {
        const { error, resolve: answer } = state.errorReport;
        errors.push({ code: error.code, program: error.program, line: error.line, message: error.message });
        answer(errors.length >= MAX_ERRORS ? 'cancel' : 'ignore');
      }
    });

    const name = main.slice(main.lastIndexOf('/') + 1);
    const run = useSessionStore.getState().runProgram(createProjectSource(), name);
    let finished = false;
    void run.then(() => (finished = true)).catch(() => (finished = true));
    const started = Date.now();
    while (!finished && Date.now() - started < 60_000 && useSessionStore.getState().status !== 'waiting') await settle();

    // AVBCO_INSTALL=1: answer the first-run install dialog the way a person would - read what it
    // offers, Next to the paths page, the paths typed in where they differ, Next to finish
    const install: string[] = [];
    const INSTALL_PATH = process.env['AVBCO_INSTALL_PATH'] ?? 'c:\\avbcodev\\data\\';
    if (process.env['AVBCO_INSTALL'] && !finished) {
      const desktop = useSessionStore.getState().desktop!;
      const waitQuiet = async () => {
        for (let i = 0; i < 400; i++) await settle();
        const t = Date.now();
        while (!finished && Date.now() - t < 30_000 && useSessionStore.getState().status === 'running') await settle();
      };
      const dialog = () => desktop.forms.find((f) => f.name.toLowerCase() === 'frmappinstalldialog' && f.alive);
      const prop = (obj: { handle: number }, name: string) => {
        try {
          return JSON.stringify(desktop.getProp(obj.handle, name));
        } catch (e) {
          return `(threw ${e instanceof Error ? e.message : String(e)})`;
        }
      };
      const snapshot = (label: string) => {
        const f = dialog();
        install.push(`-- ${label}: dialog ${f ? 'open' : 'gone'}, status ${useSessionStore.getState().status}`);
        if (!f) return;
        for (const p of ['cName', 'cCompany', 'cSerialNo', 'cPathLocal', 'cPathShared', 'cPathCommon', 'uValue']) install.push(`   ${p} = ${prop(f, p)}`);
        const frame = f.child('pgfSteps');
        if (frame) install.push(`   pgfSteps.ActivePage = ${prop(frame, 'ActivePage')}`);
        for (const d of f.descendants()) if (d.has('Value')) install.push(`   ${d.path()}.Value = ${prop(d, 'Value')} Visible=${prop(d, 'Visible')}`);
      };
      const click = async (name: string) => {
        const button = dialog()?.child(name);
        install.push(`-- click ${name}${button ? '' : ' (not found)'}`);
        if (!button) return;
        const outcome = desktop.dispatch(button, 'Click');
        if (outcome instanceof Promise) await Promise.race([outcome, new Promise((r) => setTimeout(r, 30_000))]);
        await waitQuiet();
      };
      const type = async (path: string[], text: string) => {
        let obj = dialog() as ReturnType<typeof dialog> | ReturnType<NonNullable<ReturnType<typeof dialog>>['child']>;
        for (const step of path) obj = obj?.child(step);
        if (!obj) return install.push(`-- type ${path.join('.')} (not found)`);
        install.push(`-- type ${path.join('.')} = ${JSON.stringify(text)} (was ${prop(obj, 'Value')})`);
        obj.set('Value', text, 'interactive');
        for (const event of ['Valid', 'LostFocus']) {
          const outcome = desktop.dispatch(obj, event);
          if (outcome instanceof Promise) await outcome;
        }
        await waitQuiet();
      };

      if (dialog()) {
        // AVBCO_EVAL: expressions to ask where the program is paused, one per line
        for (const expr of (process.env['AVBCO_EVAL'] ?? '').split(String.fromCharCode(10)).filter((e) => e.trim() !== '')) {
          try {
            install.push(`-- eval ${expr} => ${JSON.stringify(await desktop.evaluateQuietly?.(expr))}`);
          } catch (e) {
            install.push(`-- eval ${expr} threw ${e instanceof Error ? e.message : String(e)}`);
          }
        }
        snapshot('as shown');
        await click('cmdNext');
        snapshot('after Next');
        for (const box of ['cntLocalPath', 'cntSharedPath', 'cntCommonPath']) {
          const edit = dialog()?.child('pgfSteps')?.child('pagPaths')?.child(box)?.child('edtPath');
          if (edit && String(edit.get('Value') ?? '').trim().toLowerCase() !== INSTALL_PATH.toLowerCase()) await type(['pgfSteps', 'pagPaths', box, 'edtPath'], INSTALL_PATH);
        }
        snapshot('paths typed');
        if (process.env['AVBCO_INSTALL'] === 'show') install.push('-- show only: Finish not clicked');
        else await click('cmdNext');
        snapshot('after Finish');
        const t = Date.now();
        while (!finished && Date.now() - t < 60_000 && useSessionStore.getState().status !== 'waiting') await settle();
        install.push(`-- afterwards: status ${useSessionStore.getState().status}${finished ? ' (run returned)' : ''}`);
      } else install.push('-- no install dialog open');
    }

    const state = useSessionStore.getState();
    const ask = async (expr: string) => {
      try {
        return String(await state.desktop?.evaluateQuietly?.(expr));
      } catch (e) {
        return `(threw ${e instanceof Error ? e.message : String(e)})`;
      }
    };
    const classlib = await ask('SET("CLASSLIB")');
    const procedure = await ask('SET("PROCEDURE")');
    const lines = [
      `SET CLASSLIB: ${classlib}`,
      `vcx read: ${vcxReads.join(' | ')}`,
      `SET PROCEDURE: ${procedure}`,
      `project opened: ${opened}, main: ${main}`,
      `status: ${state.status}${finished ? ' (run returned)' : ''}, forms: ${(state.desktop?.forms ?? []).map((f) => f.name).join(', ') || '(none)'}`,
      `menu: ${state.menu ? 'installed' : '(none)'}`,
      ...(state.desktop?.forms ?? []).map(
        (f) => `  form ${f.name} handle=${f.handle} module=${f.module} lib=${f.classLibrary ?? ''} alive=${f.alive} class=${f.className ?? ''} methods=${Object.keys(f.node.methods).join(',')}`,
      ),
      '',
      `# install dialog (${install.length})`,
      ...install,
      '',
      `# errors (${errors.length})`,
      ...errors.map((e, i) => `${i + 1}. ${e.code} ${e.program}:${e.line} ${e.message}`),
      '',
      `# dialogs (${dialogs.length})`,
      ...dialogs,
      '',
      '# output',
      ...state.output.map((o) => `[${o.kind}] ${o.text}`),
      '',
      '# host exceptions',
      ...traces.map((t) => t.split('\n').slice(0, 25).join('\n') + '\n----'),
    ];
    stop();
    try {
      state.cancel();
    } catch (e) {
      lines.push('', `# cancel threw: ${e instanceof Error ? e.message : String(e)}`);
    }
    setApi(undefined);
    writeFileSync(REPORT, lines.join('\n'));
    console.log(lines.slice(0, 12).join('\n'));
  }, 400_000);
});
