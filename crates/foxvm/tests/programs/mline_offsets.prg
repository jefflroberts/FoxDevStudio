* MLINE() with a character offset: lines counted from the offset, and _MLINE left just past the
* line, the LF of a CR+LF passed over - how CodeMine reads its messages a line at a time.
t = "aaa" + CHR(13) + "bbb" + CHR(13) + "ccc" + CHR(13) + "ddd"
? "1", "[" + MLINE(t, 2, 5) + "]", TRANSFORM(_MLINE)
? "2", "[" + MLINE(t, 1, 5) + "]", TRANSFORM(_MLINE)
? "3", "[" + MLINE(t, 3, 0) + "]", TRANSFORM(_MLINE)
? "4", "[" + MLINE(t, 2, 9) + "]", TRANSFORM(_MLINE)
? "5", "[" + MLINE(t, 1, 3) + "]", TRANSFORM(_MLINE)
? "6", "[" + MLINE(t, 9, 0) + "]", TRANSFORM(_MLINE)
? "7", "[" + MLINE(t, 2) + "]", TRANSFORM(_MLINE)
cV = " 2" + CHR(13) + CHR(10) + CHR(13) + CHR(10) + CHR(13) + CHR(10) + CHR(13) + CHR(10) + "   30" + CHR(13) + CHR(10) + "Alabama Venetian Blind Company" + CHR(13) + CHR(10)
SET MEMOWIDTH TO 512
_MLINE = 0
? "a[" + MLINE(cV, 1, _MLINE) + "]", TRANSFORM(_MLINE)
? "b[" + MLINE(cV, 1, _MLINE) + "]", TRANSFORM(_MLINE)
? "c[" + MLINE(cV, 1, _MLINE) + "]", TRANSFORM(_MLINE)
? "d[" + MLINE(cV, 1, _MLINE) + "]", TRANSFORM(_MLINE)
? "e[" + MLINE(cV, 1, _MLINE) + "]", TRANSFORM(_MLINE)
_MLINE = _MLINE + 3
? "f[" + MLINE(cV, 1, _MLINE) + "]", TRANSFORM(_MLINE)
? "len", TRANSFORM(LEN(cV))
_MLINE = 0
? "g[" + MLINE(cV, 2) + "]", TRANSFORM(_MLINE)
? "h[" + MLINE(cV, 2, 4) + "]", TRANSFORM(_MLINE)
