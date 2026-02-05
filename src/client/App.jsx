import { useState, lazy, Suspense, useRef } from 'react';
import { BrowserRouter as Router, Routes,Route, Link} from "react-router-dom"

import reactLogo from './assets/react.svg';
// eslint-disable-next-line no-unassigned-import
import './App.css';

import {mtest} from './tests/form-test'

import {Date} from 'azlib/components/controls'


const ExtApp = lazy(()=> import(
    /* webpackChunkName: "ext/app" */
    './ext/ExtApp.jsx'
))
const IntApp = lazy(()=> import(
    /* webpackChunkName: "int/app" */
  './int/IntApp.jsx'
))


function DefApp() {
  const [count, setCount] = useState(0);
  const rr = useRef()

  //if(false) console.log(aaa)

  return (
    <div className="App">
      <div>
        <a href="https://reactjs.org" target="_blank" rel="noreferrer">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Rspack + React!</h1>
      <div className="card">
        <button type="button" onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/client/App.jsx</code> and save to test HMR
        </p>
        <p>
          <Link to="ext_app">ext</Link>
          <Link to="int/int_app">int</Link>
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Rspack and React logos to learn more
      </p>

      <p>
        <button-x onClick={async ()=>{
          DBG(await mtest())
        }}>TEST</button-x>
      </p>
      <form onSubmit={()=> console.log(new FormData(event.target))} >
      <p><input-x ref={rr} name="fff" value="lll" reserved="5em">
          <button slot="buttons"
          >B</button>
          <span>body</span>
          </input-x>
      </p>
      <button-x type="submit" name="ddd" value="33">kkk</button-x>
      </form>
      <div>
      <Date />
      </div>
      88888
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

export default App;
