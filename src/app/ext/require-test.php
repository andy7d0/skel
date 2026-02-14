<?php

$x = 0;

function F() { 
	global $x;
	$x++; 
	error_log(__FILE__);
	error_log(__DIR__);
	return $x+2000;
}

