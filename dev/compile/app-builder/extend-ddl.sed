:a
N
$!ba 
s/(\n[ \t]*CREATE\s+)(VIEW|FUNCTION|TRIGGER)(\s)/\1 OR REPLACE \2\3/ig
s/\n[ \t]*CREATE\s+TABLE\s+/&#IF NOT EXISTS# /ig
s/\n[ \t]*CREATE\s+(UNIQUE\s+)?INDEX\s+/&#IF NOT EXISTS# /ig
s/\n[ \t]*ALTER\s+(TABLE\s+ONLY|TABLE)\s+[a-zA-Z_0-9]+[.][a-zA-Z_0-9.]+\s+ADD\s+COLUMN\s/&#IF NOT EXISTS# /i
s/#IF NOT EXISTS#IF\s/IF /ig
s/#IF NOT EXISTS#/IF NOT EXISTS/ig
s/\n[ \t]*DROP\s+(VIEW|FUNCTION|TABLE)\s+/&#IF EXISTS# /ig
s/#IF EXISTS#IF\s/IF /ig
s/#IF EXISTS#/IF EXISTS/ig
s/\n[ \t]*CREATE\s+(UNIQUE\s+INDEX|INDEX)\s+IF\s+NOT\s+EXISTS\s+([a-zA-Z_0-9]+)\s+ON\s+([a-zA-Z_0-9]+)[.]([a-zA-Z_0-9.]+)\s+[^;]+;/& PERFORM migration.drop_versions('DROP INDEX IF EXISTS \3.###','\2');/ig
s/\n([ \t]*ALTER\s+(TABLE\s+ONLY|TABLE)\s+([a-zA-Z_0-9]+)[.][a-zA-Z_0-9.]+\s+ADD\s+CONSTRAINT\s+([a-zA-Z_0-9]+)\s+[^;]+;)/\nIF NOT migration.constraint_exists('\4','\3') THEN \1 END IF;/ig
s/ [ \t]*(ALTER\s+(TABLE\s+ONLY|TABLE)\s+([a-zA-Z_0-9]+)[.][a-zA-Z_0-9.]+)\s+ADD\s+CONSTRAINT\s+([a-zA-Z_0-9]+)\s+[^;]+;/& PERFORM migration.drop_versions('\1 DROP CONSTRAINT IF EXISTS ### CASCADE', '\4');/ig

