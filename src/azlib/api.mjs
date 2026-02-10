import {sha256}  from  'js-sha256';

import {setServerNow, serverTime} from 'azlib/date.mjs'
import {getAPIparams, setAuthToken, api_url} from 'azlib/common.mjs';

export const API = {
	URL: function(strings, item) {
		return `${strings[0].replace(/[.][^.]+$/,'').replace(/^[/]app[/]src[/]/, '/app/')}~${item}`;
	}
	, GET: function(strings, item) {
		return values => api_get(API.URL(strings, item), values)
	}
	, POST: function(strings, item) {
		return values => api_post(API.URL(strings, item), values)
	}
	, PUT: function(strings, item) {
		return values => api_put(API.URL(strings, item), values)
	}
	, PATCH: function(strings, item) {
		return values => api_patch(API.URL(strings, item), values)
	}
	, DELETE: function(strings, item) {
		return values => api_delete(API.URL(strings, item), values)
	}
}

/**
 * GET ENCODING
 * 
 * int - as is
 * string - in quotes
 * null - empty value
 * true - Y
 * false - N
 * 
 * start array   * as value 
 * start object  . as value (except toplevel)
 * 
 * each item in array has empty key
 * each item in object has property key
 * 
 * end array/object  - . as key (except toplevel)
 * 
 * safe chars:  + _ - . <empty>
 * 
 * array    *  as value or key
 * object   .  as value or key
 * 
 */


function JsonToParams0(obj, params) {
	// root case
	if(obj !== Object(obj)) {
		if(obj !== undefined) params.append('', 
				obj === null? '.' // null
				: typeof obj === 'number'? `${obj}`
				: typeof obj === 'string'? `'${obj}'`
				: obj === true ? 'Y'
				: obj === false ? 'N'
				: ''
			)
	} else {
		if(Array.isArray(obj)) {
			// start array
			params.append('*','')
			for(const v of obj) {
				JsonToParams(v, params, '')
			}
		} else if(isPlainObject(obj)) {
			for(const i in obj) {
				JsonToParams(obj[i], params, i)
			}
		}
	}
}
function JsonToParams(obj, params, prop) {
	// root case
	if(obj !== Object(obj)) {
		if(obj !== undefined) params.append(prop, 
				obj === null? ''
				: typeof obj === 'number'? `${obj}`
				: typeof obj === 'string'? `'${obj}'`
				: obj === true ? 'Y'
				: obj === false ? 'N'
				: ''
			)
	} else {
		if(Array.isArray(obj)) {
			// start array
			params.append(prop, '*')
			for(const v of obj) {
				JsonToParams(v, params, '')
			}
			params.append('*','')
		} else if(isPlainObject(obj)) {
			params.append(prop, '')
			for(const i in obj) {
				JsonToParams(obj[i], params, i)
			}
			params.append('.','')
		}
	}
}

function JsonToGet(obj, getParams = '') {
	const sp = new URLSearchParams(getParams);
	JsonToParams0(obj, sp)
	return sp.toString()
		.replace(/=$/,'')
		.replace(/=&/,'')
}

function enc(ts, value, integrityKey) {
	return sha256.hmac(value,ts+':'+integrityKey)
}

let seqPromise = Promise.resolve();

export async function api_fetch_json(url, values, params) {
	const APIparams = await getAPIparams();
	const ts = serverTime();

	if(url.match(/~([a-zA-Z0-9_]+)$/)) {
		values = {...values, _: RegExp.$1 }
		url = RegExp.leftContext
	}
	url = api_url(url);

	const anon = 
		(url instanceof URL ? url.pathname : url) 
		.match(/^[/]app[/]ext[/]anonymous[/]/)

	const headers = {
 			"X-Requested-With": "XMLHttpRequest"
 			, 'Accept': 'application/json'
 			, "Authorization": anon? '' : APIparams.token
 			, "X-PEER": anon? '' : APIparams.peer
 			, "X-TS": ts
 		}

 	if(!params || params.method === 'GET' || params.method === 'HEAD') {
 		const getParams =  JsonToGet(values)
 		url.search = getParams
 		headers["X-SA"] = enc(ts, getParams, APIparams.integrity)
 	} else {
 		params.body = JSON.stringify(values);
 		headers['Content-Type'] =  "application/json";
 		headers["X-SA"] = enc(ts, params.body, APIparams.integrity)
 	}

 	await seqPromise;
 	const {promise, resolve} = Promise.withResolvers();
	seqPromise = promise;

	let r = await fetch(url, {
		method:'GET'
		, ...params
 		, headers
	})

	resolve();

	if(r.ok) {
	    setServerNow( (new Date(r.headers.get('date'))).valueOf() 
	    			, (new Date(r.headers.get('x-local-time'))).valueOf()	
	    			);

		if(r.headers.has('X-Auth-Token'))
			await setAuthToken(r.headers.get('X-Auth-Token'))
	} else {
		// throw!!!!
		throw r
	}

	return r;
}

function api_raw_get(url, values, head) {
	if(head === true) head = 'HEAD'
	if(typeof head === 'string') head = {method: head}

	return api_fetch_json(url, values, head)
}

function api_raw_post(url, values, params) {
	params ??= 'POST'
	if(typeof params === 'string') params = {method:params}

	return api_fetch_json(url, values, params)
}

export function api_get(url, values) { return api_raw_get(url, values, false).then(r=>r.json()) }
export function api_post(url, values) { return api_raw_post(url, values, 'POST').then(r=>r.json()) }
export function api_put(url, values) { return api_raw_post(url, values, 'PUT').then(r=>r.json())}
export function api_delete(url, values) { return api_raw_post(url, values, 'DELETE').then(r=>r.json()) }
export function api_patch(url, values) { return api_raw_post(url, values, 'PATCH').then(r=>r.json()) }
