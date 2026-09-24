/**
 * Where a file named without a folder is. Visual FoxPro reads it from the default directory,
 * which for a program run from a project is the project's folder - the same place `USE` finds
 * a table - and `FULLPATH()` also answers from SET PATH when the file is there and not here.
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setApi } from '@renderer/api/foxdev';
import { createMemoryApi } from '@renderer/api/memoryApi';
import { useProjectStore } from '@renderer/stores/projectStore';
import { useSessionStore } from '@renderer/runtime/session';
import { createProjectSource } from '@renderer/runtime/projectSource';
import { loadFoxVm } from '../../src/wasm/foxvm/loader';

const HOME = 'C:/proj';
const source = createProjectSource();

async function run(...lines: string[]): Promise<string[]> {
  useSessionStore.setState({ output: [] });
  await useSessionStore.getState().execute(source, lines.join('\n'));
  return useSessionStore.getState().output.filter((o) => o.kind === 'output').map((o) => o.text);
}

beforeAll(async () => {
  await loadFoxVm();
});

beforeEach(() => {
  const api = createMemoryApi();
  api.binary$.set(`${HOME}/data/appdata.dbc`, new Uint8Array([0]));
  setApi(api);
  useProjectStore.setState({ path: `${HOME}/proj.fxproject`, doc: null });
  useSessionStore.getState().cancel();
  useSessionStore.setState({ output: [] });
});

describe('a file named without a folder', () => {
  it('is in the project folder, for FULLPATH as for everything else', async () => {
    const said = await run('? FULLPATH("appdata.dbc")', '? FILE("data\\appdata.dbc")');
    expect(said[0]).toBe(`${HOME}/APPDATA.DBC`.toUpperCase());
    expect(said[1]).toBe('.T.');
  });

  it('is answered by FULLPATH where SET PATH finds it', async () => {
    // measured in Visual FoxPro 9: found on the path, the path is where it is; found nowhere,
    // it is in the default directory
    const said = await run('SET PATH TO data', '? FULLPATH("appdata.dbc")', '? FULLPATH("nothere.dbc")');
    expect(said[0]?.replace(/\\/g, '/')).toBe(`${HOME}/data/appdata.dbc`.toUpperCase());
    expect(said[1]).toBe(`${HOME}/NOTHERE.DBC`.toUpperCase());
  });

  it('is opened by OPEN DATABASE where SET PATH finds it', async () => {
    // measured in Visual FoxPro 9: `OPEN DATABASE name` finds a container on SET PATH
    const said = await run(
      'CREATE DATABASE data\\fdvdb',
      'CLOSE DATABASES ALL',
      'SET PATH TO data',
      'OPEN DATABASE fdvdb SHARED',
      '? DBC()',
    );
    // the name as it was found: the path it was looked for on, which here is the project's
    expect(said[0]?.replace(/\\/g, '/').toUpperCase()).toMatch(/(^|\/)DATA\/FDVDB\.DBC$/);
  });
});
