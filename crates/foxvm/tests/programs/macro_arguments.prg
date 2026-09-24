* A macro standing as a whole argument is text put into the line - several arguments, passed by
* reference with @ if the text says so - and SET CENTURY TO takes values that are worked out.
n = 20
r = 40
SET CENTURY TO (n) ROLLOVER (r)
? "century", TRANSFORM(SET("CENTURY", 1)), TRANSFORM(SET("CENTURY", 2)), SET("CENTURY")
SET CENTURY TO 19 ROLLOVER 0
LOCAL a, b
a = 1
b = 2
cList = "@m.a,@m.b"
? "args", Swap(&cList), TRANSFORM(a), TRANSFORM(b)
cList = "10, 20"
? "sum", TRANSFORM(Add(&cList))
? "mixed", TRANSFORM(Add(1, &cList))
IF Add(&cList) = 30
  ? "in an IF"
ENDIF
FUNCTION Swap(x, y)
  LOCAL t
  t = x
  x = y
  y = t
  RETURN "swapped"
ENDFUNC
FUNCTION Add(p, q, s)
  RETURN p + q + IIF(PCOUNT() > 2, s, 0)
ENDFUNC
