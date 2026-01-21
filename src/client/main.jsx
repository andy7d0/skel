import _R from "core-js/stable";
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// eslint-disable-next-line no-unassigned-import
import './index.css';

import * as gitVersion from 'git-version';

// eslint-disable-next-line no-unused-expressions
_R;

console.log(API.URL`test`);

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

console.log(gitVersion)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
