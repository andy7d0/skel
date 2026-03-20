#include <stdio.h>
#include <string.h>
#include <sys/signalfd.h>
#include <sys/time.h>
#include <unistd.h>

#include <errno.h>

#include <signal.h>

#include <event2/event.h>
#include <event2/bufferevent.h>
#include <event2/buffer.h>
#include <event2/listener.h>
#include <event2/util.h>
#include <event2/http.h>


#include <libpq-fe.h>

#include <argp.h>


const char* HEX = "0123456789abcdef";

const int first_arg = 3;

const char * argp_program_version = "2.0";
static char doc[] = "Translate postgres notifications to http requests.";

struct channel_t {
	const char* name;
};
struct channel_t channels[100] = {0};
int num_channels = 0;

struct arguments {
    const char* dsn;
    const char* target;
};

static error_t parse_opt(int key, char *arg, struct argp_state *state) {
    struct arguments *arguments = state->input;
    switch (key) {
    case 'd': arguments->dsn = arg; break;
    case 't': arguments->target = arg; break;
    case 'n':
    		if(num_channels < 100) channels[num_channels++].name = arg; 
    		break;
    case ARGP_KEY_END:
    			if(!arguments->dsn 
    				|| !*arguments->dsn
    				|| !arguments->target
    				|| !*arguments->target
    			) {
    				argp_error(state, "all options required");
    				return ARGP_ERR_UNKNOWN;
    			}
    			break;
    default: return ARGP_ERR_UNKNOWN;
    }   
    return 0;
}


struct event_base * base = NULL;
PGconn* conn = NULL;
struct event* pg = NULL;

struct notify_uri_parsed {
	const char* host;
	int port;
	const char* path;
} parsed;


void connect_pg(const char* dsn);


static void
http_request_done(struct evhttp_request *req, void *ctx)
{
	char buffer[256];
	int nread;

	if (!req || !evhttp_request_get_response_code(req)) {
		/* If req is NULL, it means an error occurred, but
		 * sadly we are mostly left guessing what the error
		 * might have been.  We'll do our best... */
		struct bufferevent *bev = (struct bufferevent *) ctx;
		unsigned long oslerr;
		int printed_err = 0;
		int errcode = EVUTIL_SOCKET_ERROR();
		fprintf(stderr, "some request failed - no idea which one though!\n");
		// Print out the OpenSSL error queue that libevent
		// squirreled away for us, if any.
		//while ((oslerr = bufferevent_get_openssl_error(bev))) {
		//	ERR_error_string_n(oslerr, buffer, sizeof(buffer));
		//	fprintf(stderr, "%s\n", buffer);
		//	printed_err = 1;
		//}
		// If the OpenSSL error queue was empty, maybe it was a
		// socket error; let's try printing that.
		if (! printed_err)
			fprintf(stderr, "socket error = %s (%d)\n",
				evutil_socket_error_to_string(errcode),
				errcode);
		return;
	}

	//fprintf(stderr, "Response line: %d %s\n",
	//    evhttp_request_get_response_code(req),
	//    evhttp_request_get_response_code_line(req));

	/*
	while ((nread = evbuffer_remove(evhttp_request_get_input_buffer(req),
		    buffer, sizeof(buffer)))
	       > 0) {
		// These are just arbitrary chunks of 256 bytes.
		// They are not lines, so we can't treat them as such.
		fwrite(buffer, nread, 1, stdout);
	}
	*/
}

