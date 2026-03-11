<?php namespace az\access;

class AutorizedUser {
	private array $roles = [];

	function __construct(private object $uinfo, private object $sinfo)
	{	
		$this->roles = \az\settings\roles($uinfo);
	}

	function has_role(...$role) {
		foreach($role as $r)
			if(@$this->roles[$r]) return true;
		return false;
	}
	function all_roles() { return @$this->roles ?? []; }

	// next are always effective
	function login() { return @$this->uinfo->login; }
	function personId() { return @$this->uinfo->personid; }
	function sysrole() { return @$this->uinfo->sysrole; }
	function accessTag() { return @$this->sinfo->pt; }
	function dbLogin() { return @$this->sinfo->dl; }
	function dbPass() { return @$this->sinfo->dp; }
}

function loginOnlineUser($request, $response) {
	$authorization = @$request->header['authorization'];
	if($authorization) {
		if(preg_match('/^Bearer:\s*(.*):(.*)/',$authorization, $m)) {
			$uinfo = json_decode(base64_decode($m[1]));
			$sinfo = json_decode(\az\access\decode($m[2]));
		} else {
			$sinfo = null;
		}
		if($sinfo
			&& @$sinfo->peer === @$request->header['x-peer'])
		{
			if(time() < $sinfo->stamp + \az\settings\AUTH_TT) {
				// successfully autorized shortly
				return new AutorizedUser($uinfo, $sinfo);
			} else {
				// nice auth, but too late
				if(\az\settings\login($sinfo->dl, $sinfo->dp, $uinfo_str, $personTag)) {
					// TODO: compare pt and $personTag
			        $response->header('authorization', genAuthHeader($uinfo_str, $sinfo));
					// successfully reautorized after auth timeout
					return new AutorizedUser(json_decode($uinfo_str), $sinfo);
				}
			}
		}
	}
	// not logged in
	throw new \ResourceForbidden('login');
}

function genAuthHeader($uinfo_str, $sinfo) {
	$ctx = \getRequestContext();
	$request = $ctx['request'];
	$sinfo->stamp = time();
	$sinfo->peer = $request->header['x-peer'];
	return "Bearer: "
			.base64_encode($uinfo_str)
			.':'.
			\az\access\encode(json_encode($sinfo))
			;
}

const cipher = "aes-128-cfb";
const hmac = 'sha256';
const hmac_lev = 32;
function encode($string,$key = null) {
	if(!$key) $key = \az\settings\COOKIE_KEY;
	$ivlen = openssl_cipher_iv_length(cipher);
	$iv = openssl_random_pseudo_bytes($ivlen);
	$ciphertext_raw = openssl_encrypt($string, cipher, $key, OPENSSL_RAW_DATA, $iv);
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
	$original_plaintext = @openssl_decrypt($ciphertext_raw, cipher, $key, OPENSSL_RAW_DATA, $iv);
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

function decode256($string,$key) {
	$c = base64_decode($string);
	$ivlen = openssl_cipher_iv_length('aes-256-cfb');
	$iv = substr($c, 0, $ivlen);
	$hmac = substr($c, $ivlen, hmac_lev);
	$ciphertext_raw = substr($c, $ivlen+hmac_lev);
	$original_plaintext = @openssl_decrypt($ciphertext_raw, 'aes-256-cfb', $key, OPENSSL_RAW_DATA, $iv);
	$calcmac = hash_hmac(hmac, $ciphertext_raw, $key, $as_binary=true);
	if (@hash_equals($hmac, $calcmac))// timing attack safe comparison
	{
	    return $original_plaintext;
	}
	error_log("decode: wrong data");
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

