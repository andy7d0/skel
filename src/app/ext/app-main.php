<?php

const SUBSYSTEM = 'ext';
const __ROOTDIR__ = __DIR__;

$http = new Swoole\Http\Server("0.0.0.0", 9580);



$http->set([
    'max_coroutine' => 3000,
    'enable_deadlock_check' => true,

    'hook_flags' => SWOOLE_HOOK_ALL,

    'enable_preemptive_scheduler' => true, //??

    'worker_num' => 2, // TODO: dev/prod

    'max_request' => 1000, //10_000 may be better

    'max_connection' => 1000, // TODO: dev/prod

    'dispatch_mode' => 1, // NOTE: stateless!

    'package_max_length' => 10_1000_1000, // 10M

    'open_cpu_affinity' => true,
    'cpu_affinity_ignore' => [0],

    // 'enable_delay_receive' ???

    // 'reload_async' dev/prod?
    'max_wait_time' => 0.1, // it is dev! TODO:prod

    'tcp_fastopen' => true, // def = false!

    'enable_coroutine' => true, // this IS DEFAULT
    'hook_flags' => SWOOLE_HOOK_ALL,

    'send_yield' => false, // really false?

    // 'stats_file' => 'path/to/file', current stats

    // 'max_queued_bytes' //????

    'admin_server' => '0.0.0.0:9582',
    
    //'http_parse_cookie' => false,
    //'http_parse_post' => false,
    //'http_parse_files' => false,

    'http_compression' => false,
    //'compression_min_length' => 128,

    // nginx responsibility
    //'upload_max_filesize' => 5 * 1024,

    'max_concurrency' => 1000_1000,
    'worker_max_concurrency' => 10_1000,


]);

$http->on('request', function ($request, $response) {
    //error_log(@$request->server['query_string']??'---');
    //error_log(var_export($request->get, true));
    $path = $request->server['request_uri'];
    if(!preg_match('#^/app/'.SUBSYSTEM.'/#', $path)) { // FIXME: use correct subsystem here
        $response->status(404, 'subsystem');
        return;        
    }
    $path = preg_replace('#^/app/(ext|int|par)/#', '/', $path);

    if(str_ends_with($path, '/')) {
        $response->status(400, 'dir?');
        return;                
    }

    if(preg_match('#~(\d+)$#', $path, $m)) {
        // api path
        // trim entry index 
        $request->server['api_index'] = $m[1];
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

    $route = null;
    while($path !== '/') {
        //error_log($path);
        $fpath = __DIR__."$path.entry.php";
        $route = route_defined($fpath);
        if($route) break;
        if(file_exists($fpath)) {
            safe_require_once($fpath);
            $route = route_defined($fpath);
            if($route) break;
            $response->status(500, "$path.entry.php is not a route target");
            return;
        }
        $path = dirname($path);
    }
    if(!$route) {
        $response->status(404, 'no route');
        return;
    }

    $request->server['path_info'] = substr($src_path, strlen($path));
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
            $response->end(json_encode($msg));
        } else {
            $response->header('Content-Type', 'text/plain');
            $response->end($e);
        }
        error_log($e);
    }
});

$inotify_fd = inotify_init();

$http->on('start', function() use($http) {
    global $inotify_fd;

    Swoole\Event::add($inotify_fd, function ($fd) use ($http) {
        // Read the events to clear the buffer
        $events = inotify_read($fd); 
        if ($events) {
            error_log('!!!!!!!! changes !!!!!!!!!!!!');
            // Trigger a graceful server reload when a change occurs
            //$http->reload();  
            $http->shutdown();  
        }
    });
});

error_log("\n------- app started ----------");

$http->start();

// --- helpers

function safe_require_once($path) {
    require_once($path);
    critical_section(function(){
        global $inotify_fd;
        static $included = [];
        $inc = get_included_files();
        $diff = array_diff($inc, $included);
        $included = $inc;
        foreach($diff as $d) 
            if(preg_match('#^/dist/#', $d))
                $watch_descriptor = inotify_add_watch($inotify_fd
                    , preg_replace('#^/dist/#', '/app/', $d)
                    , IN_MODIFY);
    });
}

function critical_section($func) {
    $old = ini_set("swoole.enable_preemptive_scheduler", "0");
    try{
        $func();
    } finally {
        ini_set("swoole.enable_preemptive_scheduler", $old);
    }
}


// $func: ($request, $responce) => void
function define_route($name, $func) {
    define('⌬'.$name, $func);
}

// $func: (...$params) => $response
function define_api_route($name, $func) {
    define_route($name, function($request, $response) use($func) {
        $params = @$request->get? reparse_get($request->get)
                                : json_decode($request->getContent());
        $ret = $func(...(array)$params);
        $response->header('Content-Type', 'application/json', false);
        $response->end(json_encode($ret));
    });
}

function route_defined($path) {
    $name = '⌬'.$path;
    if(defined($name)) return constant($name);
}

function reparse_get($get) {
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

function parse_get_value($s) {
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

