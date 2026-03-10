SET azstate.mode = 'ALTER_DB';

ALTER DATABASE main_db SET client_encoding TO 'UTF8';
ALTER DATABASE main_db SET "DateStyle" TO 'iso, ymd';
ALTER DATABASE main_db SET "TimeZone" TO 'utc';
ALTER DATABASE main_db SET client_min_messages TO 'warning';
ALTER DATABASE main_db SET bytea_output TO 'hex';
ALTER DATABASE main_db SET search_path TO 'operators';

CREATE SCHEMA IF NOT EXISTS pgc;
GRANT USAGE ON SCHEMA pgc TO PUBLIC;

CREATE SCHEMA IF NOT EXISTS utils;
GRANT USAGE ON SCHEMA utils TO PUBLIC;

CREATE SCHEMA IF NOT EXISTS login;
GRANT USAGE ON SCHEMA login TO sysuser_auth;

CREATE SCHEMA IF NOT EXISTS private;

CREATE SCHEMA IF NOT EXISTS migration;
GRANT USAGE ON SCHEMA login TO anonymous;

CREATE SCHEMA IF NOT EXISTS logs;
GRANT USAGE ON SCHEMA logs TO user_user;

CREATE SCHEMA IF NOT EXISTS operators;
GRANT USAGE ON SCHEMA operators TO user_user;

CREATE SCHEMA IF NOT EXISTS store;
GRANT USAGE ON SCHEMA store TO user_sysop;

CREATE SCHEMA IF NOT EXISTS user_user;
GRANT USAGE ON SCHEMA user_user TO user_user;
CREATE SCHEMA IF NOT EXISTS user_staff;
GRANT USAGE ON SCHEMA user_staff TO user_staff;
CREATE SCHEMA IF NOT EXISTS user_sysop;
GRANT USAGE ON SCHEMA user_sysop TO user_sysop;
CREATE SCHEMA IF NOT EXISTS user_admin;
GRANT USAGE ON SCHEMA user_admin TO user_admin;


CREATE FUNCTION migration.drop_triggers(p_table text) RETURNS void
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

CREATE FUNCTION migration.constraint_exists(name text, scm text) RETURNS boolean
    LANGUAGE sql
    AS $$SELECT exists(
        SELECT true from pg_catalog.pg_constraint 
        WHERE conname = name AND connamespace = scm::regnamespace)
    $$;

CREATE FUNCTION migration.drop_versions(cmd text, name text) RETURNS void
    LANGUAGE plpgsql 
    AS $$
declare
    cnt int = SUBSTRING(name FROM '(\d+)$')::int;
    n int;
begin
    if cnt is null then return; end if;
    FOR n IN 1 .. cnt-1 LOOP
        EXECUTE replace(cmd, '###', RTRIM(name,'0123456789') || n::text);
    END LOOP;
end$$;


CREATE TABLE migration.guards (guard_key text PRIMARY KEY, guard_value text);
COMMENT ON TABLE migration.guards IS 'guard marks for migrations';


CREATE FUNCTION migration.guard_migration(p_key text, p_value text DEFAULT null) RETURNS boolean
    LANGUAGE plpgsql 
    AS $$begin
    INSERT INTO migration.guards (guard_key, guard_value) VALUES (p_key, p_value) ON CONFLICT DO NOTHING;
    IF FOUND THEN RETURN true; END IF;
    UPDATE migration.guards 
        SET guard_value = p_value 
        WHERE guard_key = p_key
        AND guard_value IS DISTINCT FROM p_value;
    RETURN FOUND;
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

if to_regtype('utils.path_type') is null then
    CREATE DOMAIN utils.path_type AS character varying(1000) collate "C";
end if;


-- simple functions

CREATE FUNCTION utils.base52_10(i bigint) RETURNS text
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

CREATE FUNCTION utils.base62_3(i integer) RETURNS text
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

CREATE FUNCTION utils.unbase62_3(i text) RETURNS integer
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

CREATE FUNCTION utils.title_name(f text, i text, o text) RETURNS text
    LANGUAGE sql IMMUTABLE LEAKPROOF PARALLEL SAFE
    AS $$select concat(f||' '
                 , substring(i,1,1) || '.'
                 , substring(o,1,1) || '.')$$;



