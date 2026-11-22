# 交接

最新 GitHub Pages 改造交接為 [GITHUB-PAGES.md](GITHUB-PAGES.md)。目標倉庫已由使用者指定 `yongliancai/money`，目前僅讀取其 metadata，未建立本機遠端、未推送、未啟用 Pages。以下初始交接與提交保留作歷史基準。

產品與防護基準提交為 `115e352`。其獨立 clone 已重新安裝、完整 verify 通過並完成 Git revert 回復演練；證據 `docs/evidence/isolated-clone.json`。後續文件提交只補驗收紀錄。開發／測試伺服器均已停止；ignored `.tmp/acceptance-115e352` 保留供追查，原始工作區沒有 GitHub 遠端。

專案根目錄：`C:\Users\w5555\money`。版本化規範入口 AGENTS.md；完整檔案地圖 PROJECT-TREE.md，架構與契約 ARCHITECTURE.md，各階段任務、驗收與風險 PHASES.md。

目前為可執行的隔離本機產品版。手動帳本、CRUD、分類、月份統計、今日操作活動、JSON／CSV、合併預覽／恢復揭露、離線 PWA、匿名裝置、設定、同步與排程機制已實作並驗證。自然語言僅展示 adapter，真實模型尚未接通。正式提醒預設停用。

執行 `npm ci`、`npm run dev`，網址 `http://127.0.0.1:5173`。展示解析使用啟動前 `$env:AI_MODE='demo'`。完整離線 build 以 `npm run build`、`npm start`，同來源 `http://127.0.0.1:3001`，APP_ORIGIN 須一致。兩個 port 帳本不同；以 JSON 移轉。測試資料人工生成，無正式帳本。

驗證 `npx playwright install chromium`、`npm run verify`；保存證據使用 `npm run verify:record`。最終 35 個程式測試與 6 個 Chromium E2E 通過，audit 0 漏洞，詳見 VERIFICATION 與 evidence/summary.json。完整新會話執行、GitHub CI、真實 AI、iPhone／HTTPS／push 送達仍 BLOCKED。

沒有 GitHub 遠端與 PR，不使用其他倉庫。本機分支 `work/isolated-build`；提交以 `git log --oneline` 為準。正式部署未執行。程式回復採 Git revert，帳本恢復使用 JSON 合併預覽；不要用 Git reset 操作帳本。

正式部署前須另批：模型與費用、提醒有效期及去抖、隔離公開 HTTPS 與 iPhone 試驗、外部資源與權限、正式環境位置與資料安全、最後一次部署或保護分支合併。原附件缺少 guardrail YAML 範本的情況已記 AUDIT；不影響本次用實際程式建立防護。
