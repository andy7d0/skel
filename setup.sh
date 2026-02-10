#!/bin/sh

mkdir -p /top/workarea/sockets/web
mkdir -p /top/workarea/sockets/app
mkdir -p /top/workarea/sockets/pg

rm -rf /top/workarea/sockets/web/*
rm -rf /top/workarea/sockets/app/*
rm -rf /top/workarea/sockets/pg/*

mkdir -p /top/workarea/migration/dumps

mkdir -p /top/workarea/cache/ext
mkdir -p /top/workarea/cache/int
mkdir -p /top/workarea/cache/par

mkdir -p /top/workarea/modules/ext
mkdir -p /top/workarea/modules/int
mkdir -p /top/workarea/modules/

mkdir -p /top/dist/web
mkdir -p /top/dist/app/ext
mkdir -p /top/dist/app/int


# cat /top/app/ext/crontab /top/app/int/crontab > /top/workarea/crontab-both

# mkdir -p /top/workarea/pgadmin

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

