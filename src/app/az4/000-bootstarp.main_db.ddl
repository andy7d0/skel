raise notice 'MIGRATION go';

if to_regproc('migration.db_version') is not null then
	if (select migration.db_version()) = '#MIGRATION_VERSION_PLACEHOLDER#' then
		return;
	end if;
end if;

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
PERFORM pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE SCHEMA IF NOT EXISTS login;
GRANT USAGE ON SCHEMA login TO sysuser_auth;

CREATE SCHEMA IF NOT EXISTS private;

CREATE SCHEMA IF NOT EXISTS migration;
GRANT USAGE ON SCHEMA login TO anonymous;

CREATE SCHEMA IF NOT EXISTS logs;
GRANT USAGE ON SCHEMA logs TO user_user;

CREATE SCHEMA IF NOT EXISTS operators;
GRANT USAGE ON SCHEMA operators TO user_user;

CREATE SCHEMA IF NOT EXISTS pgc;
GRANT USAGE ON SCHEMA pgc TO PUBLIC;

CREATE SCHEMA IF NOT EXISTS store;
GRANT USAGE ON SCHEMA store TO user_sysop;

CREATE SCHEMA IF NOT EXISTS utils;
GRANT USAGE ON SCHEMA utils TO PUBLIC;


SET azstate.mode = 'ALTER_DB';

ALTER DATABASE ext_db SET client_encoding TO 'UTF8';
ALTER DATABASE ext_db SET "DateStyle" TO 'iso, ymd';
ALTER DATABASE ext_db SET "TimeZone" TO 'utc';
ALTER DATABASE ext_db SET client_min_messages TO 'warning';
ALTER DATABASE ext_db SET bytea_output TO 'hex';
ALTER DATABASE ext_db SET search_path TO 'operators';

CREATE OR REPLACE FUNCTION migration.db_version() RETURNS text 
	LANGUAGE sql IMMUTABLE LEAKPROOF COST 1 
	AS $$SELECT '#MIGRATION_VERSION_PLACEHOLDER#'$$;

CREATE OR REPLACE FUNCTION migration.drop_triggers(p_table text) RETURNS void
    LANGUAGE plpgsql 
    AS $$
declare
    n text;
begin
    FOR n IN SELECT
        tgname
    FROM
        pg_catalog.pg_trigger tg
    WHERE
        tgrelid = p_table::regclass
        AND NOT tgisinternal
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s CASCADE', n, p_table);
    END LOOP;
end$$;

CREATE TABLE migration.guards (guard_key text PRIMARY KEY, guard_value text);
COMMENT ON TABLE migration.guards IS 'guard marks for migrations';


CREATE OR REPLACE FUNCTION migration.guard_migration(p_key text, p_value text DEFAULT null) RETURNS boolean
    LANGUAGE plpgsql 
    AS $$
begin
    INSERT INTO migration.guards (guard_key, guard_value) VALUES (p_key, p_value) ON CONFLICT DO NOTHING;
    RETURN NOT FOUND;
end$$;

-- usage IF migration.guard_migration('some_op_marker', 'version') THEN
   -- do something once (in target db) 
-- END IF;




-- types

ALTER FUNCTION  textlike LEAKPROOF;

--DROP TYPE IF EXISTS utils.cmp_op CASCADE;
if to_regtype('utils.cmp_op') is null then
CREATE TYPE utils.cmp_op AS ENUM (
    '=',
    '!=',
    '<',
    '>',
    '<=',
    '>='
);
end if;

--DROP TYPE IF EXISTS utils.pair CASCADE;
if to_regtype('utils.pair') is null then
CREATE TYPE utils.pair AS (
    k text,
    v text
);
end if;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA pgc;
COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--DROP TYPE IF EXISTS utils.path_pair CASCADE;
if to_regtype('utils.path_pair') is null then
CREATE TYPE utils.path_pair AS (
    p text[],
    v jsonb
);
end if;

if to_regtype('store.path_type') is null then
    CREATE DOMAIN main.path_type AS character varying(1000) collate "C";
end if;


-- simple functions

CREATE OR REPLACE FUNCTION utils.base52_10(i bigint) RETURNS text
    LANGUAGE plpgsql IMMUTABLE STRICT LEAKPROOF
    AS $$declare
  s text;
  r text;
  c bigint;
begin
  s = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  r = chr(ascii('0')+(i%10)::integer);
  c = i/10;
  loop exit when c = 0;
     r = SUBSTRING(s,(c%52)::integer+1,1)||r;
     c = c/52;
  end loop;
  return r;
end
$$;

CREATE OR REPLACE FUNCTION utils.base62_3(i integer) RETURNS text
    LANGUAGE plpgsql IMMUTABLE STRICT LEAKPROOF
    AS $$
declare
    s text;
begin 
    s = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    return SUBSTRING(s,i/(62*62)+1,1) 
        || SUBSTRING(s,(i/62)+1,1) || SUBSTRING(s,(i%62)+1,1);
end
$$;

CREATE OR REPLACE FUNCTION utils.unbase62_3(i text) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE STRICT LEAKPROOF
    AS $$
declare
    s text;
begin 
    s = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    return 
        (position(SUBSTRING(i,1,1) in s) - 1)*62*62 
        + (position(SUBSTRING(i,2,1) in s) - 1) *62 
        + (position(SUBSTRING(i,3,1) in s) - 1);
end
$$;

CREATE OR REPLACE FUNCTION utils.title_name(f text, i text, o text) RETURNS text
    LANGUAGE sql IMMUTABLE LEAKPROOF PARALLEL SAFE
    AS $$select concat(f||' '
                 , substring(i,1,1) || '.'
                 , substring(o,1,1) || '.')$$;



