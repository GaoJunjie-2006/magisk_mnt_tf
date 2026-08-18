#!/system/bin/sh
# 开机：等系统起来后，后台执行 boot（应用挂载 + 启动 Web 界面）
MODDIR=${0%/*}
DATADIR=/data/adb/tfcard
mkdir -p $DATADIR/logs
nohup $MODDIR/system/bin/tfc boot >$DATADIR/logs/boot.log 2>&1 &
exit 0
