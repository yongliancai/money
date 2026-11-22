# 主工程規範 v1

目前適用範圍：使用者授權第一批 MNY-01～05 的審查、修復、測試、提交與 Draft PR #3 更新，限 `feature/consumption-analysis-batch1`；禁止 main 合併、Pages／後端部署、真實資料、付費 API 與擴權。以下第一版發布授權是已完成的一次歷史授權，不能沿用到本批。[本批需求](ANALYSIS-BATCH1.md) 補充原先需求，不取消品質防護或提醒限制。

最新授權（2026-11-22）：使用者「我給你權限你直接正式發佈，也可以操作我的電腦」，批准本倉庫第一版 main 合併、Pages 啟用與手動正式發布。以下較早的禁止發布記述為歷史範圍，依此明確授權更新。保留所有品質檢查與 PR CI 的唯讀權限；發布僅限 workflow_dispatch、main、明確輸入確認及先建置驗證，沒有 push／PR 自動部署。未批准付費資源、秘密傳輸或其他正式資料操作。

第一版任務的最新授權：使用指定 `yongliancai/money` 倉庫，在隔離分支開發、測試、推送並提交 PR；不得合併 main、啟用 Pages 或發布。這取代先前「不得推送」的本次範圍限制。產品第一版使用本機規則解析、七類關鍵字分類、人工確認與開啟網站時的今日完成提示；不呼叫 AI API、不提供背景定時推播。分類衝突／未知不能用優先序或「其他」自動猜測。

本次 GitHub Pages 相容性任務補充授權：可修改隔離分支、測試 `/money/` 與選用 HTTPS 後端，並準備停用的手動發布範本；不授權啟用 Pages、變更外部發布權限、推送或正式部署。`scripts/workflow-policy.mjs` 檢查 active CI 不得含部署 action／權限，範本必須手動且有確認與 protected environment 門檻。

權威：使用者 2026-11-22 的完整執行指令、建置計畫 v1.2 的已確認產品需求。手冊 v2.0 為方法論草案。原附件的 PLAN ONLY 與階段未批准描述已由本次 Phase 0–5、Phase 6 隔離驗收授權取代，並未授權部署。

## 工作循環與門檻

DISCOVER → AUDIT → DESIGN → IMPLEMENT → VERIFY → PERSIST → REPORT。每批保留需求、檔案、命令、結果、問題、風險與驗收結論。檢查用 PASS／FAIL／BLOCKED／NOT_CONFIGURED／NOT_APPLICABLE，不能混用。

先讀需求與資料契約，再改程式。出錯依序：重現 → 根因 → 修復 → 防護 → 重跑 → 記錄。禁止刪有效測試、關閉檢查或降低標準以通過。對低影響可逆改動不增加鏡像實作的測試；帳本、授權、提醒狀態必須有行為測試。

## 安全與權限

只操作新專案、人工測試資料與隔離環境。正式部署、正式資料庫、既有伺服器、真實使用者資料、不可逆刪除、擴權、費用資源、傳送或揭露金鑰、正式保護分支合併均需另行批准。禁止自動部署。無 GitHub 遠端時只使用本機 Git，不借其他倉庫。

不記錄請求原文、完整消費明細或權杖到伺服器日誌；錯誤回覆不得包含堆疊或伺服器密鑰。`.env.local`、SQLite、測試執行資料不得入 Git。只使用後端環境設定存放服務密鑰。前端裝置 token 必須持久化於本機以支援免登入，不能防禦完全控制裝置或同來源 XSS 的攻擊；以 CSP、文字節點及依賴防護降低風險。

## 邊界與程式規則

- UI → ledger repository → IndexedDB；同步服務依 repository 操作，不讓 Service Worker 寫帳本。
- API → service／scheduler → SQLite；shared 僅提供無副作用契約與日期工具。
- client 不可載入 server、Node built-ins、web-push 或模型 SDK。
- AI 只回候選資料，不能持有帳本存取或統計計算權限。
- 正整數 TWD；單筆上限為 JS 安全整數的表示限制，累計使用 BigInt 避免溢位。未確定的退費／小數需求不得擅自加入。
- 使用文字節點呈現外部資料；不把使用者輸入插入 HTML。

## 可執行防護

`npm run verify` 為統一入口。`scripts/guardrails.mjs` AST 檢查包含 import、re-export、dynamic import、require 的依賴方向；機密掃描識別高信心金鑰形狀與私鑰標頭，及 Git 追蹤的 env／SQLite。此為有限規則，不宣稱能偵測所有秘密。合法 shared import 與故意非法 server import、合成金鑰均有正反例。

與單靠 ESLint 相比，AST checker 覆蓋 re-export／dynamic import 與伺服器／shared 反向依賴；兩者分工保留。owner 為本機專案維護者；例外需在 ADR 記原因、範圍、到期與正反例。規則失效或誤判需先重現再修，不默默跳過。

## 完成定義

受影響檢查通過；最後完整 verify、乾淨安裝、回歸 red/green、安全測試與證據。新工作階段載入須另驗，不以存在 AGENTS.md 代替成功。PR CI 實際執行與 iPhone 真機無法驗證時標記 BLOCKED。回滾採 Git revert，不刪帳本；資料復原使用預覽後 JSON 合併。
