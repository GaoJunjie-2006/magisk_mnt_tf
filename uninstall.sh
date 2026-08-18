#!/system/bin/sh
# 卸载：解除全部挂载、停止 Web 服务。
# 注意：数据默认保留在 TF 卡上，不会丢失；如需移回请在卸载前用 Web 界面执行“恢复数据”。
MODDIR=/data/adb/modules/tfcard
if [ -x $MODDIR/system/bin/tfc ]; then
  $MODDIR/system/bin/tfc uninstall_all >/dev/null 2>&1
fi
# 兜底：停掉可能的 httpd 残留
pkill -f "httpd -p 127.0.0.1" 2>/dev/null
exit 0
