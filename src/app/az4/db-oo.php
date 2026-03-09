<?php namespace \az\db;

require_once __DIR__.'/db-driver-base.php';

class Command {
    function __construct(public string $database) {}

    function Execute($cmd) { return new SelectCommand($cmd, $this->database); }

    function Select($cmd) {
        if(!preg_match('/^\s*(SELECT|WITH)\s/i',$cmd)) $cmd = 'SELECT '.$cmd;
        return $this->Execute($cmd);
    }

    function SelectColumn($cmd) { return $this->Select($cmd)->fetchColumn(); }
    function SelectRow($cmd)  { return $this->Select($cmd)->fetchObj(); }
    function SelectRowUnnamed($cmd) { return $this->Select($cmd)->fetchUnnamed(); }

    function SelectColumnAll($cmd) { return $this->Select($cmd)->fetchColumnAll(); }
    function SelectAll($cmd) { return $this->Select($cmd)->fetchAll(); }

    function SelectKeyPairs($cmd) { return $this->Select($cmd)->fetchKeyPairs(); }
    function SelectKeyAll($cmd) { return $this->Select($cmd)->fetchAllKeyed(); }
    function SelectGrouped($cmd) { return $this->Select($cmd)->fetchGrouped(); }

    function Update($cmd, $returning = null) {
        if(!preg_match('/^\s*UPDATE\s/i',$cmd)) $cmd = 'UPDATE '.$cmd;
        return new UpdateCommand($cmd, $this->database, $returning);
    }

    function InsertInto($cmd, $returning = null) {
        if(!preg_match('/^\s*INSERT\s++INTO\s/i',$cmd)) $cmd = 'INSERT INTO '.$cmd;
        return new InsertCommand($cmd, $this->database, $returning);
    }

    function Delete($cmd) {
        if(!preg_match('/^\s*DELETE\s++FROM\s/i',$cmd)) $cmd = 'DELETE FROM '.$cmd;
        return new DeleteCommand($cmd, $this->database);
    }

    function Upsert($cmd, $returning = null) {
        if(!preg_match('/^\s*INSERT\s++INTO\s/i',$cmd)) $cmd = 'INSERT INTO '.$cmd;
        return new UpsertCommand($cmd, $this->database, $returning);
    }

    // named parameters ONLY!!!
    function CallSQLFunction($cmd) { 
    	return (new CommandBase("SELECT $cmd", $this->database))->PREPARE();
    }

    function Transaction($f) {
        $c = \az\connect\connectAsCurrentUserPooled($this->database);
        $ret = null;
        if($c->beginTransaction()) {
            try {
                $ret = $f();
            } catch(\Throwable $e) {
                $c->rollBack();
                throw $e;
            }
            $c->commit();
        } else $c->transactionLevel = 0;
        return $ret;
    }


    public static function main() { return new Command('main_db'); }
    public static $DB;
}

Command::$DB = new class {
	function __callStatic($name, $args) { return new Command($name); } 
}

/*
	variants
	1) fn($_) => ".... id = {$_(1)}"
		не красиво
		плохо совместимо с update
	2) всегда именованные параметры в т.ч. с подстановкой имени

	Select("a from t where . = :id")(id: 1)
	1) красиво
	2) просто
	3) совместимо с разными способами компоновки
	минусы
	1) для сразу выполняемой команды имена два раза
	2) всегда именованные параметры (но можно относительно просто заменить их на позиционные)

	если посчитать кол-во параметров (или имен)
	 можно знать, когда выполнять команду
	 и все ли параметры на месте
*/


class CommandBase {
	public string $method = '';
	public array $args = [];
	function __construct(public string $cmd, public $database) {}

	protected function using($args) {
		$this->args = [...$this->args, ...$args];
		foreach($args as $f => $v) $this->with($f);
		return array_keys($args);	
	}

	function PREPARE() {
        return new CommandPrepared($this);
    }

	function DO(...$args) {
		return $this->prepare()(...$args);
	}

	function __invoke(...$args){ return $this->DO(...$args); }

	function inner() { return $this->cmd; }

}

