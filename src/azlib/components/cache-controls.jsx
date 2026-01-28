import {useState, useEffect} from 'react'

import {regsiterCheckConnection} from '../common.mjs'


export function WhenOffline({children}) {
	const [online, setOnline] = useState()
	useEffect(()=>regsiterCheckConnection(setOnline)
		, [setOnline])
	return online === false && children
}
export function WhenOnline({children}) {
	const [online, setOnline] = useState()
	useEffect(()=>regsiterCheckConnection(setOnline)
		, [setOnline])
	return online !== false && children
}


// TODO: cache minitor