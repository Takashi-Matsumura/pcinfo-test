# pcinfo-test

ヘッドレスサーバ（macOS / Linux）の状態をブラウザから読み取り専用で確認できるダッシュボード。
信号機色（緑／黄／赤／灰）と日本語の総合判定文で「ハードウェア／ソフトウェア／ネットワークのどこに問題があるか」を一画面で示す。

## できること

- **基本リソース**: CPU 使用率 ／ メモリ ／ ロードアベレージ ／ アップタイム ／ ディスク ／ NIC リンク
- **ハードウェア健全性**: 熱状態（macOS は CPU 速度制限、Linux は温度）／ SMART
- **ネットワーク疎通**: デフォルトゲートウェイ ／ DNS 解決 ／ ping（複数宛先）
- **サービス監視**: launchd（macOS）／ systemd（Linux）の指定ユニットの稼働確認
- **ログ**: macOS の `log show` または Linux の `journalctl` + `dmesg` の直近エラー抜粋
- **総合判定**: 設定したしきい値を超えると、原因系統（ハード／ソフト／ネット）を日本語 1 文で要約
- **自動更新**: クライアント側で 5 / 10 / 30 秒間隔のポーリング（種類別）
- **障害耐性**: 連続応答失敗時はカードを灰色にして「サーバ応答なし」と表示
- **読み取り専用**: 操作系 API は持たない

## エンドポイント

| Path | 内容 | ポーリング間隔 |
| --- | --- | --- |
| `/` | ダッシュボード UI | — |
| `/api/status` | CPU ／ メモリ ／ Load ／ Uptime ／ ディスク ／ NIC リンク | 5 秒 |
| `/api/health` | 熱／温度／ SMART ／ ゲートウェイ ／ DNS ／ ping | 30 秒 |
| `/api/services` | launchd / systemd ユニットの状態 | 10 秒 |
| `/api/logs` | エラーログ抜粋 | 手動取得 |

## プラットフォーム対応

| 指標 | macOS | Linux |
| --- | --- | --- |
| CPU 使用率 | Node `os.cpus()` 差分 | 同左 |
| メモリ | `vm_stat` + `sysctl hw.memsize` | `/proc/meminfo` |
| Load Average | Node `os.loadavg()` | 同左 |
| Uptime | Node `os.uptime()` | 同左 |
| ディスク | `df -k -l` | `df -P -B1` |
| NIC リンク | `ifconfig` の status / media | `/sys/class/net/*` |
| 温度・熱 | `pmset -g therm`（CPU 速度制限） | `sensors -j` |
| SMART | `smartctl --json`（外付け SATA/USB 中心） | `smartctl --json` |
| ゲートウェイ | `route -n get default` | `ip -j route` |
| DNS | Node `dns.promises.lookup` | 同左 |
| ping | `ping -c 1 -t 2` | `ping -c 1 -W 2` |
| サービス | `launchctl list <Label>` | `systemctl is-active <unit>` |
| ログ | `log show --predicate 'messageType == "error" OR messageType == "fault"'` | `journalctl -p err` + `dmesg` |

## 必要環境

- Node.js 24+
- macOS（Apple Silicon / Intel）または Linux
- 任意: `brew install smartmontools`（SMART を見る場合）／ `lm-sensors smartmontools`（Linux）

## セットアップ

### 開発（実機データ）

```bash
npm install
npm run dev
# http://localhost:3000
```

### モックモード（UI 確認のみ）

```bash
MONITOR_DEV_MOCK=1 npm run dev
```

実機コマンドを呼ばず、ダミーデータで UI 動作だけを確認できる。

### 本番ビルド

```bash
npm ci
npm run build
npm start -- -H 127.0.0.1 -p 3000
```

LAN の他端末からアクセスする場合は `-H 0.0.0.0` か、nginx / Caddy などのリバースプロキシを前段に置く。

### macOS 常駐（LaunchDaemon）

`/Library/LaunchDaemons/jp.local.servermonitor.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>jp.local.servermonitor</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/opt/server-monitor/node_modules/next/dist/bin/next</string>
        <string>start</string>
        <string>-H</string><string>127.0.0.1</string>
        <string>-p</string><string>3000</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/opt/server-monitor</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>StandardOutPath</key>
    <string>/var/log/server-monitor.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/server-monitor.err</string>
</dict>
</plist>
```

```bash
sudo launchctl bootstrap system /Library/LaunchDaemons/jp.local.servermonitor.plist
sudo launchctl enable system/jp.local.servermonitor
```

### Linux 常駐（systemd）

`/etc/systemd/system/server-monitor.service`

```ini
[Unit]
Description=Server Status Monitor
After=network-online.target

[Service]
Type=simple
User=monitor
SupplementaryGroups=adm systemd-journal
WorkingDirectory=/opt/server-monitor
Environment=NODE_ENV=production
ExecStart=/usr/bin/node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3000
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

## 設定（`config/monitor.ts`）

```ts
{
  thresholds: {
    cpuPercent:     { warn: 85, critical: 95 },
    memPercent:     { warn: 85, critical: 95 },
    diskPercent:    { warn: 80, critical: 92 },
    loadPerCore:    { warn: 1.0, critical: 1.5 },
    tempC:          { warn: 75, critical: 90 },   // Linux 温度
    cpuSpeedLimit:  { warn: 99, critical: 80 },   // macOS 熱抑制
  },
  diskMounts:         [],                         // 空 = 自動検出
  smartDevices:       [],                         // 例: ["/dev/disk2", "/dev/sda"]
  networkInterfaces:  [],                         // 空 = 全 IF（lo / lo0 除外）
  pingTargets: [
    { name: "デフォルトGW",   host: "__gateway__" },
    { name: "Cloudflare DNS", host: "1.1.1.1" },
    { name: "Google DNS",     host: "8.8.8.8" },
  ],
  dnsTestHosts: ["example.com", "cloudflare.com"],
  services:     [],                               // launchd ラベル / systemd ユニット名
  refreshIntervalsMs: { status: 5000, health: 30000, services: 10000 },
}
```

`launchctl list | grep <キーワード>` または `systemctl list-units --type=service` で対象を確認して `services` に列挙する。

## 必要権限

### macOS

| 機能 | 権限 |
| --- | --- |
| `vm_stat` / `sysctl` / `df` / `ifconfig` / `route` / `ping` / `pmset -g therm` / `launchctl list` | 不要 |
| `log show` でプライベートデータを含むログを見る | プロセスに「フルディスクアクセス」を付与 |
| `smartctl` で内蔵 Apple SSD | Apple Silicon の内蔵 SSD は対応外（外付け USB/SATA は可） |

### Linux

| 機能 | 権限 |
| --- | --- |
| `journalctl -p err` | `adm` または `systemd-journal` グループ |
| `dmesg` | `setcap cap_syslog+ep $(which dmesg)` |
| `smartctl` | `setcap cap_sys_rawio+ep $(which smartctl)` または sudoers |
| その他（`ip`, `ping`, `df`, `systemctl is-active`, `sensors`） | 不要 |

## ライセンス

MIT License

Copyright (c) 2026 pcinfo-test contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
