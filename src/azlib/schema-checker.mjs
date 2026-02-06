import {produce} from 'immer'
/**
 * 
 * takes value and schema template
 * 
 * genetare schema and check it
 * 
 * MODEL is just an object
 * .prop: {conditions}
 * .prop: object({ checking-props }) ({subprops})
 * .prop: array({checks})({object-props})
 * .prop: array({checks})(string({checking-props})) etc
 * .prop: map({checks})({object-props})
 * .prop: map({checks})(string({checking-props})) etc
 * 
 * .prop: string({checks})
 * .prop: text({checks})
 * .prop: int({checks})
 * .prop: uint({checks})
 * .prop: number({checks})
 * .prop: unumber({checks})
 * 
 * .prop: object({checks})(keys-array)(key=>schema)
 * 
 * checker is a function value => errors object
 * 
 * if we just skip prop use
 * .prop: cond && etc
 * 
 * if we alternate prop defs use
 * .prop: cond1 && def1 || cond2 && def2
 * 
 * if we alternate blocks use
 * 
 * ...(cond1 && {defs1} || cond2 && {defs2})
 * 
 * merge subschema:
 * 
 * {
 * ....
 * , [merge]: items
 * ....
 * }
 * 
 * conditional merge schema
 * ,[merge]: cond && {defs}
 * 
 * 
 * lex-friendly
 * 
 * const <schema-name> = 
 * 	BEGIN_SCHEMA
 * 	.STATES(<object-or-function>) // values (and roles somehow) => states-object
 * 	.MODEL(<object-or-function>) // values => schema-object
 * 	.ACTIONS(<object-or-function>) // values => actions-array
 * 	.SCHEMA_END
 * 
 * actions:
 * 	{
		id: {action-def}
	}
 * 	
 * action-def:
 * 	{
 	* label:
 	* access: access-object
 	* appearence:
 	* enabled: function-to-check action accesibility
 	* confirm: function_or_string
 	* dirty: true/false -- apply to dirty values only
 * 	}
 * 
 * access-object appied to actions and controls
 * 
 * {
 	* state: access code or simple type or access-object for subtypes
 * }
 * 
 * if state = _ this rule defines defaults for all states not mentioned explicitly
 * 
 * schema-params - do we need this at all?
 * 
 * if schems is function, it can import modules and use params from there!
 * 
 * often we needs some scheme info to be used in client (or server) code and well as in schems
 * (some constant constraints, message texts etc)
 * 
 * there are two ways
 * 1) extract some info from actual schema props (min/max etc) and use it in control
 * 2) use global values from schema somehow declared
 * 
 * to check we do
 * 
 * const actual_schema = SCHEMA_NAME(actual_root)
 * 
 * checkSchema(actual_schema, actual_root)
 * 
 */

/**
 * Not-a-value value
 */
export const NaV = Symbol('Not-a-value')

export function validValue(v) {
  // eslint-disable-next-line no-self-compare
  return v === v // !isNaN
    && v !== Number.NEGATIVE_INFINITY // underrange
    && v !== Number.POSITIVE_INFINITY // overreange
    && v !== NaV;
}

export const BEGIN_SCHEMA = { 
	SATATES(states_def) {
		return {
			schema: {
				states: Function.isFunction(states_def)? states_def : () => states_def
				, model: () => {}
				, actions: () => []
			}
			, MODEL(model_def) {
				return { ...this
					, schema: { ...this.schema
						, model: Function.isFunction(model_def)? model_def 
									: () => model_def
					}
				}
			}
			, ACTIONS(actions_def) {
				return { ...this
					, schema: { ...this.schema
						, actions: Function.isFunction(actions_def)? actions_def 
									: () => actions_def
					}
				}
			}
			, END_SCHEMA() { 
				return (values, maxCMODE) => {
					const schema = this.schema;
					const states = schema.states?.(values) ?? {}
					const actions = mergeDefinitions(schema.actions?.(values) ?? {})
					const accessibleActions = {}
					for(const i in actions) {
						if(actions[i].access !== undefined
							&& !reduce_access(states, actions[i].access)) continue;
						accessibleActions[i] = actions[i];
					}
					const goals = Object.values(accessibleActions)
							.map(action=>action.goal)
							.filter(Boolean)
					const raw_model = mergeDefinitions(schema.model?.(values) ?? {})
					const model = produce({children:raw_model, access: maxCMODE}
						, draft=> {mutate_model(draft, states, goals, maxCMODE)})
					return {
						actions: accessibleActions
						, model
						, annotateValues(values) { return annotateValues(values, model) }
						, modifyValues(values, initial) {
							values = enforceRO(values, initial, model)
							values = callModelCrawler(applyMasters, wrapStack(values), model)
							return values
						}
						, validate: (values, goal = goals) => callModelCrawler(
													performCheck.bind(undefined,goal)
													, wrapStack(values)
													, model)
					}
				}
			}
		}
	}
}
/*
	schema composition
	model: 
	{
		...submodel - replace names with submodel defined
		[merge] = submodel-here  -- expand submodel in upper level with deep merge
	}
	actions:
	{
	...actions -- append actions
	}

*/

