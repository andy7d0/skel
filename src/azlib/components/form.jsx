import {Fragment, createContext, use, useRef, useCallback, useState, useEffect, useMemo} from 'react'
import {produce} from 'immer'

import {getValueByPath, setStateByPath} from '../helpers.mjs'

import {Cancel, useModalContext} from './modals'
import {fakeEvent} from './controls';
import {confirm as confirmFunc, promptBig as promptBigFunc} from './controls'

import {CMODE} from '../schema-checker.mjs'

import * as css from './form.module.css'

export * as Ctrl from './controls'
export * as formsCss from './form.module.css'
export {globalShowModal} from './modals'

/* поля

	варианты 
		<Field name="aaa" as={Ctrl.Str} />
	or
		<Ctrl.Str ...{hadlers('aaa')} />

	Сейчас Field заодно создает контекст для имени
	Но он нужен лишь для массивов, да и там - сложнее

	При этом мы внутри ВСЕГДА можем использовать пути-как-массивы(!)

	при этом контролл для массива также возможен именно как контрол!

	обычный контрол имеет пару (value+onChange(event))
	и для controlled значения используется event.target.value

	если мы помещаем control в форму, нам еще нужно event.target.name(!)

	однако, форма может игнорировать name в событии(!!!!), т.к. ее обработчик это name знает

	у контролов есть варианты
	1) при невалидном локальном значение писать в onChange нечто невалидное
	    и аккуратно использовать localValue вместо невалидного значения
	    при этом глобальный валидатор видит невалидные значения и может работать с ними корректно
	    при этом можно НЕ заморачиваться с регистрацией контролов, т.к. по схеме все и так понятно!
	2) писать себе в state флаг "невалидно" (=error) (и почему)
		и НЕ обновлять удаленное значение (т.е. она всегда равно последнему валидному, что хорошо)
		в этом случае надо как-то собирать непроставленные значение (валидаторы)
		для корректной работы глобального валидатора (?)
	3) можно расширить базовый тип значений и ставить вместе с корректным значением еще и ошибку
		это можно через proxy
		однако, в таком случае typeof field будет 'Object'
		и код обхода может быть ошибочным(!!!!)
	4) можно расширять свойства, но тут не ясно, что будет, если верное значение было null/undefined

	проблема - как вычислить все объекты, показывающие ошибки
	1) можно иметь контекст ошибок
	2) если надо вычислить показ ошибок, надо заставить всех, кому он интересен, перерисовать себя
	   (например, клонировать)
	3) рядом этим клоном вести mutable карту показанных ошибок и карту редактируемых полей

	т.е. каждый объект ошибки имеет
	поле + текст + флак показа + флаг редактирования

	эта карта доступна ПОСЛЕ render, фактически она - эффект (в рендере)
	когда карта отображения ошибок равна по версии карте ошибок, можно отображать absorber


	уровни работа поля (controlModes)

	0/null -> невидим
	1      -> видны данные
	2      -> видны данные и ошибки
	3      -> редактируемый

*/

/**
 *  form is an <form> or nothing
 *  
 */


export const FormContext = createContext()

export function useFormContext() { return use(FormContext) }
export function WithForm(props) { return <FormContext.Consumer {...props} /> }

