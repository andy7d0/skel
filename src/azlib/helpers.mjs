import {produce} from 'immer'

export const MY = Symbol('My') 

/**
 * assing value as parameter in next function
 * usage 
 * letIn( <complex-calculation> )(v=> <code> )
 * so, v is an alias for complex expression
 * somehow like
 * let x = <complex-calculation> in <code>
 */
export const letIn = (...values) => (f => f(...values))

export function DBG(...values) {
	console.log(...values);
	return values[values.length-1]
}

/*
	 USAGE:

	 for arrays:

		 setValue(setter.array.append(value))
		 or
		 setValue(setter.array(null,value))
		 etc

	for objects

		setValue(setter.object.prop(value))
		or
		setValue(setter.object.prop(undefined)) // delete prop

*/

export const setter = {
	object: new Proxy({}, {
		get(_target, prop, _receiver) {
			return value => 
				value === undefined? ({[prop]:_, ...rest} = {}) => rest
				: obj => ({...obj, [prop]: value})
		}
	}) 
	, array: (idx, value) =>
  				idx === null ? setter.array.append(value)
					: idx === undefined ? setter.array.prepend(value)
  				: value === undefined ? setter.array.delete(idx)
  				: setter.array.replace(idx,value)
} 

setter.array.append = value=> a => [...(a??[]), value]
setter.array.prepend = value=> a => [value, ...(a??[])]
setter.array.delete = idx=>
				     	Function.isFunction(idx) ? a=>(a??[]).filter(e=>!idx(e)) 
				      : a=>(a??[]).toSpliced(idx,1)
setter.array.replace = (idx, value)=>
				      Function.isFunction(idx) ? a=>(a??[]).map(e=>idx(e)? value: e) 
				      : a=>(a??[]).toSpliced(idx,1, value)

setter.array.swap = (idx1, idx2)=>
							a=>a.map((v,i,a)=>
									i === idx1? a[idx2] : i === idx2? a[idx1] : v 
								)

export const cmp = (a,b) => (a > b) - (a < b);  

cmp.selector = selector => 
  		Function.isFunction(selector)?
                    (a,b) => cmp(selector(a), selector(b))
        : (a,b) => cmp(a[selector], b[selector])

cmp.selector.desc = selector => 
  		Function.isFunction(selector)?
                    (a,b) => cmp(selector(b), selector(a))
        : (a,b) => cmp(b[selector], a[selector])

cmp.lex = (...f) => (a,b) => {
  for(const func of f){
    const r = func(a,b)
    if(r) return r;
  }
  return 0;
}


export function classes(...array) {
	return array.filter(Boolean).join(' ')
}
/**
 * if a value is empty ( i.e. === '' or undefined or null)
 * return placeholder value
 */
export function applyPlaceholder(v, ph) {
	return v === ''? ph : v ?? ph;
}

/**
 * check, if object is 'simple', i.e. like {}
 */
export function isPlainObject(v) {
	if(v !== Object(v)) return false
	if(Object.getPrototypeOf(v) === null) return true;
	return Object.getPrototypeOf(v) === Object.getPrototypeOf({});
}

/**
 * resolve promise to <value> after <delay>
 */
export const later = (delay, value, signal) =>
    new Promise((resolve,reject) => {
    	const t = setTimeout(resolve, delay, value)
    	if(signal) {
		  signal.addEventListener("abort", ()=>{
	        clearTimeout(t);
	        reject();
	      })
    	}
    });

/**
 * relolve Promose to <value> as soon, as possible
 */
export const defer = v => Promise.resolve(v)

/**
 * convert true/false to ''/null, i.e. to empty/absent attribute
 * usage: <Component attribute={htmlBool(value)} />
 */
export const htmlBool = v => v ? '' : null;

/**
 * wrap (by function call) value, if it is not empty
 * return placeholder if elmpty
 */
export function wrapNotEmpty(value, code, placeholder) {
	return value? code(value) : placeholder;
}


/**
 * if first parameter is function apply it to rest
 * if not, return it
 * 
 * so, it is can be used to mix constant or evaluated values
 * in the same property 
 * <Compoent prop="const" /> or <Component prop={(args)=>...code...} />
 */
export const applyEx = (obj, ...args) =>
		(Function.isFunction(obj) ? obj(...args) : obj); 


/**
 * NOTE
 * 
 * in react, this works
 * <Component {...{attribute:value}} />
 * 
 * so we can use shorthand properties almost natively
 */

/**
 * split string to fields array
 * 
 * f 
 * of pfx { f1 f2 ...}
 */
export function parse_fields(fields) {
	if(Array.isArray(fields)) return fields;

	let res = []
	const re = /([{])|([}])|([.])|([^{.}\s]+)/g
	let pfx = []
	let curr = null
	let m;
	const out = v => {
			if(curr !== null) 
				res.push([...pfx,curr].join('~')); 
			curr = v??null;
	}
	while((m=re.exec(fields))) {
		//console.log(m)
		if(m[1]) {
			//open
			pfx.push(curr); curr = null;
			continue;
		}
		if(m[2]) {
			//close
			out()
			pfx.pop()
			continue;
		}
		if(m[3]){
			out()
			res.push(pfx.join('~'))
			continue;
		}
		out(m[4])
	}
	out()
	return res
}

