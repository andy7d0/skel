import {useState} from 'react';

import * as styles from './calendar.module.css';

// eslint-disable click-events-have-key-events tabindex-no-positive

const firstDoW = 1; //monday; TODO: locale aware

//FIXME: const localeName = window.navigator.language || window.navigator.userLanguage

var weekDays = []

for(let i = 1; i <= 7; ++i) {
	const d = new Date(2000,0,i)
	weekDays[d.getDay()] = d.toLocaleDateString(undefined,{weekday:"short"})
}

function adjustDoW(i) {
	return (i-firstDoW+weekDays.length)%weekDays.length
}

let weekDaysAdjusted = []
for(let i = 0; i < weekDays.length; ++i)
	weekDaysAdjusted[adjustDoW(i)] = weekDays[i]

var monthNames = []
var monthNamesShort = []

for(let i = 1; i <= 12; ++i) {
	const d = new Date(2000,i-1)
	monthNames[i-1] = d.toLocaleDateString(undefined,{month:"long"})
	monthNamesShort[i-1] = d.toLocaleDateString(undefined,{month:"short"})
}

//const firstYear = 1
//const lastYear = 4000

function date(y,m,d) { 
	return new Date(y,m,d??1) 
}

function range(n) {
	let r = []
	for(let i = 0; i < n; ++i)
		r.push(i)
	return r;
}

function Hbutton({params, mode, yearOffset, modulo, month, ...props}) {
	return <span
		onClick={()=>{
			if(mode) params.setMode(mode)
			params.setStart(date(
				modulo?
						Math.floor(params.start.getFullYear()/modulo)*modulo
					:   params.start.getFullYear()+(yearOffset||0)
				, modulo? 1 : params.start.getMonth()+(month||0)
				))
		}}
		{...props}
		/>
}

function Bbutton({params, mode, year, month, ...props}) {
	return <span
		onClick={()=>{
			params.setMode(mode ?? 'days')
			params.setStart(date(
					params.start.getFullYear() + (year??0)
					, month??0
				))
		}}
	{...props} />
} 

function Xbutton({className, onChoose, dt, min, max, ...props}) {
	if(min && dt < min || max && dt > max)
		className = styles.outOfRange
	return <span className={className} {...props} 
		onClick={()=>
			(!min || dt >= min)
			&&
			(!max || dt <= max)
			&&
			onChoose(dt)
		}
	/>
}

export function Calendar({ref,onChoose,min,max,...props}) {
	const [dt] = useState(new Date()) // initial date //FIXME: it is not a state
	const [mode,setMode] = useState('days')
	const [start,setStart] = useState(
						date(dt.getFullYear(), dt.getMonth())
					)

	const params = {mode, setMode, start, setStart}

	/* eslint-disable-next-line default-case */
	switch(mode) {
		case 'days':
				return <div ref={ref} className={styles.container} {...props}>
							<div className={styles.header}>
								<Hbutton params={params} yearOffset={0} month={-1}>
									≪
								</Hbutton>
								<Hbutton params={params} mode="months" modulo={1}>
									{monthNames[start.getMonth()]}
								</Hbutton>
								<Hbutton params={params} mode="months" modulo={1}>
									{start.getFullYear()}
								</Hbutton>
								<Hbutton params={params} yearOffset={0} month={+1}>
									≫
								</Hbutton>
							</div>
							<div className={styles.body}>
								{
									range(7).map(r=>
										<div key={r} className={styles.days}>{
											weekDaysAdjusted.map((wd,i)=>
											r===0?// top row
												<span key={wd}>{wd}</span>
											:
												(dt=>
													<span key={wd}
													>
													<Xbutton 
														className={
															dt.getMonth() === start.getMonth()
															? styles.current
															: styles.other
														}
														onChoose={onChoose}
														dt={dt} min={min} max={max}
													>
														{dt.getDate()}
													</Xbutton>
													</span> 
												)(
													/*
													2022, may
													fDoW = 1 (Mon)
													--
													1 => Sun (0/6 (if fDow=1))
													4 => Wed (3/2 (if fDow=1)) 
													*/
													date(start.getFullYear()
													, start.getMonth()
													, (r-1)*7+i+1
													  - adjustDoW(date(start.getFullYear()
													  	, start.getMonth()
													  	, 1
														).getDay())
													)
												)
										)}
										</div>
									)
								}
							</div>
						</div>
		case 'months':
				return <div ref={ref} className={styles.container} {...props}>
							<div className={styles.header}>
								<Hbutton params={params} yearOffset={-1}>
									≪
								</Hbutton>
								<Hbutton params={params} mode="years" modulo={10}>
									{start.getFullYear()}
								</Hbutton>
								<Hbutton params={params} yearOffset={+1}>
									≫
								</Hbutton>
							</div>
							<div className={styles.body}>{
								range(4).map(r=>
									<div key={r}>{
										range(3).map(c=>
										<span key={c}><Bbutton className={styles.month} 
											params={params} month={r*3+c}
											>{monthNames[r*3+c]}
										</Bbutton></span>
										)
									}
									</div>
								)
							}</div>
						</div>
		case 'years':
				return <div ref={ref} className={styles.container} {...props}>
							<div className={styles.header}>
								<Hbutton params={params} yearOffset={-10}>
									≪
								</Hbutton>
								<Hbutton params={params} mode="decades" modulo={100}>
									{start.getFullYear()}
									-
									{start.getFullYear()+9}
								</Hbutton>
								<Hbutton params={params} yearOffset={+10}>
									≫
								</Hbutton>
							</div>
							<div className={styles.body}>{
								range(4).map(r=>
									<div key={r}>{
										range(3).map(c=><span key={c}>{
										r*3+c === 0?<Bbutton className={styles.years} 
											mode="years"
											params={params} year={-10}
											>≪</Bbutton> 
										: r*3+c === 11?<Bbutton className={styles.years} 
											mode="years"
											params={params} year={+10}
											>≫</Bbutton>
										: 
										<Bbutton className={styles.years} 
											mode="months"
											params={params} year={r*3+c-1}
											>{start.getFullYear()+r*3+c-1}
										</Bbutton>
										}</span>)
									}
									</div>
								)
							}</div>
						</div>
		case 'decades':
				return <div ref={ref} className={styles.container} {...props}>
							<div className={styles.header}>
								<Hbutton params={params} yearOffset={-100}>
									≪
								</Hbutton>
								<Hbutton params={params} mode="decades" modulo={100}>
									{start.getFullYear()}
									-
									{start.getFullYear()+99}
								</Hbutton>
								<Hbutton params={params} yearOffset={+100}>
									≫
								</Hbutton>
							</div>
							<div className={styles.body}>{
								range(4).map(r=>
									<div key={r}>{
										range(3).map(c=><span key={c}>{
										r*3+c === 0?<Bbutton className={styles.years} 
											mode="decades"
											params={params} year={-100}
											>≪</Bbutton> 
										: r*3+c === 11?<Bbutton className={styles.years} 
											mode="decades"
											params={params} year={+100}
											>≫</Bbutton>
										: 
										<Bbutton className={styles.decades} 
											mode="years"
											params={params} year={r*3+c-1}
											>
											<div>{start.getFullYear()+(r*3+c-1)*10}</div>
											<div>{start.getFullYear()+(r*3+c-1)*10+9}</div>
										</Bbutton>
										}</span>)
									}
									</div>
								)
							}</div>
						</div>
	}
}
