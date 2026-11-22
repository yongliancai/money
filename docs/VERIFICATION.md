# 隔離驗收與發布判斷

最新第一版驗收見 [V1-ACCEPTANCE](V1-ACCEPTANCE.md)，證據位於 `evidence/v1`；以下是先前里程碑，不應當成第一版最終測試數。

以下 35/35＋6/6 與 clone 是初始基準的歷史紀錄。**Pages 相容性改造的最新驗收與發布門檻請見 [GITHUB-PAGES](GITHUB-PAGES.md)**，對應證據保存在 `docs/evidence/pages`，不把 WebKit 模擬當成 iPhone 實機通過。

隔離副本最終驗收 **PASS**：以本機基準提交 `115e352` 執行不使用 hardlink 的全新 clone，斷開其 origin、重新 `npm ci`、完整 `npm run verify`，全部 exit 0（35 個程式測試、6 個 E2E）。僅在該副本新增並提交測試檔，再 Git revert，確認工作內容與基準零差異。證據：[isolated-clone.json](evidence/isolated-clone.json)、[執行日誌](evidence/isolated-clone.txt)。原始工作區與正式資料不受回復演練影響。

環境：Windows、Node 22.23.1、npm 10.9.8。實測日期 2026-11-22（Asia/Taipei；JSON 時戳使用 UTC）。原始命令、版本、時間、exit code 與日誌保存於 [evidence/summary.json](evidence/summary.json)。

| 驗收                                    | 狀態                    | 證據                                                                                                    |
| --------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------- |
| 乾淨 lockfile 安裝                      | PASS                    | npm ci，exit 0；clean-install.txt                                                                       |
| ESLint／Prettier／AST／機密／文件一致性 | PASS                    | npm run verify，exit 0；quality-and-e2e.txt                                                             |
| 單元、整合、API 契約／安全              | PASS                    | **35/35**；含 200 組狀態序列、AI 逾時、IDB 回滾、同步競爭與撤銷                                         |
| Chromium E2E                            | PASS                    | **6/6**；CRUD、預覽確認、備份還原、離線重載、手機與注入防護、撤銷恢復                                   |
| 開發啟動／health／實際手動儲存          | PASS                    | dev-smoke.json；5173 → 3001、儲存 42 元、pageErrors=[]                                                  |
| 回歸 red/green                          | PASS                    | 錯誤樣本 child exit 1，正確實作 exit 0；regression-proof.txt                                            |
| 依賴 audit                              | PASS                    | npm audit --audit-level=high，exit 0；**0 vulnerabilities**                                             |
| GitHub hosted CI／PR                    | BLOCKED                 | 無遠端 Repository，不借其他專案                                                                         |
| 真實 AI                                 | BLOCKED                 | 無模型／預算決策與憑證；demo 不算真實模型驗證                                                           |
| 正式提醒啟用                            | BLOCKED                 | freshness／debounce 未定；default policy=null，不送正式通知                                             |
| iPhone／公開 HTTPS／實際 push           | BLOCKED                 | 無隔離公開站、裝置與外部推播測試；stub／Chromium 不算實機                                               |
| 全新規範工作階段完整驗收                | BLOCKED                 | 新會話可見 AGENTS 內容並指出規則，但不能啟動終端機；未執行負例，不宣稱完整自動發現成功；new-session.txt |
| 正式部署                                | NOT_APPLICABLE 本次範圍 | 使用者明確禁止，未執行                                                                                  |

桌面與手機尺寸截圖：`evidence/desktop.png`、`evidence/mobile.png`。新 CLI 會話阻礙為 `Failed to create unified exec process: registered Core launch requires an installed app`，替代 Node runtime 也退出。入口可見與完整獨立驗收分開判定。

發布判斷：**No-Go 正式發布**。帳本隔離驗收與外部服務驗收分開，沒有將 BLOCKED 視為 PASS。

## 正式部署前需批准或定案

提醒有效期／補發去抖的產品取捨；AI 供應商／模型／費用上限與安全憑證；獨立 HTTPS 測試資源及實機操作；正式 host／domain／DB、備份與主機安全；若需 GitHub 倉庫或擴權則另批；最後每次正式部署與保護分支合併均需明確獨立批准。