void pg_notify_cb(evutil_socket_t fd, short op, void * p) {
	const char* dsn = (const char*) p;

    if(!PQconsumeInput(conn)) {
        fprintf(stderr, "!consume\n");
        PQfinish(conn); conn = NULL;
        event_del(pg);
        sleep(5); // something went wrong, wait 5s
        connect_pg(dsn);
    }
	PGnotify   *notify;
    while ((notify = PQnotifies(conn)) != NULL)
    {
        fprintf(stderr,
                "ASYNC NOTIFY of '%s' received from backend PID %d\npayload:%s\n",
                notify->relname, notify->be_pid, notify->extra);

        const struct channel_t* channel = NULL;
        // find channel. if num_channels is small, linear search is a good (or the best)
        for(int i = 0; i < num_channels; ++i)
        	if(strcmp(channels[i].name, notify->relname)==0) {
        		channel = &channels[i];
        		break;
        	}

        if(channel) {

			struct bufferevent * bev = bufferevent_socket_new(base, -1, BEV_OPT_CLOSE_ON_FREE);
			if (bev == NULL) {
				fprintf(stderr, "bufferevent_openssl_socket_new() failed\n");
				continue;
			}

			// FIXME: blocked on dns...
			struct evhttp_connection * evcon = evhttp_connection_base_bufferevent_new(
				base, NULL, bev,
				parsed.host, parsed.port);
			if (evcon == NULL) {
				fprintf(stderr, "evhttp_connection_base_bufferevent_new() failed\n");
				bufferevent_free(bev); 
				continue;
			}

			evhttp_connection_free_on_completion(evcon);

			evhttp_connection_set_retries(evcon, 1);
			struct timeval tv;
			tv.tv_sec = 5; tv.tv_usec = 0;
			//evhttp_connection_set_connect_timeout_tv(evcon, tv);
			//evhttp_connection_set_read_timeout_tv(evcon, tv);
			//evhttp_connection_set_write_timeout_tv(evcon, tv);
			evhttp_connection_set_timeout_tv(evcon, &tv);

            char url[64*1024];
    		snprintf(url, sizeof(url), "%s/%s/", parsed.path, notify->relname);
        	char* s = notify->extra; 
        	char* d = url+ strlen(url);
        	char* end = url + sizeof(url)-4;
        	while(*s && d < end) {
        		if(*s >= '0' && *s <= '9' || *s == '-' || *s == '.'
        			|| *s >= 'a' && *s <='z'
        			|| *s >= 'A' && *s <= 'Z'
        		) {
        			//as is
        			*d++ = *s;
        		} else {
        			//percent-encoded
        			*d++ = '%';
        			*d++ = HEX[ *s>>4 ];
        			*d++ = HEX[ *s&0xf ];
        		}
        		++s;
        	}
        	*d = '\0';

			struct evhttp_request * req = evhttp_request_new(http_request_done, bev);
			if (req == NULL) {
				fprintf(stderr, "evhttp_request_new() failed\n");
				evhttp_connection_free(evcon);
				continue;
			}

			struct evkeyvalq *output_headers = evhttp_request_get_output_headers(req);
			evhttp_add_header(output_headers, "Host", parsed.host);
			evhttp_add_header(output_headers, "Connection", "close");
			evhttp_add_header(output_headers, "Content-Type", "application/octet-stream");

			fprintf(stderr,"REQ: %s:%d %s\n", parsed.host, parsed.port, url);

			int r = evhttp_make_request(evcon, req, EVHTTP_REQ_HEAD, url);
			if (r != 0) {
				fprintf(stderr, "evhttp_make_request() failed\n");
				evhttp_connection_free(evcon);
				continue;
			}

		} else {
            fprintf(stderr,
                    "NOTE: channel '%s' not found\n", notify->relname);
		}

        PQfreemem(notify);
    }
}

