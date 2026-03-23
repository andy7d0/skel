FROM bash:5.3-alpine3.23

# Install build requirements
RUN apk add --no-cache --upgrade make rsync inotify-tools curl jq yq 
# toml2json

RUN ln -s /usr/local/bin/bash /usr/bin/bash
RUN ln -s /usr/local/bin/bash /bin/bash

ARG S_UID
ARG S_GID

ENV LANG=C.UTF-8

# Clean 
RUN apk cache clean

