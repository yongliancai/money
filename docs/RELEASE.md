# 正式發布紀錄

## 第一批消費分析（2026-11-22）

使用者獨立批准本次第一批正式發布，包含 PR #3 Ready／依規則合併、既有手動 Pages workflow 與隔離合成資料驗收；不包含第二批、付費服務、權限擴張、其他 Repository 或真實帳本操作。

**PASS：正式發布與公開網址驗收成功。**

- PR #3 head 核對為 `1f1591d255ead79586917822172568e03ac9ae84`，base 核對為 `a6f45df`，CI 成功且 mergeable_state=clean。先標示 Ready，再以預期 head 防護合併，沒有 force push。
- merge／正式程式版本：`7551d96d879fa11dcefe433b039e91081310f838`；tree `201a17d982b63a6a4ab6d0e89c423787d7ffb289` 與已驗收版本完全相同。
- [手動發布 run 45031237703](https://github.com/yongliancai/money/actions/runs/45031237703)，event=workflow_dispatch、branch=main、確認文字 `PUBLISH money`，build／deploy 均成功。build 重新執行乾淨安裝、80 個程式測試、6 個原有 E2E、26 個 Pages E2E 與靜態建置。
- artifact `github-pages` ID `14757572455`，digest `sha256:ed10d81d51192f67e97f5e5cba45395f6972dd117ddd37b66610ed31af2aed3e`。
- 正式網址：https://yongliancai.github.io/money/ 。既有 Pages 存取設定與手動流程未變更，沒有改成 push／PR 自動部署。

正式站驗收：`npx playwright test --config playwright.published.config.js`，Chromium 7 案、WebKit 7 案，**14 通過、0 失敗／跳過／flaky**。原始結果見 [published-results.json](evidence/batch1-release/published-results.json) 及 [執行日誌](evidence/batch1-release/published-run.txt)。此 config 是人工選用的正式站驗收，不會由一般 CI 自動操作正式網站。

| 正式站檢查                                                                          | 結果                                      |
| ----------------------------------------------------------------------------------- | ----------------------------------------- |
| 快速文字預覽確認、CRUD、搜尋、JSON v2 匯出／刪除後還原／去重                        | PASS                                      |
| 同商品人工確認與取消、五筆門檻／中位數、編輯及刪除重算                              | PASS                                      |
| 最近 7 天日期／總額／百分比、月同期日期／筆數、18/20=90%、14/20=70%、13/20=65% 門檻 | PASS                                      |
| 今天零支出確認與取消、匯入不完成今天                                                | PASS                                      |
| 市場 Mock 明確示範標示、三商家與中位數、沒有真實市場請求                            | PASS                                      |
| 重新載入保留資料、Worker scope／Manifest／圖示、離線重載及新增                      | PASS                                      |
| 真實瀏覽器 context 內種入 v1 合成紀錄，正式程式升 v2 且完整保留                     | PASS                                      |
| 320／390／768 寬度無水平溢出或主選單按鈕重疊                                        | PASS                                      |
| JavaScript／HTTP 錯誤與非預期網路／API 請求                                         | 全部 0                                    |
| 真正 iPhone Safari／主畫面安裝                                                      | BLOCKED：沒有實機，不能以桌面 WebKit 代替 |

資料保護：每案由 Playwright 建立全新臨時 browser context，不使用 persistent context、Chrome 使用者 profile 或帳本；未呼叫 deleteDatabase／清除網站資料。刪除與還原只作用於該隔離 context 的合成資料。未提交測試帳本資料庫、備份下載、機密或本機環境檔；保留的是測試程式、匿名合成結果與畫面證據。

本次產品程式沒有新增修復，發布前後驗收一次通過。GitHub 仍顯示既有 v4 actions 的 Node runtime 淘汰警告，工作成功且未隱藏；可於日後獨立維護。沒有購買服務、建立付費資源或發送付費 API 請求，GitHub 帳單未另行查核。

本次後續紀錄提交只更新文件與獨立驗收工具／證據，不重發網站；正式站仍對應上述 `7551d96`。後續正式發布仍需使用者獨立批准。

## 第一版（歷史發布）

使用者於 2026-11-22 明確指示：「我給你權限你直接正式發佈，也可以操作我的電腦」。範圍為 yongliancai/money 第一版：合併已通過驗證的 PR、啟用 Pages、手動發布至 https://yongliancai.github.io/money/。沒有批准付費資源、秘密傳輸、真實帳本操作或後續自動發布。

## 發布方式

- `.github/workflows/ci.yml` 僅測試並產生預覽，不部署。
- `.github/workflows/pages-release.yml` 只接受手動 workflow_dispatch，指定 main 並輸入 `PUBLISH money`。
- build 必須先完成乾淨安裝、完整 npm run verify 與 Pages 建置；deploy 依賴成功的 build。
- 僅 deploy job 具有 pages/write 與 id-token/write；不更改一般 CI 權限。
- Pages Source 使用 GitHub Actions，base 為 `/money/`，沒有 AI API Key 或獨立後端。
- 未假設 github-pages environment 已配置 required reviewers；本次人工門檻是使用者明確授權與手動確認。後續發布須再次取得授權。

## 證據與目前狀態

**PASS：2026-11-22 正式發布成功。** [網站](https://yongliancai.github.io/money/) 已可開啟。

- [PR #1](https://github.com/yongliancai/money/pull/1) 的最後 head `9ec2421` 經 [CI 44985262808](https://github.com/yongliancai/money/actions/runs/44985262808) 成功後合併。
- 正式版本為 main commit `3268c4e466d77bcb4a9064a77e9261bf11f9b404`，tree `35e8b949429e34b0f7ae8c625dfc899de91282b4` 與本機驗證版本完全一致。
- [手動發布 44985467153](https://github.com/yongliancai/money/actions/runs/44985467153) build、deploy 全成功。build 再次執行 npm ci、npm run verify 與 npm run build:pages。51 個程式測試、6 個原有 E2E、16 個 Pages E2E 均通過。
- 正式 artifact `github-pages` ID `14739950744`，digest `sha256:99297696e7264585ed130d0232fe8c526509cfaeaf16ce2a0438552f9999448a`。
- Pages Source 已設 GitHub Actions、HTTPS 強制啟用，github-pages environment 僅允許 main，未新增秘密、付費資源或第三方服務。
- 正式網址 Chromium／WebKit 390×844 測試均 PASS：HTTPS 200、圖示／Manifest／Worker scope、確認前不寫入、CRUD、月統計、JSON 匯出與合併去重、重載保留資料、離線重載與新增、無水平溢出、零 API 請求、零頁面錯誤／HTTP 錯誤。原始結果見 [published-smoke.json](evidence/release/published-smoke.json)。

可重跑正式站測試：`node scripts/verify-published.mjs`。只在全新隔離瀏覽器 context 寫入合成資料，關閉 context 即結束，不讀取使用者 Chrome 帳本。首次驗證腳本因選單含圖示、exact accessible name 不相符而等待超時；修正測試定位後完整重跑成功，產品程式未變更，沒有降低斷言。

已知維護事項：本次 GitHub Actions 顯示部分 v4 actions 使用 Node 20 runtime 的淘汰警告（由平台轉為 Node 24 執行），工作全部成功。後續可獨立更新 actions 版本並重新驗證，未隱藏警告。

本紀錄與證據的後續文件提交不會自動發布；正式站仍對應上述 `3268c4e`。沒有啟用 push／PR 自動部署。

真實 iPhone Safari／加入主畫面／裝置離線驗收仍為 BLOCKED，不能以桌面 WebKit 手機模擬代替。第一版只有開啟網站時的今日提示，不具備背景定時推播。

## 回復

若正式檢查失敗，停止後續發布，保留 workflow 日誌；以 Git revert 建立修復 PR、驗證後再經授權手動發布。Service Worker 更新不刪除 IndexedDB；不移除使用者網站資料。
