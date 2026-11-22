# 架構與資料契約

第一版 Pages 最新資料流：快速文字表單 → `features/quick-entry/parser.js` → 集中 `classification-rules.js` → 可編輯預覽（未知分類空值）→ 使用者確認 → ledger.preview／confirm → IndexedDB。解析器不持有 storage 或網路權限。確認以 origin=manual 表示人工確認的本機輸入，維持既有備份 schema／資料庫版本。Pages runtime 強制不連後端，隱藏後端 AI／訂閱控制，只顯示本機今日完成與安裝說明；根目錄與 integration mode 的既有後端流程保留作回歸，不是第一版發布功能。

GitHub Pages 補充：`config/site.json` 指向 `yongliancai/money`，`shared/site-config.js` 統一 base 與公開 API URL 規則；Vite pages mode 產出 `dist-pages` 並重寫 Manifest／Worker。未設定獨立後端時不發送 API 請求。`client/src/services/api.js` 負責指定後端、逾時、停用與契約驗證；裝置憑證依後端 URL 分隔。後端只對明確 `APP_ORIGIN` 回 CORS；Pages origin 為 `https://yongliancai.github.io`。詳見 [Pages 交接](GITHUB-PAGES.md)。

```text
client/index.html → src/main.js
                      ├─ storage/ledger.js → IndexedDB
                      ├─ services/sync.js → authenticated /api
                      └─ services/push.js → Service Worker / PushManager
shared/schemas/index.js + shared/dates.js ← client & server
server/src/app.js → db/database.js → SQLite
                 → services/ai.js (disabled/demo; injectable parse interface)
server/src/index.js → jobs/scheduler.js → web-push (disabled by default)
```

## IndexedDB v1

`expenses`：UUID、item、正整數 amount、category、expenseDate、不可被一般編輯改動的 createdAt、updatedAt、origin、schemaVersion。`activity` 以 record ID 儲存本裝置新建的操作時間；刪除紀錄同交易刪除此證據。按設定 IANA 時區換算今日；時區變更會重新計算活動日期。

`settings`：提醒設定、匿名裝置授權與撤銷標記。`meta`：每個 localDate 的 revision；`outbox`：eventId → 狀態快照；`tombstones`：刪除過的 ID，以便備份恢復預覽揭露。

記帳、activity、revision、outbox 在同一 readwrite transaction 寫入；中途失敗全部回滾。預覽 token 為記憶體中一次性操作入口，確認先同步消耗 token 以擋快速連按，交易失敗才還原 token；不是防止惡意本機使用者修改自己帳本的安全邊界。

匯入保留原始 createdAt／updatedAt，來源轉 import；不新增 activity。重複 ID 跳過，不覆蓋既有內容；同檔案內 ID 也去重。預覽後實際確認會再檢查目前 ID，因此其他分頁先新增相同 ID 不會被覆蓋。

## SQLite migration v1

`devices`（token SHA-256）；`settings`；`subscriptions`；`statuses`（device,date 主鍵）；`events`（device,eventId 主鍵）；`claims`（device,date 主鍵）。`PRAGMA user_version=1`、外鍵、WAL、busy_timeout。當前只有初始 migration；未來版本須新增可測 migration，不能任意重建資料。

events/statuses 清理 35 天以前資料；claims 保留到裝置撤銷，避免再次旅行回同日期重發。撤銷裝置透過外鍵 cascade 清除其後端中繼資料，不影響本機帳本。推播訂閱端點在隔離 SQLite 儲存，無靜態加密；公開環境需檢視主機權限／磁碟加密與保留政策，尚未授權部署。

## 狀態同步

eventId、localDate、timeZone、每日本機遞增 revision、completed、occurredAt、settingsRevision。裝置 ID 從驗證 header 決定，不接受 body 的任意 deviceId。設定版本不得倒退；相同版本不同設定拒絕。事件檢查時鐘／本地日期、時區與設定版本。舊 revision 不能覆蓋新狀態；同 eventId 冪等。

同步使用 Web Locks（支援時）跨分頁串行。伺服器確認 eventId 與不小於本事件的 revision 才清除有效當日事件。前一天或舊設定事件可被本機淘汰，不補發；新設定事件不得被舊同步過程清除。snapshot 前再次檢查設定版本，競爭時 abort 並下輪重試。離線不妨礙記帳。

## 提醒與安全

讀設定／狀態／訂閱、判斷資格與每日 claim 置於 SQLite `BEGIN IMMEDIATE`，避免排程程序交錯。claim 先持久化再呼叫外部 send；不確定結果不重試，維持最多一次嘗試，可能漏送。404／410 清除訂閱。Push TTL 60 秒且 SW 依當地日期拒絕前一天內容。外部服務接受與使用者看見通知分開記錄。

API 使用 strict Zod、24 KB 上限、token 驗證、來源檢查、全域／AI／註冊 rate limit、Helmet CSP；不記錄請求或 token。推播只接受 HTTPS 且明確列舉的 Apple／Google／Mozilla 主機，禁止任意 IP、連接埠及 credentials，降低 SSRF。新增供應商需修改 allowlist 與負例。

PWA 只快取 build shell、內容雜湊 JS/CSS、manifest 與圖示；API 永不快取。cache 名稱包含 build hash，activate 清理舊 app cache。SW 不寫帳本，notification click 固定回同來源 `/`。瀏覽器儲存清除仍可能遺失帳本，需使用者備份。
