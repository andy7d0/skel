<?php

require_once __DIR__.'/common.php';
require_once 'settings.php';

use \Swoole\Coroutine;


//NOTE: cli code can return predefined global array here
// with or without Swoole
function getRequestContext() {
    return \Swoole\Coroutine::getContext();
}

//NOTE: cli code should somehow get login/pass
// and reset connection using them
// or act as pedifined user privileged or not
// almost always there is no 'real' user for cli scripts!  
    
//TODO: @include __ROOTDIR__.'/vendor/autoload.php';

//TODO:
// define('APP_MODE',
//     file_exists('/src') ? 'dev'
//     :  (false ?'test' //TODO
//     : 'prod')
// );

$http = new \Swoole\Http\Server("0.0.0.0", \az\settings\SERVER_PORT);

$http->set([
    'max_coroutine' => \az\settings\MAX_COROUTINE,
    'enable_deadlock_check' => true,

    'hook_flags' => SWOOLE_HOOK_ALL,

    'enable_preemptive_scheduler' => true, //??

    'worker_num' => \az\settings\WORKER_NUM,

    'max_request' => 1000, //10_000 may be better

    'max_connection' => \az\settings\MAX_CONNECTION,

    'dispatch_mode' => 1, // NOTE: stateless!

    'package_max_length' => \az\settings\PACKAGE_MAX_LENGTH, 

    'open_cpu_affinity' => true,
    'cpu_affinity_ignore' => [0],

    // 'enable_delay_receive' ???

    // 'reload_async' dev/prod?
    'max_wait_time' => \az\settings\MAX_WAIT_TIME,

    'tcp_fastopen' => true, // def = false!

    'enable_coroutine' => true, // this IS DEFAULT
    'hook_flags' => SWOOLE_HOOK_ALL,

    'send_yield' => false, // really false?

    // 'stats_file' => 'path/to/file', current stats

    // 'max_queued_bytes' //????

    'admin_server' => \az\settings\ADMIN_SERVER,
    
    //'http_parse_cookie' => false,
    //'http_parse_post' => false,
    //'http_parse_files' => false,

    'http_compression' => false,
    //'compression_min_length' => 128,

    // nginx responsibility
    //'upload_max_filesize' => 5 * 1024,

    'max_concurrency' => \az\settings\MAX_CONCURRENCY,
    'worker_max_concurrency' => \az\settings\WORKER_MAX_CONCURRENCY,

]);

