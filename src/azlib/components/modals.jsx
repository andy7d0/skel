import {createContext, use, useState, useEffect, useCallback, useRef} from 'react';
import {Button} from 'azlib/components/tags'
import {createPortal} from 'react-dom';
import {createRoot} from 'react-dom/client';

import { Link } from "react-router-dom";

import { later, classes } from '../helpers.mjs'
import { AutosizeTextarea, getXY, applyProps} from '../ui-helpers.mjs'

import css from './modals.module.css'
import {Date} from "./controls";

// eslint-disable click-events-have-key-events no-noninteractive-tabindex
//tabindex-no-positive

const ModalContext = createContext(()=>{})
export const useModalContext = () => use(ModalContext)

export const PopupFrameContext = createContext(false);
export const usePopupFrameContext = () => use(PopupFrameContext)


export function PopupFrame({className, children, ...props}) {
	return <div className={classes(className, css.PopupFrame)} {...props}>
		<PopupFrameContext value={true} children={children} />
	</div>
}


//NOTE: last child is modal is topmost modal 
//  (we create modal portals there!)
// so, we chould check focus there

// document.addEventListener('blur', (e) => {
// 	//console.log(e.target, e.relatedTarget)
// 	const topmost_modal = 
// 		document.getElementById('modals')
// 		.lastChild
// 	if(e.relatedTarget &&
// 		topmost_modal && 
// 		!topmost_modal.contains(e.relatedTarget)) 
// 	{
// 		topmost_modal.focus()
// 		console.log('restore focus to',topmost_modal)
// 	}
// }, true)

// function ShadowDiv({close}) {
// 	const shadowRef = useRef() 

// 	useEffect(()=>{

// 		const wheel = (e)=>{e.preventDefault()}
// 		const DOMMouseScroll = (e)=>{e.preventDefault()}

// 		const element = shadowRef.current

// 		element.addEventListener('wheel',wheel)
// 		element.addEventListener('DOMMouseScroll',DOMMouseScroll)
// 		return () => {
//       		element.removeEventListener('wheel', wheel);
//       		element.removeEventListener('DOMMouseScroll', DOMMouseScroll);
//     	};
// 	}, [])

// 	return <div style={{
// 			position:"fixed",
// 			left:0, top:0,
// 			width:"100%", height:"100%",
// 		}} 
// 		ref={shadowRef}
// 		className="shadow"
// 		onClick={() => close?.()}
// 	/>
// }


const focusableSelector = "INPUT,TEXTAREA,SELECT,BUTTON";


