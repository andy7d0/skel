

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
