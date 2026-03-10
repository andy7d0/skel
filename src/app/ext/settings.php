<?php namespace az\settings;

const DATABASES = [
	'main' => [
		'server' => 'pgsql:host=main_bouncer port=6432 dbname=main_db'
		, 'lib' => __ROOTDIR__.'/az4/db-driver-pg.php'
		, 'factory' => 'az\db\driver\PDO\php\connect'
		, 'init_mode' => 'transaction'
												  // conection (re)initialisation mode
												  // when user-based role adjustment used
												  // we need redo it when connection reused
												  // also, if bouncer come to play
												  // it internally reuse the same real connection
												  // for each transaction, so we reset it
				, 'user' => 'anonymous'       
												  // database username
												  // if omited, current process-owner username is used
				                                  //   it can be kerberos or peer authenticated
												  // if is null, current user name (and password) used 
												  //   if fallback_user set (and user is null)
												  //   , it is used when connection failed
				, 'pass' => '1'
				                                  // database pass
				                                  // TODO: load passwords from protected storage
	]
];


const SERVER_PORT = 9580;
const MAX_COROUTINE = 3000;
const WORKER_NUM = 2; //TODO: dev/prod
const MAX_CONNECTION = 1000; //TODO: dev/prod
const PACKAGE_MAX_LENGTH = 10_000_000; // 10M

const MAX_WAIT_TIME = 0.1; //it's dev, prod should be much bigger

const HOLDED_CONNECTIONS = ['main' => 64]; 

const ADMIN_SERVER = '0.0.0.0:9582';

const MAX_CONCURRENCY = 1_000_000;
const WORKER_MAX_CONCURRENCY = 10_000;

const AUTHENTICATED_URLS = 'user|semistaff|staff|sysop|admin';
const AUTH_TTL = 5*60; // 5m
const COOKIE_KEY = 'D2fq9No8pzsTb12nRx';
const INTERNAL_KEY = '6677198927423874297428937429874984728987324729791741969833734632682685268e7537189719719001';
// const CLIENT_KEY = "?313142423424532525342525253452352389099809808093420?";


const GLOBAL_PRIV = <<<K
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCp4aZPWHRFrh3H
9UdTf7Uzhs8ZwEEPlML4+0aH4+hNimt1Orh4UL/Rwrl9oytY6nsmccL2gOLc/2gK
B4qajFtZIk4MH9N8EUIuw9tizwH50K18hyWo4b4Wd43tIDa97/JLqIWJIbPlkUYQ
E4vXa3FDh48L7ILdlz3W1YC2klzigCWi90vwhTNujewdji/U6OtPeqYudXMkprOz
xur43CmDeFgNxC3kSD17SWc0psOs9CcTpKaBcFa9I1JCHqKXYXjHgryjY1NaOkS7
Qb0odfcnOpTg9JuwBVf/4LNSlNQK1UDaCtZkD3PQrgKnXF5+Xq0Lw93G+IaDamyc
jSgHl6dbAgMBAAECggEAD1KK4X451bnlXFs4FZ5sfA5gajl7RMoApsKXQBUWdCP6
tD/Zhc4wUJDOxTe55nlKJhOkGsxRagIS/FCY0X68xunZGBV1lquoO53IkTClqqzs
cOs83AiPnU9aoQ6P3j4HRyHjxXruOTo+Rp+H54qv1Ezxe7xXdpNR7XYjxJPbLKyh
P43t5EaViabLDAIh2x1zYeeUgCTE2Mr0Re6wKm9J67GUqCk450nZFn3dJvxhEJTq
DHTcviz8IA9d7zIk+GSJaAgs8Q161J054dJmSeW1Lf2tIBPIxjcDGJcwUAE7FR2U
3Y/BwJdSLSBPxbWSkJSdKqtTrArsaatJKbZ/8QxFDQKBgQDTEbetxwL6JcDB9ntq
kma/gpb+mSZom4s/pBNmZDGZeAxehsoDfB/8cMeveDLAN0XrAthDp3r4w1JvA6JR
jY1FU2KUm+nxPnVUtZ/JuYbijZYi1fszuPiCSsaS/TuZC7OTElUVaA2FmG4inAsJ
6N3d0MBe+wNcDhDev3KszwAZRwKBgQDOC2RbzyfQCyV1HFRVECmIMSZU+dHyBTdH
y+QE3Qg7Xm9nDWGZvB8KAMk8N/RJTOk5P1zw1ywrYHLM7uhNlcnH8kH0kalZFDWj
mjLJXR30P7boOYamVVvnAk3e+QNl71Eg1wKFiYty76XdzMhnTLCTmZhU0bn+3m3O
3py4XbYLTQKBgAO3ciaLNJA3DffcYTv1K/3/TK1bAQQiiQcr2nOZHA55wK4BbZk2
HFITolCCq1IbJw4GVMyMLGwo9FCkHb2V4oDwAPJg9HOdB+/f6tpge/GNULF4Vx4I
CcgxjOGVt/Dv9c+HKRxhYquRjY7qdH9OLGn1fQ2vGdYLIVzqvhgw5O2NAoGBALAV
/EaZ2yRo4jIba9bmYRgLKP8mIM38tymcjdm6K/bQ1dP0E50WsFAUK+ZSy2p5WDec
dwk8WnsXigSph84GXNOLreIdOeTu6IhQl2aPNbIvYVlFEFXGTSw3Q+VyWf0bcPHn
zjfhPFOViuLqx7nASIdblFuogJPX82//v1+wdothAoGAS90sfmkGzGuVNqfy9gPW
cm5Nx9xKkhlz0LRubFy6QGemYWnDgWI0Qq3YRvPvn1m4ZD1I5/4hWz8aGA2W8Xyd
LwYpLMafm8arWyekfqp6BPufeuFn6fG98QbiRzs+a9DJl3Tp5Rkx1GLW2DoB3ISE
fJwZPoIujBq9N/bpVMmFAWI=
-----END PRIVATE KEY-----
K;