export function useModals() {
	const [element, setOpen] = useState({})

	const showModal = useCallback((element, modalProps = {}, bindProps = {}, triggerElem = null) => {
		const {
			closeBox = false, closeWithEsc = true, closeWithClick = true
			, toFocus = focusableSelector
			, framed = true, className, style, width, height		
		} = modalProps
	
		const {x:bindX, y:bindY, position} = bindProps;

		const adjustPos = !triggerElem || !bindX && !bindY ? null :

			() => {

			const {x=0,y=0,w=0,h=0} = getXY(triggerElem) || {}

			return position?.(x,y,w,h) ?? { x: bindX === 'right'? x+w : x
    		 					, y: bindY === 'bottom'? y : y+h
    		 					}
    	}

    	let currentPos = { x:0, y:0 }

		let popupStyle = adjustPos ?
		{
			...style
			, position: 'absolute'
			, [bindX]: bindX==='right'? document.body.offsetWidth - currentPos.x
							: currentPos.x
			, [bindY]: bindY==='bottom'? -currentPos.y
							: currentPos.y
			, width
			, height
		}
		:
		{
			...style
			, position:'fixed'
			, top: "50%", left:"50%"
			, transform: "translate(-50%, -50%)"
			, maxWidth: "100vw", maxHeight: "95vh"
			, overflow: "auto"
			, width
			, height
		}

		let dialogNode = null;

		function modalRefChanged(node) {
		  	if(node) {
		  		dialogNode = node
		  		dialogNode.showModal()
		  		const to_focus = dialogNode.querySelector(toFocus);
		  		//console.log('to_focus', to_focus, node, node.children.length);
		  		(to_focus||dialogNode).focus()
		  	}		
		}

		let ival;
		if(adjustPos) {
			ival = setInterval(()=>{
				if(!dialogNode) return;
				const np = adjustPos()
				if(currentPos.x === np.x && currentPos.y === np.y) return
				currentPos = np;
				dialogNode.style[bindX] = 
							bindX==='right'? document.body.offsetWidth - currentPos.x
							: currentPos.x
				dialogNode.style[bindX] = 
							bindY==='bottom'? -currentPos.y
							: currentPos.y
			}, 10)
		}

	    const {promise, resolve} = Promise.withResolvers();

	    function close(value) {
	    	resolve(value)
	    	if(ival) clearInterval(ival)
	    }

	    element = applyEx(element, close)

		setOpen(<dialog style={popupStyle} className={className} 
				onKeyDown={(e) => { if(closeWithEsc && e.keyCode === 27) close() } }
				ref={modalRefChanged}
				tabIndex="0"
				onClick={event=>{
					  if(!closeWithClick || !dialogNode) return;
					  const rect = dialogNode.getBoundingClientRect();
					  const isInDialog = (rect.top <= event.clientY && event.clientY <= rect.top + rect.height &&
					    rect.left <= event.clientX && event.clientX <= rect.left + rect.width);
					  if (!isInDialog) close();
					 }
					}
				>
				{closeBox && <div className={css.closeBox} onClick={ ()=>close() }/>}
				<PopupFrameContext value={framed}>
					<ModalContext value={close} children={element} />
				</PopupFrameContext>
			</dialog>			
		)

		return promise;
		}
	,[setOpen])

	showModal.Portal = ({children})=> <>
		{element && createPortal(element, document.getElementById('modals'))}
		{applyEx(children, showModal)}
	</>

	return showModal;
}

export function WithModals({children}) {
	const showModal = useModals()
	return <showModal.Portal>{children}</showModal.Portal>
}


/*
	сейчас popup добавляет в trigger - произвольный элемент - onClick

	это включает магию
	- НЕ ВО ВСЕ элементы можно добавить события
	- что делать, если событие уже есть

	в этом смысле лучше, если триггер вызывает код явно
	или, например, передает ref - который все равно нужен

	попробует "от ref"
	мы имеем triggerRef

	и передаем triggerRef как ref в триггер - это будет всегда DOM Element

	в целом, от trigger нам надо ДВЕ вещи
	- позиция (иногда)
	- событие - всегда (в этом и смысл)

	пока так:
  <PopupModal trigger={<button>...</button>}>
  	... items ...
  </PopupModal>	

	но это требует hack на trigger
	в целом, render для trigger зависит от PopupModal (передается callback)
  По уму, trigger должен сам зарегистироваться в Popup
  - магически?
  - через Effect
  - используя контекст

  useEffect требует компонента и все равно требует Ref (что не проблема, т.к. там уже по делу!)
  при этом Popup просто определяем контекст для trigger
	часто, этот контекст нужен прямо тут, можно render props

  <PopupModal trigger={(handlers, props)=><button {...handlers}>...</button>}>
  	... items ...
  </PopupModal>	

	это может сработать

*/

/**
 * PopupModal
 * props
 * trigger: ({ref,onClick}) => element
 * 			, click on them trigger popup
 * 			of element to close and set props
 * bindPos.x: left or right popup side binded to trigger
 * bindPos.y: top or bottom popup side binded to trigger
 * bindPos.position: function to recalculate (usually offset) popup position
 * modalProps.closeBox: draw gui box to close modal
 * modalProps.className: className of the popped element (PopupFrame by default)
 * modalProps.style
 * modalProps.width
 * modalProps.height
 * modalProps.closeWithEsc
 * modalProps.closeWithClick
 * modalProps.framed
 * modalProps.toFocus
 * onClose: (result) => {...}
*/
export function PopupModal({
		trigger, ref
		, onClose, readOnly
    	, bindPos = {}
    	, modalProps = {}
    	, children}
) {
	const triggerRef = useRef()
	const uRef = ref ?? triggerRef;
	const showModal = useModals()

	return <showModal.Portal>{applyProps(trigger, {ref: uRef
		, readOnly
		, onClick:
			async e=>{
				e.preventDefault(); e.stopPropagation();
				if(!readOnly) {
					const r = await showModal(children, modalProps, bindPos, uRef.current)
					onClose?.(r)
				}				
			}
		})}</showModal.Portal>
}

