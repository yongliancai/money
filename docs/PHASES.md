# 分階段任務與完成條件

所有 phase 均使用本次使用者授權；沒有正式部署批准。PASS 僅限下列有證據的隔離部分；外部條件另列。

| 階段 | 已完成任務／主要檔案                                                                           | 完成條件／驗證                                                     | 尚餘風險／結論                                             |
| ---- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------- |
| 0    | AUDIT、REQUIREMENTS、ARCHITECTURE、DECISIONS、來源副本                                         | 空工作區與工具實測、已確認與候選需求分離、未決核心政策隔離         | PASS 本機規格；模型與提醒有效期待決                        |
| 1    | package/lock、vite、client/server/shared、AGENTS、README、env、manifest/SW、SQLite schema      | npm ci、build、HTTP health、瀏覽器可啟動                           | PASS 本機骨架；Node SQLite experimental 已明示             |
| 2    | ESLint、Prettier、guardrails、Zod、docs checker、CI                                            | 合法／非法 import、合成秘密負例；lint/format/guardrail/schema PASS | PASS 本機防護；GitHub 實際 CI BLOCKED 無遠端               |
| 3    | unit/integration/contracts、IDB rollback、property sequences、regression-proof                 | 人工確認、日期、匯入、同步亂序、日 claim、前日不補發均執行         | PASS 已列測試；不代表任意併發或所有輸入已形式證明          |
| 4    | capability/permission/subscription、server endpoint allowlist、VAPID adapter、SW push handlers | localhost PWA／離線、模擬推播／跨日、授權與去重通過                | 部分 PASS；公開 HTTPS、實際訂閱、iPhone 關閉後通知 BLOCKED |
| 5A   | ledger/UI CRUD、分類、月統計、完成活動                                                         | domain＋IDB＋CRUD E2E                                              | PASS                                                       |
| 5B   | disabled/demo adapter、Schema、可編輯預覽／取消／確認、fallback                                | API＋storage＋E2E；展示模式清楚標示                                | 部分 PASS；真實模型及品質評測 BLOCKED                      |
| 5C   | JSON/CSV、匯入版本驗證、預覽、去重、恢復提示                                                   | lossless ledger restore＋CSV 防護＋下載／還原 E2E                  | PASS；匯入不恢復今日活動                                   |
| 5D   | 匿名授權、設定、撤銷／啟用、outbox、SQLite atomic claim、排程指標                              | API 安全／限流、sync failures/race、200 狀態序列、兩連線競爭       | 本機機制 PASS；正式提醒啟用 BLOCKED 待政策                 |
| 5E   | 手機 UI、PNG app icons、PWA 離線快取、錯誤提示                                                 | 390px 無橫向溢出、XSS 字串、offline reload、截圖                   | PASS Chromium；iPhone UX／安裝 BLOCKED                     |
| 6    | 乾淨安裝、統一 verify、安全與還原、red/green、文件／規範檢查、獨立會話嘗試                     | 見 VERIFICATION 與 docs/evidence；不能僅抄錄實作宣稱               | 隔離可執行項依證據；正式發布 No-Go                         |

## 修改與修復紀錄

Phase 6 的獨立本機 clone、乾淨 npm ci、完整 verify 與 Git revert 演練均 PASS，基準提交 `115e352`；35 個程式測試與 6 個 E2E 再次全通過。全新 Codex 規範工作階段仍因 runtime 無法執行而 BLOCKED，沒有用 clone 測試替代該項宣稱。

完整檔案見 PROJECT-TREE。已發現及修正問題見 KNOWN-ISSUES F01–F06；保留有效測試並重跑。未觸碰既有伺服器／帳本／GitHub repo，無 PR、無遠端部署。

回滾：Git commit 可還原程式，JSON preview merge 可還原帳本。隔離 rollback 演練應從已保存的本機提交建立獨立 worktree／clone，不對工作資料做 destructive reset。發送 claim 已消耗時不能回復後重送，避免破壞每日上限。
