* Names a line only has once it runs: the work area held in a property, a variable that may not
* be there, and an array named by a macro.
CREATE CURSOR curA (n N(3))
INSERT INTO curA VALUES (1)
INSERT INTO curA VALUES (2)
INSERT INTO curA VALUES (3)
CREATE CURSOR curB (n N(3))
INSERT INTO curB VALUES (9)
o = CREATEOBJECT("Empty")
ADDPROPERTY(o, "cWorkarea", "curA")
GO TOP IN curA
SKIP 1 IN o.cWorkarea
? "skip", TRANSFORM(RECNO("curA")), ALIAS()
SKIP -1 IN o.cWorkarea
? "back", TRANSFORM(RECNO("curA"))
GO BOTTOM IN o.cWorkarea
? "bottom", TRANSFORM(RECNO("curA"))
? "vartype", VARTYPE(m.pnNoSuchVariable), VARTYPE(pnNoSuchVariable), VARTYPE(o), VARTYPE(m.o)
PRIVATE pnThere
pnThere = 4
? "there", VARTYPE(m.pnThere)
cName = "aList"
DIMENSION &cName[3]
? "dim", TRANSFORM(ALEN(aList))
LOCAL aTemp[3]
aTemp[1] = "a"
aTemp[2] = "b"
aTemp[3] = "c"
=ACOPY(aTemp, &cName)
? "acopy", aList[1], aList[3]
DIMENSION aNames[2]
aNames[2] = "cName"
? "element", &aNames[2]
* a relation taken away from a parent named by expressions, from another area
CREATE CURSOR par (k N(3))
INSERT INTO par VALUES (1)
CREATE CURSOR kid (k N(3))
INDEX ON k TAG k
INSERT INTO kid VALUES (1)
SELECT par
SET RELATION TO k INTO kid
? "rel", RELATION(1), IIF(SEEK(1, "kid"), "found", "missing")
cKid = "kid"
cPar = "par"
SELECT kid
SET RELATION OFF INTO (cKid) IN (cPar)
? "off", "[" + RELATION(1, "par") + "]", ALIAS()
SELECT kid
SET RELATION TO k INTO (cKid) IN (cPar)
? "again", RELATION(1, "par"), ALIAS()
* what kind of source a cursor is: a table or a cursor is 3, which CodeMine asks before SET ORDER
? "sourcetype", TRANSFORM(CURSORGETPROP("SourceType", "kid")), TRANSFORM(CURSORGETPROP("SourceType"))
* and which database it is in: none, for a cursor or a free table
CREATE TABLE fdvfree FREE (n N(3))
? "database", "[" + CURSORGETPROP("Database") + "]", "[" + CURSORGETPROP("Database", "kid") + "]"
USE IN fdvfree
* a folder whose name is how a clause word may be shortened is still a folder of the path
MKDIR data
CREATE DATABASE data\fdvdb
? "dbc", LOWER(JUSTFNAME(DBC())), LOWER(JUSTFNAME(JUSTPATH(DBC())))
CLOSE DATABASES
* CodeMine sets the memo width well past what FoxPro 2 allowed
SET MEMOWIDTH TO 2048
? "memowidth", TRANSFORM(SET("MEMOWIDTH"))
cSaid = "no error"
TRY
  SET MEMOWIDTH TO 7
CATCH TO oErr
  cSaid = TRANSFORM(oErr.ErrorNo) + " " + TRANSFORM(SET("MEMOWIDTH"))
ENDTRY
* one string: after an error the product spaces the items of a ? list in a way not worked out
? "too narrow " + cSaid