function FormInt({initial, name, value, onChange, readOnly
		, validator
		, schema

		, action

		, className
		, enableEnter
		, as
		, children
	}) {

	if(onChange) { console.assert(value === undefined, 'no value if controlled form') }

	const [localValue, setLocalValue] = useState(initial) // use initial as local value
	// if onChange, use external values
	const values = onChange? value : localValue

	const schemaInstance = useMemo(()=>schema?.(values, readOnly? CMODE.R : CMODE.W), [schema, readOnly, values])

	const modifyValues = useCallback(values => schemaInstance?.modifyValues? 
							schemaInstance.modifyValues(values, initial) : values
		, [schemaInstance, initial])

	const setValuesEx = useCallback(v => onChange(fakeEvent(name,
		 	modifyValues(Function.isFunction(v) ? v(values) :v )))
		, [name, values, onChange, modifyValues])
	const setLocalValuesEx = useCallback(v => setLocalValue(values=>
		 	modifyValues(Function.isFunction(v) ? v(values) :v ))
		, [setLocalValue, modifyValues])
	// eslint-disable-next-line exhaustive-deps
	const setValues = onChange? setValuesEx : setLocalValuesEx;

	// calculate instant errors when values changed
	const instantErrors = useMemo(()=>schemaInstance?.validate?.(values), [values, schemaInstance]);

	const [validationResult, setValidationResult] = useState({}) // values+result+remote(undef/true/false)

	// canculate combined errors (instant or validation)
	// use better one
	const actualErrors = 
		validationResult?.values === values? validationResult.errors : instantErrors;

	const [touched, setTouched] = useState({})

	// form can be modal and it's common case
	const close = useModalContext()

	// default action from modal from is close
	// eslint-disable-next-line exhaustive-deps
	const realAction =  useCallback((cmd,values) => action? action(cmd, values) : close(values), [action, close]);


	const [submiting, setSubmiting] = useState(false)

	const annotations = useMemo(()=>schemaInstance?.annotateValues(values), [values, schemaInstance])

	// track shown errors 
	const [errorsMarkers, setErrorsMarkers] = useState({})
	// clear when something changed
	useEffect(()=> { setErrorsMarkers({}) }, [actualErrors])

	const [errorsToShow, setErrorsToShow] = useState(null)
	useEffect(()=>{
		if(!actualErrors) {
			setErrorsToShow(null);
			return;
		};
		function rec(errors, annotations) {
			let ret;
			for(const i in errors) {
				if(errors[i] === Object(errors[i])) {
					const r = rec(errors[i], annotations[i])
					if(r) { ret ??= {}; ret[i] = r; }
				} else {
					if(annotations[i]().access >= CMODE.E){
						ret ??= {}
						ret[i] = errors[i]
					}
				}
			}
			return ret;
		}
		const ret = rec(actualErrors, annotations, ret)
		setErrorsToShow(ret)

		return () => setErrorsToShow(null)
	}, [actualErrors, annotations, setErrorsToShow])

	const [lostErrors, setLostErrors] = useState([])
	useEffect(()=>{
		if(!errorsToShow) {
			setLostErrors([])
			return;
		}
		const ret = []
		function rec(errors, errorsMarkers, ctx) {
			for(const i in errors) {
				if(errorsMarkers?.[i]) continue;
				const n = [...ctx, i]
				if(errors[i] === Object(errors[i])) {
					rec(errors[i]
							, errorsMarkers?.[i] ?? {}
							, n)
				} else {
					ret.push([ n, errors[i] ]);
				}
			}
		}
		rec(errorsToShow, errorsMarkers, [])

		return () => setLostErrors([])
	}, [errorsToShow, errorsMarkers, setLostErrors])

	// асинхронная валидация - это красиво, 
	// но ВСЕ наши валидаторы локальны,
	// а валидаторы, зависящие от данных (а не документа)
	// проще выполнить на сервере при отправке!
	// потенциально еще могут быть валидаторы, зависящие от локальных ф-й, 
	// типа indexedDB, но пока не ясно, что они будут делать
	// а потом расширим, если надо
	// расширение: делаем синхронную валидацию, а за ней Асинхронную 
	// однако, сама по себе валидация ВСЕГДА асинхронная
	// т.к. вызывается в событиях, а значит, errors не связаны с текущими values

	const validate = useCallback((values, initial) => {
					try {
						const errors = validator?.(values, initial)
						setValidationResult({values,errors})
						return errors;
					} catch(e) { 
						const errors = {'*':e};
						setValidationResult({values,errors});
						return errors;
					}
				},[validator, setValidationResult])


	const [revalidate, setRevalidate ] = useState()
	const requestValidation = useCallback(
		() => setRevalidate(()=>()=>validate(values, initial))
		, [setRevalidate, validate, values, initial])

	const lastRevalidate = useRef(0)
	useEffect(()=>{
		if(!revalidate) return;
		if(lastRevalidate.current + 500 <= Date.now()) {
			lastRevalidate.current = Date.now()
			revalidate()
			return;
		}
		const id = setTimeout(revalidate, lastRevalidate.current + 500 - Date.now())
		return () => clearTimeout(id)
	}, [revalidate])

	// used in from context (ONLY!) which use values, so it is useless to memorize 
	const submit = useCallback(async (action) => {
			if(!action) return;
			const toSubmit = values;
			try {
				setSubmiting(true) //sync re-render here
					// special action - do not check automatically
				const doValidation = action !== action.toUpperCase() && action !== '_' 
				let errors = doValidation? 
								await validate(toSubmit, initial) // null if no errors
								: null;
				if(!errors) {
					const {errors, values = toSubmit} 
						= await realAction?.(action, toSubmit) ?? {};
					setValidationResult({values,errors,remote:!!errors})
					if(errors) {
						// eslint-disable-next-line consistent-function-scoping
						function rec(draft, obj) {
							for(const i in obj) {
								if(obj[i] === Object(obj[i])) {
									draft[i] ??= {}
									rec(draft[i], obj[i])
								} else {
									draft[i] ??= true;
								}
							}
						}
						setTouched(touched=>produce(touched, draft=>{rec(draft, errors)}))
					} else {
						setValues(values)
						setTouched({})
					}
				}
			} finally {
				setSubmiting(false)
			}
		}, [setSubmiting, realAction, validate, values, initial, setValidationResult, setValues, setTouched])

	// forms always block submit/reset form handlers and rely on global one solely
	// also block 'enter' from sending!!! //TODO: allow 'enter' with option
	const formHandlers = useMemo(()=>({
		onSubmit: e => e.preventDefault()
		, onReset: e => e.preventDefault()
		, onKeyPress: e => {
					if(!enableEnter && e.which === 13 
						&& e.target.type !== "textarea"
						&& e.target.type !== "button"
						&& e.target.type !== "submit"
						&& e.target.type !== "reset"
					){
						e.preventDefault(); 
						return false;
					}
				}
	}), [enableEnter])

	const setFieldValue = useCallback((name,value)=>
			setStateByPath(setValues,name,value)
		, [setValues])
	const setFieldTouched = useCallback((name)=>{
			setStateByPath(setTouched, name, true)
			requestValidation()
			}
		, [setTouched,requestValidation])

	const form = useMemo(()=>({ 
				values, initial
				, annotations
				, error:errorsToShow, validOwned: !errorsToShow
				, valid: !actualErrors, remoteValid: validationResult?.remote
				, touched
				, submiting, submit
				, setFieldValue, setFieldTouched
				, validated: validationResult?.values === values
				, setErrorsMarkers, lostErrors
			})
			, [values, initial
				, annotations
				, actualErrors, errorsToShow
				, touched 
				, submiting, submit
				, setFieldValue, setFieldTouched
				, validationResult
				, setErrorsMarkers, lostErrors
			  ]
		)

	const rootField = { name:'' 
			, value: values
			, values
			, form
			, visible: true
			, writeable: !readOnly
			, Component: null
			, parent: null
		}

	children = applyEx(children, form)

	const Component = as;
	const componentProps = Component === Fragment ? {} : { ...formHandlers, className }
	return <FormContext value={form}>
			<NameContext value={rootField}>
			<Component {...componentProps} children={children} />
			</NameContext>
		  </FormContext>
}

