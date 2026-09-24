* GETFLDSTATE() on a buffered table: the deletion flag and each field, and -1 for all of them
* as a string. CodeMine asks both to tell whether a record has changes to save.
SET MULTILOCKS ON
CREATE TABLE fdvbuf FREE (a N(3), b C(3))
INSERT INTO fdvbuf VALUES (1, "x")
USE
USE fdvbuf ALIAS bb
CURSORSETPROP("Buffering", 3, "bb")
GO TOP
? "clean", TRANSFORM(GETFLDSTATE(0, "bb")), GETFLDSTATE(-1, "bb"), TRANSFORM(GETFLDSTATE(1, "bb")), TRANSFORM(GETFLDSTATE("b", "bb"))
REPLACE b WITH "y" IN bb
? "changed", TRANSFORM(GETFLDSTATE(0, "bb")), GETFLDSTATE(-1, "bb"), TRANSFORM(GETFLDSTATE(2, "bb"))
APPEND BLANK IN bb
? "appended", TRANSFORM(GETFLDSTATE(0, "bb")), GETFLDSTATE(-1, "bb")
REPLACE a WITH 5 IN bb
? "appended+", TRANSFORM(GETFLDSTATE(0, "bb")), GETFLDSTATE(-1, "bb")
? "types", VARTYPE(GETFLDSTATE(0, "bb")), VARTYPE(GETFLDSTATE(-1, "bb"))
TABLEREVERT(.T., "bb")
USE IN bb
ERASE fdvbuf.dbf
