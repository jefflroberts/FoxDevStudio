import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setApi } from '@renderer/api/foxdev';
import { createMemoryApi } from '@renderer/api/memoryApi';
import { useSessionStore } from '@renderer/runtime/session';
import { createProjectSource } from '@renderer/runtime/projectSource';
import { compileProgram } from '@renderer/runtime/vmBridge';
import { loadFoxVm } from '../../src/wasm/foxvm/loader';

// two programs of Visual FoxPro's own FormsUI sample, read where the product installs them
const FORMSUI = 'C:/Program Files (x86)/Microsoft Visual FoxPro 9/Samples/Solution/FormsUI';
const haveFormsUi = existsSync(FORMSUI);

const source = createProjectSource();
const outputText = () => useSessionStore.getState().output.map((o) => `${o.kind}:${o.text}`).join(' | ');

beforeAll(async () => {
  await loadFoxVm();
});

beforeEach(() => {
  setApi(createMemoryApi());
  useSessionStore.getState().cancel();
  useSessionStore.setState({ output: [] });
});

describe('DEFINE CLASS', () => {
  it('creates a form defined in code and shows it', async () => {
    await useSessionStore.getState().execute(
      source,
      [
        'oForm = CREATEOBJECT("form1")',
        '? oForm.Caption',
        '? oForm.Image1.Left',
        'oForm.Image1.Left = 200',
        '? oForm.Image1.Left',
        'RETURN',
        '',
        'DEFINE CLASS form1 AS form',
        '\tCaption = "Built in code"',
        '\tName = "Form1"',
        '',
        '\tADD OBJECT image1 AS image WITH ;',
        '\t\tLeft = 100, ;',
        '\t\tTop = 75, ;',
        '\t\tName = "Image1"',
        'ENDDEFINE',
      ].join('\n'),
    );

    expect(outputText()).toContain('Built in code');
    expect(outputText()).toContain('100');
    expect(outputText()).toContain('200');
    const desktop = useSessionStore.getState().desktop;
    expect(desktop?.forms).toHaveLength(1);
    expect(desktop?.forms[0]?.className?.toLowerCase()).toBe('form1');
  });

  it('runs a method defined on the class', async () => {
    await useSessionStore.getState().execute(
      source,
      [
        'oThing = CREATEOBJECT("greeter")',
        '? oThing.Greet("world")',
        'RETURN',
        '',
        'DEFINE CLASS greeter AS custom',
        '\tPrefix = "Hello, "',
        '\tPROCEDURE Greet(cName)',
        '\t\tRETURN THIS.Prefix + cName',
        '\tENDPROC',
        'ENDDEFINE',
      ].join('\n'),
    );
    expect(outputText()).toContain('Hello, world');
  });

  it('keeps a non-visual class off the desktop', async () => {
    await useSessionStore.getState().execute(source, 'oS = CREATEOBJECT("thing")\n? oS.Tag\nRETURN\n\nDEFINE CLASS thing AS custom\n\tTag = "quiet"\nENDDEFINE');
    expect(outputText()).toContain('quiet');
    expect(useSessionStore.getState().desktop?.visibleForms).toHaveLength(0);
  });

  it('inherits properties and methods from a class in the same program', async () => {
    await useSessionStore.getState().execute(
      source,
      [
        'oB = CREATEOBJECT("child")',
        '? oB.Kind, oB.Extra, oB.Describe()',
        'RETURN',
        '',
        'DEFINE CLASS parent AS custom',
        '\tKind = "base"',
        '\tPROCEDURE Describe',
        '\t\tRETURN "from parent"',
        '\tENDPROC',
        'ENDDEFINE',
        '',
        'DEFINE CLASS child AS parent',
        '\tExtra = "more"',
        'ENDDEFINE',
      ].join('\n'),
    );
    expect(outputText()).toContain('base');
    expect(outputText()).toContain('more');
    expect(outputText()).toContain('from parent');
  });

  it('calls the method of the class it was built from with DODEFAULT()', async () => {
    await useSessionStore.getState().execute(
      source,
      [
        'oB = CREATEOBJECT("child")',
        '? oB.Describe()',
        'RETURN',
        '',
        'DEFINE CLASS parent AS custom',
        '\tPROCEDURE Describe',
        '\t\tRETURN "from parent"',
        '\tENDPROC',
        'ENDDEFINE',
        '',
        'DEFINE CLASS child AS parent',
        '\tPROCEDURE Describe',
        '\t\tRETURN "child and " + DODEFAULT()',
        '\tENDPROC',
        'ENDDEFINE',
      ].join('\n'),
    );
    expect(outputText()).toContain('child and from parent');
  });

  it.skipIf(!haveFormsUi)('compiles the real sample that used to fail', () => {
    const text = readFileSync(`${FORMSUI}/1_formsui_gdiplusimaging.prg`, 'utf8');
    const out = compileProgram(text, '1_formsui_gdiplusimaging');
    const errors = out.diagnostics.filter((d) => d.severity === 'error');
    expect(errors.map((e) => `${e.message} (line ${e.line})`)).toEqual([]);
    expect(out.bytes).not.toBeNull();
  });

  it('sets properties on the pages a pageframe creates for itself', async () => {
    await useSessionStore.getState().execute(
      source,
      [
        'oForm = CREATEOBJECT("tabbed")',
        '? oForm.pgfMain.PageCount',
        '? oForm.pgfMain.Page1.Caption',
        '? oForm.pgfMain.Page2.Caption',
        'RETURN',
        '',
        'DEFINE CLASS tabbed AS form',
        '\tADD OBJECT pgfMain AS pageframe WITH ;',
        '\t\tPageCount = 2, ;',
        '\t\tLeft = 10, ;',
        '\t\tPage1.Caption = "First", ;',
        '\t\tPage2.Caption = "Second"',
        'ENDDEFINE',
      ].join('\n'),
    );

    expect(outputText()).toContain('First');
    expect(outputText()).toContain('Second');
    expect(outputText()).toContain('2');
  });

  it('gives an option group its buttons so a dotted caption lands', async () => {
    await useSessionStore.getState().execute(
      source,
      [
        'oForm = CREATEOBJECT("picker")',
        '? oForm.opgSize.Option1.Caption + "/" + oForm.opgSize.Option3.Caption',
        'RETURN',
        '',
        'DEFINE CLASS picker AS form',
        '\tADD OBJECT opgSize AS optiongroup WITH ;',
        '\t\tButtonCount = 3, ;',
        '\t\tOption1.Caption = "Small", ;',
        '\t\tOption3.Caption = "Large"',
        'ENDDEFINE',
      ].join('\n'),
    );

    expect(outputText()).toContain('Small/Large');
  });

  it.skipIf(!haveFormsUi)('compiles the themes sample, which sets page properties in the WITH list', () => {
    const text = readFileSync(`${FORMSUI}/3_formsui_themes.prg`, 'utf8');
    const out = compileProgram(text, '3_formsui_themes');
    const errors = out.diagnostics.filter((d) => d.severity === 'error');
    expect(errors.map((e) => `${e.message} (line ${e.line})`)).toEqual([]);
    expect(out.bytes).not.toBeNull();
  });

  it('adds a control at runtime and fills a combo box, like the themes sample', async () => {
    await useSessionStore.getState().execute(
      source,
      [
        'oForm = NEWOBJECT("form1")',
        '? oForm.Pageframe1.Page1.Combo1.ListCount',
        '? oForm.Pageframe1.Page1.Combo1.List(2)',
        '? oForm.Pageframe1.Page1.Combo1.Selected(1)',
        '? oForm.Command1.Caption',
        'RETURN',
        '',
        'DEFINE CLASS form1 AS form',
        '\tADD OBJECT pageframe1 AS pageframe WITH ;',
        '\t\tPageCount = 2, ;',
        '\t\tName = "Pageframe1", ;',
        '\t\tPage1.Name = "Page1"',
        '',
        '\tPROCEDURE Init',
        '\t\tThis.Pageframe1.Page1.AddObject("Combo1","combobox")',
        '\t\tThis.Pageframe1.Page1.Combo1.AddItem("Apples")',
        '\t\tThis.Pageframe1.Page1.Combo1.AddItem("Oranges")',
        '\t\tThis.Pageframe1.Page1.Combo1.Picture[1] = "fox.bmp"',
        '\t\tThis.Pageframe1.Page1.Combo1.Selected(1) = .T.',
        '\t\tThis.Pageframe1.Page1.Combo1.Visible = .T.',
        '\t\tThis.AddObject("Command1","commandbutton")',
        '\t\tThis.Command1.Caption = "Command1"',
        '\tENDPROC',
        'ENDDEFINE',
      ].join('\n'),
    );

    expect(outputText()).toContain('2');
    expect(outputText()).toContain('Oranges');
    expect(outputText()).toContain('.T.');
    expect(outputText()).toContain('Command1');
  });

  it('reports a subscript past the end of an item list', async () => {
    await useSessionStore.getState().execute(
      source,
      ['oC = CREATEOBJECT("picker")', 'RETURN', '', 'DEFINE CLASS picker AS form', '	ADD OBJECT combo1 AS combobox', 'ENDDEFINE'].join('\n'),
    );

    const combo = useSessionStore.getState().desktop?.forms[0]?.child('combo1');
    expect(combo).toBeDefined();
    combo!.addItem('Apples');
    expect(() => combo!.setElement('Selected', [4], true)).toThrow(/Subscript is outside defined range/);
    expect(() => combo!.setElement('Nonesuch', [1], true)).toThrow(/NONESUCH is not found/);
  });

  it('binds an Exception object to CATCH TO, with VFP property names', async () => {
    await useSessionStore.getState().execute(
      source,
      [
        'TRY',
        // `%` by zero is error 1307; `/` by zero is not an error in Visual FoxPro at all - it
        // answers with a number too big to print
        '\tx = 1 % 0',
        'CATCH TO oErr',
        '\t? oErr.Message',
        '\t? TRANSFORM(oErr.ErrorNo) + " on line " + TRANSFORM(oErr.LineNo)',
        '\t? VARTYPE(oErr)',
        'ENDTRY',
      ].join('\n'),
    );

    expect(outputText()).toContain('Cannot divide by 0.');
    expect(outputText()).toContain('1307 on line 2');
    expect(outputText()).toContain('O');
  });

  it('tries each CATCH clause in turn and rethrows when none matches', async () => {
    await useSessionStore.getState().execute(
      source,
      [
        'TRY',
        '\tTRY',
        '\t\tTHROW "inner"',
        '\tCATCH TO e WHEN e.ErrorNo = 12',
        '\t\t? "wrong"',
        '\tCATCH TO e WHEN e.ErrorNo = 2071',
        '\t\t? "user error: " + e.UserValue',
        '\tENDTRY',
        '\tTRY',
        '\t\tTHROW "unhandled"',
        '\tCATCH TO e WHEN e.ErrorNo = 12',
        '\t\t? "wrong again"',
        '\tENDTRY',
        'CATCH TO e',
        '\t? "outer caught " + e.UserValue',
        'ENDTRY',
      ].join('\n'),
    );

    const printed = useSessionStore.getState().output.filter((o) => o.kind === 'output').map((o) => o.text);
    expect(printed).toEqual(['user error: inner', 'outer caught unhandled']);
  });

  it('gives a class an array property from DIMENSION and returns it by reference', async () => {
    await useSessionStore.getState().execute(
      source,
      [
        'oRGB = CREATEOBJECT("Colors")',
        'aParts = oRGB.RGBComp(14055680)',
        '? TRANSFORM(aParts[1]) + "," + TRANSFORM(aParts[2]) + "," + TRANSFORM(aParts[3])',
        '? TRANSFORM(ALEN(oRGB.aRGB))',
        'RETURN',
        '',
        'DEFINE CLASS Colors AS Custom',
        '\tDIMENSION aRGB[3]',
        '',
        '\tFUNCTION RGBComp(nColor)',
        '\t\tThis.aRGB[3] = INT(nColor/(256^2))',
        '\t\tnColor = MOD(nColor,(256^2))',
        '\t\tThis.aRGB[2] = INT(nColor/256)',
        '\t\tThis.aRGB[1] = MOD(nColor,256)',
        '\t\tRETURN @This.aRGB',
        '\tENDFUNC',
        'ENDDEFINE',
      ].join('\n'),
    );

    // RGB(0, 121, 214) is 14055680
    expect(outputText()).toContain('0,121,214');
    expect(outputText()).toContain('3');
  });

  it('runs a program named by an expression', async () => {
    await useSessionStore.getState().execute(
      source,
      ['cWhich = "Greet"', 'DO (cWhich) WITH "world"', 'RETURN', '', 'PROCEDURE Greet(cWho)', '\t? "hello " + cWho'].join('\n'),
    );
    expect(outputText()).toContain('hello world');
  });

  it('hands an error inside a method to the class Error method', async () => {
    await useSessionStore.getState().execute(
      source,
      [
        'x = NEWOBJECT("MyClass")',
        'x.Proc1()',
        '? "still running"',
        'RETURN',
        '',
        'DEFINE CLASS MyClass AS Session',
        '\tPROCEDURE Proc1',
        '\t\tTRY',
        '\t\t\tThis.Proc2()',
        '\t\tCATCH',
        '\t\t\t? "not here: the class has an Error method"',
        '\t\tENDTRY',
        '\t\t? "back in Proc1"',
        '\tENDPROC',
        '',
        '\tPROCEDURE Proc2',
        '\t\tLOCAL y',
        '\t\ty = nosuchvariable',
        '\t\t? "Proc2 carries on after the Error method"',
        '\tENDPROC',
        '',
        '\tPROCEDURE Error(nError, cMethod, nLine)',
        '\t\t? "Error method: " + TRANSFORM(nError) + " in " + cMethod',
        '\tENDPROC',
        'ENDDEFINE',
      ].join('\n'),
    );

    const printed = useSessionStore.getState().output.filter((o) => o.kind === 'output').map((o) => o.text);
    // VFP resumes the failing method at its next statement, as it does after ON ERROR
    expect(printed).toEqual([
      'Error method: 12 in proc2',
      'Proc2 carries on after the Error method',
      'back in Proc1',
      'still running',
    ]);
  });

  it('lets a TRY inside the failing method win over the Error method', async () => {
    await useSessionStore.getState().execute(
      source,
      [
        'x = NEWOBJECT("Guarded")',
        'x.Run()',
        'RETURN',
        '',
        'DEFINE CLASS Guarded AS Session',
        '\tPROCEDURE Run',
        '\t\tTRY',
        '\t\t\ty = nosuchvariable',
        '\t\tCATCH TO e',
        '\t\t\t? "caught here: " + e.Message',
        '\t\tENDTRY',
        '\tENDPROC',
        '',
        '\tPROCEDURE Error(nError, cMethod, nLine)',
        '\t\t? "not the Error method"',
        '\tENDPROC',
        'ENDDEFINE',
      ].join('\n'),
    );

    const printed = useSessionStore.getState().output.filter((o) => o.kind === 'output').map((o) => o.text);
    expect(printed).toEqual(["caught here: Variable 'NOSUCHVARIABLE' is not found."]);
  });

  it('carries on past an error raised inside an Error method, however it was reached', async () => {
    // Measured in Visual FoxPro 9: an ERROR raised in an Error method - called directly, or
    // reached as an ancestor's through DODEFAULT() - goes neither to Error again nor to ON
    // ERROR; the method carries on at its next line. This was the loop in CodeMine's handler.
    await useSessionStore.getState().execute(
      source,
      [
        'ON ERROR ? "ON ERROR got", ERROR()',
        'o = CREATEOBJECT("cerr")',
        'o.Error(1098, "direct", 1)',
        '? "count", o.nCount',
        'o = CREATEOBJECT("cchild")',
        'o.Error(1098, "direct", 1)',
        '? "count", o.nCount',
        'RETURN',
        '',
        'DEFINE CLASS cerr AS Custom',
        '  nCount = 0',
        '  PROCEDURE Error(nError, cMethod, nLine)',
        '    THIS.nCount = THIS.nCount + 1',
        '    ? "in Error", THIS.nCount',
        '    IF THIS.nCount < 4',
        '      ERROR "raised inside Error"',
        '    ENDIF',
        '    ? "after ERROR", THIS.nCount',
        '  ENDPROC',
        'ENDDEFINE',
        '',
        'DEFINE CLASS cchild AS cerr',
        '  PROCEDURE Error(nError, cMethod, nLine)',
        '    ? "child Error"',
        '    DODEFAULT(nError, cMethod, nLine)',
        '  ENDPROC',
        'ENDDEFINE',
      ].join('\n'),
    );
    const printed = useSessionStore.getState().output.filter((o) => o.kind === 'output').map((o) => o.text.replace(/\s+/g, ' ').trim());
    expect(printed).toEqual(['in Error 1', 'after ERROR 1', 'count 1', 'child Error', 'in Error 1', 'after ERROR 1', 'count 1']);
  });

  it('does not hand an error inside the Error method back to itself', async () => {
    await useSessionStore.getState().execute(
      source,
      [
        'x = NEWOBJECT("Looper")',
        'x.Run()',
        'RETURN',
        '',
        'DEFINE CLASS Looper AS Session',
        '\tPROCEDURE Run',
        '\t\ty = firstmissing',
        '\tENDPROC',
        '',
        '\tPROCEDURE Error(nError, cMethod, nLine)',
        '\t\tTRY',
        '\t\t\tz = secondmissing',
        '\t\tCATCH TO e',
        '\t\t\t? "handled twice: " + e.Message',
        '\t\tENDTRY',
        '\tENDPROC',
        'ENDDEFINE',
      ].join('\n'),
    );

    const printed = useSessionStore.getState().output.filter((o) => o.kind === 'output').map((o) => o.text);
    expect(printed).toEqual(["handled twice: Variable 'SECONDMISSING' is not found."]);
  });

  it('runs the next class up with DODEFAULT(), as Visual FoxPro 9 measured it', async () => {
    // Every expected line was printed by vfp9.exe running this same program. The one thing left
    // out is `ca::Greet()` called from a method of another name, which still runs the parent's
    // version of the running method.
    await useSessionStore.getState().execute(
      source,
      [
        "o = CREATEOBJECT(\"cb\")",
        "? \"1\", o.Greet(\"x\")",
        "o = CREATEOBJECT(\"cc\")",
        "? \"2\", o.Greet(\"y\")",
        "o = CREATEOBJECT(\"cf\")",
        "? \"3\", o.Greet(\"z\")",
        "o = CREATEOBJECT(\"cd\")",
        "? \"4\", o.Greet()",
        "? \"5\", o.Who()",
        "o = CREATEOBJECT(\"cb\")",
        "? \"6\", o.Who()",
        "? \"7\", o.nInits",
        "o = CREATEOBJECT(\"cstmt\")",
        "? \"8\", o.cLog",
        "o = CREATEOBJECT(\"cscope\")",
        "? \"9\", o.Greet(\"s\")",
        "o = CREATEOBJECT(\"cnoret\")",
        "? \"11\", o.Greet()",
        "RETURN",
        "",
        "DEFINE CLASS ca AS Custom",
        "  nInits = 0",
        "  FUNCTION Init",
        "    THIS.nInits = THIS.nInits + 1",
        "  ENDFUNC",
        "  FUNCTION Greet(p)",
        "    RETURN \"a\" + p",
        "  ENDFUNC",
        "  FUNCTION Who",
        "    RETURN \"who=\" + THIS.Class",
        "  ENDFUNC",
        "ENDDEFINE",
        "",
        "DEFINE CLASS cb AS ca",
        "  FUNCTION Init",
        "    THIS.nInits = THIS.nInits + 10",
        "    RETURN DODEFAULT()",
        "  ENDFUNC",
        "  FUNCTION Greet(p)",
        "    RETURN \"b<\" + DODEFAULT(p + \"!\") + \">\"",
        "  ENDFUNC",
        "ENDDEFINE",
        "",
        "DEFINE CLASS cc AS cb",
        "ENDDEFINE",
        "",
        "DEFINE CLASS ce AS ca",
        "ENDDEFINE",
        "",
        "DEFINE CLASS cf AS ce",
        "  FUNCTION Greet(p)",
        "    RETURN \"f\" + DODEFAULT(p)",
        "  ENDFUNC",
        "ENDDEFINE",
        "",
        "DEFINE CLASS cd AS Custom",
        "  FUNCTION Greet",
        "    RETURN DODEFAULT()",
        "  ENDFUNC",
        "  FUNCTION Who",
        "    RETURN \"cd-\" + TRANSFORM(DODEFAULT())",
        "  ENDFUNC",
        "ENDDEFINE",
        "",
        "DEFINE CLASS cstmt AS ca",
        "  cLog = \"\"",
        "  FUNCTION Greet(p)",
        "    THIS.cLog = THIS.cLog + \"stmt;\"",
        "    DODEFAULT(p)",
        "    RETURN \"done\"",
        "  ENDFUNC",
        "  FUNCTION Init",
        "    THIS.Greet(\"q\")",
        "    THIS.cLog = THIS.cLog + TRANSFORM(THIS.nInits)",
        "  ENDFUNC",
        "ENDDEFINE",
        "",
        "DEFINE CLASS cscope AS ca",
        "  FUNCTION Greet(p)",
        "    RETURN \"s\" + ca::Greet(p)",
        "  ENDFUNC",
        "ENDDEFINE",
        "",
        "DEFINE CLASS cnoret AS ca",
        "  FUNCTION Greet(p)",
        "    DODEFAULT(\"n\")",
        "  ENDFUNC",
        "ENDDEFINE",
      ].join('\n'),
    );
    const printed = useSessionStore.getState().output.filter((o) => o.kind === 'output').map((o) => o.text.trimEnd());
    expect(printed).toEqual([
      '1 b<ax!>',
      '2 b<ay!>',
      '3 faz',
      '4 .T.',
      '5 cd-.T.',
      '6 who=Cb',
      '7         11',
      '8 stmt;0',
      '9 sas',
      '11 .T.',
    ]);
    expect(useSessionStore.getState().output.filter((o) => o.kind === 'error')).toEqual([]);
  });
  // After an error has been caught, Visual FoxPro puts more than one space between the items
  // of a `?` list, in a way not yet worked out; these two compare with runs of spaces closed up.
  const printedWords = () =>
    useSessionStore.getState().output.filter((o) => o.kind === 'output').map((o) => o.text.trim().replace(/ +/g, ' '));

  it('runs a method called from EVALUATE(), as Visual FoxPro 9 measured it', async () => {
    // CodeMine's cmEvent.Subscribe calls its subscriber this way. Every expected line was
    // printed by vfp9.exe running this same program.
    await useSessionStore.getState().execute(
      source,
      [
        "LOCAL oPub, oSub, x",
        "oPub = CREATEOBJECT(\"Publisher\")",
        "oSub = CREATEOBJECT(\"Subscriber\")",
        "oPub.Subscribe(oSub, \"Receive\")",
        "? oSub.cGot",
        "x = EVALUATE(\"oSub.Twice(21)\")",
        "? x",
        "? EVALUATE(\"oSub.Twice(oSub.Twice(2)) + 1\")",
        "EVALUATE(\"oSub.Receive('as a statement', 9)\")",
        "? oSub.cGot",
        "? EVAL(\"oSub.Twice(5)\")",
        "TRY",
        "  EVALUATE(\"oSub.Fails()\")",
        "CATCH TO oErr",
        "  ? \"caught\", TRANSFORM(oErr.ErrorNo), oErr.Procedure",
        "ENDTRY",
        "? \"after\"",
        "",
        "DEFINE CLASS Publisher AS Custom",
        "  uValue1 = \"first\"",
        "  uValue2 = 42",
        "  nParamCount = 2",
        "  PROCEDURE Subscribe(oSubscriber, cMethod)",
        "    LOCAL ix, cParams",
        "    cParams = ''",
        "    FOR ix = 1 TO THIS.nParamCount",
        "      cParams = cParams + ', THIS.uValue' + STR(ix, 1)",
        "    ENDFOR",
        "    EVALUATE('m.oSubscriber.' + m.cMethod + '(' + SUBSTR(m.cParams, 3) + ')')",
        "  ENDPROC",
        "ENDDEFINE",
        "",
        "DEFINE CLASS Subscriber AS Custom",
        "  cGot = \"\"",
        "  PROCEDURE Receive(a, b)",
        "    THIS.cGot = a + \" \" + TRANSFORM(b)",
        "  ENDPROC",
        "  FUNCTION Twice(n)",
        "    RETURN n * 2",
        "  ENDFUNC",
        "  PROCEDURE Fails",
        "    x = 1 + \"a\"",
        "  ENDPROC",
        "ENDDEFINE",
      ].join('\n'),
    );
    expect(printedWords()).toEqual(['first 42', '42', '9', 'as a statement 9', '10', 'caught 107 fails', 'after']);
    expect(useSessionStore.getState().output.filter((o) => o.kind === 'error' && !o.text.includes('handled by the program'))).toEqual([]);
  });

  it('catches an error inside a called method with a TRY in the caller, as Visual FoxPro 9 measured it', async () => {
    // The method runs as a fiber of its own here; in Visual FoxPro it is one stack, so a TRY
    // in the caller catches what nothing in the method handles. It is nearer than ON ERROR,
    // the object's own Error method is nearer still, and the rest of the method does not run.
    await useSessionStore.getState().execute(
      source,
      [
        "LOCAL o, p",
        "o = CREATEOBJECT(\"Plain\")",
        "p = CREATEOBJECT(\"WithError\")",
        "TRY",
        "  o.Fails()",
        "  ? \"1 not caught\"",
        "CATCH TO oErr",
        "  ? \"1 caught\", TRANSFORM(oErr.ErrorNo), oErr.Procedure, TRANSFORM(oErr.LineNo)",
        "ENDTRY",
        "ON ERROR ? \"2 on error\", TRANSFORM(ERROR())",
        "TRY",
        "  o.Fails()",
        "  ? \"2 after call\"",
        "CATCH TO oErr",
        "  ? \"2 caught\", TRANSFORM(oErr.ErrorNo)",
        "ENDTRY",
        "ON ERROR",
        "TRY",
        "  p.Fails()",
        "  ? \"3 after call\"",
        "CATCH TO oErr",
        "  ? \"3 caught\", TRANSFORM(oErr.ErrorNo)",
        "ENDTRY",
        "TRY",
        "  o.Outer()",
        "  ? \"4 not caught\"",
        "CATCH TO oErr",
        "  ? \"4 caught\", TRANSFORM(oErr.ErrorNo), oErr.Procedure",
        "ENDTRY",
        "? \"5\", o.cLog",
        "TRY",
        "  o.Throws()",
        "CATCH TO oErr",
        "  ? \"6 caught\", TRANSFORM(oErr.ErrorNo), TRANSFORM(oErr.UserValue)",
        "ENDTRY",
        "? \"end\"",
        "",
        "DEFINE CLASS Plain AS Custom",
        "  cLog = \"\"",
        "  PROCEDURE Fails",
        "    x = 1 + \"a\"",
        "    THIS.cLog = THIS.cLog + \"ran on;\"",
        "  ENDPROC",
        "  PROCEDURE Outer",
        "    THIS.Fails()",
        "    THIS.cLog = THIS.cLog + \"outer on;\"",
        "  ENDPROC",
        "  PROCEDURE Throws",
        "    THROW \"boom\"",
        "  ENDPROC",
        "ENDDEFINE",
        "",
        "DEFINE CLASS WithError AS Custom",
        "  PROCEDURE Fails",
        "    x = 1 + \"a\"",
        "  ENDPROC",
        "  PROCEDURE Error(nError, cMethod, nLine)",
        "    ? \"3 error method\", TRANSFORM(nError), cMethod, TRANSFORM(nLine)",
        "  ENDPROC",
        "ENDDEFINE",
      ].join('\n'),
    );
    expect(printedWords()).toEqual([
      '1 caught 107 fails 41',
      '2 caught 107',
      '3 error method 107 fails 55',
      '3 after call',
      '4 caught 107 fails',
      '5',
      '6 caught 2071 boom',
      'end',
    ]);
  });

  it('stops a method calling itself at the deepest level, as Visual FoxPro 9 measured it', async () => {
    // Measured from a main program at level 2: a method calling itself made 124 calls before the
    // next raised 103, one fewer than a function makes. From a main program at level 1 that is
    // 125. Each call is a fiber of its own here, so this is also what keeps a program that
    // recurses without end from running the JavaScript stack out.
    await useSessionStore.getState().execute(
      source,
      [
        'PUBLIC gnDepth',
        'gnDepth = 0',
        'o = CREATEOBJECT("Deep")',
        'TRY',
        '  o.Recurse()',
        'CATCH TO oErr',
        '  ? "caught", TRANSFORM(oErr.ErrorNo), TRANSFORM(gnDepth)',
        'ENDTRY',
        'DEFINE CLASS Deep AS Custom',
        '  PROCEDURE Recurse',
        '    gnDepth = gnDepth + 1',
        '    THIS.Recurse()',
        '  ENDPROC',
        'ENDDEFINE',
      ].join('\n'),
    );
    expect(printedWords()).toEqual(['caught 103 125']);
  });

  it('fills an Empty object with SCATTER NAME, into a property through WITH too, as Visual FoxPro 9 measured it', async () => {
    // CodeMine keeps a record's original values this way: SCATTER MEMO NAME .oOldVal
    await useSessionStore.getState().execute(
      source,
      [
        "CREATE CURSOR cc (keyname C(10), n N(3))",
        "INSERT INTO cc VALUES (\"abc\", 5)",
        "o = CREATEOBJECT(\"Holder\")",
        "e = CREATEOBJECT(\"Empty\")",
        "? \"empty\", VARTYPE(e)",
        "SCATTER MEMO NAME oPlain",
        "? \"plain\", oPlain.keyname, oPlain.n",
        "o.Fill()",
        "? \"with\", VARTYPE(o.oOldVal), o.oOldVal.keyname",
        "DEFINE CLASS Holder AS Custom",
        "  oOldVal = .NULL.",
        "  PROCEDURE Fill",
        "    WITH THIS",
        "      SCATTER MEMO NAME .oOldVal",
        "    ENDWITH",
        "  ENDPROC",
        "ENDDEFINE",
      ].join('\n'),
    );
    const printed = useSessionStore.getState().output.filter((o) => o.kind === 'output').map((o) => o.text.trimEnd());
    expect(printed).toEqual(['empty O', 'plain abc                 5', 'with O abc']);
  });

  it('runs Load for a form and not for a Custom or a Session, as Visual FoxPro 9 measured it', async () => {
    await useSessionStore.getState().execute(
      source,
      [
        'PUBLIC gcLog',
        'gcLog = ""',
        'o = CREATEOBJECT("CustomWithLoad")',
        's = CREATEOBJECT("SessionWithLoad")',
        'f = CREATEOBJECT("FormWithLoad")',
        '? "log", gcLog',
        'DEFINE CLASS CustomWithLoad AS Custom',
        '  PROCEDURE Load',
        '    gcLog = gcLog + "custom-load;"',
        '  ENDPROC',
        '  PROCEDURE Init',
        '    gcLog = gcLog + "custom-init;"',
        '  ENDPROC',
        'ENDDEFINE',
        'DEFINE CLASS SessionWithLoad AS Session',
        '  PROCEDURE Load',
        '    gcLog = gcLog + "session-load;"',
        '  ENDPROC',
        'ENDDEFINE',
        'DEFINE CLASS FormWithLoad AS Form',
        '  PROCEDURE Load',
        '    gcLog = gcLog + "form-load;"',
        '  ENDPROC',
        'ENDDEFINE',
      ].join('\n'),
    );
    expect(printedWords()).toEqual(['log custom-init;form-load;']);
  });

  it('lets a function fill an array property it is handed, as Visual FoxPro 9 measured it', async () => {
    // CodeMine's error dialog does AERROR(THISFORM.aErrInfo)
    await useSessionStore.getState().execute(
      source,
      [
        "o = CREATEOBJECT(\"Holder\")",
        "TRY",
        "  x = 1 + \"a\"",
        "CATCH",
        "ENDTRY",
        "n = AERROR(o.aErrInfo)",
        "cSaid = TRANSFORM(n) + \" \" + VARTYPE(o.aErrInfo[1]) + \" \" + TRANSFORM(o.aErrInfo[1]) + \" \" + TRANSFORM(ALEN(o.aErrInfo, 1)) + \" \" + TRANSFORM(ALEN(o.aErrInfo, 2))",
        "? \"aerror \" + cSaid",
        "DEFINE CLASS Holder AS Custom",
        "  DIMENSION aErrInfo[1]",
        "ENDDEFINE",
      ].join('\n'),
    );
    expect(printedWords()).toEqual(['aerror 1 N 107 1 7']);
  });
});
