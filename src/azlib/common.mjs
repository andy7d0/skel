import {sha256}  from  'js-sha256';
import {bytesToBase64URL, base64decode} from './b64.mjs';

import { get as getKV, set as setKV, del as delKV, update as updateKV } from 'idb-keyval';
import {openDB, unwrap} from 'idb';
import {toServerTime} from './date.mjs';

let peerCode = null;
let windowId = null;
let lastTime = 0;
let idInIime = 0;
let currentBranch = '';

// eslint-disable-next-line no-restricted-globals 
const hostname = self.location.hostname;

export function getPeerCode() {
  return peerCode;
}
export function getWindowId() {
  return windowId;
}

async function branch_from_header() {
  let r = await fetch('/', {method:"HEAD", cache:"force-cache"})
  return r.headers.get("Req-Magic-Switch")
}


console.log(`hostname: ${hostname}`);

export function getCurrentBranch() {
  let branch = isLocalServer() && 'debug'
    || !isDevServer() && 'production'
    || currentBranch 
    ;
  return branch;
}

export async function DB() {
  return openDB(`${getCurrentBranch()}.app`, 1, {
  upgrade(db, oldVersion, _newVersion, _transaction, _event) {
    /* eslint-disable-next-line default-case */
    //console.log(oldVersion, newVersion)
    // eslint-disable-next-line default-case
    switch(oldVersion||0) {
      case 0:{
        db.createObjectStore('keyval')
        db.createObjectStore('keygen', { autoIncrement : true })
        // const docs = db.createObjectStore('docs')
        //   docs.createIndex('doctype','doctype')
        }
      //
      // ..etc  
    }
  },
  blocked(_currentVersion, _blockedVersion, _event) {
    // …
  },
  blocking(_currentVersion, _blockedVersion, _event) {
    // …
  },
  terminated() {
    // …
  },
})
};

export async function customStore() {
  let db = unwrap(await DB());
  return (txMode, callback) => 
          callback(db.transaction('keyval', txMode).objectStore('keyval'))
}

/**
 * subscribe to login state changed!
 */

export async function login(func) {
  const r = await func();
  if(!r) {
    console.log('auth error');
    throw 'auth error';
  }
  return r;
}

export async function logout(navigate){
  await delKV('login-state', await customStore())
  broadcast('auth', null)
  navigate('/')
}

export async function getLoggedState() {
  return await getKV('login-state', await customStore()) // use local (per branch) store
}

export async function getAPIparams() {
  const at = await getKV('login-state', await customStore()) // use local (per branch) store
  const peer = getPeerCode()
  return { integrity: at && sha256.hmac(at.authorization, peer ) || ''
          , token: at?.authorization
          , peer: peer
        }
}


function roles($uinfo) {
  const $roles = [];
  switch($uinfo.sysrole) {
    case 'admin': $roles['admin'] = true;
    case 'sysop': $roles['sysop'] = true;
    case 'staff': $roles['staff'] = true;
    case 'semistaff': $roles['semistaff'] = true;
    default: $roles['user'] = true;
  }
  return $roles;  
}
/**
 *  state:
 *    subscription: key to subscribe on server
 *    authorization: header to send with requests
 */
export async function setAuthToken(auth) {
  let [,uinfo] = auth.authorization.match(/Bearer:\s*(.*):/);
  uinfo = JSON.parse(base64decode(uinfo));
  uinfo.roles = roles(uinfo);
  auth.uinfo = uinfo;
  await setKV('login-state', auth, await customStore())
  broadcast('auth', auth)
}


// called before impersonate
// or to revert to (in this case returns saved token)
export async function setSavedToken(token) {
  const store = await customStore();
  if(token) {
    await updateKV('login-state'
      , prev => ({...prev, saved: token})
      , store)
  }
  else {
    const t = getKV('login-state', store)
    if(t.saved) {
      await updateKV('login-state', t.saved, store)  
      broadcast('auth', t.saved)
    }
  }
}

export function isLocalServer() {
  return hostname === '127.1.2.1';  // hardcoded, KISS
}

export function isProdDomain() {
  return hostname === 'prod.domain'; // hardcoded, KISS
}

