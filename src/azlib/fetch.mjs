import { set as setKV } from 'idb-keyval';
import {sha256}  from  'js-sha256';

import {getAPIparams, customStore} from 'azlib/common.mjs';
import {isPlainObject} from 'azlib/helpers.mjs';

import {setServerNow, serverTime} from 'azlib/date.mjs'

function enc(ts, value, integrityKey) {
	return sha256.hmac(value,ts+':'+integrityKey)
}


/**
 * API contract
 * 1) request is js (json) object
 * 2) for post/put etc we can use JSON directly
 * формирование $_POST может быть на стороне PHP
 * при этом мы вызываем только две функции: чтение потока и разбор JSON
 * либо разбор при помощи parse_str
 * т.к. при этом всегда есть нативные данные, мы можем легко (и надежно) их проверить по SA
 * можно также кодировать данные в особом формате
 * 
*/

/*
	values can be
	array of items
	[ 'string', {key:value, key:value ...} ]

	в текущей версии мы используем digdoc как json только filter!
	и так работает pack_filter
*/

/**
 * pack_filter:
 * 
 * {f:true}                     ===> f is true
 * {f:false}                    ===> f is false
 * {f:null}                     ===> f is null
 * {f:value}                    ===> f = value
 * f                            ===> f is not null
 * {not: recursive_fiter }      ===> NOT(filter)
 * {or: [recursive_fiter...] }  ===> ( recursive_fiter OR recursive_fiter ... )
 * {in:[values...]}
 * {notin:[values...]}
 * [recursive_fiter...]         ===> ( recursive_fiter AND recursive_fiter ... )
 * 
 * ['a', {a:null}, {a:1}]
 * 
 */

 /** 
 * при этом json-get-parameters не наглядны так и так (много url-кодировки)
 * 
 * т.о. мы можем использовать get-json
 * запрещенные символы в URL
 * 
*/
/*
The reserved characters are:

ampersand ("&")
dollar ("$")
plus sign ("+")
comma (",")
forward slash ("/")
colon (":")
semi-colon (";")
equals ("=")
question mark ("?")
'At' symbol ("@")
pound ("#").

The characters generally considered unsafe are:

space (" ")
less than and greater than ("<>")
open and close brackets ("[]")
open and close braces ("{}")
pipe ("|")
backslash ("\")
caret ("^")
percent ("%")

encodeURIComponent('`~@#$%^&*()_-+={}[];:\'"<>,.?/')
%60~%40%23%24%25%5E%26*()_-%2B%3D%7B%7D%5B%5D%3B%3A'%22%3C%3E%2C.%3F%2F

не кодированы по факту
 ' ~ * () _ - .

post мы посылаем как json всегда
get мы можем или
1) кодировать специальным образом
или
2) послать в доп. хедере (который и используем)

типизированное кодирование
string: 'symbols'
number: [-]digits
true: параметр есть  или param=+
false: параметра нет или param=-

разбор этого - уже большой код на интерпретаторе!

в имени параметра не кодируются только
* . - _

кодирование объектного типа

*/


/* encode get

toplevel object name=value
if value is null
	name=
if value is bool
	name=! or name=-
if value is string
	name='string'
if value is number
	name=[+-]?digits[.]digits
if value is array
	name=[val&&.=val&&.=val]
if value is object
	name&&name1=val1}
*/

function quote_name(v) {
	if(v.match(/[^a-zA-Z0-9_]/)) return `'${v}'`
	return v;
}
function quote_value(v) {
	if(v === null) return 'null';
	if(v === true) return 'true';
	if(v === false) return 'false';
	v = v + "";
	if(v.match(/[^a-zA-Z0-9_.]/)
		|| v === '' || v ==='null' || v === 'true' || v === 'false'
		|| v.match(/[(].*[)]/)
	) return `'${v}'`
	return v;
}

function comment_get(v) {
	if(Array.isArray(v)) {
		return `(${v.map(comment_get).join('~')})`
	}
	if(isPlainObject(v)) {
		let ret = []
		for(const i in v) {
			if(v[i] === undefined) continue;
			ret.push(`${quote_name(i)}.${comment_get(v[i])}`)
		}
		return `(*${ret.join('~')}*)`
	}
	return quote_value(v);
}

