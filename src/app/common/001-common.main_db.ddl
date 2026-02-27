

CREATE SCHEMA IF NOT EXISTS cls;
GRANT USAGE ON SCHEMA cls TO user_user;

CREATE TABLE cls.tuples (
    k text NOT NULL,
    r text,
    dict text NOT NULL,
    v jsonb NOT NULL
)
WITH (fillfactor='100');
ALTER TABLE ONLY cls.tuples ADD CONSTRAINT cls_pk PRIMARY KEY (dict, k) INCLUDE (r, v) WITH (fillfactor='90');

CREATE INDEX cls_rev1 ON cls.tuples USING btree (dict, r) INCLUDE (k) WITH (fillfactor='90', deduplicate_items='true');

GRANT SELECT ON TABLE cls.tuples TO user_user;


-- CLS HELPERS

CREATE FUNCTION cls.decode(p_key text, p_dict text) RETURNS text
    LANGUAGE sql STABLE STRICT LEAKPROOF PARALLEL SAFE
    AS $$select r from cls.tuples where dict = p_dict and k = p_key$$;

CREATE FUNCTION cls.decode_json(p_key text, p_dict text) RETURNS jsonb
    LANGUAGE sql STABLE STRICT LEAKPROOF PARALLEL SAFE
    AS $$select v from cls.tuples where dict = p_dict and k = p_key$$;

CREATE FUNCTION cls.encode(p_r text, p_dict text) RETURNS text
    LANGUAGE sql STABLE STRICT LEAKPROOF PARALLEL SAFE
    AS $$select k from cls.tuples where dict = p_dict and r = p_r$$;

-- CLS UPDATER

CREATE FUNCTION cls.update_classifiers(c jsonb) RETURNS void
	LANGUAGE plpgsql STRICT LEAKPROOF
	AS $$
	DECLARE
		dict_name text; dict_data jsonb;
	BEGIN
		FOR dict_name,dict_data IN SELECT k,v FROM jsonb_each(c) _(k,v)
		LOOP
			DELETE FROM cls.tuples WHERE dict = dict_name;

			INSERT INTO cls.tuples(dict, k, v, r)
			SELECT dict_name, k, val, 
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
			FROM jsonb_each(dict_data) _(k,val);
		END LOOP;
	END$$;