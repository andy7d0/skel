
export { default as date } from "locutus/php/datetime/date.js";
export { default as strtotime} from 'locutus/php/datetime/strtotime.js';


//eslint-disable-next-line no-unused-vars
let server_tzo_sec = 0;
let timeShift_sec = 0;
export function toServerTime(time) {
	return time - timeShift_sec;
}

/**
 * save time shift between server time and client time
 * server_now_sec - UTC
 * server_now_local_opt - server local
 */
// eslint-disable-next-line no-unused-vars
export function setServerNow(server_now_sec, server_now_local_opt) {
	timeShift_sec = Date.now() - server_now_sec
	if(server_now_local_opt)
		server_tzo_sec = server_now_sec - server_now_local_opt
}

/*
	return now in server's clock
*/
export function serverTime() {
	return toServerTime(Date.now()).toFixed(0)
}


/**
 * shows the current time zone of the user's computer
 */
export function getTimezone() {
	let today = new Date();
	let short = today.toLocaleDateString(undefined);
	let full = today.toLocaleDateString(undefined, { timeZoneName: 'long' });
	let shortIndex = full.indexOf(short);
	let offset = -(today.getTimezoneOffset() / 60);
	if (shortIndex >= 0) {
		const trimmed = full.substring(0, shortIndex) + full.substring(shortIndex + short.length);
		return "UTC" + ((offset)>0?"+"+offset:offset.toString()) + " (" + trimmed.replace(/^[\s,.\-:;]+|[\s,.\-:;]+$/g, '') + ")";
	} else {
		return "UTC" + ((offset)>0?"+"+offset:offset.toString()) + " (" + full + ")";
	}
}

const systemTZOminutes = 3*60;

/**
 * DATE (without time)
 * there is no 'timezone' concept
 * DATE is always string in ISO format
 * 
 * for calculation, date-string can be freely converted to date-object 
 */

// eslint-disable-next-line no-extend-native
Object.defineProperty(Date.prototype, 'asDateString', {
    enumerable: false,
    get: function () { 
    	if(Number.isNaN(this.valueOf())) return '';
    	return this.toISOString().slice(0,10); 
    }
});

export function TodayLocal() {
	const dt = new Date()
	dt.setUTCMinutes(dt.getUTCMinutes()-dt.getTimezoneOffset())
	return dt.asDateString
}

export function TodaySystem() {
	const dt = new Date()
	dt.setUTCMinutes(dt.getUTCMinutes()-dt.getTimezoneOffset()+systemTZOminutes)
	return dt.asDateString
}

/** DATETIME
 * store as a string in UTC time zone by default
 * 
 * so, toISOstring() give string from date
 * 
 * if dt is in system time (like MSK), we use it in calcluation, comparation, etc as 
 * 		fromSystemTimeString(dt) 
 * 
 */

/**
 * convert time (in UTC) to local timezone
 * date - local date string
 * returns UTC date string
 * asDateTimeString strips timezone
 */

// eslint-disable-next-line no-extend-native
Object.defineProperty(Date.prototype, 'asDateTimeString', {
    enumerable: false,
    get: function () { 
    	if(Number.isNaN(this.valueOf())) return '';
    	return this.toISOString().replace('T','').replace('Z',''); }
});

export function localNow() {
	return new Date().asDateTimeString;
}

export function systemNow() {
	const dt = new Date()
	dt.setUTCMinutes(dt.getUTCMinutes()-dt.getTimezoneOffset()+systemTZOminutes)
	return dt.asDateTimeString;
}

/*
	dt is a iso-like string in SYSTEM timezone without timezone postfix
*/
export function fromSystemTimeString(dt) {
	dt = new Date(`${dt}Z`)
	dt.setUTCMinutes(dt.getUTCMinutes()+systemTZOminutes)
	return dt.asDateTimeString;
}

Date.toDateTime = function(str, tz = 'Z') {
	if(!str) return new Date(NaN);
	if(str.match(/Z/)) return new Date(str)
	if(str.match(/[+-]/)) return new Date(str)
	return new Date(`${str}${tz}`)
}

export function atSystemDateTimeString(dt) {
	if(!dt) return dt;
	if(typeof dt === 'string') dt = Date.toDateTime(dt)
	dt.setUTCMinutes(dt.getUTCMinutes()+systemTZOminutes)
	return formatLocalDateTime(dt) 
}

