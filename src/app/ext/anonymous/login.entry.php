<?php
require_once 'access.php';

\define_api_route(function($login, $pass){
	$auth = \az\settings\login($login, $pass); // real login
	if(!$auth) return;
	$info = $auth;
	unset($info['person_access_tag']);
	unset($info['magic']);
	return ['authorization'=> \az\access\AutorizedUser::authorizationHeader($auth)
			, 'info' => $info];
}
,__FILE__);

/*
impersonate: (should be in /ext/staff/ )

	$auth = \az\settings\impersonate($target_id);
	if(!$auth) return;
	$info = $auth;
	unset($info['person_access_tag']);
	unset($info['magic']);
	return ['authorization'=> \az\access\AutorizedUser::authorizationHeader($auth)
			, 'info' => $info];

*/