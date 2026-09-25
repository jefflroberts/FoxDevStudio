import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setApi } from '@renderer/api/foxdev';
import { createMemoryApi } from '@renderer/api/memoryApi';
import { useSessionStore } from '@renderer/runtime/session';
import { createProjectSource } from '@renderer/runtime/projectSource';
import { loadFoxVm } from '../../src/wasm/foxvm/loader';

// What the Foundation Classes and the Wizards' classes ask of the language once DODEFAULT() runs
// their parent code. tests/vfp/samplesRun.test.ts opens the sample forms that reach each of
// these, where Visual FoxPro is installed; these are the same questions without the product.
const source = createProjectSource();
const printed = () =>
  useSessionStore
    .getState()
    .output.filter((o) => o.kind === 'output')
    .map((o) => o.text.trim().replace(/ +/g, ' '));
const errors = () =>
  useSessionStore
    .getState()
    .output.filter((o) => o.kind === 'error')
    .map((o) => o.text);

beforeAll(async () => {
  await loadFoxVm();
});

beforeEach(() => {
  setApi(createMemoryApi());
  useSessionStore.getState().cancel();
  useSessionStore.setState({ output: [] });
});

const run = (lines: string[]) => useSessionStore.getState().execute(source, lines.join('\n'));

describe('the Foundation Classes', () => {
  it('keep an array that is given a value, with the value in every element', async () => {
    // the table mover: PUBLIC aSkipTables, DIMENSION aSkipTables[1], aSkipTables = "", then ALEN
    await run([
      'PUBLIC aP',
      'DIMENSION aP[2]',
      'aP = "x"',
      '? "public", ALEN(aP), aP[1], aP[2]',
      'LOCAL laL[3]',
      'laL = 5',
      '? "local", ALEN(laL), laL[3]',
      'STORE "s" TO aP',
      '? "store", ALEN(aP), aP[2]',
      '=Fill(@laL)',
      '? "by ref", ALEN(laL), laL[1]',
      'FUNCTION Fill',
      '  LPARAMETERS aF',
      '  aF = "f"',
      'ENDFUNC',
    ]);
    expect(errors()).toEqual([]);
    expect(printed()).toEqual(['public 2 x x', 'local 3 5', 'store 2 s', 'by ref 3 f']);
  });

  it('read a one-dimensional array with a column subscript of 1', async () => {
    // the table mover reads its one-dimensional aSkipTables as aSkipTables[m.i, 1]
    await run(['DIMENSION a[2]', 'a[1] = "one"', 'a[2] = "two"', '? a[1, 1], a[2, 1]']);
    expect(errors()).toEqual([]);
    expect(printed()).toEqual(['one two']);
  });

  it('take CREATE() for CREATEOBJECT()', async () => {
    // _autograph.MSGraphCheck makes its registry object with create('FileReg')
    await run(['o = create("custom")', '? VARTYPE(o), o.BaseClass']);
    expect(errors()).toEqual([]);
    expect(printed()).toEqual(['O Custom']);
  });

  it('list the objects on a form that has no parent', async () => {
    // the Wizards' buttons look for a grid with AMEMBERS(aMems, THISFORM, 2); a top-level
    // form's Parent refuses a read, and the list is made all the same
    await run([
      'o = CREATEOBJECT("fwith")',
      'n = AMEMBERS(a, o, 2)',
      '? n, a[1], a[2]',
      'DEFINE CLASS fwith AS Form',
      '  ADD OBJECT grd AS Grid',
      '  ADD OBJECT btn AS CommandButton',
      'ENDDEFINE',
    ]);
    expect(errors()).toEqual([]);
    expect(printed()).toEqual(['2 BTN GRD']);
  });

  it("clear every item's picture of a list with Picture[0]", async () => {
    // the table mover clears its list and writes lstTables.Picture[0] = "" with nothing in it
    await run(['o = CREATEOBJECT("listbox")', 'o.Picture[0] = ""', 'o.AddItem("a")', 'o.Picture[0] = ""', '? "ok", o.ListCount']);
    expect(errors()).toEqual([]);
    expect(printed()).toEqual(['ok 1']);
  });
});