const GLOBAL_PUBL = <<<K
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqeGmT1h0Ra4dx/VHU3+1
M4bPGcBBD5TC+PtGh+PoTYprdTq4eFC/0cK5faMrWOp7JnHC9oDi3P9oCgeKmoxb
WSJODB/TfBFCLsPbYs8B+dCtfIclqOG+FneN7SA2ve/yS6iFiSGz5ZFGEBOL12tx
Q4ePC+yC3Zc91tWAtpJc4oAlovdL8IUzbo3sHY4v1OjrT3qmLnVzJKazs8bq+Nwp
g3hYDcQt5Eg9e0lnNKbDrPQnE6SmgXBWvSNSQh6il2F4x4K8o2NTWjpEu0G9KHX3
JzqU4PSbsAVX/+CzUpTUCtVA2grWZA9z0K4Cp1xefl6tC8PdxviGg2psnI0oB5en
WwIDAQAB
-----END PUBLIC KEY-----
K;


function login($login, $pass, &$ret = null) {
	\az\safe_require_once('db-driver-base.php');
	// we hold access_db connection
	// at it is jush a function call 
	//  we can use bouncer and share connection in transaction/statement mode! 

	// special users (api, daemon etc) skip this code

	try{

	// always perform REAL, NOT POOLED, connect
	// due to check real login/pass here
	$db = \az\db\driver\connect('main', $login, $pass, false); // FALSE = unpooled
	
	// if connected, we has valid user with valid cred user
	// if not, connect throw and cache item left unitialized
	// so we can reconnect later with i.e. anonumous credentials

	/*
		мы не можем ограничить ф-ю get_uinfo из-за tarnsaction pooling
		но не хотим передавать пароль на сервер ни в каком виде.
		срвер знает, однако, scram storage key
		может вернуть:
		iter, server-salt, storageKey + зашифрованные на key данные

		клиент также, зная пароль + server-salt может получить storageKey

		и расшифровать все
	*/
	$info = $db->executeWithParams("SELECT public.get_uinfo(?)", [$login], ['cmd'=>'login'])
			->fetchColumn();
	if(!$info) return;
	if(preg_match('/^(\d+):([^:]+):([^:]+):(.*)/s',$info, $m)) {
		list( , $iter, $salt, $iv, $enc ) = $m;
		$key = \az\access\scram_storage_key($iter,$salt, $pass);
		$info = \az\access\scram_decode($enc,base64_decode($iv),$key);
		$info = @json_decode($info);
		//var_dump($info);
		// info: {personid, sysrole, person_access_tag, ext, int} here
		if(@$info->magic !== hash('sha256', @$info->person_access_tag))
			throw new \Exception('no decoded');
	} else {
		throw new \Exception('not a token');
	}

	// client uses $info transparently, so, each field required

	// add token to login info
	$acces = (array)$info;
	$acces['db_login'] = $login; 
	$acces['db_pass'] = $pass; 
	return $acces;

	/*
		when login returns to the client
		it set (pseudo)cookie with auth token
		later, client asks about cached uinfo
		if login itself do not update the server cache 
		it's responce totally useless, due to server will be asked 
		later, when login updates cache (and, so, goes trough server-side ddc)
		it CAN set cache and save one request
		also, we can directly set (update) cache right from here
		FIXME: set cache from ddc
	*/
	
	} catch(\Exception $e) {
		//FIXME: throw database error
		//       but skip 'no acces' 
		if (isset($ret)) $ret= $e->getCode()." # ".$e->getMessage()." ";
		//print_r($e->getCode()." # ".$e->getMessage());
	}
}

function resetConnection($conn, $currentUser){
	$login = $currentUser?->login(); // used possible impersonated id

	if($login){
		$personid = $currentUser?->personId();
		$person_access_tag = $currentUser?->accessTag();

		$version = \az\settings\db_version(); // global version
		$ok = $conn->executeWithParams("SELECT public.reset_connection(?,?,?,?)"
			,[$login, $personid, $person_access_tag, $version]
			,['cmd'=>'reset-logged #'.$conn->connId])
			->fetchColumn();
		if($ok) { 
			if($login !== $currentUser?->dbLogin()) {
				// impersonated, set it's role as db role
				$sysrole = $currentUser?->sysrole();
				$conn->executeWithParams("SET LOCAL ROLE $sysrole");
			}
			return; 
		}
		error_log('UPDATE DB TO: '.$version);
		// if version mismatch return special exception
		throw new DBVersionException();
	}
	else
		$conn->executeWithParams("SELECT public.reset_connection()"
		,[]
		,['cmd'=>'reset-anon #'.$conn->connId]);
}

function impersonate($target, $currentUser) {
	\az\safe_require_once(__ROOTDIR__.'/az4/db-oo.php');

	$info = \az\db\SelectColumn("user_staff.get_uinfo_somebody(?)")($target);

	if(!$info) return;

	$acces = (array)$info;
	$acces['db_login'] = $currentUser->dbLogin(); 
	$acces['db_pass'] = $currentUser->dbPass(); 
	return $acces;
}