class CommandPrepared {
	public ?object $cmd = null;
	public array $args = [];
	public array $names = [];
	public string $method = '';
	function __construct(object $src) {
		$cmd = $src->inner();

		switch($src->method) {
			case 'fetchColumn': case 'fetchObj': case 'fetchUnnamed':
			$cmd .= ' LIMIT 1 ';
		}

		$cmd = preg_repace('/.(\s*=\s*):([a-zA-Z_][a-zA-Z0-9_]*)/',' $2 $1 :$2 '. $cmd);
		$c = self::eliminateStrings($cmd);
		preg_match_all('/(?<=\s:)\S/', $c, $m);
		$this->names = $m[0];

    	$this->cmd = \az\connect\connectAsCurrentUserPooled($src->database)
    					->parepareCommand($cmd,['cmd'=>$cmd]);

    	$this->method = $src->method;
	}
    function __invoke(...$args) {
    	$a = [];
		foreach($this->names as $name) {
			//todo: check!
			$a[] = array_key_exists($name, $args)? $args[$name] : $this->args[$name];
		}
    	if($this->method) {
	        $ret = $this->cmd->executePrepared($a);
    		$ret = $ret->{$this->method}();
            //if($ret === false) $ret = null; //DO WE NEED IT?
            return $ret;
    	} else {
       		return $this->cmd->executeAndReturnGeneratedId($a);
       	}
    }

	static function eliminateStrings($str) {
		$str = preg_replace('/[$][$].*?[$][$]/s',"''",$str);
		$str = preg_replace('/[$][a-zA-Z_][a-zA-Z0-9_]*[$].*?[$]\1[$]/s',"''",$str);
		$str = preg_replace("/E'(?:[^'\\]|\\.)*'/","''",$str);
		$str = preg_replace("/'[^']*'/","''", $str); // this think 'a''b' as two adjacent strings and converts to ''''
													// but it's ok for sanitize commands
		return $str;
	}
}

// where + limit
// usually, we do not need explicit limit
// 

class SelectCommand extends CommandBase {
	function __call($name) { $method = $name; return $this; }

	function WHERE(...$fields) {
		if(!$fields) return $this->DO();
		$fields = $this->using($fields);
		$this->cmd .= " WHERE ".implode(' AND ', array_map(fn($f)=>"$f = :$f",$fields));
		return $this->DO();
	}
	function AND(...$fields) {
		if(!$fields) return $this->DO();
		$fields = $this->using($fields);
		$this->cmd .= " AND ".implode(' AND ', array_map(fn($f)=>"$f = :$f",$fields));
		return $this->DO();
	}
}


/**
 * \az\db\SelectColumn('f from t where k = :x')(x:1)
 * ...
 * 
 * or 
 * $cmd = \az\db\SelectColumn('....')->prepare();
 * $cmd(args1); $cmd(args2) ...
 * 
 * \az\db\SelectColumn('f from t')->where(k:1);
 * \az\db\SelectColumn('f from t where fld < :m')(m:100);
 * 
 * (FROM: ....
 *  , WHERE(a:1,b:2)
 *  , ORDER(a,b,c)
 *  , HAVING:
 * )
 * 
 */

function SelectColumn($cmd) { return Command::main()->SelectColumn($cmd); }
function SelectRow($cmd)  { return Command::main()->SelectRow($cmd); }
function SelectRowUnnamed($cmd) { return Command::main()->SelectRowUnnamed($cmd); }

function SelectColumnAll($cmd) { return Command::main()->SelectColumnAll($cmd); }
function SelectAll($cmd) { return Command::main()->SelectAll($cmd); }

function SelectKeyPairs($cmd) { return Command::main()->SelectKeyPairs($cmd); }
function SelectKeyAll($cmd) { return Command::main()->SelectKeyAll($cmd); }
function SelectGrouped($cmd) { return Command::main()->SelectGrouped($cmd); }

function Execute($cmd) { return Command::main()->Execute($cmd); }


/**
 *
 * \az\db\Update("tbl")->set(a:10,b:20)->where(k:10); 
 * 
 * \az\db\Update(fn($P)=>"tbl {$P->set(k:1,f:2)} WHERE . = :k")(k:1, f: 2); 
 * 
 * 
 */

class UpdateCommand extends CommandBase {
	public array $set = [];
	function __call($name,$args) {
		$this->set[] = $name;
		if(func_num_args()) {
			$this->args[ $name ] = @$args[0];
		}
		return $this;
	}
	function SET(...$fields) {
		$cmd = $this->using($fields);
		$this->set = [ ...$this->set, ...$cmd ];
		return $this;
	}

	public string $returning = '';
	function RETURNING($name) { $this->returning = $name; return $this; }

	function WHERE(...$fields) {
		if(!$fields) return $this->DO();
		$fields = $this->using($fields);
		$this->cmd .= " WHERE ".implode(' AND ', array_map(fn($f)=>"$f = :$f ",$fields));
		return $this->DO();
	}
	function AND(...$fields) {
		if(!$fields) return $this->DO();
		$fields = $this->using($fields);
		$this->cmd .= " AND ".implode(' AND ', array_map(fn($f)=>"$f = :$f ",$fields));
		return $this->DO();
	}
	function inner() {
		$cmd = preg_replace('/(UPDATE\s+\S+\s+(?:AS\s+\S+)?)/i'
			,'$1 SET '
				.implode(', ', array_map(fn($f) => "$f = :$f ", $this->set))
		, $this->cmd);

		if($this->returning) $cmd .= "RETURNING $this->returning";

		return $cmd;
	}
}

