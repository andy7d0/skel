<?php
require_once 'access.php';

\define_api_route(function($login, $pass){
	$auth = \az\settings\login($login, $pass); // real login
	if(!$auth) return;
	$info = $auth;
	unset($info['person_access_tag']);
	return ['authorization'=> AutorizedUser::authorizationHeader($auth)
			, 'info' => $info];
}
,__FILE__);
