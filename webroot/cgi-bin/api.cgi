#!/system/bin/sh
# tfc API 入口 —— 由 busybox httpd 以 CGI 方式执行。
# 必须位于 cgi-bin/ 且可执行；shebang 指向 /system/bin/sh。
# QUERY_STRING / REQUEST_METHOD 等环境变量由 httpd 注入。
exec /data/adb/modules/tfcard/system/bin/tfc web