function comment_get0(v) {
	let search = new URLSearchParams();
	for(const i in v) {
		let a = v[i]
		if(i[0] === '.') continue;
		if(v[i] === undefined) continue;
		if(Array.isArray(v)) {
			for(const a of v)
				search.append(i,comment_get(a))
			continue;
		}
		if(isPlainObject(a)) {
			search.append(i,comment_get(a))
			continue;
		}
		search.append(i,comment_get(a))
	}
	search = search.toString()
			.replace(/=true(&|$)/,'$1')
	return search
}

/**
 * GET can be
 * param=value
 * but we needs json-like, i.e. typed
 * in json we have
 * null
 * true
 * false
 * empty string
 * string
 * number
 * array
 * object
 * 
 * natural encoding can be 
 * true -> param
 * false -> param=~
 * null ->  param=
 * number       -> param=number
 * string       -> param='string', url-escaped
 * empty string -> param='' , like string
 * 
 * array -> param=(value~value)
 * object -> param=.(param.value~param.value).
 * 
 * json:
 *    number -> number
 *    true -> true
 *    false -> false
 *    null -> null
 * 
 * toplevel decode
 * 
 * '' => ""
 * .( ... ). => { .... }
 *  ( ... )  => [ .... ]
 * ~ => ,
 * . => :
 * 
 * null => empty string
 * true {name: true} => .(name.t).
 * false {name: false} => .(name.f).
 * 
 * parsing: extract strings, then make json,
 * 
 */

let seqPromise = Promise.resolve();

const FetchApi = {
xxx: null
, async api_raw_raw(url, values, method, json) {
	const ts = serverTime();
	// post values as json!
	values = JSON.stringify(values);

	const APIparams = await getAPIparams();

	const anon = 
		(url instanceof URL ? url.pathname : url) 
		.match(/^[/]app[/]ext[/]app[/]ext[/]anonymous[/]/)

	const headers = {
 			"X-Requested-With": "XMLHttpRequest"
 			, 'Accept': (json?'application/json' : '*/*')
 			, "Authorization": anon? '' : APIparams.token
 			, "X-PEER": anon? '' : APIparams.peer
 			, "X-TS": ts
 			, "X-SA": enc(ts, values, APIparams.integrity)
 		}

 	if(!method || method.method === 'GET' || method.method === 'HEAD')
 		headers["X-QUERY"] = encodeURIComponent(values);
 	else {
 		headers['Content-Type'] =  "application/json";
 		method.body = values;
 	}

	try { await seqPromise; }
	//eslint-disable-next-line  no-unused-vars
	catch(e) {}

	seqPromise = fetch(url, {
		method:'GET'
		, ...method
 		, headers
	})

	let r = await seqPromise;

	if(r.ok) {
	    setServerNow( (new Date(r.headers.get('date'))).valueOf() 
	    			, (new Date(r.headers.get('x-local-time'))).valueOf()	
	    			);

		if(r.headers.has('X-Auth-Token'))
			await setKV('auth-token', r.headers.get('X-Auth-Token'), await customStore())
		// TODO: boadcast auth-token
	}

	return r;
}
, async api_raw_get(url, values, head, json) {
	if(url.match(/:([a-zA-Z0-9_]+)$/)) {
		values = {...values, _: RegExp.$1 }
		url = RegExp.leftContext
	}
	url = new URL(url, window.location.href); //FIXME: page base url
	url.search = comment_get0(values)

	if(head === true) head = 'HEAD'
	if(typeof head === 'string') head = {method: head}

	const r = await this.api_raw_raw(url, values, head, json)
	if(!r.ok) { throw r; }
	return r;
}
,
async api_raw_post(url, values, method, json) {
	if(url.match(/:([a-zA-Z0-9_]+)$/)) {
		values = {...values, _: RegExp.$1 }
		url = RegExp.leftContext
	}
	method ??= 'POST'
	if(typeof method === 'string') method = {method}

	const r = await this.api_raw_raw(url, values, method, json)
	if(!r.ok) { throw r; }
	return r; 
}
, api_get(url, values) { return this.api_raw_get(url, values, false, true).then(r=>r.json()) }
, api_post(url, values, _method) { return this.api_raw_post(url, values, 'POST', true).then(r=>r.json()) }
, api_put(url, values) { return this.api_raw_post(url, values, 'PUT', true).then(r=>r.json())}
, api_delete(url, values) { return this.api_raw_post(url, values, 'DELETE', true).then(r=>r.json()) }
, api_patch(url, values) { return this.api_raw_post(url, values, 'PATCH', true).then(r=>r.json()) }
, api_text_get(url, values) { return this.api_raw_get(url, values).then(r=>r.text()) }

}

export const mainApi = FetchApi