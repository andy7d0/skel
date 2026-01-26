#!/bin/sh
rm -f /var/www/sockets/web.socket
rm -f /var/www/sockets/local-web.socket
if [[ ! -f /var/www/sockets/web.socket && ! -f /var/www/sockets/local-web.socket ]]
then
	nginx -g 'daemon off;'
fi