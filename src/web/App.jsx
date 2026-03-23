import { lazy, Suspense, useState, createContext, useContext, useEffect } from 'react';
import { BrowserRouter as Router, Routes,Route, Link, useNavigate} from "react-router-dom"

// eslint-disable-next-line no-unassigned-import
import './App.css';

import {mtest} from './tests/form-test'

import {Date} from 'azlib/components/controls'

import {api_post} from 'azlib/api.mjs'

import {monitorResource} from 'azlib/common.mjs'

import {setAuthToken, subscribe, broadcast, getLoggedState, logout, login} from 'azlib/common.mjs'


const ExtApp = lazy(()=> import(
    /* webpackChunkName: "ext/app" */
    './ext/ExtApp.jsx'
))
const IntApp = lazy(()=> import(
    /* webpackChunkName: "int/app" */
  './int/IntApp.jsx'
))


function DefApp() {
  const uinfo = useUinfo()
  const navigate = useNavigate()
  return (
    <div className="App">
      <h1>Rspack + React!</h1>
      {uinfo.login}+{uinfo.tmp} {uinfo.login && <button onClick={()=>{logout(navigate)}}>logout</button>}
      {!uinfo.login &&
        <Link to="login">login</Link>}
      <div className="card">
        <p>
          <Link to="ext_app">ext</Link>
        </p>
        <p>
          <Link to="int/int_app">int</Link>
        </p>
      </div>

      <p>
        <aligned-button align='center' onClick={async ()=>{
          DBG(await mtest())
        }}>TEST</aligned-button>
      </p>
      <form onSubmit={()=> console.log(new FormData(event.target))} >
      <aligned-button type="submit" name="ddd" value="33" align='left'>kkk</aligned-button>
      </form>
      <div>
      <Date />
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
    <Routes>
      <Route path="*" element={<UinfoContext><UserApp /></UinfoContext>}/>
    </Routes>
   </Router>
  );

}

function UserApp() {
  return <Routes>
    <Route path="/" element={<DefApp/>} />
    <Route path="/login" element={<LoginPage/>} />
    <Route path="int/*" element={
        <Suspense fallback={<div>Loading app...</div>}>
          <IntApp />
        </Suspense>
    }/>
    <Route path="*" element={
      <Suspense fallback={<div>Loading app...</div>}>
        <ExtApp />
      </Suspense>
    }/>
  </Routes>
}

function LoginPage() {
  const [err, setErr] = useState()
  const navigate = useNavigate()
  return <div>
    <form onSubmit={async (event)=> {
      event.preventDefault();
      setErr(null)
      const data = new FormData(event.target);
      const obj = Object.fromEntries(data.entries())
      try {
        const auth = await login(()=>api_post('/app/login',obj))
        await setAuthToken(auth);
        navigate('/')
      } catch(error) {
          console.log(error)
          if(typeof error === 'string') setErr(error)        
      }
    }} >
    Login: <input name="login" />
    <br/>
    Pass: <input name="pass" type="password" />
    <br/>
    <button>OK</button>
    {err}
    </form>
  </div>
}

const Uctx = createContext({})

const empty = {}

function UinfoContext({children}) {
  const [auth, setAuth] = useState()
  useEffect(()=>{
    const prev = subscribe('auth', setAuth)
    return () => subscribe('auth', prev)
  },[setAuth])
  useEffect(()=>{
    getLoggedState().then(st=>{broadcast('auth', st)})
  }, [])
  const id = auth?.subscription;
  const version = auth?.version;
  useEffect(()=>{
    monitorResource('user', id, version)
  },[id,version])
  return <Uctx value={auth?.uinfo??empty}>{children}</Uctx>
}

export function useUinfo() {
  return useContext(Uctx);
}

export default App;
