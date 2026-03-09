<?php namespace az\db\driver;
require_once __DIR__.'/db-driver-base.php';

#[\AllowDynamicProperties]
class PDODatabaseConnection extends AbstractDatabaseConnection {
	var $realConnection = null;
	var $connectionInitials = null;
	var $initMode = null; 
	var $connId = null;
	static $sconnId = 0;
	// null - default (instant) mode
	// 'ondemand' - ini on first use
	// 'transaction' - init on each (real) transaction / statement

	function __construct($PDO, $db) { 
		$this->connId = ++self::$sconnId;
		$this->realConnection = $PDO; 
		$this->initMode = @$db['init_mode'];
		// copy ini settings to connection object
	    foreach($db as $k=>$v)
	    	$this->$k = $v; //copy ini keys	
	    $this->dialect = dialect($db);
	}	

	function executeWithParams($cmd, $args, $cmd_info = null) {
		$stmt = $this->parepareCommand($cmd, $cmd_info);
		return $stmt->executePrepared($args);
	}

	function parepareCommand($cmd, $cmd_info) {
		// NOTE: should EMULATE prepare!!!!
	  //error_log($cmd_info ? 'prepare ' . $cmd_info['cmd'] : 'prepare null');
	  $stmt = $this->realConnection->prepare($cmd);   
	  return new PDODatabasePrepared($stmt, $cmd_info, $this);
	}

	function setConnectionInitials($commands) {
		$this->connectionInitials = $commands;
		if($this->initMode===null) {
			$this->doInitConnection();
		}
	}
	function doInitConnection() {
			//error_log('init connection! '.$this->initMode. ' #'.$this->connId);
  			if($this->connectionInitials)
				($this->connectionInitials)($this);
	}
	function beginTransaction() {
		//error_log('begin! '.$this->initMode. ' #'.$this->connId. ':'.$this->transactionLevel);
		if($this->transactionLevel++) return; // nested
		//error_log('prepare mode' . $this->realConnection->getAttribute(\PDO::PGSQL_ATTR_DISABLE_PREPARES));
		$this->realConnection->beginTransaction();
		if($this->initMode === 'transaction')
			$this->doInitConnection();
		//error_log('begin xid '.$this->realConnection->query('select pg_current_xact_id_if_assigned()')->fetchColumn());
	}
	function rollbackTransaction() {
		//error_log('rollback! '.$this->initMode. ' #'.$this->connId. ':'.$this->transactionLevel);
		if(--$this->transactionLevel) return; // nexted
		//error_log('rollback xid '.$this->realConnection->query('select pg_current_xact_id_if_assigned()')->fetchColumn());
		return $this->realConnection->rollBack();
	}
	function commitTransaction() {
		//error_log('commit! '.$this->initMode. ' #'.$this->connId. ':'.$this->transactionLevel);
		if(--$this->transactionLevel) return; // nexted
		//error_log('commit xid '.$this->realConnection->query('select pg_current_xact_id_if_assigned()')->fetchColumn());
		return $this->realConnection->commit();
	}
}

class PDODatabasePrepared extends AbstractDatabasePrepared {
	function __construct(public $stmt, public $cmd_info, public $conn) {}

	function executePrepared($args) {
		$args = AbstractDatabaseConnection::prepare_db_args($args);
		try {
			// in some modes we should init connecton here!
			//  it allows connection pooling
			if($this->conn->initMode === 'ondemand') {
					$this->conn->initMode = null; //once!
					$this->conn->doInitConnection();
			}
			if($this->conn->initMode === 'transaction' && 
				$this->conn->transactionLevel === 0) {
				// if no transaction, initiate new
				try {
					$this->conn->beginTransaction();
					$this->stmt->execute($args);
				} catch(\Exception $e) {
					$this->conn->rollbackTransaction();
					throw $e;
				}
				$this->conn->commitTransaction();
			} else
				$this->stmt->execute($args);
			return new PDODatabaseStmt($this->stmt);
		} catch(\PDOException $e) {
			throw new \az\connect\DBOOException($e, $this->stmt->queryString, $args, @$this->cmd_info);
		}
	}

