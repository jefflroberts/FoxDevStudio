/**
 * The `#DEFINE` constants of a class's header files, for the property values the class writes as
 * expressions.
 *
 * A class's methods are compiled with its header, so a constant there is a value in every line
 * of them. A property written as an expression - CodeMine's `cKeyPathTable = (KEY_PATH_TABLE)` -
 * is worked out when an object is made, not compiled with the methods, so the constants it names
 * are put into its text first, as the compiler puts them into a line.
 */

/** Every `#DEFINE name value` in the headers, by upper-cased name. */
export function definesIn(headers: Record<string, string>): Map<string, string> {
  const out = new Map<string, string>();
  for (const text of Object.values(headers)) {
    for (const line of text.split(/\r?\n|\r/)) {
      const found = /^\s*#\s*DEFINE\s+([A-Za-z_][A-Za-z0-9_]*)\s+(.*?)\s*$/i.exec(line);
      if (!found) continue;
      // a comment after the value is no part of it
      const value = (found[2] ?? '').replace(/\s*&&.*$/, '').trim();
      if (value !== '' && !out.has(found[1]!.toUpperCase())) out.set(found[1]!.toUpperCase(), value);
    }
  }
  return out;
}

/**
 * The expression with every constant it names put in, a constant's value read for constants of
 * its own as the compiler reads it. Text inside quotes and a name after a dot - a member - are
 * left as they are.
 */
export function expandDefines(expression: string, defines: Map<string, string>): string {
  if (defines.size === 0) return expression;
  let text = expression;
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    let out = '';
    let i = 0;
    while (i < text.length) {
      const c = text[i]!;
      if (c === '"' || c === "'") {
        const end = text.indexOf(c, i + 1);
        const stop = end < 0 ? text.length : end + 1;
        out += text.slice(i, stop);
        i = stop;
        continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        let j = i + 1;
        while (j < text.length && /[A-Za-z0-9_]/.test(text[j]!)) j++;
        const word = text.slice(i, j);
        const afterDot = out.trimEnd().endsWith('.') && !/\.(AND|OR|NOT|T|F|NULL)\.$/i.test(out.trimEnd());
        const value = afterDot ? undefined : defines.get(word.toUpperCase());
        if (value !== undefined) {
          out += value;
          changed = true;
        } else {
          out += word;
        }
        i = j;
        continue;
      }
      out += c;
      i++;
    }
    text = out;
    if (!changed) break;
  }
  return text;
}

/** The same, for every expression of a class. */
export function expandAllDefines(expressions: Record<string, string> | undefined, defines: Map<string, string>): Record<string, string> | undefined {
  if (!expressions || defines.size === 0) return expressions;
  return Object.fromEntries(Object.entries(expressions).map(([where, source]) => [where, expandDefines(source, defines)]));
}