/*
	states - current state according to value
	goals - planned states according to applicable actions

	validate checs required with all possible goals
	also, before go we need enshure than all requrements met for specific goal(!)
	so, we pass optional goal to validate

	reduce_access delivers max value for all applicabe states
	but require needs MIN (if field not required for a role it's not required at all)

	also, required is timelined but domain ussually not

	if require is a function it's value-dependent
	so we forced to reacalculate it for an every possible goal

	such value-dependent require is very simple!

	of course, we can do model-recalculation for all goals changin value
*/

function mutate_model(draft, states, goals, maxCMODE) {
	draft.access =  Math.min(maxCMODE, reduce_access(states, draft.access))
	draft.accessMin = draft.access;

	if(draft.required && draft.access < CMODE.W) draft.required = false;
	if(draft.required && !Function.isFunction(draft.required)) {
		const goals_req = 
			goals.filter(g=> !!reduce_require(g, draft.required) )

		draft.required = goals_req.length = goals.length
		draft.requiredFor = new Set(goals_req)
	}
	if(draft.children) {
		for(const i in draft.children) {
			mutate_model(draft.children[i], states, goals, draft.access)
			draft.accessMin = Math.min(draft.accessMin, draft.children[i].accessMin)
		}
	}
	if(draft.items) {
		mutate_model(draft.items, states, goals, draft.access)
		draft.accessMin = Math.min(draft.accessMin, draft.items.accessMin)
	}
}

function reduce_access(states, access) {
	if(access !== Object(access)) return access; // simple leaf
	let r = null; // default access (for all states)
	for(const i in access) {
		if(!(i in states)) continue;
		const a = access[i]
		const c = a === Object(a) 
						? reduce_access(states[i], a)
						: a;
		r = Math.max(r, c)
	}
	return  r ?? access['_'];
}

function reduce_require(states, require) {
	if(require !== Object(require)) return require; // simple leaf
	let r = Number.POSITIVE_INFINITY; // default require
	for(const i in require) {
		if(!(i in states)) continue;
		const a = require[i]
		const c = a === Object(a) 
						? require(states[i], a)
						: a;
		r = Math.min(r,c)
	}
	return  r === Number.POSITIVE_INFINITY ? require['_'] : r;
}

/*
	states - ф-я, берущая value и неявно рoли или иную инфу 
				и возвращающая текущие состояния
	поля access далее фильтруются по этим состояния!!!
	состояния - это иерархический объект
			, листья имеют значение null

	отдельная ф-я собирает текущие параметры схемы по текущим значениям
*/

export const CMODE = {
	N: 0
	, R: 1
	, E: 2
	, W: 3
}

export function string(checks) { return {...checks, type:'string'}}
export function text(checks) { return {...checks, type:'text'}}
export function int(checks) { return {...checks, type:'int'}}
export function uint(checks) { return {...checks, type:'uint'}}
export function number(checks) { return {...checks, type:'number'}}
export function unumber(checks) { return {...checks, type:'unumber'}}
export function number1(checks) { return {...checks, type:'number', pattern: /^[+-]?\d+([.]\d?)?$/}}
export function unumber1(checks) { return {...checks, type:'number', pattern: /^\d+([.]\d?)?$/}}
export function number2(checks) { return {...checks, type:'number', pattern: /^[+-]?\d+([.]\d{0,2})?$/}}
export function unumber2(checks) { return {...checks, type:'number', pattern: /^\d+([.]\d{0,2})?$/}}
export function number3(checks) { return {...checks, type:'number', pattern: /^[+-]?\d+([.]\d{0,3})?$/}}
export function unumber3(checks) { return {...checks, type:'number', pattern: /^\d+([.]\d{0,3})?$/}}
export function number4(checks) { return {...checks, type:'number', pattern: /^[+-]?\d+([.]\d{0,4})?$/}}
export function unumber4(checks) { return {...checks, type:'number', pattern: /^\d+([.]\d{0,4})?$/}}
export function date(checks) { return {...checks, type: 'string', pattern: /^\d{4}[-]\d{2}-\d{2}$/}}
export function date2000(checks) { return {...checks, type: 'string', pattern: /^20\d{2}[-]\d{2}-\d{2}$/}}
// dateBefore, dateAfter - use base field or today

