import {useState,useEffect, useMemo, cloneElement} from 'react';

export function applyProps(element_or_function, props) {
  if(Function.isFunction(element_or_function)) return element_or_function(props)
  return cloneElement(element_or_function, props)
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