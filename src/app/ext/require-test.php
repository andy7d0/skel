<?php

$x = 0;

echo 'required';

function F() { 
	global $x;
	$x++; 
	error_log(__FILE__);
	error_log(__DIR__);
	return $x+1000;
}