// property calculate replace current value

export function object(checks) { return children => 
	Array.isArray(children)? 
		template => ({...checks, children: Object.fromEntries(children.map(k=>[k,template(k)])) })
	:	{...checks, children }
}

/*
	{
		p: string()
		x: object({ a: string(), b: string() })
	}

	--
	{
		p: {type:string}
		x: {type:object, children: {a: {type:string, b: {type: string()} }} }
	}
*/

export function array(checks) { return items => ({...checks, type: 'array', items}) }
export function map(checks) { return items => ({...checks, type: 'map', items}) }

export const merge = new Proxy({},{
	mergeId: 0
	, get(t,name,r) {
		if(name==='valueOf') {return ()=>`_________${++r.mergeId}`} 
		return Reflect.get(t,name,r);
	}
})

function mergeDefinitions(schema) {
	const ret = {}
	for(const i in schema) {
		if(schema[i] !== Object(schema[i])) continue; // ignore non-object items
		if(i.match(/^_________\d+$/)) {
			if(schema[i] !== Object(schema[i])) continue;
			deepMerge(ret, schema[i])
		} else {
			ret[i] = schema[i];
		}
	}
	return ret;
}

function deepMerge(dest, src) {
	for(const i in src) {
		if(src[i] === undefined) {
			delete dest[i]
			continue
		}
		if(src[i] !== Object(src[i])) continue; // ignore non-object items
		if(i in dest) deepMerge(dest[i], src[i])
		else dest[i] = src[i] 
	}
}

function enforceRO(value, initial, model) {
	if(model.access < CMODE.W) return initial;
	if(model.items && model.accessMin < CMODE.W) {
		const kv = new Set(Object.keys(value??{}))
		const ki = new Set(Object.keys(initial??{}))
		const diff = kv.symmetricDifference(ki)
		if(diff.size) return initial; // rever add/delete
		let ret;
		for(const k of ki) {
			const r = enforceRO(value[k], initial[k], model.items)
			if(!Object.is(value[k], r)) {
				ret ??= Array.isArray(initial)? [...value] : {...value}; 
				ret[k] = r;
			}
		}
		return ret ?? value; 
	}
	let ret;
	if(model.children)
	for(const i in model.children) {
		if(model.children[i].accessMin >= CMODE.W) continue;
		const r = enforceRO(value?.[i], initial?.[i], model.children[i])
		if(!Object.is(value?.[i], r)) {
			ret ??= {...value}; ret[i] = r;
		}
	}
	return ret ?? value;
}

function applyMasters(stack, model) {
	const current = stack(0);
	if(model.access < CMODE.W) return current;
	if(isEmptyValue(current)) return current; // already empty
	if('master' in model) { // has master
		if(isEmptyValue(model.master) || model.master === false) { // to be clean
			return null
		}
	}
	return digSchema(applyMasters, stack, model, current, Object.is)
								 //{a,x:{b,c}}    {a,x}
}

//  model should be proxied(!!!!!!!!)
function performCheck(goal, stack, model) {

	if('calculated' in model) {
		stack = [model.calculated, ...stack.slice(1)]
	}

	const current = stack(0);

	let master = false;
	if('master' in model) { // has master
		// master is function or precalculated value
		master = isEmptyValue(model.master) || model.master === false;
	}
	// required
	let required = model.required;
	required = !master && 
		(required 
		|| goal && model.requiredFor?.has(goal)
		);
	if(required && isEmptyValue(current)) return '((required))';

	if(isEmptyValue(current)) return;

	if(current !== current // NaN
		|| current === NaV
	) {
		return '((format error))';
	}
	if(current === Number.NEGATIVE_INFINITY) return '((underflow))';
	if(current === Number.POSITIVE_INFINITY) return '((overflow))';


	if(model.pattern && !current.match(model.pattern)) return '((format error))';
	if(model.fileType && current.fileType !== model.fileType) return '((format error))';
	if(model.equal && `${current}` !== `${model.equal}`) return '((diff))';

	let def;

	def = model.min;
	if(def !== undefined) {
		if(model.type === "string" && model.noSpaces) 
			{ if(current.repace(/s/g,'').length < +def) return '((underflow))'; }
		if(model.type === "string") { if(current.length < +def) return '((underflow))'; }
		if(model.type === "array") { if(current.length < +def) return '((underflow))'; }
		if(model.type === "map") { if(Object.keys(current).length < +def) return '((underflow))'; }
		if(model.type === "object") { if(Object.keys(current).length < +def) return '((underflow))'; }
        if(current < def) return '((underflow))';
	}

	def = model.max;
	if(def !== undefined) {
		if(model.type === "string" && model.noSpaces) 
			{ if(current.repace(/s/g,'').length > +def) return '((overflow))'; }
		if(model.type === "string") { if(current.length > +def) return '((overflow))'; }
		if(model.type === "array") { if(current.length > +def) return '((overflow))'; }
		if(model.type === "map") { if(Object.keys(current).length > +def) return '((overflow))'; }
		if(model.type === "object") { if(Object.keys(current).length > +def) return '((overflow))'; }
        if(current > def) return '((overflow))';
	}

	def = model.check;
	if(def !== undefined) {
		if(typeof def === 'string' && def) return def;
		if(def === false) return '((check error))';
	}

	if('debug' in model) 
		console.log(model.debug)

	return digSchema(performCheck.bind(undefined,goal), stack, model
		, undefined, (ret, _)=> ret === undefined)
}


