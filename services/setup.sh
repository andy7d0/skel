#!/bin/sh

mkdir -p /top/workarea/sockets/web
mkdir -p /top/workarea/sockets/app
mkdir -p /top/workarea/sockets/pg

rm -rf /top/workarea/sockets/web/*
rm -rf /top/workarea/sockets/app/*
rm -rf /top/workarea/sockets/pg/*

mkdir -p /top/workarea/migration/dumps

cat /top/app/ext/crontab /top/app/int/crontab > /top/workarea/crontab-both

mkdir -p /top/workarea/pgadmin

# cat > /top/workarea/pgadmin/servers.json << EOF
# {
#     "Servers": {
#         "ext": {
#             "Name": "ext",
#             "Group": "Servers",
#             "Port": 5432,
#             "Username": "postgres",
#             "Host": "${S_PWD}/workarea/sockets/pg/ext",
#             "SSLMode": "prefer",
#             "MaintenanceDB": "postgres"
#         }, 
#         "int": {
#             "Name": "int",
#             "Group": "Servers",
#             "Port": 5432,
#             "Username": "postgres",
#             "Host": "${S_PWD}/workarea/sockets/pg/int",
#             "SSLMode": "prefer",
#             "MaintenanceDB": "postgres"
#         }
#     }
# }
# EOF

