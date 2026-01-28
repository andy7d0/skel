import {useState, useEffect, useMemo /*TODO:, useDefferedState*/} from 'react'

import {debounceImmidiate, debounceSerialized} from 'azlib/helpers.mjs'

import {Popup} from 'azlib/components/controls.jsx'
import {ModalButton} from './modals'

import {useSubsystemApi} from 'azlib/doctype-registry'

import {SearchFilter, useFilterState} from './search_filter'

export {useFilterState} from './search_filter'

function ClassifierSelect({obj, required, filter, selectable, showKeys = true, caption, sort}) {
	let [cfilter, setFilter] = useState()

	const wfilter = cfilter?.toUpperCase();

	const isArray = Array.isArray(obj);

	return <>
		{caption}
		<div><SearchFilter onChange={(e)=>{
			setFilter(e.target.value.trim())
		}} 
			style={{width:"90%", margin:"0 auto 1em auto"
					, position: "sticky"
				    , top: "16px"
				    , left: 0
				    , background: "white"
				    , zIndex: 1
			}}
			autoComplete="off"
		/>
		</div>
		<div style={{height:"80vh", width:"90vw", overflow:"auto", position:"relative"}}>
			{!required && <ModalButton
					value={null}
					className="block flat"
				>
					{!isArray && showKeys && <div>-- Не выбрано --</div>}
					<div>&nbsp;</div>
				</ModalButton>
			}
		{
			Object.entries(obj)
			.filter(filter??(()=>true))
			.filter(([k,v])=>
				!wfilter
				|| !isArray && k && k.toUpperCase().indexOf(wfilter) >= 0
				|| v && v.toUpperCase().indexOf(wfilter) >= 0
			)
			.toSorted(([ka],[kb])=>(sort ? cmp(ka, kb) : 0))
			.map(([k,v])=>
				!selectable || selectable(k,v) ?<ModalButton key={k} 
					value={isArray?v:k}
					className="block flat"
				>
					{!isArray && showKeys && <div>{k}</div>}
					<div>{v}</div>
				</ModalButton>
				: <div className="block  flat" key={k} style={{opacity:"50%"}}>
					{!isArray && showKeys && <div>{k}</div>}
					<div>{v}</div>
				</div>
			)
		}
		</div>
	</>
}

ClassifierSelect.modalProps = { closeBox: true }

export function promptClassifier(showModal, obj, props) {
	return showModal(<ClassifierSelect obj={obj} {...props} />)
}

export function ClassifierEdit({ref, obj, required, filter, selectable
	, showKeys = true, decode, placeholder, empty
	, caption, sort, ...props}) {
	return <Popup ref={ref} {...props}
		placeholder={placeholder} empty={empty}
		decode={decode ?? (showKeys ? v=>v : v=>obj[v]??v)}
	>
		<ClassifierSelect obj={obj} 
			required={required} filter={filter} selectable={selectable} 
			showKeys={showKeys} caption={caption} sort={sort}
		/>
	</Popup>
}

export function useCatalog(fetch, serverFilter = null, frequence = 500) {
	const subsystemApi = useSubsystemApi()

	const [data,setData] = useState()
	const [edited, setFilterParam] = useFilterState()

	const [actualFilter, setActualFilter] = useState({})

	// translate filter to actualFilter (which is initiate fetch)
	// no frequent than once per 500ms 
	const setActualFilterT = 
		useMemo(()=>debounceImmidiate(setActualFilter,frequence)
			, [setActualFilter, frequence])

	useEffect(()=>{setActualFilterT(edited)}, [edited, setActualFilterT]);

	const [lastFetched, setLastFetched] = useState(null)

	// fetch values sequentially
	const fetchT = useMemo(() => 
			debounceSerialized(
					async filter => {
                    	const data = await fetch({...serverFilter, ...filter}
                    		, subsystemApi
                    		, filter
                    	)
                        setLastFetched(filter);
                        setData(data)
                        }
				)
		,[fetch, setLastFetched, serverFilter, subsystemApi])
	useEffect(()=>{
		fetchT(actualFilter)
	}, [actualFilter, fetchT])

	//withData(initial)(data=>UI)

	return {
		data,
		withData(ui){
			return !!data && ui(data)
		},
		filter: edited, lastFetchedFilter: lastFetched
		, setFilterParam
		, dirtyFilter: edited !== lastFetched
	}
}

function SearchInputCtrl({setFilterParam, parseInput, dirty}) {
	const [value,setValue] = useState('')
	return <SearchFilter type="search" value={value} dirty={dirty?'':null}
		style={{width:"100%", marginBottom:10
					, position: "sticky"
				    , top: "16px"
				    , left: 0
				    , background: "white"
				    , zIndex: 1
		}}
		onChange={e=>{
			setValue(e.target.value)
			parseInput(e.target.value, setFilterParam)
		}} 
	/>
}
export function SearchInput(parseInput) {
	return (props) => <SearchInputCtrl {...props} parseInput={parseInput} /> 
}

export function fetchWithOverflow(fetch, limit) {
	return async (params, ...rest) => {
		const ret = await fetch({...params, ".limit": limit+1}, ...rest)
		if(ret.length > limit) return [ret.slice(0,-1), true]
		return [ret, false]
	}
}


export function inputParser(FA, value) {
	value = value.trim();
	let state = ['initial', {}]
	loop: while(state[0] && value) {
		const def = FA[ state[0] ];
		for(const d of def) {
			const m = value.match(d[0]);
			if(m) {
				state = d[1](state, m[1] ?? m[0])
				value = value.replace(d[0],'')
				value = value.trimStart();
				continue loop;
			}
		}
		break loop;
	}
	return state[1];
}
