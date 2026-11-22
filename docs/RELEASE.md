# 第一版正式發布紀錄

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
