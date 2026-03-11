<?php namespace az;

define('__ROOTDIR__', dirname(__DIR__));
define('SUBSYSTEM', $argv[1]);

set_include_path(
    implode(':', [
    __ROOTDIR__.'/az4'
    , __ROOTDIR__.'/common'
    , __ROOTDIR__.'/'.SUBSYSTEM])
);

mb_internal_encoding("UTF-8");

function safe_require_once(string $path, ?array $vars = []) {
    extract($vars);
    require_once($path);
    // watch_changes();
}

function critical_section(callable $func) {
    $old = ini_set("swoole.enable_preemptive_scheduler", "0");
    try{
        return $func();
    } finally {
        ini_set("swoole.enable_preemptive_scheduler", $old);
    }
}

function json_decode_null($value)
{
	return $value === null? null : json_decode($value);
}


class KeyedLRUItem {
	function __construct(public $item, public string $key
		, public ?object $prev, public ?object $next
	) {}
}
class KeyedLRU {
	private array $keys = [];  // key => items[]
	private ?object $first = null;
	private ?object $last = null;
	private int $cnt = 0;

	function __construct(public int $max = 100) {}

	function put($key, $item) {
		return \az\critical_section(function() use($item, $key) {
			if($this->cnt > $this->max) {
				$e = $this->first;
				$n = $e->next;
				$this->first = $n;
				$n->prev = null;
				$e->next = null;
				$k = $e->key;
				array_shift($this->keys[$k]);
				if(!$this->keys[$k]) unset($this->keys[$k]);
				--$this->cnt;
			}
			$e = new KeyedLRUItem($item, $key, $this->last, null);
			if($this->last) $this->last->next = $e;
			$this->last = $e;
			++$this->cnt;
		});
	}

	function get($key) {
		return \az\critical_section(function() use($key) {
			if(!array_key_exists($key, $this->keys)) return null;
			$e = array_pop($this->keys[$key]);
			
			$p = $e->prev;
			$n = $e->next;

			if($p) $p->next = $n; else $this->first = $n;
			if($n) $n->prev = $p; else $this->last = $p;

			--$this->cnt;

			return $e->item;
		});
	}
}