function isProdServer() {
  return isProdDomain() || hostname === 'prod-ip-address'; // hardcoded, KISS
}

export function isDevServer() {
  return !window.localStorage.getItem('dev-as-prod') && !isProdServer(); 
}

export function asProdServer(asProd) {
  if(asProd === undefined) return window.localStorage.getItem('dev-as-prod')
  if(asProd) window.localStorage.setItem('dev-as-prod', 'Y')
  else window.localStorage.removeItem('dev-as-prod')
}

export function api_url(url) {
  if(url[0]!=='/') url = `/${url}`
  if(!url.startsWith('/app/')) url = `/app/${url}`
  if(url.startsWith('/app/common/')) {
    const loc = window.location.href;
    if(loc.startsWith('/app/int/')||loc.startsWith('/int/')) {
      url = url.replace('/app/common/', '/app/int/')
    } else
    if(loc.startsWith('/app/par/')||loc.startsWith('/par/')) {
      url = url.replace('/app/common/', '/app/par/')
    } else
    if(loc.startsWith('/app/ext/')||loc.startsWith('/ext/')) {
      url = url.replace('/app/common/', '/app/ext/')
    } else 
      url = url.replace('/app/common/', '/app/ext/') // default!
  }
  return url;
}


export async function initPeerAndID() {
  await updateKV('ids', codes => {
    console.log('on init peer')
    if(codes) {
      console.log('peer already inited')
    } else {
      let peerCode = new Uint8Array(32);
      // eslint-disable-next-line no-restricted-globals
      self.crypto.getRandomValues(peerCode);
      peerCode = bytesToBase64URL(peerCode);
      console.log('peer inited')
      codes = { peerCode, winId: 0 }
    }
    ++codes.winId;
    peerCode = codes.peerCode;
    windowId = codes.winId;
    console.log(codes)
    return codes;
  }, await customStore())
  currentBranch = await branch_from_header()
}

export function getLocalUniqueCode() {
  const tm = Date.now().toFixed(0);
  if(lastTime === tm) {
    return {win: windowId, time: lastTime, inc: idInIime++ };
  } else {
    return {win: windowId, time: (lastTime = tm), inc: (idInIime=1)};
  }
}

export function getGlobalUniqueCode() {
  const peer = getPeerCode();
  const lc = getLocalUniqueCode();
  lc.time = toServerTime(lc.time).toFixed(0); // to server time
  return `${lc.time}.${lc.inc}.${lc.win}.${peer}`;
}


let listeners = {}
export function subscribe(code, fun) {
  const prev = listeners[code]
  if(fun) listeners[code] = fun;
  else delete listeners[code];
  return prev;
}

let channel = new BroadcastChannel('bc-main') // from worker to main
// eslint-disable-next-line prefer-add-event-listener
channel.onmessage = event => {
  listeners[event.data.code]?.(event.data, event)
}

export function broadcastOthers(code, data) {
  const msg = {...data, code}
  // eslint-disable-next-line  require-post-message-target-origin
  channel.postMessage(msg)
}

export function broadcast(code, data) {
  const msg = {...data, code}
  defer(msg).then(event=>listeners[code]?.(event))
  // eslint-disable-next-line  require-post-message-target-origin
  channel.postMessage(msg)
}


// let focusTimers = new Set()
// let bgTimers = new Set()
// export function registerBgTimer(fun, always) {
//   (always? bgTimers:focusTimers).add(fun)
// }
// export function unregisterBgTimer(fun) {
//   focusTimers.delete(fun)
//   bgTimers.delete(fun)
// }

// window?.setInterval?.(()=>{
//   if(document?.hasFocus()) for(let f of focusTimers) f()
//   for(let f of bgTimers) f()
// }, 1000)

/* check server cache
  in focused window call check response
  if no response in check periond 
*/

let checkConnectionCallbacks = new Set();
export function regsiterCheckConnection(fun) { checkConnectionCallbacks.add(fun);
  return () => { checkConnectionCallbacks.delete(fun); }
}
  
let controller = null;
                // undefined - instant restart
                // null - no restart
function resetMonitor() {
  if(controller) {
      controller.abort();
      controller = null;
      // check(); - call in timer    
  }
}

