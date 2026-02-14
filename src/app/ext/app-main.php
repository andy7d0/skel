<?php





$http = new Swoole\Http\Server("0.0.0.0", 9580);


class ManipStream {
    var $file;
    var $context;

    function stream_open($path, $mode, $options, &$opened_path)
    {
        $url = substr($path, strlen('manip://'));
        // error_log($url);
        $this->file = fopen($url, $mode);

        return true;
    }

    function stream_read($count)
    {
        return fread($this->file, $count);
    }

    function stream_write($data)
    {
        return false;
    }

    function stream_tell()
    {
        return ftell($this->file);
    }

    function stream_eof()
    {
        return feof($this->file);
    }

    function stream_seek($offset, $whence)
    {
        return fseek($this->file, $whence);
    }

    function stream_close() {
        return fclose($this->file);
    }
    function stream_stat() {
        return fstat($this->file);
    }

    function stream_metadata($path, $option, $var) 
    {
        return false;
    }

    function stream_set_option(int $option, int $arg1, int $arg2) {
        // error_log(var_export($option, true));
        // error_log(var_export($arg1, true));
        // error_log(var_export($arg2, true));
        return false;
    }
}

stream_wrapper_register("manip", "ManipStream") or die("Failed to register protocol");


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
    // 'max_wait_time' in dev?

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

//$http->listen()

$http->on('request', function ($request, $response) {
    require_once 'manip://'.__DIR__.'/require-test.php';
    //error_log(__DIR__);
    $response->end("<h1>Hello Swoole. #".F()."</h1>");
});

$http->start();