export function Form(props) {
	return <FormInt {...props} as="form" />
}

Form.Fragment = function(props) {
	return <FormInt {...props} as={Fragment} />	
}

const errorDecoder = 
{
	'((NULL))': 'Обязательно заполните это поле!'
	, '((required))': 'Обязательно заполните это поле!'
	, '((format error))': 'Неверный формат'
	, '((underflow))': 'Значение вне допустимого диапазона'
	, '((overflow))': 'Значение вне допустимого диапазона'
	, '((diff))': 'Значение не совпадает с требуемым'
	, '((check error))': 'Неверное значение'
}

export const commonErrorDecoder = (error) => isPlainObject(error) ? 'есть ошибки'
			: errorDecoder[error]??error.toString()

/*
	кодирование ошибок
	<Field min={value} ...>
	<Field min={[value,message]} ...>
*/

export const NameContext = createContext(null);


export function nameFormContext(nctx, name) {
	return name && name[0] === '/'? name.slice(1)
			: nctx?.name && name ? `${nctx.name}.${name}` 
			: name? name 
			: nctx?.name??''
}

export function useField({name, as, ...props}) {
	const nctx = use(NameContext);
	const form = nctx.form;
	name = nameFormContext(nctx, name)

	const annotation = form.annotations && getValueByPath(form.annotations, name)?.();

	const mode = annotation?.access ?? 10000;

	const required = props.required || annotation?.required
	const probablyRequired = !!annotation?.requiredFor?.size

	const value = getValueByPath(nctx.values, name)
	return { name
			, value
			, changed: value !== getValueByPath(nctx.initial, name) 
			, values: nctx.values
			, form
			, cmode: mode
			, visible: nctx?.visible && mode >= CMODE.R
			, writeable: nctx?.writeable && !props.readOnly && mode >= CMODE.W
			, required, probablyRequired
			, annotation

			, Component: as
			, handlers: {
				name
				, value
				, onChange: e => form.setFieldValue(e.target.name, e.target.value)
				, onBlur: e => form.setFieldTouched(e.target.name)
			}
			, rest: props
			, parent: nctx
		}
}

