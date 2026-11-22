# AI 工程入口

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