export function TriggerButton({props}) {
	return handlers=>props.readOnly? props.children
			: <Button {...handlers} {...props} />
}
PopupModal.Button = TriggerButton;

/**
 * MenuLink like Link from router but autoclose nearest modal
 * 
*/
export function ModalLink(props) {
	const close = useModalContext();
	return <Link {...props} onClick={() => close(props.value)}/>;
}

export function ModalButton(props) {
	const close = useModalContext();
	return <Button className={css.modalButton}
		{...props}
		onClick={(e)=>{
			props.onClick?.(e)
			close(props.value)
		}}
	/>
}

export function Cancel(props) {
	const close = useModalContext();
	return <Button className={css.modalButton}
		{...props}
		onClick={(e)=>{
			props.onClick?.(e)
			close()
		}}
	/>
}

function ModalProcessing({operation, UI}) {
	const hide = useModalContext();
	const [ state, updateUI ] = useState()
	useEffect(()=>{
		updateUI({})
		operation(updateUI) // can be multistage promice
		.then((ret)=>hide(ret))
		.catch(()=>hide())
	},[hide, updateUI, operation]); //once!
	return state && <UI {...state} />; // show UI when operation started only
}

/**
 * lock UI until processing ends
 * 
 * operation: (updateUI: (value, {resolve, reject}) => {}) => value
 * <Component state={state} update={updateState} />
 * 
 * state object (with arbitary content} shared between 
 * - Component (as state property)
 * - and operation (as it's own state)
 *  
 * if operation needs interaction it can 
 * 		updateUI with some value and component shows corresponding UI
 * 		in this case  operation should wait on newly created promise
 * 		and pass 'resolve/reject' to updateUI
 * 		which UI calls later
 * 
 * if UI decided to cancel operations (or pass anither info there)
 * 		it just set something in state
 * 		and operation 
 * 
 * i.e. operation(updateUI) {
 * 
 * 	....
 * 		check state if UI pass something like cancel request
 * 			like while(!state.cancel) { ... do code ... }
 *      also, state.cancel can be signal with AbortController
 * 
 *  .... also, with somthing like that op inform UI about progress
 *      while(....) {
 *          notifyUI({processed, total})
 *      }
 * 
 * ....  also, if op request interaction it can do:
 *      while(...) {
 *          ...
 *              res = await new Promise(resolve,reject) {
												updateUI(state=>({...state, request, resolve, reject}))
											}
 *          ...
 *      }
 *      or construct modal UI on its own
 * ...  also, to terminate the operation just returns value
 * }
 * 
 */
/**
 * <WithModals>{showModal=>.... onClick={()=>showModalProcessing(showModal, operation, UI) }} ...}</WithModals>
 * or
 * showModal = useModals()
 * ...
 * 	<showModal.Portal>.....onClick={()=>{showModalProcessing(showModal, operation, UI)}} </showModal.Portal>
 */
export function showModalProcessing(showModal, operation, UI)
{
	return showModal(<ModalProcessing 
			operation={operation}
			UI={UI}
		/>
	)
}

let globalShowModal = null;

export function GlobalModals({children}) {
	const showModal = useModals()
	globalShowModal = showModal;

	return <showModal.Portal>{children}</showModal.Portal>
}

export function alert(text) {
	return globalShowModal(
		<div className={css.alertBox}>
			<div>{text}</div>
			<footer>
			<ModalButton>OK</ModalButton>
			</footer>
		</div>
	)
	.catch(()=>{})
}

/**
 *   required - throw instead returning false
 */
export function confirm(text,required) {
	return globalShowModal(
		<div className={css.confirmBox}>
			<div>{text}</div>
			<footer>
			<ModalButton value={true}>Да</ModalButton>
			<ModalButton value={false}>Нет</ModalButton>
			</footer>
		</div>
	)
	.catch(()=>false)
	.then(r => {
		if(!r && required) throw null;
		return r;
	})
}