function Update($cmd) { return Command::main()->Update($cmd); }


/**
 *
 * 	\az\db\InsertInto("tbl")->f(1)->values(k:1,v:2); 
 * 
 * 	\az\db\InsertInto("tbl")->values(k:'1',v:'2'); 
 * 	
 *  \az\db\InsertInto("tbl")->SELECT(a:_,b:_,c:'d+1')
 * 	->FROM(' ...... ')
 * 	->WHERE(a:1, x:10)
 * (); 
 * 
 * 
 */

class InsertCommand extends CommandBase {
	public array $set = [];	
	function __call($name, $args) {
		$this->set[] = $name;
		if(func_num_args()) {
			$this->args[ $name ] = @$args[0];
		}
	}
	function VALUES(...$fields) {
		$cmd = $this->using($fields);
		$this->set = [ ...$this->set, ...$cmd ];
		return $this->DO();
	}

	public string $returning = '';
	function RETURNING($name) { $this->returning = $name; return $this; }

	function inner() {
		$cmd = preg_replace('/(INSERT\s++INTO\s++\S++\s++(?:AS\s+\S+)?)/i'
			,'$1 '
				'(' .implode(', ', $this->set). ')'
			, $this->cmd);
		
		$cmd .= ' VALUES ('
				.implode(', ', array_map(fn($f) => " :$f ", $this->set))
				.' )';

		if($this->returning) $cmd .= "RETURNING $this->returning";

		return $cmd;
	}
	function SELECT(...$cols) {
		if($this->set) {
			// it is error!
			throw new Exception("VALUES and SELECT can not meet in the same insert");
		}
		$cmd = $this->cmd;
		$exprs = [];
		$fields = [];
		foreach($cols as $f=>$e) {
			$fields[] = $f;
			$expr = $e instanceof Placeholder ? $f : $e;
			$exprs[] = $f === $expr ? $f : "$expr AS $f";
		}
		$cmd .= '(' .implode(', ', $fields). ')';
		$cmd .= " SELECT ";
		$cmd .= implode(', ', $exprs);
		return new InsertSelected($cmd, $this->database, $this->returning);
	}
}
function InsertInto($cmd) { return Command::main()->InsertInto($cmd); }

class Placeholder {}
define('_', new Placeholder);

class InsertSelected extends SelectCommand {
	function __construct(public string $cmd, $database, public string $returning) {
		parent::__construct($cmd, $database);
	}
	function FROM($cmd) {
		$this->cmd .= " $cmd ";
		return $this;
	}
	function inner() {
		$cmd = $this->cmd;
		if($this->returning) $cmd .= " RETURNING $this->returning";
		return $cmd;
	}
}

/**
 *
 *  Upsert("tbl")
 *  ->SET(a:'1',b:'2')
 *  ->WHERE(id:111)
 *  
 */

class UpsertCommand extends SelectCommand {
	public array $set = [];
	function __call($name,$args) {
		$this->set[] = $name;
		if(func_num_args()) {
			$this->args[ $name ] = @$args[0];
		}
		return $this;
	}
	function SET(...$fields) {
		$cmd = $this->using($fields);
		$this->set = [ ...$this->set, ...$cmd ];
		return $this;
	}

	public string $returning = '';
	function RETURNING($name) { $this->returning = $name; return $this; }

	public array $keys = [];
	function WHERE(...$fields) {
		$cmd = $this->using($fields);
		$this->keys = $cmd;
		return $this->DO();
	}
	function inner() {
		$ins = [...$this->set, ...$this->keys];
		$cmd = preg_replace('/(INSERT\s++INTO\s++\S++\s++(?:AS\s+\S+)?)/i'
			,'$1 '
				'(' .implode(', ', $ins). ')'
			, $this->cmd);
		
		$cmd .= ' VALUES ('
				.implode(', ', array_map(fn($f) => " :$f ", $ins))
				.' )';

		$cmd .= ' ON CONFLICT ('.implode(', ', $this->keys).')';
		$cmd .= ' DO UPDATE SET '
				.implode(', ', array_map(fn($f)=>"$f = excluded.$f",$this->set));

		if($this->returning) $cmd .= "RETURNING $this->returning";

		return $cmd;
	}
}


class DeleteCommand extends SelectCommand {}

function Delete($cmd) { return Command::main()->Delete($cmd); }

function Transaction($f) { return Command::main()->Transaction($f); }

function CallSQLFunction($func_name_and_named_params) { return Command::main()->CallSQLFunction($func_name); }