export function ReadOnly(props) {
	const nctx = use(NameContext);
	const rctx = useMemo(()=>({
		...nctx
		, writeable: false
	}),[nctx])
	return	<NameContext value={rctx} {...props} />
}

export function Initial(props) {
	const nctx = use(NameContext);
	const rctx = useMemo(()=>({
		...nctx
		, values: nctx.form.initial
		, value: getValueByPath(nctx.form.initial, nctx.name)
		, writeable: false 
	}),[nctx])
	return	<NameContext value={rctx} {...props} />
}

export function WithField(props) {
	const field = useField(props);
	return	field.visible && 
					<NameContext value={field}>{
						applyEx(props.children, field.value, field)
					}</NameContext>
}


/**
 *  name  - field name
 *  as    - component name
 *  required - not null AND not empty                    
 * 				true or function which takes all values bag and return true/false 
 *  notnull - not null, but can be empty (strings only)
 *  min, max, pattern - domain restrictions
 *  validator - funtion takes value and values bag and returns empty or error
 */
export function Field(props) {
	const field = useField(props)
	//console.log(field)
	//console.log(handlers.name,handlers.value, visible)

	return field.visible && (
	field.Component && <NameContext value={field}>
			<field.Component {...field.handlers} />
		</NameContext>
	|| `-no as for ${field.name}-`)
}

/*
	
	<Field name="xxx" min={0} max={10} />

	технически, валидатор у нас работает так
state.
	required вычисляет свое условие (applyEx)
	
	если оно норм, проверяет на !null & !''

	notnull тажке 

	validator сам умный

	остаются min/max/pattern

	pattern можно применять универсально!

	min/max зависят от типов
	бывают
	1) числа - это видно по типу сразу?
	2) строки - это поледнее, что рассматриваем
	3) даты
	даты можно превращать в NaN
*/

export function Error({untouched, errorDecoder, ...props}) {
	const field = useField(props);
	const {form,name} = field;

	// suppressor suppress whole subtree!
	// so all subpaths of name need to be checked

	const visible = field.cmode >= CMODE.E

	const reg = form.setErrorsMarkers
	useEffect(()=>{
		if(visible) setStateByPath(reg, name, true) // true if we can write! 
	}
	, [reg, name, visible]);

	if(!visible) return;

	const error = getValueByPath(form.errors, name);
	const decoded = (errorDecoder??commonErrorDecoder)(error);

	if(
	    error
	    && (untouched || getValueByPath(form.touched, name))){
            return (field.Component
                        && <field.Component name={name} {...field.rest}>{
                            applyEx(props.children??decoded, decoded, field.value, error, form)
                        }</field.Component>
                    || applyEx(props.children, decoded, field.value, error, form)
                    )
    }
}

