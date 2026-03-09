<?php 

// Parse declrations from header file.
$ffi = FFI::cdef( '
typedef struct JSRuntime JSRuntime;
typedef struct JSContext JSContext;
typedef struct JSObject JSObject;
typedef struct JSClass JSClass;
typedef uint32_t JSClassID;
typedef uint32_t JSAtom;

typedef union JSValueUnion {
    int32_t int32;
    double float64;
    void *ptr;
} JSValueUnion;

typedef struct JSValue {
    JSValueUnion u;
    int64_t tag;
} JSValue;

typedef struct JSValue JSValueConst;

JSRuntime *JS_NewRuntime(void);
JSContext *JS_NewContext(JSRuntime *rt);
JSValue JS_Eval(JSContext *ctx, const char *input, size_t input_len, const char *filename, int eval_flags);

void JS_FreeValue(JSContext *ctx, JSValue v);

JSValue JS_NewStringLen(JSContext *ctx, const char *str, size_t str_len);

JSValue JS_ToString(JSContext *ctx, JSValueConst val);
JSValue JS_ToPropertyKey(JSContext *ctx, JSValueConst val);
/*const*/ char *JS_ToCStringLen2(JSContext *ctx, size_t *plen, JSValueConst val1, bool cesu8);
void JS_FreeCString(JSContext *ctx, const char *ptr);

JSValue JS_NewAtomString(JSContext *ctx, const char *str);
JSValue JS_GetProperty(JSContext *ctx, JSValueConst this_obj, JSAtom prop);
JSValue JS_GetPropertyStr(JSContext *ctx, JSValueConst this_obj,
                                    const char *prop);

/* buf must be zero terminated i.e. buf[buf_len] = 0. */
JSValue JS_ParseJSON(JSContext *ctx, const char *buf, size_t buf_len,
                               const char *filename);
JSValue JS_JSONStringify(JSContext *ctx, JSValueConst obj,
                                   JSValueConst replacer, JSValueConst space0);

int JS_ToBool(JSContext *ctx, JSValueConst val); // return -1 for JS_EXCEPTION 
int JS_ToInt32(JSContext *ctx, int32_t *pres, JSValueConst val);
int JS_ToInt64(JSContext *ctx, int64_t *pres, JSValueConst val);
int JS_ToIndex(JSContext *ctx, uint64_t *plen, JSValueConst val);

bool JS_IsArray(JSValueConst val);
int JS_GetLength(JSContext *ctx, JSValueConst obj, int64_t *pres);

JSValue JS_GetException(JSContext *ctx);

', './libqjs.so' );


/*
static inline const char *JS_ToCString(JSContext *ctx, JSValueConst val1)
{
    return JS_ToCStringLen2(ctx, NULL, val1, 0);
}


    JS_TAG_BIG_INT     = -9,
    JS_TAG_SYMBOL      = -8,
    JS_TAG_STRING      = -7,
    JS_TAG_STRING_ROPE = -6,
    JS_TAG_MODULE      = -3, // used internally
    JS_TAG_FUNCTION_BYTECODE = -2, // used internally 
    JS_TAG_OBJECT      = -1,

    JS_TAG_INT         = 0,
    JS_TAG_BOOL        = 1,
    JS_TAG_NULL        = 2,
    JS_TAG_UNDEFINED   = 3,
    JS_TAG_UNINITIALIZED = 4,
    JS_TAG_CATCH_OFFSET = 5,
    JS_TAG_EXCEPTION   = 6,
    JS_TAG_SHORT_BIG_INT = 7,
    JS_TAG_FLOAT64     = 8,


#define JS_VALUE_GET_TAG(v) ((int32_t)(v).tag)
// same as JS_VALUE_GET_TAG, but return JS_TAG_FLOAT64 with NaN boxing
#define JS_VALUE_GET_NORM_TAG(v) JS_VALUE_GET_TAG(v)
#define JS_VALUE_GET_INT(v) ((v).u.int32)
#define JS_VALUE_GET_BOOL(v) ((v).u.int32)
#define JS_VALUE_GET_FLOAT64(v) ((v).u.float64)
#define JS_VALUE_GET_SHORT_BIG_INT(v) ((v).u.short_big_int)
#define JS_VALUE_GET_PTR(v) ((v).u.ptr)

#define JS_EVAL_TYPE_GLOBAL   (0 << 0) // global code (default)
#define JS_EVAL_TYPE_MODULE   (1 << 0) // module code
#define JS_EVAL_TYPE_DIRECT   (2 << 0) // direct call (internal use)
#define JS_EVAL_TYPE_INDIRECT (3 << 0) // indirect call (internal use)
#define JS_EVAL_TYPE_MASK     (3 << 0)

#define JS_EVAL_FLAG_STRICT   (1 << 3) // force 'strict' mode
#define JS_EVAL_FLAG_UNUSED   (1 << 4) // unused 


// compile but do not run. The result is an object with a
 //  JS_TAG_FUNCTION_BYTECODE or JS_TAG_MODULE tag. It can be executed
 //  with JS_EvalFunction(). 
#define JS_EVAL_FLAG_COMPILE_ONLY (1 << 5)
// don't include the stack frames before this eval in the Error() backtraces 
#define JS_EVAL_FLAG_BACKTRACE_BARRIER (1 << 6)
// allow top-level await in normal script. JS_Eval() returns a
   // promise. Only allowed with JS_EVAL_TYPE_GLOBAL 
#define JS_EVAL_FLAG_ASYNC (1 << 7)


*/

function JSValueToPhp($context, $value) {
	global $ffi;
	switch($value->tag) {
    	case 8: return $value->u->float64;
		case 4: return NULL;
		case 3: return NULL;
		case 2: return NULL;

	    case 0: return $value->u->int32;
	    case 1: return !!$value->u->int32;
    // JS_TAG_CATCH_OFFSET = 5,
    // JS_TAG_EXCEPTION   = 6,
    // JS_TAG_SHORT_BIG_INT = 7,

	    case 6:
	    	$e = $ffi->JS_GetException($context);
	    	$v = $ffi->JS_ToString($context, $e); 
	    		$ffi->JS_FreeValue($context, $e);
	    	$s = $ffi->JS_ToCStringLen2($context, NULL, $v, 0);
				$ffi->JS_FreeValue($context, $v);
			$r = $ffi::string($s);
	    		$ffi->JS_FreeCString($context, $s);
	    	error_log($r);
	    	throw new Exception($r);
	    	return null;

	    case -7: case -6:
	    	$s = $ffi->JS_ToCStringLen2($context, NULL, $value, 0);
	    	$r = $ffi::string($s);
	    	$ffi->JS_FreeCString($context, $s);
	    	return $r;
	}
}

$runtime = $ffi->JS_NewRuntime();
$context = $ffi->JS_NewContext( $runtime );

$code = '`${3+5}`';

$result = $ffi->JS_Eval( $context, $code, strlen($code), __FILE__, 0 );

var_dump( $result, JSValueToPhp($context, $result) );

$ffi->JS_FreeValue($context, $result);