// keep callable if node instantiated
const keepCallable = Symbol('keep function callable')
export function callable(func) {
	func[keepCallable] = true;
	return func;
}

function instantiateModelNode(stack, baseModelNode, parentProxy) {
	// TODO: cache instance
	return new Proxy({}, {
			get(_target, name, receiver) {
				if(name === 'parent') return parentProxy;
				if(name === 'root') {
					if(parentProxy) return parentProxy.root;
					return receiver;
				}
				const v = baseModelNode[name]
				if(Function.isFunction(v) && !v.keepCallable) {
					return v(stack, receiver)
				}
				return v;
			}
			, has(_target, property) {
				return property in baseModelNode;
			} 
		})
}

function callModelCrawler(func, stack, model, parentProxy) {
	return func(stack, instantiateModelNode(stack, model, parentProxy));
}

// return current or somethig else
// model should be proxied, it's crawler requirement
function digSchema(func, stack, model, defaultRet, check) {
	const current = stack(0)
	// go depper
	if(model.children) {
		let ret
		// objects
		for(const k in model.children) {
			const next = current?.[k];
			const r = callModelCrawler(func, wrapStack(next, stack)
									, model.children[k]
									, model);
			if(!check(r, next)) { ret ??= {...defaultRet}; ret[k] = r; }
		}
		return ret ?? defaultRet
	} 
	if(model.items && model.type === 'map') {
		let ret
		// map
		if(current)
		for(const k in current) {
			const next = current[k];
			const r = callModelCrawler(func, wrapStack(next, stack, k)
						, model.items
						, model);
			if(!check(r, next)) { ret ??= {...defaultRet}; ret[k] = r; }
		}
		return ret ?? defaultRet
	} 
	if(model.items && model.type === 'array') {
		let ret
		// array
		if(current)
		for(const [k,v] of Object.entries(current)) {
			const next = v;
			const r = callModelCrawler(func, wrapStack(next, stack, k)
						, model.items
						, model);
			if(!check(r, next)) { ret ??= [...(defaultRet??[])]; ret[k] = r; }
		}
		return ret ?? defaultRet
	} 
	return defaultRet;
}

function isEmptyValue(current, empty = '') {
	return current === undefined || current === null || current === empty;
}

export const INDEX = Symbol('value-index')
function wrapStack(current, parent, index) {
	return new Proxy(idx => idx === 0? current
							: idx === undefined? (parent?parent():current)
							: parent?.(idx-1)
		, {
		get(target, prop) {
			switch(prop) {
				case 'valueOf': return current;
				case INDEX: return index;
			}
			return Reflect.get(target, prop, target)
		}
	})
}


function annotateValues(stack, modelNode, parentProxy) {
	return new Proxy(
		() => instantiateModelNode(stack, modelNode, parentProxy)
		, {
		get(target, prop, receiver) {
			if(modelNode.children) {
				return annotateValues( wrapStack(target[prop], target)
						, modelNode.children[prop], receiver)
			}
			if(modelNode.items) {
				return annotateValues( wrapStack(target[prop], target, prop)
					, modelNode.items, receiver)
			}
		}
	})
}




/*
	1) master / required as function

	function schm(root, params) {
		return {
			prop: string({master: root.mf}) // this is root, the best from root expresstion
			// realtive master? here we can not express it
		}
	}


	2) master as function
	function schm(root, params) {
		return {
			prop: string({master: root.mf}) // this is root, the best from root expresstion
			// realtive master? here we can not express it
			, prop: string({master: _=>_(1).fld !== true})
		}
	}

master prop calculated to empty or false ==> clean deps

properties is js schema

_    - current
_(0) - native current
_(N) - Nth ancestor
_()  - root


*/