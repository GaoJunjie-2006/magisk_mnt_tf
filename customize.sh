#!/system/bin/sh
# tf_card 安装脚本
# 按架构挑选 busybox / bindfs，清理其它架构二进制

DATADIR=/data/adb/tfcard
mkdir -p $DATADIR/logs $DATADIR/state
[ -f $DATADIR/config.txt ] || touch $DATADIR/config.txt

case $ARCH in
  arm)   BB=busybox-arm;            BFS=bindfs-armeabi-v7a;;
  arm64) BB=busybox-arm64;          BFS=bindfs-arm64-v8a;;
  x86)   BB=busybox-x86;            BFS=bindfs-x86;;
  x64)   BB=busybox-x86_64;         BFS=bindfs-x86_64;;
  *)
    case $(uname -m) in
      aarch64|arm64) BB=busybox-arm64; BFS=bindfs-arm64-v8a;;
      armv7l|armv8l) BB=busybox-arm;   BFS=bindfs-armeabi-v7a;;
      x86_64|amd64)  BB=busybox-x86_64; BFS=bindfs-x86_64;;
      i686|i386)     BB=busybox-x86;    BFS=bindfs-x86;;
      *) BB=; BFS=;;
    esac
    ;;
esac

# 选中本机架构的二进制
if [ -n "$BB" ] && [ -f $MODPATH/bin/$BB ]; then
  mv -f $MODPATH/bin/$BB $MODPATH/bin/busybox
fi
if [ -n "$BFS" ] && [ -f $MODPATH/bin/$BFS ]; then
  mv -f $MODPATH/bin/$BFS $MODPATH/bin/bindfs
fi

# 清理其它架构二进制
rm -f $MODPATH/bin/busybox-arm $MODPATH/bin/busybox-arm64 \
      $MODPATH/bin/busybox-x86 $MODPATH/bin/busybox-x86_64 \
      $MODPATH/bin/bindfs-arm64-v8a $MODPATH/bin/bindfs-armeabi-v7a \
      $MODPATH/bin/bindfs-x86 $MODPATH/bin/bindfs-x86_64

chmod 0755 $MODPATH/bin/busybox 2>/dev/null
chmod 0755 $MODPATH/bin/bindfs 2>/dev/null
chmod 0755 $MODPATH/system/bin/tfc
# CGI 脚本必须可执行：Magisk 提取 zip 时可能丢失执行位（实测 api.cgi 变 0644），
# 导致 busybox httpd 的 execv 失败、所有接口 404。这里统一兜底。
chmod 0755 $MODPATH/webroot/cgi-bin/api.cgi

# 兼容旧模块数据迁移占位（如需可扩展）
true