let checkUrl = '/app/cache/monitor';
export function setCheckUrl(url) { checkUrl = url; controller?.abort(); controller = undefined; }

// TODO: share it between windows
let monitoredSubscriptions = {}
export function monitorResource(zone, id, version) {
  if(version === undefined) {
    if(monitoredSubscriptions[zone][id]!==undefined) {
      const a = setter.object[id](undefined)(monitoredSubscriptions[zone])
      monitoredSubscriptions[zone] = a;
    }
  } else { 
    monitoredSubscriptions[zone] ??= {};
    monitoredSubscriptions[zone][id] = version;
  }
  broadcast('monitor', monitoredSubscriptions)
}
subscribe('monitor', ms => {
    monitoredSubscriptions = ms;
    resetMonitor();
})


if(self.document) {
  const checkPeriod = 1000;
  let lastSuccessfullCheck = 0;
  let recentCheck = 0;
  let lastStatus = undefined;
  window.setInterval(()=>{
    if(
      recentCheck > Date.now() - checkPeriod*3
    ) {
      const st = lastSuccessfullCheck > Date.now() - checkPeriod*3
      if(lastStatus !== st) {
        console.log(`ping status: ${st?'online':'offline'}`)
        lastStatus = st;
      }
      // only focused window can feedback 
      for(const f of checkConnectionCallbacks) f(st)
    } else {
      for(const f of checkConnectionCallbacks) f() // undefined
    }
  }, checkPeriod*3)


  async function check(){
    console.log('start monitor')
    if(!document.hasFocus()) return;
    if(controller) {
      controller.abort();
      controller = undefined;
    } else {
      let instant = false;
      controller = new AbortController();
      recentCheck = Date.now();
      let monitored = [];
      for(const zone in monitoredSubscriptions) {
        for(const key in monitoredSubscriptions[zone])
          monitored.push([zone,key, monitoredSubscriptions[zone][key] ])
      }
      try{
        const response = await fetch(checkUrl,{method: "POST"
            , body:JSON.stringify(monitored)
            , headers: {"Content-Type": "application/json"}
            , signal: controller.signal})
        if(!response.ok) {
            throw new Error(`Monitor Response status: ${response.status}`);
        }
        if(response.status === 412) {
          // dirty cache
          const info = await response.json()
          for(const c of info) {
            
          }
          instant = true;
        } else {
          const stream = response.body.pipeThrough(new TextDecoderStream());
          for await (const value of stream) {
            console.log(`cache monitor: ${value}`);
            lastSuccessfullCheck = Date.now();
          }
          console.log(`cache monitor end`);
          if(controller === undefined) instant = true;
        }
      } catch(error) {
          console.error(error.message)
      }
      controller = null;
      window.setTimeout(check, instant? 0 : checkPeriod); // retry 
    }
  }

  window.addEventListener('focus', check);
  window.addEventListener('blur', () => {
    console.log('blur')
    resetMonitor()
  })

  window.setTimeout(check,10);
}


/*
  global:
  peer-code
  auth-token реально глобальный

  local to database branch
  PersonCache

  откуда мы узначем branch?
  лучше всего - из базы
  auth-token - роли в конкретной базе (это такая кука, нужная только серверу)

  база может быть или не быть совместимой с текущей

  сервер всегда(?)

  откуда мы узначем сервер?
  по идее, из выбора для сервера
  этот выбор должен работать без программы,
  т.о. только браузер
  в принципе, настройки браузера можно читать
  очевидная cookie
  сложнее (и как вообще) - host
  ip требует proxy, но зато не нужно ничего менять

  также, мы выбираем ветку + базу!
  по идее
    локальная ветка + локальная база
    локальная ветка + глобальная база (по выбору из совместимых)
    глобальная ветка + ее база
    глоблальная ветка + база по выбору

  на сервер приходит пара: ветка+база (или просто ветка? - тогда ее база)
  на клиенте ветка фикс в разработаке (явно ставится в проксировании)
  а база выбираемая из допустимых (фиксированный список)

  на веб-браузере ветка и база приходят из куки

  сервер также может ставить куку (по идее) - так упрощается код (наверное)

  таким образом, /x управляет ТОЛЬКО глобальной кукой сервера
  а куку базы мы выставляем отдельно

*/
