# 生意管理系統 (Biz Management System)

庫存管理、客戶管理、記帳、財務概覽 — 全棧應用

## 技術棧

- **前端**: 純 HTML/CSS/JS（暗色主題，無框架）
- **後端**: Node.js + Express（本地）/ Vercel Serverless Functions（雲端）
- **資料庫**: better-sqlite3（本地開發）/ Turso libSQL（雲端部署）

## 本地開發

```bash
npm install
npm start
# 打開 http://localhost:3000
```

不設定環境變數時，自動使用本地 SQLite（`data.db`）。

## 部署到 Vercel + Turso

### 1. 建立 Turso 資料庫

```bash
# 安裝 Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# 登入
turso auth login

# 建立資料庫
turso db create biz-management

# 取得連線 URL 和 Token
turso db show biz-management --url
turso db tokens create biz-management
```

### 2. 推到 GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### 3. 部署到 Vercel

1. 前往 https://vercel.com → New Project → Import GitHub 倉庫
2. Environment Variables 設定：
   - `TURSO_DATABASE_URL` = Turso 連線 URL
   - `TURSO_AUTH_TOKEN` = Turso Auth Token
3. Deploy

## API 端點

| Method | Path | 說明 |
|--------|------|------|
| GET | `/api/health` | 健康檢查 |
| GET/POST | `/api/inventory` | 庫存列表/新增 |
| GET/PUT/DELETE | `/api/inventory/:id` | 庫存查詢/更新/刪除 |
| GET/POST | `/api/customers` | 客戶列表/新增 |
| GET/PUT/DELETE | `/api/customers/:id` | 客戶查詢/更新/刪除 |
| GET/POST | `/api/transactions` | 帳目列表/新增 |
| GET/PUT/DELETE | `/api/transactions/:id` | 帳目查詢/更新/刪除 |
| GET | `/api/dashboard` | 儀表板統計 |
| GET | `/api/finance` | 財務概覽 |

## 資料表結構

- **inventory**: 商品庫存（name, category, stock, unit, min_stock, unit_price）
- **customers**: 客戶資料（name, phone, email, address, notes）
- **transactions**: 收支記錄（type, amount, category, description, tx_date）
