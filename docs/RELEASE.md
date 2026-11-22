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

發布準備中。既有 PR #1 的完整 GitHub CI 已成功：[run 44974118899](https://github.com/yongliancai/money/actions/runs/44974118899)。51 個程式測試、6 個原有 E2E、16 個 Chromium／WebKit Pages E2E 全通過，audit 0 漏洞。新增發布設定另經檢查與 CI 後才合併及觸發發布。

真實 iPhone Safari／加入主畫面／裝置離線驗收仍為 BLOCKED，不能以桌面 WebKit 手機模擬代替。第一版只有開啟網站時的今日提示，不具備背景定時推播。

## 回復

若正式檢查失敗，停止後續發布，保留 workflow 日誌；以 Git revert 建立修復 PR、驗證後再經授權手動發布。Service Worker 更新不刪除 IndexedDB；不移除使用者網站資料。
