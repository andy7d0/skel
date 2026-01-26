import {useState,useEffect,createElement, forwardRef, useMemo} from 'react';

export function renderWithProps(componet,props,...children) {
  if(typeof componet === "function") {
    return createElement(componet,props,...children)
  }
  return componet;
}

export function isFixedPosition(e) {
  while(e) {
    if(e === window.document.body)
      return false;
    e = e.offsetParent
  }
  return true;
}

export function getXY(elem) {
	var box = elem.getBoundingClientRect();

  var fixed = isFixedPosition(elem);

	var body = document.body;
	var docElem = document.documentElement;

	var scrollTop = window.pageYOffset || docElem.scrollTop || body.scrollTop;
	var scrollLeft = window.pageXOffset || docElem.scrollLeft || body.scrollLeft;

	var clientTop = docElem.clientTop || body.clientTop || 0;
	var clientLeft = docElem.clientLeft || body.clientLeft || 0;

	var top  = fixed? box.top : box.top +  scrollTop - clientTop;
	var left = fixed? box.left : box.left + scrollLeft - clientLeft;

	return { x: Math.round(left), y: Math.round(top) 
			, w: Math.round(box.right) - Math.round(box.left)
			, h: Math.round(box.bottom) - Math.round(box.top)
      , fixed
		}
}


export function mousePos(event) {
  var bounds = event.target.getBoundingClientRect();
  var x = event.clientX - bounds.left;
  var y = event.clientY - bounds.top;
  return {x,y};
}


/**
 *    use deffered initialized state
 *    
 */
export function useAsyncState(calculate, args, initial) {
  const ret = useState()
  const [, setState] = ret
  useEffect(()=>{
    if(initial !== undefined) {
      setState(()=>initial)
      return;
    }
    setState(null)
    calculate(...args).then(
      s => {
        setState(() => s)
        return null
      }
    )
  }
  // eslint-disable-next-line exhaustive-deps
  , [setState,calculate,initial, ...args])
  return ret;
}

/**
 *  no-op setValue like react
 */

export function noOpSetValue(value) {
  return (f) => typeof f === 'function' ? f(value) : undefined
}

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

/**
 * convert extrenal repsentation to editable text
 * if extrenal is not-a-value, use last known edited value directly
 */
export function useLocalEditValue(value, transform) {
    let [lastValue, setLastValue] = useState('')
    if(!validValue(value)) return [lastValue, setLastValue]
    if(value === null) {
      return ['', setLastValue];
    }
    // replace with new known good
    const current = transform?.(value, lastValue)??value
    return [current, setLastValue];
}


  /* Identical styling required!! */
//FIXME:!!!
const taStyles = {
  border: "1px solid #AAAAAA"
  , padding: "0.5rem"
  , margin: 0
  , font: 'inherit'
  , gridArea: "1 / 1 / 2 / 2"
  , overflow: 'hidden'
  , whiteSpace:'pre-wrap'
  , resize: 'none'
}

export const AutosizeTextarea = forwardRef((props,ref)=>
  <div style={{display: "grid", width:"100%"}} className="textarea">
          <textarea ref={ref} {...props} className=""
            style={{...props.style, ...taStyles}} 
          />
          <pre style={{...props.style, visibility: 'hidden', ...taStyles}}
          >{`${props.value??''} `}</pre>
  </div>
)

export function asyncStateValue(reducer) {
  return new Promise(resolve=>{
    reducer(state=> {
      resolve(state)
      return state;
    })
  })
}

export function refSetFocus(node) {
  if(node) {
    node.focus()
  }
}


export function useKeyedAsync(fetcher) {
  const [st, setSt] = useState({})
  return (key,...args) => {
    if(st[key] !== undefined) return st[key];
    fetcher(key, ...args).then(v => setSt(st=>({...st,[key]: v})) )
  }
}


export function useEffectStrictMode(func, deps) {
  // eslint-disable-next-line exhaustive-deps
  const go = useMemo(()=>({current:(true)}), deps)
  useEffect(()=>{
    if(go.current) {
      go.current = false;
      return func();
    }
  // eslint-disable-next-line exhaustive-deps
  },[go, func, ...deps])
}