$http->on('request', function ($request, $response) use($http) {
    $path = $request->server['request_uri'];

    // TODO: check APP_MODE
    if($path === '/app/'.SUBSYSTEM.'/reload') {
        error_log('!!!!!!!! changes !!!!!!!!!!!!');
        $http->shutdown();
        return;
    }

    if(str_ends_with($path, '/')) {
        $response->status(400, 'dir?');
        return;                
    }

    //TODO: define('__PEER__', @$_SERVER['HTTP_X_PEER']);

    //error_log(@$request->server['query_string']??'---');
    //error_log(var_export($request->get, true));
    if(!preg_match('#^/app/'.SUBSYSTEM.'/#', $path)) { // FIXME: use correct subsystem here
        $response->status(404, 'subsystem');
        return;        
    }
    $path = preg_replace('#^/app/(ext|int|par)/#', '/', $path);

    if(preg_match('#^(?<=/)'.\az\settings\AUTHENTICATED_URLS.'(?=/)#', $path, $m)){
        // need auth
        $need_role = $m[0];
        // TODO: auth
        \az\access\check_headers( $request->header, @$request->get ?: $request->getContent() );

        $currentUser = \az\access\loginOnlineUser($request, $response);
        $request->server['current_user'] = $currentUser;
    }
    if(preg_match('#^/internal/#', $path, $m)){
        if(@$request->header['internal-key'] !== \az\settings\INTERNAL_KEY) {
            throw new \ResourceForbidden('internal');
        }
    }

    $api_index = "";
    if(preg_match('#~(\d+)$#', $path, $m)) {
        // api path
        // trim entry index 
        $request->server['api_index'] = $m[1];
        $api_index = "~$m[1]";
        $path = preg_replace('#~\d+$#', '', $path);
    } else if(preg_match('#/([^/]+[.][^/]+)$#', $path)) {
        // file path (has ext)
        // trim file name
        $request->server['target_file_name'] = $m[1];
        $path = preg_replace('#/[^/]+$#', '',$path);
    }
    if(strpos($path, '.')) {
        $response->status(400, 'dir is not a file');
        return;
    }

    $src_path = $path;

    $suffixes = ['.entry.php', '.jsx.done'];

    $route = null;
    while($path !== '/') {
        //error_log($path);
        foreach($suffixes as $suffix) {
            $fpath = __ROOTDIR__.'/'.SUBSYSTEM."$path$suffix";
            $route = route_defined("$fpath$api_index");
            if($route) goto found;
            if(file_exists($fpath)) {
                $vars = [];
                if($suffix === '.jsx.done') {
                    $api_reg = new API_ITEMS("$fpath");
                    $vars = $api_reg->helpers();
                }
                \az\safe_require_once($fpath, $vars);
                $route = route_defined("$fpath$api_index");
                if($route) goto found;
                error_log("$path.$suffix is not a route target");
                $response->status(500, "$path.$suffix is not a route target");
                return;
            }
        }
        $path = dirname($path);
    }
    if(!$route) {
        $response->status(404, 'no route');
        return;
    }
    found:

    $ctx = getRequestContext();
    $ctx['request'] = $request;
    $ctx['response'] = $response;

    $request->server['full_path'] = $src_path;
    $request->server['path_info'] = substr($src_path, strlen($path));
    $request->server['handler_path'] = $path;
    try {
        $route($request, $response);
    } catch(ResourceError $e) {
        $response->status($e->getCode(), $e->getMessage());
    } catch(\Throwable $e) {
        $response->status(500, 'Exception:');
        if($request->header['accept'] === 'application/json') {
            $msg = ['code'=>$e->getCode()
                    , 'message'=> $e->getMessage() 
                    , 'trace' => array_slice($e->getTrace(),0,-1) //TODO: not in production or encoded value
                ];
            $response->header('Content-Type', 'application/json');
            $response->end(json_encode($msg, JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT));
        } else {
            $response->header('Content-Type', 'text/plain');
            $response->end($e);
        }
        error_log($e);
    }
});

// $inotify_fd = APP_MODE === 'dev' ? inotify_init() : null;

// $http->on('start', function() use($http) {
//     global $inotify_fd;

//     if($inotify_fd) {
//         \Swoole\Event::add($inotify_fd, function ($fd) use ($http) {
//             // Read the events to clear the buffer
//             $events = inotify_read($fd); 
//             if ($events) {
//                 error_log('!!!!!!!! changes !!!!!!!!!!!!');
//                 // Trigger a graceful server reload when a change occurs
//                 //$http->reload();  
//                 $http->shutdown();  
//             }
//         });
//         watch_changes();
//     }
// });

error_log("\n------- app started ----------");

$http->start();

// --- helpers

// function watch_changes() {
//     critical_section(function(){
//         global $inotify_fd;
//         if(!$inotify_fd) return;
//         static $included = [];
//         $inc = get_included_files();
//         $diff = array_diff($inc, $included);
//         $included = $inc;
//         foreach($diff as $d) {
//             if(str_ends_with($d, ".jsx.done"))
//                 $d = preg_replace('/[.]done$/','', $d);
//             if(preg_match('#^/dist/#', $d))
//                 $watch_descriptor = inotify_add_watch($inotify_fd
//                     , preg_replace('#^/dist/#', '/src/', $d)
//                     , IN_MODIFY);
//         }
//     });    
// }


// $func: ($request, $responce) => void
function define_route(callable $func, string $name) {
    define('⌬'.$name, $func);
}

