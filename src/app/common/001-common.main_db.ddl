

CREATE SCHEMA IF NOT EXISTS cls;
GRANT USAGE ON SCHEMA cls TO user_user;

DROP TABLE cls.tuples;


-- CLS HELPERS

DROP FUNCTION cls.decode;
DROP FUNCTION cls.decode_json;
DROP FUNCTION cls.encode;
/*
CREATE FUNCTION cls.decode(p_key text, p_dict text) RETURNS text
    LANGUAGE sql STABLE STRICT LEAKPROOF PARALLEL SAFE
    AS $$select r from cls.tuples where dict = p_dict and k = p_key$$;

CREATE FUNCTION cls.decode_json(p_key text, p_dict text) RETURNS jsonb
    LANGUAGE sql STABLE STRICT LEAKPROOF PARALLEL SAFE
    AS $$select v from cls.tuples where dict = p_dict and k = p_key$$;

CREATE FUNCTION cls.encode(p_r text, p_dict text) RETURNS text
    LANGUAGE sql STABLE STRICT LEAKPROOF PARALLEL SAFE
    AS $$select k from cls.tuples where dict = p_dict and r = p_r$$;
*/
-- CLS UPDATER

CREATE FUNCTION cls.update_classifiers(c jsonb) RETURNS void
	LANGUAGE plpgsql STRICT LEAKPROOF
	AS $$
	DECLARE
		dict_name text; dict_data jsonb;
	BEGIN
		FOR dict_name,dict_data IN SELECT k,v FROM jsonb_each(c) _(k,v)
		LOOP

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
								else v::text
								end
							FROM jsonb_each(val) _(k,v) LIMIT 1)
					when 'array' then NULL
					when 'null' then NULL
					else val::text
					end)
				FROM jsonb_each($1) _(k,val);
				$_$, dict_name)
			USING dict_data;

		END LOOP;
	END$$;

-- JSONB UPSERTS

CREATE SCHEMA IF NOT EXISTS upserts;
GRANT USAGE ON SCHEMA upserts TO user_user;

CREATE OR REPLACE FUNCTION upserts.create_upsert(schema text, tbl text) RETURNS void
    LANGUAGE plpgsql
    AS $_$
declare
    attrs text[] = (SELECT array_agg(quote_ident(attname) order by attnum)
		            FROM pg_class c JOIN pg_attribute a
		            ON c.oid = a.attrelid
		            WHERE relname = tbl
		            and relnamespace = schema::regnamespace
		            and attnum > 0
		            and not attisdropped
		          );
    fields text = ARRAY_TO_STRING(attrs,',');
    pks text[] = (SELECT array_agg(quote_ident(pg_attribute.attname)) 
			            FROM pg_class JOIN pg_index
			                 ON pg_class.oid = indrelid
			                 JOIN pg_attribute 
			                 ON pg_attribute.attrelid = pg_class.oid
			        WHERE pg_class.relname = tbl 
			        AND relnamespace = schema::regnamespace 
			        AND pg_attribute.attnum = any(pg_index.indkey)
			        AND indisprimary
			    );
    pks_t text = ARRAY_TO_STRING(pks,',');
BEGIN
   EXECUTE format($UPSERT_FUNC$
    CREATE OR REPLACE FUNCTION upserts.overloaded(%1$I.%2$I,%1$I.%2$I) RETURNS void 
    	LANGUAGE plpgsql
    AS $BODY$
    BEGIN
    CASE
    WHEN $1 IS NULL AND $2 IS NULL THEN RETURN; 
    WHEN $1 IS NULL THEN
        INSERT INTO %1$I.%2$I (%3$s) VALUES ( ($2).* ) 
        	ON CONFLICT (%4$s)
        	DO UPDATE SET (%3$s) = (SELECT ($2).*);
    WHEN $2 IS NULL THEN
        DELETE FROM %1$I.%2$I
        WHERE (SELECT (%4$s) ) = (SELECT (%4$s) FROM (SELECT ($1).*) _);
    ELSE 
        ASSERT 
        (SELECT (%4$s) FROM (SELECT ($1).*) _)
        = 
        (SELECT (%4$s) FROM (SELECT ($2).*) _);
        INSERT INTO %1$I.%2$I (%3$s) VALUES ( ($2).* ) 
        	ON CONFLICT (%4$s)
        	DO UPDATE SET (%3$s) = (SELECT ($2).*);
    END CASE;
    END
    $BODY$
    $UPSERT_FUNC$
   , schema, tbl, fields, pks_t);
END
$_$;

CREATE OR REPLACE FUNCTION upserts.jsonb_set(old_val anyelement, new_val jsonb) RETURNS void
    LANGUAGE sql
    AS $$select
    upserts.overloaded(old_val, 
        case when new_val is not null
        then
            jsonb_populate_record(old_val, new_val)
        end);
	$$;



-- PREDEFINED CONTENT

CREATE TABLE store.test (
    k text COLLATE "C" NOT NULL PRIMARY KEY,
    v text NOT NULL,
    data jsonb
);

PERFORM upserts.create_upsert('store','test');

CREATE FUNCTION store."test.prefill"(data jsonb) RETURNS void 
	LANGUAGE sql
	AS $$
		SELECT upserts.jsonb_set(d, jsonb_set(val, '{k}'::text[], to_jsonb(s.k)))
		FROM jsonb_each(data) s(k,val)
		LEFT JOIN store.test d ON d.k = s.k
	$$;
