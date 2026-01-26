import {isPlainObject} from './helpers.mjs'

export const Delete = Symbol('delete');
/**
 * preserve dest order!
 */
function immutableAssignContainers(dest, src) {
	// dest is object here as well as src
	// merge objects
	let dirty = false;
	let ret = {}
	for(const i of Object.keys(dest)) {
		if(!src.hasOwnProperty(i)) { 
			ret[i] = dest[i]
			continue;
			// keep
		}
		const s = Unbox(src[i]) // src[i] can be boxed!
		if(Object.is(dest[i],s)) {
			// keep (the same)
			ret[i] = dest[i]
			continue;
		}
		if(s === undefined || s === Delete && !Array.isArray(dest)) {
			// delete, i.e. skip
			// but if dest is array, keep pos as array still be dense
			dirty = true;
			continue
		}
		ret[i] = immutableAssign(dest[i], src[i])
		if(!Object.is(dest[i], ret[i])) dirty = true;
	}
	// appends
	for(const i of Object.keys(src)) {
		if(!dest.hasOwnProperty(i) && src[i] !== undefined) { //FIXME: maybe after unbox?
			dirty = true;
			ret[i] = Unbox(src[i])
		}
	}
	if(!dirty) return dest;
	if(Array.isArray(dest)) {
		// maybe array wanted
		const k = Object.keys(ret);
		for(let i = 0; i < k.length; ++i){
			if(k[i]!==`${i}`) {
				// it is not an array!
				return ret;
			}
		}
		ret = Object.values(ret).filter(v=>v!==Delete)
	}
	return ret;
}

/*
src must be value or OBJECT, not array

{} <= a.b.c.Box(1)
*/

export function immutableAssign(dest, src, stamped) {
	if(Boxed(src)) return Unbox(src); // boxed value always replace dest
	if(src instanceof swap) {
		// works for arrays only
		return dest.map((e,i)=> i === src.a? dest[src.b] : i === src.b? dest[src.a] : e)
	}
	if(dest instanceof Boxed && isPlainObject(src)) {
		// normally, dest isn't box, but when we merge mutators, it can be
		// here, we keep assign boxed, but apply mutator deeper
		return Box(immutableAssign(dest.value, src))
	}
	if(stamped && isPlainObject(dest) && isPlainObject(src) && src['.stamp']) {
		const m = immutableAssign(dest['_'],src['_'],stamped)
		if(dest['.stamp'] < src['.stamp'])
			return { ...src, '_': m }
		return m === dest['_'] ? dest : { ...dest, '_': m };
	}
	if(isPlainObject(dest) || Array.isArray(dest)) {
		// works with array and object
		if(!isPlainObject(src)) return Unbox(src);
		return immutableAssignContainers(dest,src, stamped);
	}
	return Unbox(src); // may be equal to dest or different
}

immutableAssign.stamped = (dest,src) => immutableAssign(dest,src, true)

function swap(a,b){
	this.a = a
	this.b = b
}
export function swapIndexes(a, b) {
	return new swap(a,b)
}

export function getValueByPath(values, name) {
	return name===''? values 
		: name.split('.').reduce((bag,name) => bag?.[name], values) ?? null
}

export function makeChain(name, value) {
	const split = name.split('.')
	const last = split.pop()
	return split.reduceRight((chain, name) => 
			({[name]: chain})
			, {[last]: value} 
		)
}

export function setValueByPath(values, name, value) {
	if(!name) {
		if(typeof values === 'function')
			return values(values=>immutableAssign(values, value))
		return immutableAssign(values, value)		
	}
	const chain = makeChain(name, value)
	if(typeof values  === 'function')
		return values(values=>immutableAssign(values, chain))
	return immutableAssign(values, chain)
}

function boxedValue(value){
	this.value = value
}
/**
 * prevent value from deep merge
 */
export function Box(value) { return new boxedValue(value); }

export function Boxed(value) { return value && value instanceof boxedValue; }

export function Unbox(maybeBoxed) {
	return Boxed(maybeBoxed)? maybeBoxed.value 
		: isPlainObject(maybeBoxed) ? immutableAssign({}, maybeBoxed)
		: maybeBoxed
}

/*
take from and to
and return object been applied to from gives to
if stamped is true, check '.stamp' field
*/
export function generatePatch(from,to, stamped) {
	let ret = undefined
	const combo = new Set([...Object.keys(from), ...Object.keys(to)])
	for(const i of combo) {
		if(Object.is(from[i],to[i])) continue;
		if(Array.isArray(from[i]) && Array.isArray(to[i])) {
			// both are arrays
			// TODO: compare array, respect order (how?)
			const p = generatePatch(from[i],to[i], stamped)
			if(p) {
				ret ??= {}
				ret[i] = to[i]  //FIXME: now we keep 'to'
								// but can be smarter
			}
			continue;
		}
		if(isPlainObject(from[i]) && isPlainObject(to[i])) {
			if(stamped && to[i]['.stamp']) {
				// traget i stamped, so keep it as is
				// except '_' field
				const {'_': to_values, ...base} = to[i];
				const from_values = from[i]['_']
				const p =
					from_values && to_values ?
						generatePatch(from_values, to_values, stamped)
					: to_values;
				if(from[i]['.stamp'] === to[i]['.stamp'] && p===undefined) {
					// stamp is unchanged! and local unchanged either
					continue;
				}
				ret ??= {}
				ret[i] = base;
				if(p) ret[i]['_'] = p;
			}
			//both are objects, go deeper
			const p = generatePatch(from[i], to[i], stamped)
			if(p) {
				ret ??= {}
				ret[i] = p
			} 
			continue;
		}
		// keep `to` in patch
		ret ??= {}
		ret[i] = to[i] 
	}
	return ret;
}

generatePatch.stamped = (from, to) => generatePatch(from, to, true)
 

/*
*/
export function deepCompare(a,b) {
	if(JSON.stringify(a) === JSON.stringify(b)) return true;
	if(typeof a !== typeof b) return false;
	if(isPlainObject(a) && isPlainObject(b)) {
		for(const i in a)
			if(!deepCompare(a[i], b[i])) return false;
		for(const i in b)
			if(!deepCompare(a[i], b[i])) return false;
		return true;
	}
	if(Array.isArray(a)&&Array.isArray(b)){
		if(a.length !== b.length) return false;
		for(let i = 0; i < a.length; ++a)
			if(!deepCompare(a[i],b[i])) return false;
	}
	return false;
}

/*
	schemaToMutator({
		a: {
			x: []
		} 
		b: {}
	}
	{
		a: {
			x: true
		} 
		b: true
	})

	schemaToMutator(M=>({
		
	}))

*/

export function shapeToMutator(shape,data) {
	if(Array.isArray(shape) && shape.length === 0) {
		return Box(data)
	}
	if(!isPlainObject(data)) return Box(data);
	const ret = {}
	for(const n in shape) {
		ret[n] = shapeToMutator(shape[n], data[n])
	}
	return ret;
}

