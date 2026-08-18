/* TF Card Mapper — 前端逻辑 */
"use strict";

let TOKEN = "";
let PKGS = [];
let MOUNTS = [];          // [{dst,src,ok}]
let MAPPED_RELS = new Set();
let selectedPkg = null;
let busy = false;

const TOKEN_KEY = "tfc_token";   // localStorage 键名

const $ = (id) => document.getElementById(id);

function loadToken() {
  try { TOKEN = localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { TOKEN = ""; }
}
function saveToken() {
  try { localStorage.setItem(TOKEN_KEY, TOKEN); } catch (e) {}
}
function isForbidden(r) {
  return !!(r && r.error === "forbidden");
}

function log(msg, cls) {
  const el = $("log");
  const t = new Date().toTimeString().slice(0, 8);
  el.textContent += `[${t}] ${msg}\n`;
  el.scrollTop = el.scrollHeight;
}

function fmt(kb) {
  if (kb >= 1048576) return (kb / 1048576).toFixed(1) + " GB";
  if (kb >= 1024) return (kb / 1024).toFixed(1) + " MB";
  return kb + " KB";
}

async function api(action, params = {}) {
  params.action = action;
  if (TOKEN) params.t = TOKEN;
  const qs = new URLSearchParams(params).toString();
  const res = await fetch("cgi-bin/api.cgi?" + qs);
  return res.json();
}

function setConn(on) {
  const p = $("connPill");
  p.textContent = on ? "● 在线" : "○ 离线";
  p.className = "pill " + (on ? "on" : "dim");
}

/* ---------- 状态 ---------- */
async function loadStatus() {
  try {
    const s = await api("status");
    if (isForbidden(s)) {
      setConn(true);
      log("❌ 需要有效令牌：把 token 粘贴到「访问令牌」并保存", "err");
      return;
    }
    $("stIntsd").textContent = s.intsd || "-";
    $("stExtsd").textContent = s.extsd || "-";
    $("stEngine").textContent = (s.engine || "auto") + " / bindfs";
    $("selinuxPill").textContent = "SELinux: " + (s.selinux || "-");
    MOUNTS = s.mounts || [];
    MAPPED_RELS.clear();
    for (const m of MOUNTS) {
      if (m.ok) {
        // 从挂载点 dst 推导相对路径，例如 /data/media/0/Android/obb/com.x -> Android/obb/com.x
        const rel = (m.dst.match(/Android\/(obb|data)\/[^/]+/) || [""])[0];
        if (rel) MAPPED_RELS.add(rel);
      }
    }
    $("stMounted").textContent = MOUNTS.filter((m) => m.ok).length;
    setConn(true);
    renderTable();
  } catch (e) {
    setConn(false);
    log("状态读取失败：" + e.message, "err");
  }
}

/* ---------- 扫描 ---------- */
async function loadScan() {
  $("btnScan").disabled = true;
  $("pkgBody").innerHTML = '<tr><td colspan="7" class="empty">正在遍历系统包并计算大小…（可能需数秒）</td></tr>';
  try {
    const s = await api("scan");
    if (isForbidden(s)) { log("❌ 需要有效令牌：先保存令牌再扫描", "err"); return; }
    PKGS = s.pkgs || [];
    if (s.intsd) $("stIntsd").textContent = s.intsd;
    $("scanMeta").textContent = `共 ${PKGS.length} 个已装 App · 大小为共享存储 obb+data 当前量（不含私有数据；已映射的显示 TF 卡数据） · 内置根 ${s.intsd || "-"}`;
    renderTable();
    log(`扫描完成：${PKGS.length} 个已装包`);
  } catch (e) {
    log("扫描失败：" + e.message, "err");
  } finally {
    $("btnScan").disabled = false;
  }
}

/* ---------- 渲染表格 ---------- */
function renderTable() {
  const q = ($("inSearch").value || "").toLowerCase();
  const list = PKGS.filter((p) => !q || p.pkg.includes(q));
  const body = $("pkgBody");
  if (!list.length) {
    body.innerHTML = '<tr><td colspan="7" class="empty">没有匹配的包</td></tr>';
    return;
  }
  body.innerHTML = "";
  for (const p of list) {
    const total = p.obb + p.data;
    const obbMapped = MAPPED_RELS.has("Android/obb/" + p.pkg);
    const dataMapped = MAPPED_RELS.has("Android/data/" + p.pkg);
    const mapped = obbMapped || dataMapped;
    const tr = document.createElement("tr");
    tr.className = "rowpkg" + (selectedPkg === p.pkg ? " sel" : "");
    tr.innerHTML =
      "<td class='num'>" + (mapped ? "<span class='badge mapped'>已映射</span>" : "<span class='badge none'>-</span>") + "</td>" +
      "<td><b>" + esc(p.pkg) + "</b>" +
      (obbMapped ? " <span class='badge mapped'>obb</span>" : "") +
      (dataMapped ? " <span class='badge mapped'>data</span>" : "") +
      "</td>" +
      "<td class='num'>" + (p.obb > 0 ? fmt(p.obb) : "-") + "</td>" +
      "<td class='num'>" + (p.data > 0 ? fmt(p.data) : "-") + "</td>" +
      "<td class='num'><b>" + (total > 0 ? fmt(total) : "-") + "</b></td>" +
      "<td class='num'>" + (mapped ? "已映射" : "未映射") + "</td>" +
      "<td class='num'><button class='btn' data-act='sel'>选择</button></td>";
    tr.querySelector("[data-act='sel']").onclick = (e) => {
      e.stopPropagation();
      selectPkg(p.pkg, p);
    };
    tr.onclick = () => selectPkg(p.pkg, p);
    body.appendChild(tr);
  }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function selectPkg(pkg, p) {
  selectedPkg = pkg;
  $("opPkg").value = pkg;
  const dir = $("inDir");
  dir.value = (p && p.obb > 0) ? "obb" : ((p && p.data > 0) ? "data" : "obb");
  toggleCustom();
  renderTable();
  log("已选择包：" + pkg + " 合计 " + (p ? fmt(p.obb + p.data) : "?"));
}

function toggleCustom() {
  $("rowCustom").style.display = $("inDir").value === "custom" ? "" : "none";
}

/* ---------- 操作 ---------- */
async function doMap() {
  if (!selectedPkg) { log("请先在表格中选择一个包", "err"); return; }
  const dir = $("inDir").value;
  const custom = dir === "custom" ? $("inCustom").value.trim() : "";
  if (dir === "custom" && !custom) { log("自定义路径不能为空", "err"); return; }
  const move = $("inMove").checked;
  const src = $("inSrc").value.trim();
  const params = { pkg: selectedPkg, dir, move: move ? 1 : 0 };
  if (custom) params.custom = custom;
  if (src) params.src = src;
  const relDesc = dir === "both" ? "obb + data" : (dir === "custom" ? custom : "Android/" + dir + "/" + selectedPkg);
  if (move && !confirm("将执行：\n1) 把 " + relDesc + " 的数据移动到 TF 卡\n2) bind 挂载 TF 卡目录到原位置\n\n移动后原 eMMC 数据会被清空（已复制到 TF）。继续？")) return;
  busyOn();
  try {
    const r = await api("map", params);
    if (r.ok) { log("✅ 映射成功：" + selectedPkg + " (" + (dir === "both" ? "obb + data" : dir) + ")"); }
    else { log("❌ 映射失败：" + (r.error || "未知错误") + (r.detail ? " — " + r.detail : ""), "err"); }
    await loadStatus();
  } catch (e) { log("映射出错：" + e.message, "err"); }
  busyOff();
}

async function doUnmap(restore) {
  if (!selectedPkg) { log("请先选择包", "err"); return; }
  const dir = $("inDir").value;
  const custom = dir === "custom" ? $("inCustom").value.trim() : "";
  const params = { pkg: selectedPkg, dir };
  if (custom) params.custom = custom;
  if (restore && !confirm("将取消挂载并把数据从 TF 卡移回 eMMC。继续？")) return;
  if (restore) params.restore = 1;
  busyOn();
  try {
    const r = await api("unmap", params);
    if (r.ok) log("✅ 已取消映射" + (restore ? "并移回数据" : "") + "：" + selectedPkg + " (" + (dir === "both" ? "obb + data" : dir) + ")");
    else log("❌ 取消失败：" + (r.error || "未知") + (r.detail ? " — " + r.detail : ""), "err");
    await loadStatus();
  } catch (e) { log("操作出错：" + e.message, "err"); }
  busyOff();
}

async function doApply() {
  busyOn();
  try {
    const r = await api("apply");
    const ok = r.mounts ? r.mounts.filter((m) => m.ok).length : 0;
    log(`已应用全部配置，当前 ${ok} 个挂载点在线`);
    await loadStatus();
  } catch (e) { log("应用配置出错：" + e.message, "err"); }
  busyOff();
}

async function doDetect() {
  try {
    const r = await api("detect");
    if (r.extsd) $("inExtsd").value = r.extsd;
    if (r.intsd) $("inIntsd").value = r.intsd;
    log("探测完成：外置=" + (r.extsd || "未找到") + "，内置=" + (r.intsd || "未找到"));
  } catch (e) { log("探测出错：" + e.message, "err"); }
}

async function saveCfg() {
  const keys = {
    extsd: $("inExtsd").value.trim(),
    intsd: $("inIntsd").value.trim(),
    bind_engine: $("inEngine").value,
    permissive: $("inPermissive").checked ? "1" : "0",
  };
  busyOn();
  try {
    for (const [k, v] of Object.entries(keys)) {
      await api("setcfg", { key: k, val: v });
    }
    log("路径设置已保存");
    await loadStatus();
  } catch (e) { log("保存失败：" + e.message, "err"); }
  busyOff();
}

function busyOn() { busy = true; document.body.style.opacity = 0.7; }
function busyOff() { busy = false; document.body.style.opacity = 1; }

/* ---------- 初始化 ---------- */
async function init() {
  $("btnScan").onclick = loadScan;
  $("btnRefresh").onclick = loadStatus;
  $("btnApply").onclick = doApply;
  $("btnDetect").onclick = doDetect;
  $("btnSaveCfg").onclick = saveCfg;
  $("btnMap").onclick = doMap;
  $("btnUnmap").onclick = () => doUnmap(false);
  $("btnRestore").onclick = () => doUnmap(true);
  $("inDir").onchange = toggleCustom;
  toggleCustom();  // 初始状态：默认 obb → 隐藏自定义输入框
  $("inSearch").oninput = renderTable;
  // H1：不再从服务端拉取 token（token 接口同样需要令牌），改为 localStorage
  loadToken();
  $("inToken").value = TOKEN;
  $("btnToken").onclick = saveTokenFromInput;
  await loadStatus();
  if (TOKEN) {
    log("界面已就绪。点击“扫描”遍历包，选择包后点击“映射”。");
  } else {
    log("需要访问令牌：先在「访问令牌」卡片粘贴 token 并保存。", "err");
    log("获取：adb shell su -c 'cat /data/adb/tfcard/web_token'");
  }
}

function saveTokenFromInput() {
  TOKEN = $("inToken").value.trim();
  saveToken();
  log(TOKEN ? "✅ 令牌已保存（localStorage 已记住）" : "令牌已清空", TOKEN ? "" : "warn");
  loadStatus();
}

init();
