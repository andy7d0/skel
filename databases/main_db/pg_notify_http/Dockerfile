FROM alpine AS pgnotifybuildstage
RUN apk add make g++ curl-dev libpq-dev libevent-dev argp-standalone

ADD src /src
RUN cd /src && make
RUN ls /src

FROM alpine AS pgnotifydaemon
RUN apk add openssl curl libpq libevent
COPY --from=pgnotifybuildstage /src/pg_notify_http /usr/local/sbin/

RUN ls /usr/local/sbin

ENV PG="host=/var/run/postgresql db=main"
ENV WEB="http://localhost/notify/pg"
ENV CHANNELS=""

# disable globbin due to channels can contains '?' and they are not a filename!

ENTRYPOINT exec /usr/local/sbin/pg_notify_http -d "$PG" -t "$WEB" $CHANNELS