/*
	эта штука показывает все ошибки, не показанные где-либо еще
*/
export function ErrorAbsorber(){
	const form = useFormContext();
	return form.lostErrors?.length && <>
		{form.lostErrors.map(([name,e])=>
				<div key={name.join('.')}>{e.toString()}</div>
			)}
	</>
}

export function FullField({
		label
	  	, tip, border = true
		, error, errorProps, errorDecoder, untouched
		, containerProps, flex, unit, footnote
		, ...props}) {
	const field = useField(props)
	const {writeable, visible, probablyRequired} = field
	const deco = ( label || tip || error || containerProps || flex ) && border
	const requireMark =  deco && writeable && probablyRequired

	useSetDefault(props);

	return visible &&
	<fieldset className={
			deco?classes(css.formField, flex && `flex-${flex}`) : css.formFieldClean
		} 
		{...containerProps}
	>
		{label && <label>{applyEx(label, field)}{requireMark && <sup/>}</label>}
		{footnote && <footer>{applyEx(footnote, field)}</footer>}
		<div><Field {...props}/></div>
		{unit && <var>{applyEx(unit, field)}{!label && requireMark && <sup/>}</var>}
		{tip && writeable && <dfn>{applyEx(tip, field)}</dfn>}
		{error && 
			(error === true? 
			  <Error name={props.name} untouched={untouched} {...errorProps} 
			  		errorDecoder={errorDecoder} as="mark"/> 
			: <Error name={props.name} untouched={untouched} {...errorProps} as="mark"  
					errorDecoder={errorDecoder}>{error}</Error>
			)
		}
	</fieldset>
}

export function LikeField({name, 
		label
	  	, tip, border = true, required
		, containerProps, flex, unit, footnote
		, error, errorProps, errorDecoder
		, children}) {
	const deco = ( label || tip || error || containerProps || flex ) && border
	const requireMark =  deco && required
	return 	<fieldset className={
			deco?classes(css.formField, flex && `flex-${flex}`) : css.formFieldClean
		} 
		{...containerProps}
	>
		{label && <label>{label}{requireMark && <sup/>}</label>}
		{footnote && <footer>{footnote}</footer>}
		<div>{children}</div>
		{unit && <var>{unit}{!label && requireMark && <sup/>}</var>}
		{tip && <dfn>{tip}</dfn>}
		{name && error && 
			(error === true? <Error name={name} untouched {...errorProps} errorDecoder={errorDecoder} as="mark"/> 
			: <Error name={name} untouched {...errorProps} as="mark"  errorDecoder={errorDecoder}>{error}</Error>
			)
		}
	</fieldset>
}


export function ReqMark(props) {
	const {writeable, visible, probablyRequired} = useField(props)
	return visible && writeable && probablyRequired && <sup><kbd/></sup>
}

/*
r/w - нажимаемая
r/o - только проверка
null - нет
*/

export function Submit({value, confirm, prompt_to, prompt_caption, ...props}) {
	const form = useFormContext()
	const mode = form.actionsModes? form.actionsModes(value) : true

	if(mode === null) return;
	const enabled = 
				//(form.valid && mode || value.endsWith('$'))
				mode
				&& !form.submiting

	return <aligned-button type="submit" disabled={!enabled}
				{...props}
				onClick={async e=>{
					e.preventDefault()
					if(confirm) {
						 	if(!await confirmFunc(confirm)) return;
					}
					if(prompt_to) {
							// header + field
						const ret = await promptBigFunc(prompt_caption??'','',{required:true})
						form.setFieldValue(prompt_to, ret);
						await defer();
					}
					form.submit(value)
				}}
			/>
}
Form.Submit = Submit;

Form.Cancel = Cancel;

export function SubmitReady({children}) {
	const form = useFormContext()
	return form.validated && form.remoteStatus.valid && children
}
Form.SubmitReady = SubmitReady;

