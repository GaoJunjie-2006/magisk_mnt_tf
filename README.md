# TF Card Mapper（eMMC ↔ TF）

Magisk 模块:把内置 eMMC 的**应用数据**(`Android/obb`、`Android/data`、自定义目录)映射到 TF 卡,把 TF 卡当"第二个 eMMC"用。

- 本地 Web 界面:扫描全部已装 App,一键映射
- 可选把 eMMC 存量数据**搬走**到 TF 卡,应用无感知继续读写原路径
- 多视图挂载:覆盖 `/data/media/0` 及所有运行时视图
- 兼容 Android 11+ / Magisk 20.4+(Android 14 + Magisk 30 实测)

## 原理

把 TF 卡目录 bind 覆盖到内置存储目录:TF 上 `/Android/obb/游戏A` → 覆盖 eMMC 同路径,应用读写原路径时实际落盘 TF 卡。默认 bindfs(对 exfat 权限最友好,`--chown-ignore` 等忽略权限差异),失败回退 `mount --bind`,可用 `auto|bindfs|mount` 切换。

## 安装

1. 传 `tf_card_v1.10.zip` 到手机
2. Magisk App → 模块 → 从本地安装
3. 重启

开机自动:等存储就绪 → 应用配置 → 启动 Web。

## 使用

浏览器开 `http://127.0.0.1:8266`(电脑:`adb forward tcp:8266 tcp:8266`)。

1. **填 token**(首次):电脑执行 `adb shell su -c 'cat /data/adb/tfcard/web_token'`,粘贴保存(localStorage 记住)。所有接口都要求 token,没有则全部拒绝。
2. **设路径**:外置根点「探测」自动找 `/mnt/media_rw/` 最大分区;内置根默认 `/data/media/0`。保存。
3. **扫描**:列出所有已装包,有共享数据目录的带占用大小(没有的显示 `-`,映射时自动建目录)。
4. **映射**:选包 → 选目录(`obb` / 同时映射 both / `data` / **私有目录子目录** / 自定义相对路径)→ 勾选「立即搬数据」(首次建议)→ 映射。
   - **私有目录映射**(微信/QQ 数据大头):选「私有目录子目录」填 `files`/`cache`。前置:**SELinux permissive**(设置里勾选「SELinux 置为 permissive」)。卡 **exfat 即可**(推荐;ext4 理论上上下文更完整,但 Android 系统不认 ext4 可移动卡、会报「已损坏」,所以实际用 exfat)。不推荐映射 `databases`/`shared_prefs`。
5. **应用全部挂载**:重放配置;开机自动执行,无需手动。

- 映射后**重启相关 App** 才生效(正在运行的已缓存路径)。
- 「取消映射」保留 TF 数据;「取消映射并移回数据」搬回 eMMC。

## 命令行

```sh
tfc status                          # 状态
tfc scan                            # 扫描(JSON)
tfc detect                          # 探测路径
tfc map <pkg> <obb|data|custom|priv|both> [rel] [--move] [--src <path>]
tfc unmap <pkg> <obb|data|custom|priv|both> [rel] [--restore]
# 私有目录(需 permissive + ext4 卡):
# tfc map com.tencent.mm priv files --move
tfc apply                           # 应用全部映射
tfc serve                           # 启动 Web
tfc token                           # 显示/生成 token
```

root 下运行:`su -c /data/adb/modules/tfcard/system/bin/tfc ...`

## 配置

数据在 `/data/adb/tfcard/`(更新模块不丢):

```
extsd=/mnt/media_rw/XXXX-XXXX        # 外置 TF 根
intsd=/data/media/0                  # 内置根
bind_engine=auto                     # auto | bindfs | mount
permissive=0                         # 1=开机 setenforce 0(排查用)
map com.tencent.gameA obb            # 映射 obb
map com.example.app both             # 同时映射 obb + data(两条独立行)
map com.x custom Android/data/com.x/files
map com.tencent.mm priv files        # 私有目录子目录(需 permissive + ext4)
src Android/obb/com.x /path/override # 该映射的源覆盖
```

`state/mounts.txt` 当前挂载记录;`logs/app.log` 主日志;`logs/boot.log` 开机日志。

## 卸载

先用界面「取消映射并移回数据」搬回 eMMC,再卸载。卸载自动解除挂载、停 Web,**不删 TF 卡数据**。

## 常见问题

| 现象 | 处理 |
|---|---|
| Web 打不开 | `su -c 'cat /data/adb/tfcard/logs/boot.log'`;确认 httpd 在监听 8266 |
| 映射后 App 还是旧数据 | 重启该 App |
| 私有映射被拒(提示文件系统) | 只支持 ext4/exfat 卡;并确保 SELinux permissive |
| 私有映射提示「卡损坏」 | 卡是 ext4:Android 不认 ext4 可移动卡,请格式化回 exfat 使用 |
| exfat 权限报错 | 引擎切回 `bindfs` |
| 挂载失败 | 确认 TF 已挂载、路径存在,看 boot.log |

## 更新日志

### v1.10
- 修复:**私有映射取消 ext4 强制,兼容 exfat 卡**。真机实测 Android vold 把 ext4 可移动卡判为「已损坏」且不挂载——ext4 路线在系统层面走不通,改为 exfat 可用(依赖 permissive + bindfs app 属主,跳过 chcon)

### v1.9
- 新增:**私有目录映射**(应用数据大头,微信 768MB / QQ 222MB 在 `/data/user/0`):`tfc map <pkg> priv <files|cache>`
- 实现:bindfs 以 app 自己的 uid/gid 挂载(非 root:9997),双视图覆盖 `/data/user/0` 与 `/data/data`,迁移前自动 force-stop 应用
- Web 界面新增「私有目录子目录」选项与子目录输入框
- 不推荐映射 `databases`/`shared_prefs`(高频随机 IO + 配置)

### v1.8
- 修复:映射目标目录不存在的包(新包、无共享数据目录的包如微信 obb)挂载失败——底层视图被 `[ -d ]` 提前过滤,已改为底层视图自动建目录并强制挂载

### v1.7
- 修复:重启后映射静默失败(apply_config 读取 map 行字段错位,已改占位符跳过)
- 修复:「同时映射」忽略源路径覆盖(`--src`/「源路径覆盖」)
- 修复:exfat 下移动数据失败(cp -a 失败回退 cp -r 仅复制内容)
- 优化:扫描列出所有已装 App(含无数据目录的,显示 `-`)

### v1.6
- 新增:同时映射 obb + data(写成两条独立映射,可单独取消)
- 修复:Web 启动误报失败(busybox nohup 的 `$!` 是父进程 PID,改用端口监听判据)
- 修复:开机等待存储过严导致 Web 迟迟不起
- 修复:extsd 路径错误 / sed 写坏配置

> ⚠️ 实验性模块:搬数据前请备份,移动不可逆,自担风险。
