* In the command ON ERROR names, PROGRAM() and LINENO() are the routine and line that failed -
* CodeMine hands them to its Error method that way. A routine the handler calls answers for
* itself. Each line is one string: after an error the product spaces the items of a list oddly.
ON ERROR ? "handler " + TRANSFORM(ERROR()) + " " + PROGRAM() + " " + TRANSFORM(LINENO())
x = nowhere
DO Sub1
ON ERROR DO fdvReport WITH ERROR(), PROGRAM(), LINENO()
DO Sub1
ON ERROR
? "end"
PROCEDURE Sub1
  y = nowhere2
ENDPROC
PROCEDURE fdvReport(n, p, l)
  ? "report " + TRANSFORM(n) + " " + p + " " + TRANSFORM(l) + " " + PROGRAM()
ENDPROC