void connect_pg(const char* dsn) {
	/* Make a connection to the database */
	fprintf(stderr, "Connecting to: %s\n", dsn);
	while(!conn) {
		/* Make a connection to the database */
	    conn = PQconnectdb(dsn);
		
		/* Check to see that the backend connection was successfully made */
	    if (PQstatus(conn) != CONNECTION_OK)
	    {
	        fprintf(stderr, "Connection to database failed: %s", PQerrorMessage(conn));
	        PQfinish(conn); conn = NULL;
	        sleep(5); // if not connected, wait 5s
	        continue;
	    }

	    for(int i = 0; i < num_channels; ++i) {
	        char cmd[16*1024];
	        snprintf(cmd, sizeof(cmd), "LISTEN \"%s\"", channels[i].name );

		    PGresult *res = PQexec(conn, cmd);
		    if (PQresultStatus(res) != PGRES_COMMAND_OK)
		    {
		        fprintf(stderr, "LISTEN command failed: %s", PQerrorMessage(conn));
		        PQclear(res);
		        PQfinish(conn); conn = NULL;
		        sleep(5); // if LISTEN failed, wait 5s
		        continue;
		    }
		    PQclear(res);
		}

		pg = event_new(base, PQsocket(conn), EV_READ|EV_PERSIST, pg_notify_cb, (void*)dsn);
		event_add(pg, NULL);
	}
	fprintf(stderr, "Connected!\n");
}

void term_cb(evutil_socket_t fd, short op, void * arg) {
	event_base_loopbreak(base);
}

int main(int argc, char** argv)
{

	struct arguments arguments = {
		.dsn = NULL
		, .target = NULL
	};

	struct argp_option options[] = {
		{"dsn", 'd', "dsn", 0, "database server address"}
		, {"target", 't', "url prefix", 0, "notification url prefix"}
		, {"channel", 'n', "channel", 0
				, "notification channel: result request is: prefix/channel/payload"
					"\n this option can be use repeadley"
				}
		, { 0 }
	};

	struct argp argp = { options, parse_opt, "", doc, 0, 0, 0 };

	error_t rc = argp_parse(&argp, argc, argv, 0, 0, &arguments);

	fprintf(stderr,"Postgres at: %s\n", arguments.dsn);
	fprintf(stderr,"Target is: %s\n", arguments.target);
	fprintf(stderr,"Channels: %d\n", num_channels);
	for(int i = 0; i < num_channels; ++i) {
		fprintf(stderr,"\t channel: %s\n", channels[i].name);
	}


	struct evhttp_uri * http_uri = evhttp_uri_parse(arguments.target);
	if (http_uri == NULL) {
		fprintf(stderr,"malformed url\n");
		goto error;
	}

	const char * scheme = evhttp_uri_get_scheme(http_uri);
	if (scheme == NULL || (strcasecmp(scheme, "http") != 0)) {
		fprintf(stderr,"url must be http or https\n");
		goto error;
	}

	parsed.host = evhttp_uri_get_host(http_uri);
	if (parsed.host == NULL) {
		fprintf(stderr,"url must have a host\n");
		goto error;
	}

	parsed.port = evhttp_uri_get_port(http_uri);
	if (parsed.port == -1) {
		parsed.port = (strcasecmp(scheme, "http") == 0) ? 80 : 443;
	}

	parsed.path = evhttp_uri_get_path(http_uri);
	if (strlen(parsed.path) == 0) {
		parsed.path = "/";
	}

	fprintf(stderr,"Started\n");

/*
	sigset_t termination_signals;
    sigemptyset(&termination_signals);
    sigaddset(&termination_signals, SIGTERM);
    sigaddset(&termination_signals, SIGINT);
    sigaddset(&termination_signals, SIGQUIT);
    if (sigprocmask(SIG_BLOCK, &termination_signals, NULL) == -1) {
		fprintf(stderr,"can not set procmask\n");
    	return 1;
    }
*/

	// Create event base
	base = event_base_new();
	if (!base) {
		fprintf(stderr, "event_base_new()\n");
		goto error;
	}

	struct event* term = event_new(base, SIGTERM, EV_SIGNAL, term_cb, NULL);
	event_add(term, NULL); 

	connect_pg(arguments.dsn);

	event_base_dispatch(base);

error:

	if(term) event_free(term);

	if(http_uri) evhttp_uri_free(http_uri);

	if(base) event_base_free(base);

	if(conn) PQfinish(conn);


	fprintf(stderr,"Done\n");
 	return 0;
}
