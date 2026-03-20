/* global ngx */
//import fs from 'fs';
import cr from 'crypto';

function test(r) {
	 r.return(200, "Hello world!\n");
}

// this concat file and url request
// there is 
// 1. 3rd echo module (echo_after_body or two subrequests)
// 2. ngx_http_addition_module (add_after_body)
async function index_and_bundle(r) {
   r.status = 200;
   r.sendHeader();
   let s1 = await r.subrequest("/spa/index.html");
   r.send(s1.responseText);
   let s2 = await r.subrequest("/app-bundle-stamp");
   r.send(s2.responseText);
   r.finish();
}

// this can be passed directly in PUT request 
// which are't url-encoded!
function esia_args(r) {
	let v = r.variables
	let c = decodeURIComponent(`${v.arg_scope}${v.arg_timestamp}${v.arg_client_id}${v.arg_state}`)
	//r.error(c)
	return c;
}

// aas/oauth2/te RETURNS token
// and nginx can not capture response body easely 
// so forced to script here (at nginx side)
// OR call backend which callback to router later with this URL 
async function esia_in(r) {
	let esia_host = r.variables.esia_host;
	let esia_f = await ngx.fetch(`https://${esia_host}/aas/oauth2/te`,{
            method: 'POST'
            , headers:  { 'Content-Type': 'application/x-www-form-urlencoded' }
            , body: r.variables.args
            , verify: false
		});
	let esia_ret = await esia_f.json();
	//r.error(esia_ret);
	r.variables.esia_access_token = esia_ret.access_token;
	r.variables.esia_code = r.variables.arg_code;
	r.internalRedirect('@backend_in');
}

// body is an json-array in form [ [zone,key-in-zone,version] ... ] 
async function cache_test(r) {
	let subscriptions = JSON.parse(r.requestText??'[]')
	//r.warn(body)
	let dirty = false;
	let out = []
	for(let i = 0; i < subscriptions.length; ++i){
		let s = subscriptions[i]
		const zone = s[0], key = s[1], version = s[2]
		//r.warn('test-cache', zone,key,version)
		let ret = await cache_local_version(r, zone, key, version)
		if(ret === undefined) { // 403 or other upstream errors
			// abort whole op (?)
			return;
		}
		if(ret === false) { // 304
			// version match, skip
			continue;
		}
		dirty = true;
		if(ret === null) { // 404
			out.push([s.zone,s.key]) // undefined version means not found key
			continue; 
		}
		// 200 here
		out.push([zone, key, ret.version, ret.value])
	}
	if(dirty) {
		//r.warn('local-cache-dirty')
		// versions don not match!
		// send patch
		r.headersOut['Content-Type'] = 'application/json';
		r.return(412, JSON.stringify(out))
	} else {
		//r.warn('local-cache-clean')
		r.status = 200;
		r.headersOut['Content-Type'] = 'text/x-event';
		r.headersOut['Transfer-Encoding'] = 'chunked';
		r.headersOut['X-Accel-Buffering'] = 'no';
   	r.sendHeader();
		//r.warn('start ticks');
		const ts = { cnt: 0 }
		send_tick(r,ts)
	}
}

function send_tick(r, ts) {
	if(++ts.cnt>10) {
		r.send('!\n');
		//r.warn('end ticks');
		r.finish();
		return;		
	}
	r.send('.\n');
	//r.warn('tick');
	setTimeout(send_tick, 1000, r, ts);
}

// check local version
// return
//   500 if error
async function cache_local_version(r, zone, key, version) {
	let dict = ngx.shared[zone]
	// get version (stored at <key> index)
	let localVersion = dict.get(key);
	//r.warn('local-cache', version, localVersion)
	if(localVersion !== undefined) { // return null(?) | false | object
		// has local version
		r.headersOut['X-Cache'] = 'hit';
		// localVersion === '' if not found in upstream
		return version !== localVersion // some codes
			&&
			//return data (stored at <key>+'.data')
			{ version: localVersion, value: localVersion ? dict.get(`${key}.data`) : '' } // 200-OK
	} else { // return null | false | object
		// get upstream
		try {
			let ret = await r.subrequest(`/app/cache/upstream/${zone}`, `key=${key}`)
			if(ret.status === 200) {
				// upstream found, cache it
				// sha1 of text is a version
				r.headersOut['X-Cache'] = 'miss';
				localVersion = cr.createHash('sha256').update(ret.responseText).digest('hex')
				dict.set(key, localVersion);
				dict.set(`${key}.data`, ret.responseText);
				return version !== localVersion
					&&
					{ version: localVersion, value: ret.responseText }
			}
			if(ret.status === 404) {
				r.headersOut['X-Cache'] = 'notfound';
				dict.set(key, '');
				dict.delete(`${key}.data`);
				return null;
			}
			r.headersOut['X-Cache'] = 'error';
			dict.delete(key);
			dict.delete(`${key}.data`);
			r.return(500, ret.responseText);
			return undefined;
		} catch(err) {
			// upstream not found
			r.headersOut['X-Cache'] = 'upstream-error';
			dict.delete(key);
			dict.delete(`${key}.data`);
			r.return(500, err.message);
			return undefined;
		}
	}
}

async function cache_purge_local(r) {
	const zone = r.variables.arg_zone;
	const key = r.variables.arg_key;
	let dict = ngx.shared[zone]
	dict.delete(key)
	dict.delete(`${key}.data`);
	r.return(200,'OK')
}

async function purge_by_url(r) {
	let m
	if(m = r.uri.match(/[/]([^/]+)[/]([^/]+)$/)) {
		const zone = m[1];
		const key = m[2];
		r.warn(`PURGED ${zone}:${key}`)
		let dict = ngx.shared[zone]
		dict.delete(key)
		r.return(200,'OK')
	} else {
		r.warn(`TRY PURGE ${r.uri}`)
		r.return(404,'Not found')
	}
}


// simulate upstream version
async function cache_upstream_version_dummy(r) {
	//r.warn('upstream-cache')
	if(r.variables.arg_key === '1') r.return(200,'[111]')
	else r.return(404,"Not Found")
}

async function cached_login(r) {
	const ret = await r.subrequest(`/app/login_redirect`, {
        method: 'POST',
        body: r.requestBuffer // Use the body of the original request
   })
	const dict = ngx.shared['user']
	const jsResp = JSON.parse(ret.responseText);
	const key = jsResp.subscription;
	dict.set(key, jsResp.version);
	dict.set(`${key}.data`, jsResp.authorization);
	r.return(200, ret.responseText)
}

function tick(_s) {
}

export default { test, index_and_bundle 
, esia_args, esia_in
, cache_test
, cache_purge_local, purge_by_url
, cache_upstream_version_dummy
, cached_login
, tick
}
