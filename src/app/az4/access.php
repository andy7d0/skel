<?php namespace az\access;

const magic =  '00-access-4';


class AutorizedUser {
	private array $roles = [];

	function __construct(private array $state)
	{	
		$this->roles = \az\settings\roles($state);
	}

	function has_role(...$role) {
		foreach($role as $r)
			if(@$this->roles[$r]) return true;
		return false;
	}
	function all_roles() { return @$this->roles ?? []; }

	// next are always effective
	function login() { return @$this->state['login']; }
	function personId() { return @$this->state['personid']; }
	function accessTag() { return @$this->state['person_access_tag']; }
	function sysrole() { return @$this->state['sysrole']; }
	function dbLogin() { return @$this->state['db_login']; }
	function dbPass() { return @$this->state['db_pass']; }

	static function authorizationHeader($state) {
		//error_log("ST".var_export(self::$state,true));

		$enc = encode(serialize($state));
		return "Bearer: $enc";
	}
}

function loginUser($request) {
	$authorization = @$request->header['authorization'];
	if($authorization) {
		if(preg_match('/^Bearer:\s*(.*)/',$authorization, $m)) {
			$authorization = @unserialize(decode($m[1]));
		} else {
			$authorization = null;
		}
		if($authorization
			&& @$authorization['magic'] === magic
			&& @$authorization['peer'] === @$request->header['x-peer'])
		{
			if(time() < $authorization['stamp'] + \az\settings\AUTH_TT) {
				// successfully autorized shortly
				return new AutorizedUser($authorization);
			} else {
				// nice auth, but too late
				$authorization = \az\settings\login($authorization['db_login'], $authorization['db_pass']);
				if($authorization) {
					// successfully reautorized after auth timeout
					return new AutorizedUser($authorization);
				}
			}
		}
	}
	// not logged in
	throw new \ResourceForbidden('login');
}

const cipher = "aes-128-cfb";
const hmac = 'sha256';
const hmac_lev = 32;
function encode($string,$key = null) {
	if(!$key) $key = \az\settings\COOKIE_KEY;
	$ivlen = openssl_cipher_iv_length(cipher);
	$iv = openssl_random_pseudo_bytes($ivlen);
	$ciphertext_raw = openssl_encrypt($string, cipher, $key, $options=OPENSSL_RAW_DATA, $iv);
	$hmac = hash_hmac(hmac, $ciphertext_raw, $key, $as_binary=true);
	return base64_encode( $iv.$hmac.$ciphertext_raw );
}

function decode($string,$key = null) {
	if(!$key) $key = \az\settings\COOKIE_KEY;
	$c = base64_decode($string);
	$ivlen = openssl_cipher_iv_length(cipher);
	$iv = substr($c, 0, $ivlen);
	$hmac = substr($c, $ivlen, hmac_lev);
	$ciphertext_raw = substr($c, $ivlen+hmac_lev);
	$original_plaintext = @openssl_decrypt($ciphertext_raw, cipher, $key, $options=OPENSSL_RAW_DATA, $iv);
	$calcmac = hash_hmac(hmac, $ciphertext_raw, $key, $as_binary=true);
	if (@hash_equals($hmac, $calcmac))// timing attack safe comparison
	{
	    return $original_plaintext;
	}
	error_log("decode: wrong data");
}

function scram_storage_key($iterations, $salt_64, $pass) {
	$salt = base64_decode($salt_64);
	$saltesPass = hash_pbkdf2("sha256", $pass, $salt, +$iterations, 0, true);
	$clientKey = hash_hmac("sha256", "Client Key", $saltesPass, true);
	$storageKey = hash("sha256", $clientKey, true);
	//$storageKey_64 = base64_encode($storageKey);
	return $storageKey;
}

function scram_decode($string, $iv, $scram_key) {
	$c = base64_decode($string);
	//var_dump(strlen($c));
	return @openssl_decrypt($c, 'aes-256-cbc', $scram_key, $options=OPENSSL_RAW_DATA, $iv);
}


// data should be 256 bytes
// returns signature
function sign_small_data($data) {
	openssl_private_encrypt(base64_decode($data), $enc, \az\settings\GLOBAL_PRIV, OPENSSL_NO_PADDING);
	return base64_encode($enc); 
}
// data should be 256 bytes
function verify_small_data($data, $signature) {
	return sign_small_data($data) === $signature; 
}

function pubkey_modulus() {
	$K = openssl_pkey_get_private(\az\settings\GLOBAL_PRIV);
	return base64_encode(openssl_pkey_get_details($K)['rsa']['n']);
}


function check_headers($headers, $raw_values) {
	if( !array_key_exists('x-peer', $headers)) throw new \ResourceForbidden('!peer');
	if( !array_key_exists('x-ts', $headers)) throw new \ResourceForbidden('!ts');
	if( !array_key_exists('x-sa', $headers)) throw new \ResourceForbidden('!sa');
	if( abs(time() - $headers['x-ts'] ) > 10 ) {
		// do nothing for now
	}

	$h = hash_hmac('sha256', $raw_values, $headers['x-ts'] . ':' .
			hash_hmac('sha256', $headers['authorization'], $headers['x-peer'] )
		);

	if($h !== $headers['x-sa']) throw new \ResourceForbidden('args');
}

function impersonate($target) {
	$ctx = \Swoole\Coroutine::getContext();
	$currentUser = @$ctx['request']->server['current_user'];
	if(!$currentUser) return;
	if(!$currentUser->has_role('user_staff')) return;

	$impAuth = \az\settings\impersonate($target, $currentUser);

	if(!$impAuth) return;

	return $impAuth;
}