export function relativeDate(dt) {
  if(!dt) return
  let m
  if((m=dt.match(/\s*(?:([+-])\s*(\d+)\s*(months|years)?|(\d{4}-\d{2}-\d{2}))\s*$/))) {
    if(m[1]) {
      let sign = m[1] === '-'? -1 : 1;
      let r = new Date()
      r = new Date(r.getFullYear(), r.getMonth(), r.getDate())
      let offset = 
        m[3] === 'years' ? [(+m[2]) * 12 * sign, 0]
        : m[3] === 'months' ? [+m[2] * sign, 0]
        : [ 0,  +m[2] * sign ]
      return new Date(r.getFullYear(), r.getMonth()+offset[0], r.getDate()+offset[1])
    } else {
      return parseLocalISO(m[4])
    }
  }
}

function parseLocalISO(dt) {
	if(!dt.trim()) return new Date(NaN);
	if(dt.match(/^\s*(\d{4})-(\d{2})-(\d{2})\s*$/))
		return new Date(+RegExp.$1,+RegExp.$2-1, +RegExp.$3)
	return new Date(NaN);
}

export function formatLocalDate(dt, locales) {
	if(!dt) return '';
	if(Number.isNaN(dt.valueOf())) return '';
	if(typeof dt === 'string') {
		let ndt = new Date(dt.slice(0,10))
		if(Number.isNaN(ndt.valueOf())) return dt;
		dt = ndt;
	}
	return dt.toLocaleDateString(locales, 
        {year:"numeric", month:"2-digit", day:"2-digit"}
    )
}

export function formatLocalDateTime(dt) {
	if(!dt) return '';
	if(Number.isNaN(dt)) return '';
	if(typeof dt === 'string') {
		let ndt = new Date(`${dt} Z`)
		if(Number.isNaN(ndt.valueOf())) return dt;
		dt = ndt;
	}
	return dt.toLocaleDateString(undefined,
			{year:"numeric", month:"2-digit", day:"2-digit"}) + " " +
		dt.toLocaleTimeString(undefined,
			{hour: "2-digit", minute: "2-digit"}
		)
}

// eslint-disable-next-line no-extend-native
Object.defineProperty(String.prototype, 'localDate', {
    enumerable: false,
    get: function () { return formatLocalDate(this); }
});
// eslint-disable-next-line no-extend-native
Object.defineProperty(String.prototype, 'localDateTime', {
	enumerable: false,
	get: function () { return formatLocalDateTime(this); }
});

// eslint-disable-next-line no-extend-native
Object.defineProperty(String.prototype, 'ruDate', {
    enumerable: false,
    get: function () { return formatLocalDate(this, 'ru-RU'); }
});

const localMask = formatLocalDate(new Date(3333,10,22)); // detect field order

export const parseLocalDate = 
	/.*22.+11.+3333/.test(localMask) ? // DMY
	(s) =>
		s.match(/[^\d]*(\d?\d)[^\d]+(\d?\d)[^\d]+(\d\d\d\d)/)?
			new Date(+RegExp.$3, +RegExp.$2-1, +RegExp.$1)
		: new Date(NaN)
	:
	/.*11.+22.+3333/.test(localMask) ? // MDY
	(s) => 
		s.match(/[^\d]*(\d?\d)[^\d]+(\d?\d)[^\d]+(\d\d\d\d)/)?
			new Date(+RegExp.$3, +RegExp.$1-1, +RegExp.$2)
		: new Date(NaN)
	:
	/.*3333.+22.+11/.test(localMask) ? // YDM
	(s) => 
		s.match(/[^\d]*(\d\d\d\d)[^\d]+(\d?\d)[^\d]+(\d?\d)/)?
			new Date(+RegExp.$1, +RegExp.$3-1, +RegExp.$2)
		: new Date(NaN)
	:
	/.*3333.+22.+11/.test(localMask) ? // YMD
	(s) => 
		s.match(/[^\d]*(\d\d\d\d)[^\d]+(\d?\d)[^\d]+(\d?\d)/)?
			new Date(+RegExp.$1, +RegExp.$2-1, +RegExp.$3)
		: new Date(NaN)
	:
		s => new Date(s)

export function months(v) {
	v = v?.toString()
	if(v?.match(/^(\d\d)[.](\d\d\d\d)$/))
		return +RegExp.$1-1 + +RegExp.$2 * 12;
	if(v?.match(/^(\d\d\d\d)-(\d\d)/))
		return +RegExp.$2-1 + +RegExp.$1 * 12;		
}

export function shiftYear(dateStr) {
	const [year, ...rest] = dateStr.split('-');
	return `${+year + 1}-${rest.join('-')}`;
}