CREATE FUNCTION utils.cmp(op utils.cmp_op, a bigint, b bigint) RETURNS boolean
    LANGUAGE sql IMMUTABLE COST 1 PARALLEL SAFE
    AS $$select case op
when '=' then a = b
when '!=' then a != b
when '<' then a < b
when '>' then a > b
when '<=' then a <= b
when '>=' then a >= b
end$$;

DROP FUNCTION utils.notice;
CREATE FUNCTION utils.notice(label text, str text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE STRICT PARALLEL SAFE
    AS $$begin
        RAISE NOTICE '%: %', label, str;
        return str;
    end$$;

CREATE FUNCTION utils.extract_number(str text) RETURNS numeric
    LANGUAGE sql IMMUTABLE STRICT LEAKPROOF PARALLEL SAFE
    AS $$select substring(str from '[0-9]+(?:[.][0-9]*)?')::numeric$$;


CREATE FUNCTION utils.immutable_concat_ws(text, VARIADIC text[]) RETURNS text
    LANGUAGE internal IMMUTABLE LEAKPROOF PARALLEL SAFE
    AS $$text_concat_ws$$;

CREATE FUNCTION utils.session_id() RETURNS text
    LANGUAGE sql STRICT LEAKPROOF 
    AS $$ select concat(pg_catalog.pg_backend_pid(),'.',extract(epoch from transaction_timestamp()))$$;

CREATE FUNCTION utils.scram_enc(scram text, data text) RETURNS text
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

CREATE FUNCTION utils.pgc_text_compare(b bytea, t text, n text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE STRICT LEAKPROOF COST 10 PARALLEL SAFE
    AS $$ begin return t = pgc.pgp_sym_decrypt(b,n); end$$;

CREATE FUNCTION utils.pgc_text_to_bytea(t text, n text) RETURNS bytea
    LANGUAGE plpgsql IMMUTABLE STRICT LEAKPROOF COST 10 PARALLEL SAFE
    AS $$ begin return pgc.pgp_sym_encrypt( t, n); end $$;

-- LOGIN HELPERS

CREATE FUNCTION private.server_key() RETURNS text
    LANGUAGE sql IMMUTABLE LEAKPROOF COST 1 PARALLEL SAFE
    AS $$select 'sdsdaalfjkjtro2357109423487482517175438217234782351897171'$$;
-- NOTE: replace this key in production!!!!!

CREATE FUNCTION private.person_tag(p_login text, p_id text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT LEAKPROOF COST 1 PARALLEL SAFE
    AS $$
    select encode(pgc.hmac(concat(p_login,':',p_id), private.server_key() ,'sha256'),'hex')$$;

CREATE FUNCTION private.session_mac(p text) RETURNS text
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

CREATE TABLE private.registrations (
    hash character varying(500) NOT NULL collate "C",
    stamp timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    info jsonb NOT NULL,
    login character varying(500) NOT NULL collate "C" 
);
ALTER TABLE ONLY private.registrations ALTER COLUMN hash SET STORAGE PLAIN;
ALTER TABLE ONLY private.registrations ALTER COLUMN login SET STORAGE PLAIN;

-- called from bouncer
-- returns [login,password-hash] from our users
-- or [uname, pass(hash)] for anonymous
CREATE FUNCTION login.shadow_info(x text) RETURNS record
    LANGUAGE sql STABLE STRICT SECURITY DEFINER LEAKPROOF PARALLEL SAFE
    AS $$ SELECT 'user_'||sysrole as u, phash2 as p FROM private.logins WHERE login = x $$;


CREATE FUNCTION public.reset_connection(p_login text DEFAULT NULL::text, p_id text DEFAULT NULL::text
    , p_h text DEFAULT NULL::text, p_version text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$begin
    if p_version is not null then
        -- raise notice 'ver:%', p_version;
        if p_version is distinct from migration.db_version() then
            return false;
        end if;
    end if;
    if p_login is null and p_id is null then
        perform 
        set_config('azstate.login', '', true),
        set_config('azstate.personid', '', true),
        set_config('azstate.lpmac', '', true)
        ;   
    elsif
            p_h is not distinct from private.person_tag(p_login,p_id)
        or
            session_user = 'postgres'
    then
        perform 
        set_config('azstate.login', p_login, true),
        set_config('azstate.personid', p_id, true),
        set_config('azstate.lpmac', 
                   private.session_mac(
                       concat(p_login,':',p_id)
                    )
                   , true)
        ;   
    else
        raise exception insufficient_privilege;
    end if;
    return true;
end 
$$;

/**
 *  this function called by login and cache update
 *  without protecition, so by anybody
 *  to be secure this function encrypt returned info
 *  with the user's scramed pass
 *  so only who knows user's pass can really access the info
 *  returned info contains access tag
 *  enverybody who knows it can represent itself as the user
 */

CREATE FUNCTION public.get_uinfo(p_login text) RETURNS text 
    LANGUAGE sql STABLE STRICT SECURITY DEFINER LEAKPROOF
    AS $$select utils.scram_enc(
    phash2, 
    user_user.get_uinfo(person)::text) 
    from private.logins where login = p_login
$$;


/**
 *  this function called securely
 *  and internally enshures that only an legitimate user or super 
 *  gets the info 
 */
CREATE FUNCTION user_user.get_uinfo(p_person bigint) RETURNS jsonb
    LANGUAGE plpgsql STABLE STRICT SECURITY DEFINER LEAKPROOF
    AS $$
declare 
    p_key text;
begin 
    if current_user != 'postgres'
    and p_person != user_user.current_personid()
    then
        raise insufficient_privilege;
    end if;
    return (select
        json_object(
            'magic': encode(pgc.digest(t.tag, 'sha256'), 'hex')
            , 'login': p.login
            , 'personid': p.person
            , 'sysrole': p.sysrole
            , 'person_access_tag': t.tag
        )
        from private.logins p
            , lateral (select private.person_tag(p.login,p.person::text) as tag ) t
         where person = p_person);
end;$$;

CREATE FUNCTION user_staff.get_uinfo_somebody(p_person bigint) RETURNS jsonb
    LANGUAGE plpgsql STABLE STRICT SECURITY DEFINER LEAKPROOF
    as $$
begin
    if (select coalesce(sysrole,'user') from private.logins where person = p_person)
        = ANY(case (select sysrole from private.logins where person = user_user.current_personid())
            when 'admin' then '{sysop,staff,semistaff,user}'
            when 'sysop' then '{staff,semistaff,user}'
            when 'staff' then '{semistaff,user}'
            when 'semistaff' then '{user}'
            else null
            end::text[]
        )
    then
        return (SELECT user_user.get_uinfo(p_person));
    else 
        raise insufficient_privilege;
    end if;
end$$;


CREATE FUNCTION user_user.current_personid() RETURNS integer
    LANGUAGE plpgsql STABLE SECURITY DEFINER LEAKPROOF COST 1
    AS $$declare
    p_login text = current_setting('azstate.login', true);
    p_id text = current_setting('azstate.personid', true);
begin 
    if current_setting('azstate.lpmac', true)
        is distinct from 
        private.session_mac(
           concat(p_login,':',p_id)
        )
    then 
        return null;
    end if;
    return nullif(p_id,'');
end$$;


/*
    anybody can get login + it's scram
    which is not so good (it should be shadow)
    so we can restrict access to sysuser_auth ounly
    which is authenticated by peer (as effective user of pg_bouncer process)
    alternatively, we can trust pg_bouncer but restrict access with scoket permission
*/


CREATE SCHEMA IF NOT EXISTS cls;
GRANT USAGE ON SCHEMA cls TO user_user;

-- CLS UPDATER

-- helper 
CREATE FUNCTION cls.already_processed_version(scm text, name text, data jsonb) RETURNS boolean 
LANGUAGE plpgsql AS $$
    DECLARE 
        vhash text = encode(sha256(convert_to(data::text,'UTF8')),'hex');
        ver text;
    BEGIN
        if to_regproc(scm||'.'||quote_ident(name||'.version')) is not null then
            EXECUTE format('SELECT %I.%I()',scm, name||'.version') INTO ver;
            if ver = vhash then
                return true;
            end if;
        end if;

        EXECUTE format('CREATE OR REPLACE FUNCTION %I.%I() RETURNS text LANGUAGE sql AS $f$ SELECT %L $f$'
                , scm, name||'.version', vhash);
        return false;
    END
$$;


CREATE FUNCTION cls.update_classifiers(c jsonb) RETURNS void
    LANGUAGE plpgsql STRICT LEAKPROOF
    AS $$
    DECLARE
        dict_name text; dict_data jsonb;
    BEGIN
        FOR dict_name,dict_data IN SELECT k,v FROM jsonb_each(c) _(k,v)
        LOOP
            if cls.already_processed_version('cls',dict_name,dict_data) then continue; end if;

            EXECUTE format('DROP TABLE IF EXISTS cls.%I', dict_name);
            EXECUTE format($_$
                    CREATE TABLE cls.%I (
                        k text COLLATE "C" NOT NULL PRIMARY KEY,
                        r text COLLATE "C",
                        v jsonb NOT NULL
                    )
                    WITH (fillfactor='100');
                $_$, dict_name);

            EXECUTE format('CREATE INDEX %2$I  ON cls.%1$I (r) INCLUDE(k) WITH (fillfactor=''90'', deduplicate_items=''true'')'
                , dict_name, dict_name||'.rev');

            EXECUTE format('GRANT SELECT ON TABLE cls.%I TO user_user', dict_name);

            EXECUTE format('DROP FUNCTION IF EXISTS cls.%I', dict_name||'.decode');
            EXECUTE format('DROP FUNCTION IF EXISTS cls.%I', dict_name||'.encode');
            EXECUTE format('DROP FUNCTION IF EXISTS cls.%I', dict_name||'.data');

            EXECUTE format($_$ CREATE OR REPLACE FUNCTION cls.%2$I(text) RETURNS text LANGUAGE sql STABLE STRICT LEAKPROOF PARALLEL SAFE
                    AS $f$select r from cls.%1$I where k = $1 $f$ $_$
                , dict_name, dict_name||'.decode');
            EXECUTE format($_$ CREATE OR REPLACE FUNCTION cls.%2$I(text) RETURNS jsonb LANGUAGE sql STABLE STRICT LEAKPROOF PARALLEL SAFE
                    AS $f$select v from cls.%1$I where k = $1 $f$ $_$
                , dict_name, dict_name||'.data');
            EXECUTE format($_$ CREATE OR REPLACE FUNCTION cls.%2$I(text) RETURNS text LANGUAGE sql STABLE STRICT LEAKPROOF PARALLEL SAFE
                    AS $f$select k from cls.%1$I where r = $1 $f$ $_$
                , dict_name, dict_name||'.encode');

            EXECUTE format('TRUNCATE cls.%I', dict_name);

            EXECUTE format($_$
                INSERT INTO cls.%I(k, v, r)
                SELECT k, val, 
                    (case jsonb_typeof(val)
                    when 'object' then
                        (SELECT case jsonb_typeof(v)
                                when 'object' then null
                                when 'array' then null
                                when 'null' then null
                                else v #>> '{}'
                                end
                            FROM jsonb_each(val) _(k,v) LIMIT 1)
                    when 'array' then NULL
                    when 'null' then NULL
                    else val #>> '{}'
                    end)
                FROM jsonb_each($1) _(k,val);
                $_$, dict_name)
            USING dict_data;

        END LOOP;
    END$$;

-- after trigger for custom person table to delete logins when person deleted
CREATE FUNCTION store.delete_login() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$begin
        DELETE FROM private.logins WHERE person = old.person;
        RETURN NULL;
    end$$;

CREATE FUNCTION private.scram_gen(pass text) RETURNS text
    LANGUAGE plpgsql STRICT SECURITY DEFINER LEAKPROOF
    AS $$declare
        r text;
    begin
        EXECUTE format('CREATE USER tmp_user_for_hash PASSWORD %L', pass);    
        SELECT rolpassword into r FROM pg_catalog.pg_authid WHERE rolname = 'tmp_user_for_hash';
        DROP USER tmp_user_for_hash;
        return r;
    end$$;

IF migration.guard_migration('admin_user') THEN
    INSERT INTO private.logins(login,person,phash2,sysrole)
    VALUES('root', 0, private.scram_gen('1234'), 'admin');
END IF;