// $func: (...$params) => $response
function define_api_route(callable $func, string $name, ?string $method = null) {
    define_route(function($request, $response) use($func, $method) {
        if($method && $method !== $request->getMethod()) {
            $response->status(405);
            return;
        }
        $params = @$request->get? reparse_get($request->get)
                                : json_decode($request->getContent());
        $ret = $func(...(array)$params);
        $response->header('Content-Type', 'application/json', false);
        $response->end(json_encode($ret,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT));
    }, $name);
}

function route_defined(string $path) {
    $name = '⌬'.$path;
    if(defined($name)) return constant($name);
}

function reparse_get(array $get) {
    $ret = [];
    if(!$get) return $ret;
    foreach($get as $k=>$v) {
        $ret[$k] = $v? parse_get_value($v) : null;
    }
    return $ret;
}

/*
    order:
    prop~ => "url-prop":
    ~* => [
    .* => ]
    .~ => }
    ~ => {
    * => ,
    .str => "url-str"
    url-decode
*/

function parse_get_value(string $s) {
    $s = preg_replace('/-~/','"":', $s);
    $s = preg_replace('#([a-zA-Z0-9_%]+)~#','"$1":',$s);

    //error_log($s);

    $s = str_replace(
         ['~*','.*','.~','~','*']
        ,['[' ,']' ,'}' ,'{',',']
        ,$s);

    //error_log($s);

    $s = preg_replace('#[.]([a-zA-Z0-9_%.-]*)#','"$1"',$s);
    $s = str_replace('*',',',$s);
    return json_decode($s);
}



class ResourceError extends \Exception {
    function __construct(int $status = 400, string $message = '', ?Throwable $previous = null) {
        parent::__construct($status, $message, $previous);
    } 
}

class MalformedRequest extends ResourceError {
    function __construct(string $message = '') {
        parent::__construct(400, $message);
    }
}
class ResourceNotFound extends ResourceError {
    function __construct(string $message = '') {
        parent::__construct(404, $message);
    }
}
class ResourceForbidden extends ResourceError {
    function __construct(string $message = '') {
        parent::__construct(403, $message);
    }
}

// TODO:
// 412 Precondition Failed (x-sa, x-ts)

// 423 Locked

// 428 Precondition Required 

// 409 Conflict

class API_ITEMS {
    public array $funcs = [];
    function __construct(public string $file) {}
    function helpers() {
        return [ '⛑' => fn($pos) => $this->done($pos)
            , '⛑_GET' => fn($f) => $this->funcs[] = ['GET', $f]
        ];
    }
    function done(array $pos) {
        foreach($this->funcs as $i=>$f) {
            $item = $pos[$i];
            define_api_route($f[1], "$this->file~$item", $f[0] );   
        }
    }
}

/* jsx routes
    METHOD+6chars
    API.GET` function($arg) {
    
    }$$`

generates file (required-once!)
in the global context
set [$⛑GET, ... ] = new ApiItemRegistry(target-file-name)
and require_once target-file-name

function dcl($f) {
    debug_backtrace();
}

we have file, line
XX can be column
NPP we know for free, but js does not

which contains:
<?php 

    ⛑GET(XX)(function($arg) {
        return 'bla-bla';
    });



    $⛑GET(NN,function($arg) {
        return 'bla-bla';
    });


    function ⛑1    (){return ⛓A(<<<SQL
                docid, title
                from udata.docs
                WHERE doctype = 's.n.exp_vote'
            SQL
            );}                                     
*/

/*
    API.GET` function($arg) {
    
    }$$`

    $SYSAPI.GET` function($arg) {
    
    }$$`
    $GET(XXXXXXX,func....



    $API.GET` function($arg) {
    
    }$$`

    $GET(XXXX,)


    ---
    encode position
    1) XXXXXX -> до миллиона
    2) 0xXXXX -> 64тыс
    3) ->IDXX -> 14млн
*/