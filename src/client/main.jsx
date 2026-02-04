//import _R from "core-js/stable";

import {enableMapSet, enableArrayMethods} from "immer"
enableMapSet(); enableArrayMethods();
//import {enablePatches} from "immer"

// eslint-disable-next-line no-unassigned-import
import "azlib/globals.mjs";
// eslint-disable-next-line no-unassigned-import
import "azlib/helpers.mjs";
// eslint-disable-next-line no-unassigned-import
import "azlib/date.mjs";

import {initPeerAndID} from 'azlib/common.mjs' 
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {GlobalModals} from 'azlib/components/modals'
import App from './App.jsx';
// eslint-disable-next-line no-unassigned-import
import './index.css';

import * as gitVersion from 'git-version';

// eslint-disable-next-line no-unused-expressions
//_R;

console.log(API.URL`test`);
console.log(gitVersion)

if(window.location.pathname === '/' && window.location.search) {
  console.log('need redirect', window.location)
  window.history.replaceState(null,'', 
        window.location.search.substr(1)
  );
} else if(window.location.pathname === '/int' && window.location.search) {
  console.log('need redirect int', window.location)
  window.history.replaceState(null,'', 
        `int/${window.location.search.substr(1+5)}`
  );
}


initPeerAndID()
.then(()=>{
  //console.log([].toSorted())
  const root = createRoot(document.getElementById('root'));
  return root.render(
    <StrictMode>
      <GlobalModals>
      <App />
      </GlobalModals>
    </StrictMode>
  );
});

