import {createContext, use, useState, useEffect, useCallback, useRef} from 'react';
import {createPortal} from 'react-dom';
import {createRoot} from 'react-dom/client';

import { Link } from "react-router-dom";

import { classes } from '../helpers.mjs'
import { /*getXY,*/ applyProps} from '../ui-helpers.mjs'

import * as css from './modals.module.css'

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


//const focusableSelector = "INPUT,TEXTAREA,SELECT,BUTTON";


export function useModals() {
	const [element, setOpen] = useState()

	const showModal = useCallback((element, modalProps = {}, bindProps = {}, triggerElem = null) => {
		const {
			closeBox = false, closeBy = "any"
			, framed = true, className, style, width, height		
		} = modalProps
	
		const {x:bindX, y:bindY, position} = bindProps;

		const adjustPos = !triggerElem || !bindX && !bindY ? null :

			() => {

			//const {x=0,y=0,w=0,h=0} = getXY(triggerElem) || {}
			const {left=0,top=0,width=0,height=0} = triggerElem.getBoundingClientRect()

			return position?.(left,top,width,height) ?? { x: bindX === 'right'? left+width : left
    		 					, y: bindY === 'bottom'? top : top+height
    		 					}
    	}

    	let currentPos = { x:0, y:0 }

		let popupStyle =  { ...style, overflow: 'auto', width, height}
		if(adjustPos) {
			currentPos = adjustPos()
			if(bindX) popupStyle[bindX] = `${currentPos.x}px`;
			if(bindY) popupStyle[bindY] = `${currentPos.y}px`;
		}

		let dialogNode = null;

		function modalRefChanged(node) {
		  	if(node) {
		  		dialogNode = node
		  		dialogNode.showModal()
		  		//const to_focus = dialogNode.querySelector(toFocus);
		  		//console.log('to_focus', to_focus, node, node.children.length);
		  		//(to_focus||dialogNode).focus()
		  	}		
		}

		let ival;
		if(adjustPos) {
			ival = setInterval(()=>{
				if(!dialogNode) return;
				const np = adjustPos()
				if(currentPos.x === np.x && currentPos.y === np.y) return
				currentPos = np;
				if(bindX) dialogNode.style[bindX] = `${currentPos.x}px`
				if(bindY) dialogNode.style[bindY] = `${currentPos.y}px`
			}, 10)
		}

	    const {promise, resolve} = Promise.withResolvers();

	    function close(value) {
	    	resolve(value)
	    	setOpen()
	    	if(ival) clearInterval(ival)
	    }

	    element = applyEx(element, close)

		setOpen(<dialog style={popupStyle} 
				className={className} 
				ref={modalRefChanged}
				closedby={closeBy}
				onCancel={()=>close()}
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
		{element && createPortal((element), document.getElementById('modals'))}
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

export function TriggerButton({readOnly,children}) {
	return handlers=>readOnly? <span>{children}</span>
			: <aligned-button {...handlers}>{children}</aligned-button>
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
	return <aligned-button className={css.modalButton}
		{...props}
		onClick={(e)=>{
			props.onClick?.(e)
			close(props.value)
		}}
	/>
}

export function Cancel(props) {
	const close = useModalContext();
	return <aligned-button className={css.modalButton}
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

export let globalShowModal = null;

export function GlobalModals({children}) {
	const showModal = useModals()
	globalShowModal = showModal;

	return <showModal.Portal>{children}</showModal.Portal>
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

