# AI 工程入口

本次第一批正式發布已獲使用者獨立授權：允許將已驗收 PR #3（1f1591d）標示 Ready、依規則合併 main、執行既有手動 Pages 發布及隔離正式站驗收。以下「僅 Draft／不得合併或發布」為前次收尾範圍，已被此次明確授權取代。未授權第二批、付費 API、其他專案、擴權或正式使用者帳本操作；後續發布仍需獨立批准。結果見 [發布紀錄](docs/RELEASE.md)。

本次第一批消費分析收尾：只更新 `feature/consumption-analysis-batch1` 與 Draft PR #3，禁止合併 main、發布 Pages、付費 API、正式資料與擴權。先前第一版的一次發布授權已完成，不適用本批。先讀 [本批需求與驗收](docs/ANALYSIS-BATCH1.md)。

最新授權（2026-11-22）：使用者明確批准將 yongliancai/money 第一版合併 main、啟用 GitHub Pages 並正式發布，也批准必要的電腦操作。此一次發布授權取代下列歷史發布限制；仍須通過 CI，僅能手動觸發發布，不得擴大至其他資源、秘密或後續自動發布。詳見 [發布紀錄](docs/RELEASE.md)。

先讀 [主工程規範](docs/PROJECT-ENGINEERING.md)、[已確認需求](docs/REQUIREMENTS.md)、[架構](docs/ARCHITECTURE.md) 與 [待決 ADR](docs/DECISIONS/README.md)。

- 修改前理解需求；修復先重現，修改後執行受影響的測試。
- 最終驗證：`npm run verify`；正反例證據：`node scripts/regression-proof.mjs`。
- client 不可引用 server、Node API 或模型 SDK；shared 不可引用任一應用層。
- 未經明確確認的 AI 預覽不得儲存；匯入不得產生今日完成活動。
- 正式部署、正式資料、費用資源、擴權、傳送金鑰及受保護分支合併，均需另行批准。
- 本專案僅授權隔離開發；不得建立自動部署流程，不得降低有效品質門檻。
- 本次 Pages 改造允許準備 `.github/workflow-templates/pages-release.yml.disabled`；不得啟用此範本、增加遠端 Pages 權限或執行發布。PR CI 僅驗證與產生預覽 artifact。
- 第一版 Pages 使用離線 JavaScript 規則解析與七類關鍵字分類；衝突／未知分類須由使用者選擇，確認前不得儲存。本次允許推送隔離分支至 yongliancai/money 並提交 PR；不得合併 main。公開第一版不使用 AI API 或背景定時推播。
- 不能執行的驗證標記 BLOCKED；不得把展示解析、模擬推播當成真實 AI／iPhone 驗證。

此入口為版本化指引，自動載入能力須由獨立工作階段實測，不能只憑檔名推定。
