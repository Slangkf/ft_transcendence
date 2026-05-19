#!/bin/sh
set -e

# 动态获取 DNS
DNS=$(cat /etc/resolv.conf | grep nameserver | head -1 | awk '{print $2}')
echo "Using DNS resolver: $DNS"

# 替换模板
sed "s/__RESOLVER__/$DNS/g" /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# 验证配置
nginx -t

# 启动
exec nginx -g "daemon off;"