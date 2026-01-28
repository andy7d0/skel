import {useState, useRef} from 'react';
import {createPortal} from 'react-dom';
import {fileTypeFromBuffer} from 'file-type'
import {lookup as mimeLookup} from 'mime-types'
import {base64ArrayBuffer} from 'azlib/b64.mjs'
import {Button} from 'azlib/components/tags'
import {applyPlaceholder, applyEx, defer} from '../helpers'
import {getXY, mousePos, useLocalEditValue, NaV, AutosizeTextarea} from '../ui-helpers.mjs'
import {relativeDate, formatLocalDate, parseLocalDate, formatLocalISO} from '../date.mjs'
import {Calendar} from './calendar.jsx';

import {prompt as promptBox, promptBig, PopupModal, confirm, alert} from './modals';

import {getGlobalUniqueCode} from '../common.mjs'

// import {useSubsystemApi} from './fetcher'
import { pdfjs } from 'react-pdf';
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.js`;
/*
	all controls should be nullabel, been controlled
	i.e. null value dispalyes as something different from other other (css!)
*/

/**
 * fool React and send change which set's controlled value
 * 
 */
export function fakeEvent(name, value){ return {target:{type:'', name, value}} }

/*
	контролируемые компонены
	получают состояние извне (могут не быть в дереве, т.е. поддерживают окна)
	
	невалидные значение надо где-то хранить локально
	(т.е. есть локальное состояние)

	регистрация возможна в процессе рендеринга, 
	но для простой работы есть просто  get/set (и перерендеринг сверху вниз)
	
	тут проблема с компонентам, где ЛОКАЛЬНОЕ состояние может быть неполным
	(например, дата)

	такой контрол требует хранения данных "в себе" до отсылки в общее состояние
	в целом, в общем состоянии должны быть только локально валидные данные
	(тип, min, max, pattern)

	как работает локальное состояние?
	есть value + local
	варианты - при невалидном состоянии мы можем передавать в общее состояние признак
				(например, NaN)
				или undefined
				или Symbol (для строк удобно и логично)

	если вариант с особым значением, обновление сверху станет простым
			(проставляется значение, не равное особому)
	также, ясно, что значение сейчас еще не готово и его не надо использовать

	другие варианты?
	можно менять локальное значение, когда изменилось внешнее
	if(lastValue !== value) local = value
	при этом в value мы выставляем только локально валидные данные

	также, некоторые контролы ХРАНЯТ невалидное состояние, например, infoset
	но тогда они его могут и выставлять обычным способом и даже сохранять

	валидаторы
	в целом, неплохо, если валидатор возможен в самом контроле
	это эквивалетното регистрации валидатора в контексте
	т.е. примерно равно, по сути, 
	setValue + setValidator
	но для простых случаев не нужно!

	также, при записи в состояние контрол может выполнять преобразования
	value -> text & text -> value
	при этом если text не валидный, цикл не замкнут 
	и надо или выставлять Unchecked(text) и не нужно локальное состояние
	или таки локальное


	===

	formik

	<Field name="xxx" as={Ctrl}/> //

	hook
	<Ctrl {...register("xxx")} /> //проще и прямее!


*/

const NUMBER = window.Number;

/**
 * ctrl+backspace ===> clear control (set to null)
 */
function nullableSetKbd(event, props) {
	if( 
		!props.readyOnly && !props.notnull
		//event.which === 191  // event.which deprecated, event.code === 'Slash'
		&& event.which === 8 // event.code === 'Backspace'
		&& !event.ctrlKey
		&& event.shiftKey
		&& !event.altKey
		&& !event.metaKey
	) {
		props.onChange?.(fakeEvent(event.target.name,null))
		event.preventDefault()
		return false;
	}
	return true
}

/*
	special rect 20x20 at top-right connet
*/
function mouseInSpecRect(event) {
	const p = mousePos(event) 
	const r = getXY(event.target)
	return p.x < r.w && p.y>=0 && p.x >= r.w - 20 && p.y < 20; 
}
function nullableClick(event,props) {
	if( 
		!props.readyOnly && !props.notnull
		&& mouseInSpecRect(event)
	) {
		props.onChange?.(fakeEvent(event.target.name,null))
		event.preventDefault()
		return false;
	}
	return true	
}

function nullableProps(props) {
	return {
		nullable: props.notnull?undefined:''
		, value: props.value===null?'':props.value
		, null: props.value===null?'':undefined
		, autoComplete: "off" //TODO: is it here?
		, onKeyDown: e=>nullableSetKbd(e,props)&&props.onKeyDown?.(e)
		, onClick: e=>nullableClick(e,props)&&props.onClick?.(e)
	}
}

export function htmlProps({required, notnull, whenChanged, storageID, dataKey, error, wide, ...props}
  , ref, tag) {
  let style = null
  if(props.style) style = {...props.style}
  if(props.width) style = {...style, width: props.width}
  if(style) style = {style}
	const ret = {...props, ...style, ref: ref
    , wide: wide?'':undefined 
    , required:required?'':undefined
    , notnull:notnull?'':undefined
  }
  if(tag) {
    ret.value = '';
    if(Array.isArray(tag))
      for(const t of tag) ret[t] = '';
    else
      ret[tag] = '';
  }
  return ret;
}

export function Input({ref, ...props}) { return <input {...htmlProps(props, ref)} {...nullableProps(props)}/>; }

/**
 * trim string on blur!
 */
export function Str ({ref, min,max,pattern,password,...props}) {
  const [localValue, setLocalValue] = useLocalEditValue(props.value,v=>v)
  return props.readOnly? <span {...htmlProps(props, ref, 'input')}>{localValue}</span>
  : <input {...htmlProps(props, ref)} {...nullableProps(props)} type={password?'password':'text'}
    value={localValue}
  onBlur={(e)=>{
    const v = e.target.value.trim() // trim spaces on blur
  	if(v !== e.target.value) {
  		e.target.value = v;
    	props.onChange?.(e)
	  }
    props.onBlur?.(e)
  }}
  onChange={(e)=>{
  	setLocalValue(e.target.value)
    const v = e.target.value
	if(pattern && !pattern.test(v)) {
		// invalid
		return props.onChange?.(fakeEvent(e.target.name, NaV))
	}
	if(min !== undefined && v.length < min)
		return props.onChange?.(fakeEvent(e.target.name, NUMBER.NEGATIVE_INFINITY))
	if(max !== undefined && max < v.length)
		return props.onChange?.(fakeEvent(e.target.name, NUMBER.POSITIVE_INFINITY))
	//valid
	return props.onChange?.(fakeEvent(e.target.name, v))
  }} 
/>
}

export function StrHrefSubstitute({ref, template,ifEmpty,...props}) {
    if(props.readOnly)
      return props.value? 
          <a {...htmlProps(props, ref, 'input')} href={template.replace('$$',props.value)} target="_blank">{props.value}</a>
          : (ifEmpty ?? '---')
    return <Str ref={ref} {...props} />
}

export function Text ({ref, resize,min,max,...props}) {
  const [localValue, setLocalValue] = useLocalEditValue(props.value,v=>v)
  const onChange=(e)=>{
  	setLocalValue(e.target.value)
    let v = e.target.value
	  if(min !== undefined && v.length < min)
		  return props.onChange?.(fakeEvent(e.target.name, NUMBER.NEGATIVE_INFINITY))
	  if(max !== undefined && max < v.length)
		  return props.onChange?.(fakeEvent(e.target.name, NUMBER.POSITIVE_INFINITY))
	  //valid
	  return props.onChange?.(fakeEvent(e.target.name, v))
  }
  return props.readOnly? <pre {...htmlProps(props, ref, 'textarea')}>{localValue}</pre> 
      : (resize ?? true) ?
        <AutosizeTextarea {...htmlProps(props, ref)} {...nullableProps(props)} onChange={onChange}
        value={localValue} />
      : <textarea {...htmlProps(props, ref)} {...nullableProps(props)} onChange={onChange} 
        value={localValue}
        />
}


export function Int ({ref, min,max,...props}) {
  const [localValue, setLocalValue] = useLocalEditValue(props.value,v=>`${v}`)
  return props.readOnly? <span {...htmlProps(props, ref, 'input')}>{localValue}</span>
  :<input {...htmlProps(props, ref)} value={localValue}
  onKeyPress={(e)=>{
    if(e.charCode < 0x30 || e.charCode > 0x39) {
      e.preventDefault()
    }
  }}
  onChange={(e)=>{
    setLocalValue(e.target.value)
    let v = e.target.value.trim()
    if(v==='') {
      // empty value is a null
      return props.onChange?.(fakeEvent(e.target.name, null))
    }
    if(!v.match(/^[+-]?[0-9]+$/)) {
      // invalid
      return props.onChange?.(fakeEvent(e.target.name, NaN))
    }
  	v = +v
  	if(min !== undefined && v < +min)
  		return props.onChange?.(fakeEvent(e.target.name, NUMBER.NEGATIVE_INFINITY))
  	if(max !== undefined && +max < v)
  		return props.onChange?.(fakeEvent(e.target.name, NUMBER.POSITIVE_INFINITY))
      props.onChange?.(fakeEvent(e.target.name, v)) // set TYPED value
  }} 
/>}

export function Year (ref, ...props) {
  return <Int ref={ref} {...props} size={4} />
}

export function Number({ref, min,max,...props}) {
  const [localValue, setLocalValue] = useLocalEditValue(props.value
    , (v,last)=> v === +last && last && !last.match(/^0+[1-9]/)? last : `${v}`
  )
  return props.readOnly? <span {...htmlProps(props, ref, 'input')}>{localValue}</span>:
  <input {...htmlProps(props, ref)} value={localValue}
  onKeyPress={(e)=>{
    if((e.charCode < 0x30 || e.charCode > 0x39) && e.charCode !== 0x2E /*.*/) {
      e.preventDefault()
    }
  }}
  onChange={(e)=>{
  	setLocalValue(e.target.value)
    let v = e.target.value.trim()
    if(v==='') {
    	// empty value is a null
		  return props.onChange?.(fakeEvent(e.target.name, null))
    }
	  if(!v.match(/^[+-]?[0-9]+([.][0-9]*)?$/)) {
		  // invalid
		  return props.onChange?.(fakeEvent(e.target.name, NaN))
	  }
  	v = +v
  	if(min !== undefined && v < +min)
  		return props.onChange?.(fakeEvent(e.target.name, NUMBER.NEGATIVE_INFINITY))
  	if(max !== undefined && +max < v)
  		return props.onChange?.(fakeEvent(e.target.name, NUMBER.POSITIVE_INFINITY))
  	//valid
  	return props.onChange?.(fakeEvent(e.target.name, v))
  }} 
/>}


function adjustCalendarPos(pos) { return pos }

export function Date({ref, value, onChange, onBlur, onFocus, min, max,...props}) {
  let [popped, setPopped] = useState(false)

  let calendarRef = useRef(null)
  let clicked = useRef(false)
  let myRef = useRef(null)
 
  let pos = useRef()

  min = relativeDate(min) // DATE!
  max = relativeDate(max) // DATE!

  const [localValue, setLocalValue] = useLocalEditValue(value,v=>formatLocalDate(v,'ru-RU'))

  if(ref) ref.current = myRef.current

  return props.readOnly? <span input=''>{localValue}</span>
      :(<>
        <input {...htmlProps(props, myRef)} value={localValue} 
          onClick={()=>{
            if(myRef.current) {
              const tp = getXY(myRef.current);
              //eslint-disable-next-line no-unused-vars
              const {x,y,w,h} = tp;
              pos.current = {x,y:y+h, fixed: tp.fixed}
            }
            if(!props.readOnly) setPopped(!popped)
          }}
          onKeyDown={()=>setPopped(false)}
          onChange={(e)=>{
            setLocalValue(e.target.value)
    		    let v = e.target.value.trim()
    		    if(v==='') {
    		    	// empty value is a null
    				  return onChange?.(fakeEvent(e.target.name, null))
    		    }
            v = parseLocalDate(v) //DATE!!!
            //console.log(v)
      			if(min !== undefined && v < min)
      				return onChange?.(fakeEvent(e.target.name, NUMBER.NEGATIVE_INFINITY))
      			if(max !== undefined && max < v)
      				return onChange?.(fakeEvent(e.target.name, NUMBER.POSITIVE_INFINITY))
            onChange?.(fakeEvent(e.target.name, v.asDateString))
          }}
          onFocus={e=>{
            clicked.current = false;
            return onFocus?.(e)
          }}
          onBlur={e=>{
              //console.log('blur',e, e.relatedTarget)
              onBlur?.(e);
              if(!clicked.current) {
                setPopped(false);
              }
            }
          }
          autoComplete="off"
        />
        {popped?
            createPortal(<dialog ref={node=>{node?.showModal()}}>
              <Calendar ref={calendarRef}
                style={{
                  position: pos.current.fixed ? "fixed" : "absolute"
                  ,left: adjustCalendarPos(pos.current, calendarRef.current).x
                  ,top: adjustCalendarPos(pos.current, calendarRef.current).y
                }}
                onMouseDown={()=>{
                  clicked.current = true;
                }}
                onBlur={() => {
                  //console.log('blur2',e, e.relatedTarget)
                  //if(!document.getElementById('transient').contains(e.relatedTarget)) 
                  //if(e.relatedTarget!==ref.current)
                  //  setPopped(false);
                }}
                onClick={()=>{
                  //console.log('cl')
                }}
                onChoose={(dt)=>{
                  setPopped(false);
                  //console.log(ref.current, dt, formatLocalDate(dt))
                  if(myRef.current) 
                    myRef.current.value = formatLocalDate(dt)
                  onChange?.(fakeEvent(props.name, dt.asDateString))
                  onBlur?.(fakeEvent(props.name))
                }}
                min={min} max={max}
              /></dialog>
          , document.getElementById('transient'))
        : null}
      </>
      )
}

export function EndlessDate({ref, ...props}) {
    let refC = useRef(null)
    const  endless = props.value === '3000-01-01'
    const endless_label = 'бессрочно'
    if(ref) ref.current = refC.current
    return <>
      {!props.readOnly && <input type="checkbox" ref={refC} checked={endless} 
        onChange={e=>{
          if(e.target.checked)
            props.onChange?.(fakeEvent(props.name, '3000-01-01'))
          else 
            props.onChange?.(fakeEvent(props.name, ''))
        }}
      />}
      {(props.readOnly && endless || !props.readOnly) && endless_label}
      {!endless && <Date {...props} />}
    </>
}

export function Prompt ({ref, name, value, onChange, onBlur
    , placeholder, caption, required, readOnly, multilne
    , children, ...props}) {
  const trigger = children? applyEx(children,value,name)
        : applyPlaceholder(value, placeholder)
  
  return props.readOnly? <span button='' ref={ref}>{trigger}</span>: <Button ref={ref}
    onClick={async ()=>{
        if(readOnly) return;
        let n = await (multilne?promptBig:promptBox)(caption, value, required)
        onChange?.(fakeEvent(name,n))
        onBlur?.(fakeEvent(name))
    }} 
    {...htmlProps(props)}>{trigger}</Button>
}


// digdoc ModalEdit
// can be expressed with popup
// ModalEdit text give a text for trigger
// here we have trigger per se
// ModalEdit can narrow returned value

// nscf PopupModal always call triggers as function!

export function Popup ({ref, name, value, onChange, onBlur
    , trigger, decode, title, placeholder = '', empty = ''
    , narrowValue, ...props}) {
  let decoded_value = applyEx(decode,value)
  return <PopupModal ref={ref}
            trigger={ trigger
            	?? <Button 
                          className="select"
                          readOnly={props.readOnly}
                          title={title}
                >{applyPlaceholder(decoded_value, props.readOnly?empty:placeholder)}</Button>
              }
            onClose={async value=>{
              if(value===undefined) return;
		          if(narrowValue) value = await narrowValue(value);
              if(value===undefined) return;
              onChange?.(fakeEvent(name,value))
	            await defer()
              onBlur?.(fakeEvent(name))
            }}
            {...props}
          />
}

Popup.TriggerButton = PopupModal.TriggerButton;
Popup.TriggerLink = PopupModal.TriggerLink;



export function Check ({ref, data, name, value, onChange, onBlur
  , readOnly, ...props}) {
  const options = data ?? [null,true];
  return <input {...htmlProps(props, ref)} type="checkbox" className="checkbox" name={name} disabled={readOnly}
      checked={value!==options[0] && value!==null} 
      onChange={(e) => { if(readOnly) return;
          onChange?.(fakeEvent(e.target.name,
              e.target.checked?
                options[1] : options[0]
            ))
          onBlur?.(e)
      }} 
    />
}

export function InlineSelect ({ref, data, name, value, onChange, onBlur
  , readOnly, ...props}) {
  return <span {...htmlProps(props, ref, ['input', 'select'])} >
      {
        Object.entries(data)
        .filter(([k])=>k!=='') // skip empty val
        .map( ([k,v]) => 
            <Button name={name} key={k} value={k}
                  className={value === k? 'selected' : null} 
                  onClick={(e) => {
                    if(readOnly) return;
                    onChange?.(fakeEvent(e.target.name,
                        value===e.target.value?'':e.target.value
                      ))
                    onBlur?.(e)
                  }} 
            >{v}</Button> 
        )
      }
    </span>
}

export function SelectButton ({ref, value, children, ...props}) { 
  return props.readOnly ? <span {...htmlProps(props, ref, 'input')} >{find_in_options(value, children)}</span>
  :
    //replace null <-> ''
   <select {...htmlProps(props, ref)}  className={`button ${props.className??''}`}
    value={value??''}  
    onChange={e=>{
      if(e.target.value === '')
            return props.onChange?.(fakeEvent(e.target.name, null))
        props.onChange?.(e)
    }}
    autoComplete="off"
    >{children}</select>
}

export function Select({ref, value, children, ...props}) { 
  return props.readOnly ? <span {...htmlProps(props, ref, 'input')} >{find_in_options(value, children)}</span>
  :
  	//replace null <-> ''
   <select {...htmlProps(props, ref)} 
   	value={value??''}  
   	onChange={e=>{
   		if(e.target.value === '')
            return props.onChange?.(fakeEvent(e.target.name, null))
        props.onChange?.(e)
   	}}
    autoComplete="off"
    >{children}</select>
}

export function SelectInt({ref, onChange, ...props}) { 
  return <Select ref={ref} {...props} 
  onChange={(e)=>{
    onChange?.(fakeEvent(e.target.name, +e.target.value))
  }} />
}

export function SelectData({ref, data, empty, ...props}) {
  if (empty) data = Object.fromEntries(Object.entries(data).filter(([k]) => k) );
  return <Select {...props} ref={ref} >
          {empty!==undefined && <option value="">{empty}</option>}
          { Object.entries(data)
              .map( ([k,v]) =>
                  <option key={k} value={k}>{v}</option>
              )
          }
      </Select>
}

export function SelectArray ({ref, data, empty, ...props}) {
  return <Select {...props} ref={ref} >
          {empty!==undefined && <option value="">{empty}</option>}
          { data.map( v =>
                  <option key={v} value={v}>{v}</option>
              )
          }
      </Select>
}

export function SelectYesNoRU({ref, onChange, value
                                              , yes, no, className
                                              , ...props}) {
    return props.readOnly? <span>{
          value === true? yes??"Да" : value === false? no??"Нет" : ''
        }</span>
        : <button type="button" {...htmlProps(props,ref)} className={`SelectYesNoRU ${className??''}`}
               onClick={(e) => {
                   onChange?.(fakeEvent(props.name,
                       e.target.dataset.value !== undefined ?
                          Boolean(e.target.dataset.value) 
                      : null
                   ))
               }}
               onKeyDown={e=>{
                switch(e.key) {
                case "ArrowRight": onChange?.(fakeEvent(props.name, false)); break;
                case "ArrowLeft": onChange?.(fakeEvent(props.name, true)); break;
                case " ": onChange?.(fakeEvent(props.name, null)); break;
                }
               }}
               value={value===true?'1':value===false?'0':'-'}
            >
       <span data-value="1">{yes??"Да"}</span>{' / '}<span data-value="">{no??"Нет"}</span>
        </button>
}

/*
  how inlineSelect, Select etc deals with nulls?
  they tooks their data form oject ({key: value}) 
  as this is for our enums only
  null is much more important than empty string
  so, convert
*/


function find_in_options(value, options) {
  for(const c of options)
    if(Array.isArray(c)) {
      for(const ca of c)
        if(ca.props.value === value) 
          return ca.props.children
    } else if(c.props !== undefined && c.props !== null &&
        c.props.value === value) 
      return c.props.children
  return ''
}

const byteToHex = [];

for (let n = 0; n <= 0xff; ++n)
{
    const hexOctet = n.toString(16).padStart(2, "0");
    byteToHex.push(hexOctet);
}

function hex(arrayBuffer)
{
    const buff = new Uint8Array(arrayBuffer);
    const hexOctets = []; // new Array(buff.length) is even faster (preallocates necessary array size), then use hexOctets[i] instead of .push()

    for (let i = 0; i < buff.length; ++i)
        hexOctets.push(byteToHex[buff[i]]);

    return hexOctets.join("");
}

export function readFileAsTypeHex(value) {
  return new Promise((resolve, reject)=>{
    const reader = new FileReader()
    reader.onload = async () => { 
        const ab = reader.result;
        const mtype = await fileTypeFromBuffer(ab)
        resolve([hex(ab),mtype?.mime])
      }
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(value)
  })
}


function readFileAsTypeB64(value) {
  return new Promise((resolve, reject)=>{
    const reader = new FileReader()
    reader.onload = async () => { 
        const ab = reader.result;
        const mtype = await fileTypeFromBuffer(ab)
        resolve([await base64ArrayBuffer(ab),mtype?.mime])
      }
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(value)
  })
}

export async function fileToJSON(value) {
  const [b64,mtype] = await readFileAsTypeB64(value)
  //TODO: use dynamic import for mimeLookup
  return {
   fileName: value.name
    , fileType: (mtype ?? mimeLookup(value.name)) || 'application/octet-stream' //value.type
    , dataB64: b64
    , fileID: await getGlobalUniqueCode()
  }
}

/**
 * value is a struct {
  * filename, 
  * filemime,
  * storage,
  * id (value or array)
  * filedata (or null to delete file)
 * }
 * name point this struct in an local store
 * it is much better if we have name as usage
 * new.files.Usage point to file struct
 * new.files.usage point to files array (with own id) (how is it sorted?)
 * so, name is
 * files.<Usage> or files.<usage>.<id>
 * 
 * and url is 
 * blob/<docid>/name
 * or
 * file/<storage>/<dataKey>/name
 */

const defMaxFileSize = 10;

export function File({value, name, readOnly, onChange, onBlur, storageID
                         , maxFileSize, skipSizeNote, ...props}) {
    const mfs = maxFileSize??defMaxFileSize
    return <>
        {!readOnly && !skipSizeNote && <dfn>Размер файла не должен превышать {mfs} Мб{props?.accept==="application/pdf" && ", формат файла .pdf"}</dfn>}
        <div className="flexBox gap">
            <FileLink name={name} value={value} storageID={storageID} />
            {!readOnly && value &&
                <Button name={name}
                        onClick={async ()=>{
                            await confirm('Удалить?', true)
                            onChange?.(fakeEvent(name,null))
                        }}
                >Удалить файл</Button>}
            {!readOnly &&  <label className="button">
                {value? 'Заменить файл':'Выберите файл'}
                <input type="file" {...props}
                       name={name}
                       style={{width:0, height:0, overflow:"hidden"}}
                       onChange={async (e)=>{
                           if(e.target.files[0]) {
                               if(e.target.files[0].size > mfs*1024*1024 )
                                   await alert(`Размер файла не должен превышать ${mfs} Мб!`);
                               else
                                   onChange?.(fakeEvent(e.target.name, await fileToJSON(e.target.files[0])))
                           } else {
                               //do nothing
                           }
                           onBlur?.(e)
                       }}
                />
            </label>
            }
        </div>
    </>
}

export function Pdf({value, name, readOnly, onChange, onBlur, storageID
                         , maxFileSize, skipSizeNote, maxPages, ...props}) {
    const mfs = maxFileSize??defMaxFileSize
    return <>
        {!readOnly && !skipSizeNote && <dfn>Размер файла не должен превышать {mfs} Мб, формат файла .pdf</dfn>}
        <div className="flexBox gap">
            <FileLink name={name} value={value} storageID={storageID} />
            {!readOnly && value &&
                <Button name={name}
                        onClick={async ()=>{
                            await confirm('Удалить?', true)
                            onChange?.(fakeEvent(name,null))
                        }}
                >Удалить файл</Button>}
            {!readOnly &&  <label className="button">
                {value? 'Заменить файл':'Выберите файл'}
                <input type="file" {...props}
                       name={name}
                       style={{width:0, height:0, overflow:"hidden"}}
                       onChange={async (e)=>{
                           if(e.target.files[0]) {
                               const reader = new FileReader();
                               reader.readAsArrayBuffer(e.target.files[0]);
                               reader.onloadend = async () => {
                                   if(e.target.files[0].size > mfs*1024*1024 ) {
                                       await alert(`Размер файла не должен превышать ${mfs} Мб!`);
                                       return;
                                   }
                                   const pdfDoc = pdfjs.getDocument(reader.result);
                                   const pdf = await pdfDoc.promise;
                                   const pages = pdf?._pdfInfo?.numPages;
                                   if(maxPages && pages > maxPages) {
                                       await alert(`Сформированный файл имеет более ${maxPages} страниц.
                                          Необходимо сократить объем введенного текста до ${maxPages} страниц включительно и повторить действие.`);
                                       return;
                                   }
                                   onChange?.(fakeEvent(e.target.name, await fileToJSON(e.target.files[0])))
                               }
                           } else {
                               //do nothing
                           }
                           onBlur?.(e)
                       }}
                />
            </label>
            }
        </div>
    </>
}

function FileLink() {

}

/*
  Файл может быть
  1) глобальный. тогда он имеет глобальное уникальное имя
    и ссылку вида /file/subsystem/unique-ref
  2) локальный. тогда он должен быть в IDB
    и там иметь ссылку вида
      /blob/doc-key/unique-ref

  отличаются они по наличию 

*/

// function decodeType(type) {
//   const types = {
//     'application/pdf': 'pdf'
//     , 'image/png': 'png'
//     , 'image/jpeg': 'jpg'
//   }
//   return types[type]
// }

// export function FileLink({value, name, placeholder, storageID, fileName='file', children, ...props}) {
//   const subsystem = useSubsystemApi().subsystem ?? '---'
//   const url = !!value && 
//     (storageID?
//     `/blob/${subsystem}/${storageID}/${value.fileID}/${fileName}.${decodeType(value.fileType)}`
//     :
//     `/file/${subsystem}/${value.fileID}/${fileName}.${decodeType(value.fileType)}`
//     );
//   return url &&
//         <a className="button" href={url}
//                 target="_blank" rel="opener"
//                 {...props}
//               >{children ?? 'Открыть файл'}
//             </a>
//         || placeholder
// }


export function HtmlValue({value, ...props}) {

  if(!value) return;

  return <div {...props} dangerouslySetInnerHTML={{__html:value}} />
}
