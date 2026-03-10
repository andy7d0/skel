import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes,Route, Link} from "react-router-dom"

import reactLogo from './assets/react.svg';
// eslint-disable-next-line no-unassigned-import
import './App.css';

import {mtest} from './tests/form-test'

import {Date} from 'azlib/components/controls'

import {api_post} from 'azlib/api.mjs'


const ExtApp = lazy(()=> import(
    /* webpackChunkName: "ext/app" */
    './ext/ExtApp.jsx'
))
const IntApp = lazy(()=> import(
    /* webpackChunkName: "int/app" */
  './int/IntApp.jsx'
))


function DefApp() {
  return (
    <div className="App">
      <h1>Rspack + React!</h1>
      <Link to="login">login</Link>
      <div className="card">
        <p>
          Edit <code>src/client/App.jsx</code> and save to test HMR
        </p>
        <p>
          <Link to="ext_app">ext</Link>
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
      <Route path="*" element={<UserApp />}/>
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
  return <div>
    <form onSubmit={async (event)=> {
      event.preventDefault();
      const data = new FormData(event.target);
      const obj = Object.fromEntries(data.entries())
      const uinfo = await login(obj)
    }} >
    Login: <input name="login" />
    <br/>
    Pass: <input name="pass" type="password" />
    <br/>
    <button>OK</button>
    </form>
  </div>
}

async function login(form) {
  const r = await api_post('/app/ext/anonymous/login',form);
  if(!r) {
    console.log('auth error');
  }
  console.log(r.authorization, r.info);
}

export default App;