	function executeAndReturnGeneratedId($args) {
	    try {
	    	$ret = $this->executePrepared($args);
	    } catch(\PDOException $e) {
	        throw new \az\connect\DBOOException($e, $this->stmt->queryString, $args, @$this->cmd_info);
	    }
		if(preg_match('#^/*lastInsertedId_[a-zA-Z0-9]+#', $this->stmt->queryString, $m)) {
			$f = "\\az\\sql_dialects\\lastInsertedId_$m[1]";
			return $f($this->stmt);
		}
		return $ret->columnCount() ? $ret->fetchColumn() : NULL;
	}
}

class PDODatabaseStmt extends AbstractDatabaseStmt {
	var $stmt = null;
	var $jsoned = [];
	function __construct($pdo_stmt) { 
		$this->stmt = $pdo_stmt;
	    for($i = 0; $i < $this->stmt->columnCount(); ++$i){
	        $meta = $this->stmt->getColumnMeta($i);
	        switch($meta['native_type'])
	        {
	            case 'json': case 'jsonb': $this->jsoned[$i] = $meta['name'];
	        }
	    }
	}

	function columnCount() { return $this->stmt->columnCount(); }
	function rowCount() { return $this->stmt->rowCount(); }

	function fetchColumn() { 
		$ret = $this->stmt->fetchColumn(); 
		if($ret===false) return $ret;
        if(@$this->jsoned[0]) $ret = \az\json_decode_null($ret); 
        return $ret;
	}

	function fetchObj() { 
		$ret = $this->stmt->fetch(\PDO::FETCH_OBJ); 
		if(!$ret) return $ret;
        //  === {name:val ...}
        foreach($this->jsoned as $name)
            $ret->$name = \az\json_decode_null($ret->$name);
        return $ret;
	}

	function fetchUnnamed() { 
		$ret = $this->stmt->fetch(\PDO::FETCH_NUM);
		if(!$ret) return $ret;
        //  === [vals ...]
        foreach($this->jsoned as $i=>$name)
            $ret[$i] = \az\json_decode_null($ret[$i]);
        return $ret;
	}

	function fetchColumnAll() { 
		$ret = $this->stmt->fetchAll(\PDO::FETCH_COLUMN);
        //  === [val]
        if(@$this->jsoned[0])
            foreach($ret as &$r)
              $r = \az\json_decode_null($r);
        return $ret;
	}
	function fetchAll() {
		$ret = $this->stmt->fetchAll(\PDO::FETCH_OBJ);
        //  === [{name:val ...}]
        foreach($this->jsoned as $name) {
	        foreach($ret as &$r)
                $r->$name = \az\json_decode_null($r->$name);
          unset($r);
        }
        return $ret;
	}

	function fetchKeyPairs() { 
		$ret = $this->stmt->fetchAll(\PDO::FETCH_KEY_PAIR);
        //  === [key=>val]
        if(@$this->jsoned[1])
            foreach($ret as &$r)
              $r = \az\json_decode_null($r);
        return $ret;
	}
	function fetchAllKeyed() { 
		$ret = $this->stmt->fetchAll(\PDO::FETCH_UNIQUE);
        //  === [key=>{name:val...}]
        foreach($this->jsoned as $name) {
	        foreach($ret as &$r)
                $r->$name = \az\json_decode_null($r->$name);
          unset($r);
        }
        return $ret;
	}
	function fetchGrouped() {
		$ret = $this->stmt->fetchAll(\PDO::FETCH_GROUP); 
        //   === [key=> [
        //                 {name:val, ....}
        //                 ....
        //              ]
        //       ]
        foreach($this->jsoned as $name) {
	        foreach($ret as &$a){
            foreach($a as &$r)
                  $r->$name = \az\json_decode_null($r->$name);
            unset($r);
          }
          unset($a);
        }
        return $ret;
	}

	function rowsIterator() { 
	  $stmt->setFetchMode(\PDO::FETCH_OBJ);
		return $this->stmt; 
	}
	
	function unnamedRowsIterator() { 
		$this->stmt->setFetchMode(\PDO::FETCH_NUM);
		return $this->stmt; 
	}
}
