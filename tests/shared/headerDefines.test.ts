import { describe, expect, it } from 'vitest';
import { definesIn, expandAllDefines, expandDefines } from '@shared/runtime/headerDefines';

describe('the constants of a class header in its property expressions', () => {
  const defines = definesIn({
    CMDEFINE: ['#DEFINE KEY_PATH_TABLE "AppReg01"', '#define KEY_TYPE_NUMERIC 2  && a number', '#DEFINE BOTH (KEY_TYPE_NUMERIC + 1)', '* a comment line'].join('\r\n'),
  });

  it('reads each #DEFINE, a trailing comment left out', () => {
    expect(defines.get('KEY_PATH_TABLE')).toBe('"AppReg01"');
    expect(defines.get('KEY_TYPE_NUMERIC')).toBe('2');
    expect(defines.size).toBe(3);
  });

  it('puts a constant in wherever it is named, and reads constants in constants', () => {
    expect(expandDefines('(KEY_PATH_TABLE)', defines)).toBe('("AppReg01")');
    expect(expandDefines('(key_type_numeric * 10)', defines)).toBe('(2 * 10)');
    expect(expandDefines('(BOTH)', defines)).toBe('((2 + 1))');
  });

  it('leaves text in quotes and a member after a dot alone', () => {
    expect(expandDefines('("KEY_PATH_TABLE" + THIS.KEY_TYPE_NUMERIC)', defines)).toBe('("KEY_PATH_TABLE" + THIS.KEY_TYPE_NUMERIC)');
    expect(expandDefines('(.NOT. KEY_TYPE_NUMERIC = 2)', defines)).toBe('(.NOT. 2 = 2)');
  });

  it('changes nothing when there are no constants', () => {
    const expressions = { 'x.y': '(NULL)' };
    expect(expandAllDefines(expressions, new Map())).toBe(expressions);
    expect(expandAllDefines({ 'x.y': '(KEY_TYPE_NUMERIC)' }, defines)).toEqual({ 'x.y': '(2)' });
  });
});