/**
 * call given function only once
 * and return it first value intead
 */
export function once(fn, context) { 
	let result;

	return function() { 
		if(fn) {
			result = fn.apply(context || this, arguments);
			fn = context = null;
		}

		return result;
	};
}

/**
 * restrict calls of given function
 * not frequently than specified in delay (ms)
 * all calls ignored for delay ms since last call
 */
export function throttle(fn, delay, context) { 
	let result;
	let next = Date.now();

	return function() { 
		if(Date.now() >= next) {
			next = Date.now()+delay;
			result = fn.apply(context ?? this, arguments);
		}

		return result;
	};
}

/**
 * restrict calls of given function
 * not frequently than specified in delay (ms)
 * if there was the calls within delay ms since last call
 * last one call with last provideded args will happen at the intreval end
 */

/**
 * execute given async(!) function sequentially
 */
export function serialized(fn) {
	let executed = Promise.resolve();
	return function() {
		return executed = executed.catch(()=>null)
			.then(
				() => (fn.apply(this, arguments))
			)
	}
}

/**
 * execute given async(!) function sequentially
 * if some call was made during function execution,
 * record params and recall function when ready 
 */
export function debounceSerialized(fn) {
	let executed = Promise.resolve();
	let args = undefined;
	return function(...fArgs) {
		args = fArgs; //just record args for next exec
		executed.finally(
			()=>{
				if(args) {
					// our turn
					const a = args;
					args = undefined;
					return fn(...a); // take current args
				}
				// if no args, do nothing
			}
		)
		// all calls shedule fn exec
		// and record args
		// when first sheduled call processed, it takes 
		// current accumulted args and replaces accumulator with none
		// when later sheduled call processed and no args, it is just ignored
		// so function executed as soon as possible
		// but with last collected args
	}
}

/**
 * iterate over array slice
 */
export function* sliceIterator(arr,from,to,filter) {
	to = Math.min(to??arr.length,arr.length) 
	if(filter)
		for(let i = from||0; i < to; ++i) {
			let e = arr[i]
			switch(filter(e,i,arr)) {
			case false: break;
			case true: yield e; break;
			default: return;
			}
		}
	else
		for(let i = from||0; i < to; ++i)
				yield arr[i];
}

export function range(from, to) {
	let r = []
	for(let i = from; i < to; ++i)
		r.push(i)
	return r;
}

/*
	project props from given object
	usage:
	given source object SRC
	do this
	SRC.property1.property2....propertyN()
*/

export function projectProps(obj) {
	const ret = {}
	const p = new Proxy((()=>{}),{
		get(target,name) { 
			if(obj.hasOwnProperty(name)) ret[name] = obj[name]
			return p;
		}
		, apply() {
			return ret;
		}
	})
	return p;
}

export function checkUnique(selector, obj, ...arrays) {
	const used = new Set();
	for(const s of arrays){
		if(s)
			for(const u of Object.values(s))
				if(u) used.add(selector(u))
	}
	return used.has(selector(obj))
}

function deepEqualContainers(dest, src) {
	for(const i of Object.keys(dest)) {
		if(!src.hasOwnProperty(i)) { 
			return false;
		}
		if(!deepEqual(dest[i], src[i])) return false;
	}
	for(const i of Object.keys(src)) {
		if(!dest.hasOwnProperty(i)) {
			return false;
		}
	}
	return true;
}

/*
src must be value or OBJECT, not array

{} <= a.b.c.Box(1)
*/

export function deepEqual(dest, src) {
	if(isPlainObject(dest) || Array.isArray(dest)) {
		// works with array and object
		return deepEqualContainers(dest,src);
	}
	return Object.is(dest,src);
}


export function smartTrim(s) {
	s = s.trim()
	s = s.replace(/^_$|^_[^_]|[^_]_$|[^_]_[^_]/g,' ')
	s = s.replace(/_(_+)/g,'$1')
	s = s.replace(/[|]([|]+)/,'$1')
	return s;
}

export function getValueByPath(values, name) {
	return !name? values 
		: name.split('.').reduce((bag,name) => bag?.[name], values) ?? null
}
export function setValueByPath(values, name, value) {
	if(!name) return value;
	name = name.split('.');
	const last = name.pop();
	return produce(values, draft =>{
		let d = draft
		for(const n of name) {
			d[n] ??= {}
			d = d[n]
		}
		d ??= {} //TODO: arrays???
		d[last] = value;
		draft = {[last]:'111'};
	})
}

export function setStateByPath(setFunc, name, value) {
	setFunc(current => setValueByPath(current, name, value))
}