function Prompt({caption, initial, props}) {
	const close = useModalContext();
	const [text,setText] = useState(initial||'')
	const arrayPhrases = props.arrayPhrases;
	return <>
			<header>{caption}</header>
			<input value={text}
			onChange={e=>setText(e.target.value)} 
			onKeyDown={e=>{
					if(e.keyCode === 13) 
						later(0,text).then(close) //NOTE: defer resolves too early! so, wait in timer
					}} 
		  autoComplete="off"
		  {...props.inputProps}
			/>
			{arrayPhrases.length > 1 &&
				<ul>
					{arrayPhrases.map((item, key) => (
							<li onClick={()=>setText(item)} key={key}><hr/>{item}</li>
					))}
				</ul>
			}
			{props?.tip && <dfn>{props?.tip}</dfn>}
			<footer>
			<ModalButton value={text}>Ок</ModalButton>
			<ModalButton>Отмена</ModalButton>
			</footer>
		</>
}

/**
 * props.required - throws
 */
export function prompt(caption, initial, props = {}) {
	props.arrayPhrases ??= []
	return globalShowModal(
		<div className={css.promptBox}>
			<Prompt caption={caption} initial={`${initial}`} props={props} />
		</div>
	)
	.catch(()=>null)
	.then(text=>{
		if(text === null) {
			if(props.required) throw null;
			return null;
		}
		if(!props.asIs) text = text.trim()
		if(!text && props.required) throw null;
		return text;
	})
}

function PromptBig({caption, initial, props}) {
	const close = useModalContext();
	const [text,setText] = useState(initial||'')
	return <>
			<header>{caption}</header>
			<AutosizeTextarea value={text} 
			style={{width:"30em", maxWidth: "90vw"}}
			onChange={e=>setText(e.target.value)} 
			onKeyDown={e=>{
					if(e.keyCode === 13 && e.shiftKey) 
						later(0,text).then(close) //NOTE: defer resolves too early! so, wait in timer
					}} 
			 {...props.inputProps}
			/>
			<footer>
			<ModalButton value={text}>OK</ModalButton>
			<ModalButton>Отмена</ModalButton>
			</footer>
		</>
}
//FIXME: remove one div level
export function promptBig(caption, initial, props = {}) {
	if(typeof props === 'boolean')
		props = { required: props }
	return globalShowModal(
		<div className={css.promptBox}>
			<PromptBig caption={caption} initial={initial} props={props} /> 
		</div>
	)
	.catch(()=>null)
	.then(text=>{
		if(text === null) {
			if(props.required) throw null;
			return null;
		}
		if(!text && props.required) throw null;
		return text;
	})
}

function PromptDate({caption, initial, props}) {
	const [date,setDate] = useState(initial||'')
	return <>
		<header style={{fontSize:"12pt"}}><b>{caption}</b></header>
		<Date value={date}
			  onChange={e=>setDate(e.target.value)}
			  {...props.inputProps}/>
		<footer>
			<ModalButton value={date}>OK</ModalButton>
			<ModalButton>Отмена</ModalButton>
		</footer>
	</>
}
export function promptDate(caption, initial, props = {}) {
	return globalShowModal(
		<div className={css.promptBox}>
			<PromptDate caption={caption} initial={initial} props={props} />
		</div>
	)
		.catch(()=>null)
		.then(text=>{
			if(text === null) {
				if(props.required) throw null;
				return null;
			}
			if(!text && props.required) throw null;
			return text;
		})
}

/**
*   usage
* 	{
*   	const loading = useLoadingMessage(....)
* 		...
* 		try {
	* 		loading.show()
	* 		....
* 		} finally {
	* 		loading.hide()
* 		}
*/

export function useModalMessage() {
	// let previousFocus; 
	let elem = null;
	let root = null;
  	return {
  		show: (message  = 'обработка действия') => {
  			//previousFocus = document.activeElement
			elem = document.getElementById('modals').appendChild(document.createElement('dialog'));
			elem.showModal()
		    root = createRoot(elem); //FIXME: use already existring root!
		    root.render(applyEx(message))
  		}
  		, hide: () => {
			root?.render(null)
			elem?.close()
			elem?.remove()
		  	//if(previousFocus) defer().then(()=>previousFocus.focus())
  		}
  	}
}

