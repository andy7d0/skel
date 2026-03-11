<?php
require_once 'access.php';

\define_api_route(function($login, $pass){
	if(!\az\settings\login($login, $pass, $uinfo_str, $personTag)) // real login
		return;
	return ['authorization'=> \az\access\genAuthHeader($uinfo_str,
				(object)['pt' => $personTag
				, 'dl' => $login
				, 'dp' => $pass
				])
			, 'subscription' => \az\access\encode($login)	
		];
}
,__FILE__);

/*
impersonate: (should be in /ext/staff/ )

	$auth = \az\settings\impersonate($target_id);
	if(!$auth) return;
	$info = $auth;
	return ['authorization'=> \az\access\AutorizedUser::authorizationHeader($auth)
			, 'info' => $info];

*/