export function HasErrors({children}) {
	const form = useFormContext()
	return form.validated && (!form.valid || form.remoteStatus.valid === false)
		&& children
}
Form.HasErrors = HasErrors;

export function HasVisibleErrors() {
	const form = useFormContext()
	// eslint-disable-next-line click-events-have-key-events
	return form.errors && <div className="button"
		onClick={(e)=>{
			const elem = e.target
			const f = elem.closest('form')
			const q = f?.querySelector('mark.error')
			q?.focus()
			q?.scrollIntoView()
		}}
	>
		<dfn>Есть ошибки в изменяемых полях</dfn>
	</div>
	||
	<>
		<br/>
		<dfn>Проверка доступных для редактирования данных пройдена успешно</dfn>
	</>
}
Form.HasVisibleErrors = HasVisibleErrors;

/*
	type submit call 'action' with params
	type reset call 'reset' with params
	form know a priory what happend after successfull op:
	1) keep doc 
	or
	2) navigate
*/


export function When({children, condition, ...props}) {
	const {value} = useField(props)
	return (condition ? condition(value) : !!value) && children
}

Form.When = When;

export function Pager({data, filter, sort, reverse, empty, children
		, head = 0, tail = 0, keep = 1, page, divider
	}) {
	if(!data) return empty;
	const array = Object.entries(data);
	if(!array.length) return empty;

	const ffilter = filter === true? ([k]) => !!k :
								filter ? ([_,v])=> !!filter(v)
								: null
	const fsort = sort === true? ([k])=>k : 
							sort? ([_,v])=> sort(v) 
							: null;

	const filtred = ffilter ? array.filter(ffilter) : array;
	const sorted = fsort? filtred.toSorted(
			(a,b)=>{ a = fsort(a); b = fsort(b); return cmp(a,b); } 
		)
		: filtred;

	const r = reverse? sorted.toReversed(): sorted;

	const toOut = r.map(([k,v], idx)=>children(k,v,idx))
	const out = [];
	let pos = head;
	toOut.forEach((v,i,a)=>{
		const rest = a.length - i;
		if(pos + rest + tail < page) {
			out.push(v);
			++pos;
			return;
		}
		if(rest <= keep) {
			out.push(divider)
			out.push(v);
			pos = 1;
			return;
		}
		if(pos >= page) {
			out.push(divider)
			out.push(v);
			pos = 1;
			return;
		}
		out.push(v)
		++pos;
	})
	return out;
}

Form.Pager = Pager


export function useDependent(name, value) {
	const nctx = use(NameContext);
	const {values,setFieldValue} = nctx.form;
	const fname = nameFormContext(nctx, name);
	const current = getValueByPath(values, fname);
	useEffect(()=>{
	    if(value !== current) {
	        setFieldValue(fname, value);
	    }
	}, [setFieldValue, value, current, fname])
}

export function Dependent({name, value, ...props}) {
	const nctx = use(NameContext);
	const valsArray = Object.entries(props)
								.map(
									([locname, path])=>
									[locname, getValueByPath(nctx.form.values
										, nameFormContext(nctx,path))]
								)
	const valsObj = Object.fromEntries(valsArray);
	const val = value(valsObj, getValueByPath(nctx.form.values, nameFormContext(nctx,name)))

	useDependent(name, val)
}

export function useSetDefault(props) {
	const {name, value: current, visible, writeable, form} = useField(props)
	const {setFieldValue} = form
	const defaultValue = props.defaultValue
	useEffect(()=>{
		if(defaultValue === undefined || !visible || !writeable) return;
	    if(current !== undefined && current !== null) return;
	    setFieldValue(name, defaultValue);
	}, [setFieldValue, name, current, defaultValue, visible, writeable])
}


export function Calculated({children, ...props}) {
	const nctx = use(NameContext);
	const form = nctx.form;
	const valsArray = Object.entries(props)
								.map(
									([locname, path])=>
									[locname, getValueByPath(form.values, nameFormContext(nctx,path))]
								)
	const valsObj = Object.fromEntries(valsArray);
	return children(valsObj)
}


