<?php

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
    safe_require_once(__DIR__.'/require-test.php');
    //error_log(__DIR__);
    $response->end("<h1>Hello Swoole. #".F()."</h1>");
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