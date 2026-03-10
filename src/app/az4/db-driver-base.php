<?php namespace az\db\driver;

class AbstractDatabaseConnection {
	var $transactionLevel = 0;

	function executeWithParams($cmd, $args, $cmd_info = null) {}
	function parepareCommand($cmd, $cmd_info) {}
	function setConnectionInitials($commands) {}

	static function prepare_db_args($args) { 
		return array_map(function($a) { 
						return is_object($a) || is_array($a)? 
							json_encode($a) : $a; 
						}
					, $args); 
	}

	//delegate all call to executed statement as is
	function __call($name, $args) {
		return $this->executeWithParams(...$args)->$name();
	}

	function beginTransaction() {}
	function commitTransaction() {}
	function rollbackTransaction() {}
}

class AbstractDatabaseStmt {
	function columnCount() {}
	function fetchColumn() {}

	function fetchObj() {} // return objects cursor
	function fetchUnnamed() {} // return unnamed array cursor

	function fetchColumnAll() {} // return array of column value 	
	function fetchAll() {} // return array of rows 	

	function fetchKeyPairs() {} // return associative array of column value 
															// firstCol => secondCol	
	function fetchKeyAll() {} // return associative array of column value 
															// firstCol => row	
	function fetchGrouped() {} // return associative array of column value 
															// firstCol => [ row with this key ]

	function rowsIterator() {}
	function unnamedRowsIterator() {} 
}

class AbstractDatabasePrepared {
	function executePrepared($args) {}

	//delegate all call to executed statement as is
	function __call($name, $args) {
		return $this->executePrepared(...$args)->$name();
	}
}

class DBOOException extends \Exception {
  public function __construct($e, $queryString, $args, $cmd = null) {
    parent::__construct(
        $e->getMessage() . "#:{$e->getCode()}"
        , is_int($e->getCode())? $e->getCode() : 0
        , $e
    );
  }
}

class DBVersionException extends \Exception {}

function dialect($a) { return @$a['dialect'] ?: @explode(':', @$a['server'], 2 )[0]; }

function connect(
		string $db
		, ?string $login = null, ?string $pass = null
		, bool $pooled = true) {

	static $LRU = [];
	
	$dbObj = \az\settings\DATABASES[$db];
	$ctx = \getRequestContext();
	if($login === null) {
		$currentUser = @$ctx['request']->server['current_user'];
		if($currentUser) {
			$login = $currentUser?->dbLogin();
			$pass = $currentUser?->dbPass();
		}
	}

	// co-part, no need to protect
	$key = "$db:$login:$pass";
	$ctx['db-connections'] ??= [];
	$connection = @$ctx['db-connections'][$key];
	if($connection) return $connection;

	// initialize global connection cache	
	\az\critical_section(function() use(&$LRU, $db) {
		$LRU[$db] ??= new \az\KeyedLRU(@\az\settings\HOLDED_CONNECTIONS[$db]??1);
	});

	// take from global, store in context
	$connection = $pooled ? $LRU[$db]->get($key) : null;
	if(!$connection) {
		// slow path
		$lib = @$dbObj['lib'];
		$driver = $dbObj['factory'];

		if($lib) \az\safe_require_once($lib);

		if(!@$dbObj['fixed_user'] && $login) {
			// explicit login info
			$user = $login;
			$pass = $pass;
			// if user/pass vary persistent usually useless 
		} else {
			// fallback to ini-stored creds
			$user = @$dbObj['user'];
			$pass = @$dbObj['pass'];
		}

		$connection = $driver($dbObj, $user, $pass);
		if(!$connection) return; // bad params		
	}
	$ctx['db-connections'][$key] = $connection;

	// even if request in UNpooled, we return results into pool
	\Swoole\Coroutine::defer(function() use($ctx, $db, $key, $LRU) {
		if(@$ctx['db-connections'][$key])
			$LRU[$db]->put($key, $ctx['db-connections'][$key]); // put connection back to global pool
	});
	return $connection;	
}

function connectAsCurrentUserPooled($db) { return connect($db); }

