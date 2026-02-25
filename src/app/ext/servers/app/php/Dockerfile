FROM phpswoole/swoole:6.1-php8.4-alpine

# Install build requirements
RUN apk add --no-cache --upgrade alpine-sdk cmake openssl-dev

# Download  GOST TLS git module 
RUN mkdir -p /usr/local/src \
  && cd /usr/local/src \
  && git clone https://github.com/gost-engine/engine \
  && cd engine \
  && git checkout tags/v3.0.3 \
  && git submodule update --init \
  && mkdir build \
  && cd build \
  && cmake -DCMAKE_BUILD_TYPE=Release -DCMAKE_POLICY_VERSION_MINIMUM=3.5 .. \
  && cmake --build . --config Release \
  && make install

ENV OPENSSL_DIR=/etc/ssl
RUN touch "${OPENSSL_DIR}/openssl.cnf" \
  && sed -i 's/openssl_conf = openssl_init/openssl_conf = openssl_def/g' "${OPENSSL_DIR}/openssl.cnf" \
  && echo "# GOST TLS Engine Config" >> "${OPENSSL_DIR}/openssl.cnf" \
  && echo "# OpenSSL default section" >> "${OPENSSL_DIR}/openssl.cnf" \
  && echo "[ openssl_def ]" >> "${OPENSSL_DIR}/openssl.cnf" \
  && echo "engines = engine_section" >> "${OPENSSL_DIR}/openssl.cnf" \
  && echo "" >> "${OPENSSL_DIR}/openssl.cnf" \
  && echo "# Engine section" >> "${OPENSSL_DIR}/openssl.cnf" \
  && echo "[ engine_section ]" >> "${OPENSSL_DIR}/openssl.cnf" \
  && echo "gost = gost_section" >> "${OPENSSL_DIR}/openssl.cnf" \
  && echo "" >> "${OPENSSL_DIR}/openssl.cnf" \
  && echo "# GOST TLS Engine section" >> "${OPENSSL_DIR}/openssl.cnf" \
  && echo "[ gost_section ]" >> "${OPENSSL_DIR}/openssl.cnf" \
  && echo "engine_id = gost" >> "${OPENSSL_DIR}/openssl.cnf" \
  && echo "dynamic_path = /usr/lib/engines-3/gost.so" >> "${OPENSSL_DIR}/openssl.cnf" \
  && echo "default_algorithms = ALL" >> "${OPENSSL_DIR}/openssl.cnf" \
  && echo "" >> "${OPENSSL_DIR}/openssl.cnf" 


# sendmail
RUN apk add --no-cache --upgrade msmtp \
	&&  ln -sf /usr/bin/msmtp /usr/bin/sendmail \
        ln -sf /usr/bin/msmtp /usr/sbin/sendmail

RUN apk add --no-cache --upgrade postgresql-dev bzip2-dev zlib-dev libpng-dev gettext-dev gmp-dev libzip-dev 

RUN docker-php-ext-install pdo_pgsql bz2 gd gettext gmp zip 

# RUN apk add --no-cache --update autoconf \
#	&& pecl channel-update pecl.php.net \
#    && yes no | pecl install inotify \
#    && docker-php-ext-enable inotify

# NO NEED apcu ???

ARG S_UID
ARG S_GID

# cache ? 
# RUN mkdir -p /var/cache/sapp && chown ${S_UID}:${S_GID} /var/cache/sapp      


# Clean 
RUN apk del alpine-sdk --purge \
  && apk cache clean \
  && rm -rf /usr/local/src/*