CREATE OR REPLACE FUNCTION utils.cmp(op utils.cmp_op, a bigint, b bigint) RETURNS boolean
    LANGUAGE sql IMMUTABLE COST 1 PARALLEL SAFE
    AS $$select case op
when '=' then a = b
when '!=' then a != b
when '<' then a < b
when '>' then a > b
when '<=' then a <= b
when '>=' then a >= b
end$$;

CREATE OR REPLACE FUNCTION utils.extract_number(str text) RETURNS numeric
    LANGUAGE sql IMMUTABLE STRICT LEAKPROOF PARALLEL SAFE
    AS $$select substring(str from '[0-9]+(?:[.][0-9]*)?')::numeric$$;


CREATE OR REPLACE FUNCTION utils.immutable_concat_ws(text, VARIADIC text[]) RETURNS text
    LANGUAGE internal IMMUTABLE LEAKPROOF PARALLEL SAFE
    AS $$text_concat_ws$$;

CREATE OR REPLACE FUNCTION utils.session_id() RETURNS text
    LANGUAGE sql STRICT LEAKPROOF 
    AS $$ select concat(pg_catalog.pg_backend_pid(),'.',extract(epoch from transaction_timestamp()))$$;

CREATE OR REPLACE FUNCTION utils.scram_enc(scram text, data text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE STRICT LEAKPROOF PARALLEL SAFE
    AS $_$
declare
    m text[];
    rand bytea;
    k bytea;
    salt text;
    iter text;
    enc text;
    iv text;
begin
    m = regexp_match(scram,'^SCRAM-SHA-256[$]([0-9]+):([^$]+)[$]([^:]+)');
    if m is null then
        return null;
    end if;
    iter = m[1]::integer;
    salt = m[2];
    k = decode(m[3],'base64');
    rand = pgc.gen_random_bytes(16); -- cbc
    iv = encode(rand,'base64');
    enc = encode(pgc.encrypt_iv(convert_to(data, 'utf-8'),k,rand,'aes'),'base64');
    return concat(iter,':',salt,':',iv,':',enc);
end
$_$;

CREATE OR REPLACE FUNCTION utils.pgc_text_compare(b bytea, t text, n text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE STRICT LEAKPROOF COST 10 PARALLEL SAFE
    AS $$ begin return t = pgc.pgp_sym_decrypt(b,n); end$$;

CREATE OR REPLACE FUNCTION utils.pgc_text_to_bytea(t text, n text) RETURNS bytea
    LANGUAGE plpgsql IMMUTABLE STRICT LEAKPROOF COST 10 PARALLEL SAFE
    AS $$ begin return pgc.pgp_sym_encrypt( t, n); end $$;

-- LOGIN HELPERS

CREATE OR REPLACE FUNCTION private.server_key() RETURNS text
    LANGUAGE sql IMMUTABLE LEAKPROOF COST 1 PARALLEL SAFE
    AS $$select 'sdsdaalfjkjtro2357109423487482517175438217234782351897171'$$;
-- NOTE: replace this key in production!!!!!

CREATE OR REPLACE FUNCTION private.login_person_check_key(p_login text, p_id text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT LEAKPROOF COST 1 PARALLEL SAFE
    AS $$
    select encode(pgc.hmac(concat(p_login,':',p_id), private.server_key() ,'sha256'),'hex')$$;

CREATE OR REPLACE FUNCTION private.session_mac(p text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT LEAKPROOF COST 1 PARALLEL SAFE
    AS $$ select encode(pgc.hmac(concat(utils.session_id(),':',p), private.server_key() ,'sha256'),'hex') $$;

-- LOGIN INFRASTRUCTURE

CREATE TABLE private.logins (
    login character varying(500) collate "C" PRIMARY KEY, 
    person bigint NOT NULL UNIQUE,
    phash2 character varying(500) collate "C",
    sysrole character varying(30) collate "C" DEFAULT 'user',
    auth bytea,
    CONSTRAINT no_special_names CHECK (login != 'anonymous')
);
ALTER TABLE ONLY private.logins ALTER COLUMN login SET STORAGE PLAIN;
ALTER TABLE ONLY private.logins ALTER COLUMN phash2 SET STORAGE PLAIN;
ALTER TABLE ONLY private.logins ALTER COLUMN sysrole SET STORAGE PLAIN;

-- called from bouncer
-- returns [login,password-hash] from our users
-- or [uname, pass(hash)] for anonymous
CREATE OR REPLACE FUNCTION login.shadow_info(x text) RETURNS record
    LANGUAGE sql STABLE STRICT SECURITY DEFINER LEAKPROOF PARALLEL SAFE
    AS $$ SELECT 'user_'||sysrole, phash2 FROM login.logins WHERE login = x $$;

CREATE TABLE private.registrations (
    hash character varying(500) NOT NULL collate "C",
    stamp timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    info jsonb NOT NULL,
    login character varying(500) NOT NULL collate "C" 
);
ALTER TABLE ONLY private.registrations ALTER COLUMN hash SET STORAGE PLAIN;
ALTER TABLE ONLY private.registrations ALTER COLUMN login SET STORAGE PLAIN;

/*
    anybody can get login + it's scram
    which is not so good (it should be shadow)
    so we can restrict access to sysuser_auth ounly
    which is authenticated by peer (as effective user of pg_bouncer process)
    alternatively, we can trust pg_bouncer but restrict access with scoket permission
*/