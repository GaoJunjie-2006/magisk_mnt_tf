#!/usr/bin/env sh
# 打包 tf_card Magisk 模块 zip
set -e
cd "$(dirname "$0")"

echo "== 语法检查 =="
for f in system/bin/tfc customize.sh service.sh uninstall.sh webroot/cgi-bin/api.cgi; do
  sh -n "$f" && echo "  OK  $f" || exit 1
done

V=$(sed -n 's/^version=//p' module.prop)
NAME=tf_card_${V}.zip

echo "== 打包 =="
rm -rf _build "$NAME"
mkdir -p _build
cp -r module.prop customize.sh service.sh uninstall.sh system bin webroot META-INF README.md _build/
chmod -R a+rX _build
# CGI 脚本必须可执行，否则 busybox httpd 的 execv 会失败（404）
chmod 0755 _build/webroot/cgi-bin/api.cgi _build/system/bin/tfc
(cd _build && zip -r9q ../"$NAME" . -x '.*')
rm -rf _build
echo "== 完成: $NAME =="
