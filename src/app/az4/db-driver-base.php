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
  public function __construct($e, $queryString, $args, $cmd = mull) {
    parent::__construct(
      //function_exists('az\model\userException')?
      //  \az\model\userException($e, $queryString, $args, $cmd)
      //:
        $e->getMessage()
        , $e->getCode()
        , $e
    );
  }
}

class DBVersionException extends \Exception {}


function connectInt($db, $login = null, $pass = null) {
	$db = \az\settings\DATABASES[$db];

  $dsn = $db['server'];
		
	  $params = [
	  	\PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION
	  	, \PDO::ATTR_ORACLE_NULLS => \PDO::ATTR_ORACLE_NULLS
	  ];

	  if(@$db['pooling'] != 'no') {
			$params[\PDO::ATTR_PERSISTENT] = true;
			if(dialect($db)==='mssql') {
			  //PDO persistent connections don't work in MS SQL
			  $params[\PDO::ATTR_PERSISTENT] = false;
			  $dsn .= ';ConnectionPooling=1';
			}
	  }

	  if(dialect($db)==='pgsql') {
			//$params[\PDO::PGSQL_ATTR_DISABLE_PREPARES] = true;
		}

		// we have own pool so no system persistent connections
		$params[\PDO::ATTR_PERSISTENT] = false;
		if(!@$db['fixed_user'] && $login) {
			// explicit login info
			$user = $login;
			$pass = $pass;
			// if user/pass vary persistent usually useless 
			$params[\PDO::ATTR_PERSISTENT] = false;
		} else {
			// fallback to ini-stored creds
		  	$user = @$db['user'];
		  	$pass = @$db['pass'];
	  }

  	//error_log("DB CONN $dsn $user $pass");
	$conn =  function_exists('az\settings\dbConnector')?
				\az\settings\dbConnector($dsn, $user, $pass, $params)
			: new \PDO($dsn, $user, $pass, $params);
	$conn = new PDODatabaseConnection($conn, $db);

	$conn->setConnectionInitials(
		function($conn){
			$ctx = Swoole\Coroutine\getContext();
			$currentUser = @$ctx['request']->server['current_user'];

			\az\settings\resetConnection($conn, $currentUser);
		}
	);

  return $conn;
}

function dialect($a) { return @$a['dialect'] ?: @explode(':', @$a['server'], 2 )[0]; }

function connect(string $db, ?string $login = null, ?string $pass = null, boolean $pooled = true) {
	static $LRU = [];
	$key = "$db:$login:$pass";

	$ctx = Swoole\Coroutine::getContext();
	// co-part, no need to protect
	$ctx['db-connections'] ??= [];
	$connection = @$ctx['db-connections'][$key];
	if($connection) return $connection;

	// initialize global connection cache	
	critical_section(function() use(&$LRU, $db) {
		$LRU[$db] ??= new KeyedLRU(@\az\settings\HOLDED_CONNECTIONS[$db]??1);
	});

	// take from global, store in context
	$connection = $pooled ? $LRU[$db]->get($key) : null;
	if(!$connection) {
		// slow path
		$connection = connectInt($db, $login, $pass);
		if(!$connection) return; // bad params		
	}
	$ctx['db-connections'][$key] = $connection;

	// even if request in UNpooled, we return results into pool
	Swoole\Coroutine::defer(function() use($ctx, $db, $key, $LRU) {
		if(@$ctx['db-connections'][$key])
			$LRU[$db]->put($key, $ctx['db-connections'][$key]); // put connection back to global pool
	});
	return $connection;	
}

function connectAsCurrentUserPooled($db) {
	$ctx = Swoole\Coroutine\getContext();
	$currentUser = @$ctx['request']->server['current_user'];
	return connect($db, $currentUser?->login(), $currentUser?->pass());
}

