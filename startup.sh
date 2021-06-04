#!/bin/bash
echo "Server init"
#start as a deamon
/usr/sbin/nginx
echo "nginx started"
node server.js