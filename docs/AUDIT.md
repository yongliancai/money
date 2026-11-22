# DISCOVER／AUDIT／DESIGN 證據

2026-11-22，Windows PowerShell，工作區 `C:\Users\w5555\money`。

- `Get-ChildItem -Force`：空工作區；`git rev-parse --show-toplevel` 回覆非 Git repo。沒有既有業務程式碼或其他倉庫。
- `rg --files`：沒有 START-HERE.md、modules/、AGENTS.md、package.json；祖先指定路徑沒有發現 AGENTS.md。
- 兩份附件可讀。Guide 為「單檔閱讀版」，含 SOURCE 標記的 START-HERE.md、modules/01–08、templates 與 examples；已依順序閱讀。未取得原始模組化套件，因此抽取副本保存在 docs/sources，不能冒稱原目錄曾存在。
- Guide 提及 `templates/04-guardrail-record.yaml`，但合併附件沒有該範本的 SOURCE 內容。此項屬文件缺件，未偽造原範本；本專案以主工程規範、防護測試及修復紀錄承載工程證據，不阻擋已授權建置。
- 計畫 v1.2 為正式審核版但內容仍明示 PLAN ONLY；使用者本次明確授權建置與非正式驗收，取代其中過時的權限狀態。產品已確認規則照原文，候選架構照 ADR 區分。
- Node v22.23.1、npm 10.9.8、Git 2.51.0.windows.2；`node:sqlite` 實測 in-memory SQL 成功，SQLite 3.51.3。終端機、網路、Playwright 可用。
- `OPENAI_API_KEY` 僅做是否存在檢查：不存在。未讀取或揭露其他專案憑證；未建立任何新金鑰。

## 初始缺口與處置

| 初始證據                   | 風險        | 選擇與驗收                                               |
| -------------------------- | ----------- | -------------------------------------------------------- |
| 無原始碼與檢查             | 無法重現    | 最小 Vite／Express／SQLite／IDB；乾淨安裝、health、build |
| AI 人工確認是產品閘門      | P0 帳本誤寫 | 一次性預覽確認入口、Schema、單元與 E2E                   |
| 離線完成狀態易遺漏         | P0 誤提醒   | 交易 outbox、revision、設定 fence、200 組狀態序列        |
| 每日通知競爭               | P0 重複     | SQL 唯一 claim、transaction 讀判斷、兩連線競爭           |
| 匯入來源時間與操作時間不同 | P0 完成誤算 | activity 與帳本分離、恢復預覽、還原演練                  |
| 公開站／實機／模型未配置   | 外部阻礙    | 隔離模擬／展示與真實驗證分開標示 BLOCKED                 |

選擇單一 npm package 避免無必要工作區發版管理；不引進大型框架、微服務、Docker 編排、形式化工具或自動部署。每批依資料契約→storage/API→UI→E2E 推進；以本次指令為建置批准，不再重複要求 Phase 批准。

官方核對來源：[Vite Node 相容性](https://vite.dev/guide/)、[Node 支援生命週期](https://nodejs.org/en/about/previous-releases)、[WebKit iPhone Home Screen Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)。這些文件不能代替本專案實機驗證。
