<?php

class X {
	function __toString() {
		return "-x-";
	}
}

$xx = 100;

var_dump(fn ($params) => "Tbl WHERE k = {$params(1)} SET x = {$params(2)}");
// Update(fn ($params) => "Tbl WHERE k = {$params(1)} SET x = {$params(2)}");
// Update(fn ($params) => "Tbl WHERE {$params::k(1)} SET {$params::x(2)}");
// Update(fn ($params) => "Tbl WHERE k = {$params} SET x = {$params}")(1,2);
// Update(fn ($params) => "Tbl WHERE {$params::k()} SET {$params::x()}")->k(1)->x(2)->go();
// Update(fn ($params) => "Tbl WHERE k = {$params->k} SET x = {$params->x}")->k(1)->x(2)->go();
// Update(fn ($params) => "Tbl WHERE k = {$params->k} SET x = {$params->x}")(['k'=>1, 'x'=>2]);


// Update("Tbl WHERE k = ? SET x = ?")(1,2);
// Update("Tbl WHERE k = :k SET x = :x")->k(1)->x(2);
// Update("Tbl WHERE :? SET :? ")->k(1)->x(2);
// Update("Tbl WHERE :=k SET :=x")->k(1)->x(2);

// prepared (positional)
//var_dump(fn ($params) => "Tbl WHERE k = {$params} SET x = {$params}")
// prepared (named) (but this is get, which is unsafe in swoole)
//var_dump(fn ($params) => "Tbl WHERE k = {$params->name1} SET x = {$params->name2}")
//var_dump(fn ($params) => "Tbl WHERE {$params->name1()} SET {$params->name2()}")

/*
	there are two command's forms
	internally both of them are cached prepared statements
	but first takes params immidiatly in the commnad string
	and second takes postionals of named params

	first can be closure
	SelectColumn(fn ($p) =>"c FROM tbl WHERE id = {$p(expr)}")
	and second can be string
	SelectColumn("c FROM tbl WHERE id = ?")(expr, ...)
	SelectColumn("c FROM tbl WHERE id = :id")(id: expr, ...)
	SelectColumn("c FROM tbl WHERE . = :id")(id: expr, ...)
*/

function f() {

	// var_dump($GLOBALS);

	echo "a ${T(1)} ${T(2)}";

}

f();



function T($v) {
	// global $INTERPOLATION_HACK;

	// $INTERPOLATION_HACK = 123;

	//return "GLOBALS['xx']";
	return 'xxxxxxxxxxxx';
}

//"WHERE x = {$k}"

//Update("Tbl WHERE k = :x")([':x'=>1]);
//Update(fn ($f) => "Tbl WHERE k = {$f(1)} SET x = {$f(2)}");
//Update('Tbl WHERE k ='.SQL(1).' SET x = '.SQL(2).'');

/*

	fn ($f) => " ... WHERE k = {$f(1)} SET f = {$f(20)} "
	
	"... WHERE k = ${\SQL()}"

	function CMD() {
		global $SQL;
		Update("Tbl WHERE k = {$SQL(1)}")
	}

	vairants

	->set(['name'=>value, 'name'=>value])

	->name(value)->name(value)

	->set->name(value)->name(value)

*/