# 第一版工程交接與驗收

更新（2026-11-22）：使用者已明確授權合併 main、啟用 Pages 與正式發布；下列原先發布限制保留為當時驗收紀錄。最新進度以 [發布紀錄](RELEASE.md) 為準。PR #1 的 GitHub hosted CI 已通過 51 個程式測試、6 個原有 E2E、16 個 Pages E2E。

本機最終驗收 **PASS**：乾淨安裝、ESLint／格式／邊界／機密／文件檢查、51 個程式測試、6 個原有 E2E、16 個 Pages／快速記帳 E2E、建置與回歸 red/green 均成功，audit 0 漏洞。實際版本、時間、命令與 exit code 見 [summary.json](evidence/v1/summary.json)，完整日誌見 [quality-and-e2e.txt](evidence/v1/quality-and-e2e.txt)。不將本機成功推論為公開 Pages 或真實 iPhone 成功。

目標倉庫 `yongliancai/money`，main 保持使用者控制。開發分支 `feat/pages-v1-quick-entry`。本次授權包含 feature branch 推送與 PR，不含 main 合併、Pages 啟用、發布、擴權或費用資源。

## 盤點與來源

已重讀 AGENTS、工程規範、需求、架構、ADR、Guide v2.0 的 START-HERE／modules 01–08，以及建置計畫 v1.2。Guide 原合併版缺少所引用 guardrail YAML 範本，此缺件沿用 AUDIT 紀錄，沒有偽稱取得。最新第一版任務核准規則解析與七類分類，取代舊文件尚未決的分類列表及 AI／推播交付範圍。

遠端 main 初始只有 `README.md`（標題 money），SHA `47ec43f460de3d1227e4cef998075d07ed6f5751`。本機已有完整隔離帳本與 Pages 程式；新增正確 origin，僅在 feature branch 接合兩者歷史，保留 README 來源資訊，讓 PR 可正常比較。沒有寫入／合併遠端 main。

## 任務與完成條件

| 階段         | 實作／檔案                                                                          | 驗證                                                                                     |
| ------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1 專案       | 沿用 Vite、原生 JS、IndexedDB、PWA、ESLint、CI，連接指定遠端 main 的 feature branch | lockfile 乾淨安裝、工程規範與依賴防護                                                    |
| 2 文字／分類 | parser.js、classification-rules.js、快速輸入表單、預覽                              | 四範例、多行、七類、同類命中、跨類衝突、未知、錯金額、相對／無效日期、50 筆／4000 字上限 |
| 3 儲存       | 沿用 ledger transaction；本機規則確認為 manual，不升 DB／backup schema              | 未確認不寫、取消不寫、雙重提交只存一次、交易回滾                                         |
| 4 管理／統計 | 沿用 CRUD、月份、搜尋、分類與消費日期                                               | 原有 unit／integration／E2E 全保留                                                       |
| 5 備份       | JSON／CSV、預覽、合併、ID 去重、恢復提示                                            | 下載、取消、恢復、重複跳過、匯入不計今日                                                 |
| 6 手機／PWA  | /money/、Worker、離線 quick entry、今日提示、加入主畫面說明                         | Chromium／WebKit 手機模擬、離線重載、更新不清資料、無後端零 API 請求                     |
| 7 自動化     | 原有全部測試＋quick-entry unit／雙瀏覽器 E2E                                        | 統一 npm run verify、secret／schema／workflow 正反例                                     |
| 8 發布前     | 現行 CI 只測試＋artifact；正式發布範本維持 disabled                                 | 不改 Pages／權限、不執行發布；feature PR 供使用者審查                                    |

## 行為與限制

每行都是一筆候選，空行忽略但保留原行號。支援末尾正整數、合法千分位、全形數字與選用幣別；不能把小數、負數、零、超過安全整數或一行多金額當成有效支出。缺欄位保留在預覽修正，不能偷偷丟行。可指定表單預設日期，並辨識今天／昨天／前天／ISO 前綴；其他不明確日期要求自行選擇。

分類會收集所有命中的類別與關鍵字；只有唯一類別才建議分類。跨類衝突或無命中都保留空選項，連「其他」也須使用者明選。所有欄位可編輯。確認按鈕有重入保護，ledger 仍以一次性確認與交易保護實際寫入。

Pages 第一版即使建置環境留下 API URL 也強制本機模式，不要求通知權限、不呼叫 AI／裝置 API。公開 UI 隱藏舊後端控制；原有 backend UI 在 production／integration mode 保留，以獨立 fixture 繼續驗證既有契約，未刪除或降低舊測試。這些是未來版本回歸，不列入第一版對外功能。

## 執行與證據

```powershell
npm ci
npx playwright install chromium webkit
npm run verify
npm run build:pages
npm run preview:pages
```

網址 `http://127.0.0.1:4173/money/`；開發 `npm run dev:pages`。證據保存命令 `npm run verify:record -- docs/evidence/v1`；日誌包含實際版本、時間、exit code。快速記帳缺失的 red 已真實重現（舊版沒有 #quick-input，E2E exit 1），見 `evidence/v1/red-before.txt`。原有 HTTP 錯誤攔截受 Worker 影響的失敗、根因與修正保存在 `legacy-route-failure.txt`、`repair-log.txt`，沒有刪除有效斷言。

真實 iPhone Safari／加入主畫面、正式 HTTPS 實站仍需裝置與發布後驗證，標記 BLOCKED。桌面 WebKit 模擬不是實機。AI API 與背景定時 Web Push 是本版明確不提供，屬 NOT_APPLICABLE，不是偷偷宣稱完成或功能故障。

## 發布門檻

預期網址 `https://yongliancai.github.io/money/` 尚未啟用。正式發布仍須另批：合併 main（含受保護分支規則）、Pages Source、environment review／Pages 權限與手動啟用發布範本、最後一次正式發布。PR／CI 不是部署，本次不執行上述操作。
