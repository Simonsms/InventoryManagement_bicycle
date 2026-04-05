# 腾讯云轻量服务器部署说明

## 1. 适用范围

本文档适用于当前库存管理项目在腾讯云轻量应用服务器上的首个部署场景。

当前推荐部署形态：

- `frontend`：Docker 构建后由 Nginx 提供静态站点
- `backend`：Node.js + Express 容器
- `postgres`：数据库容器
- `redis`：缓存容器

统一通过 [docker-compose.prod.yml](/E:/InventoryManagement_bicycle/docker-compose.prod.yml) 启动。

## 2. 服务器建议

当前已验证环境：

- Ubuntu
- Docker CE 27.5.1
- Docker Compose v2

最低可运行配置：

- `2核2G`

更稳妥配置：

- `2核4G`

## 3. 腾讯云控制台放行端口

建议仅放行：

- `22`：SSH
- `80`：HTTP
- `443`：HTTPS

不要直接放行：

- `3000`
- `5432`
- `6379`

原因是外部流量统一走 Nginx，数据库和 Redis 只给容器内网使用。

## 4. 服务器初始化

首次登录服务器后，执行：

```bash
timedatectl
apt update
apt install -y git curl unzip
mkdir -p /srv/apps
cd /srv/apps
docker --version
docker compose version
```

## 5. 拉取代码

```bash
cd /srv/apps
git clone <你的仓库地址> inventory-management
cd inventory-management
```

如果不是通过 Git 拉取，也可以先在本地打包，再上传到 `/srv/apps/inventory-management`。

## 6. 生产环境变量

先复制示例文件：

```bash
cp .env.production.example .env.production
```

再编辑：

```bash
nano .env.production
```

至少要改这些值：

```env
POSTGRES_PASSWORD=请改成强密码
JWT_SECRET=请改成足够长的随机字符串
FRONTEND_URL=http://你的服务器公网IP
APP_PORT=80
```

如果后续绑定域名并启用 HTTPS，`FRONTEND_URL` 应改成：

```env
FRONTEND_URL=https://你的域名
```

如果你同时需要支持域名和 IP 临时访问，可以写成逗号分隔：

```env
FRONTEND_URL=http://你的IP,https://你的域名
```

## 7. 启动服务

在项目根目录执行：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

查看状态：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

查看日志：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f backend
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f frontend
```

## 8. 首次启动行为

后端容器启动时会自动执行数据库迁移，然后再启动服务。

也就是说：

- 第一次启动会自动建表 / 升级结构
- 后续重启会再次检查迁移，但不会重复执行已完成迁移

## 9. 验证方式

### 9.1 服务器本机验证

```bash
curl http://127.0.0.1/health
```

如果返回类似：

```json
{"status":"ok"}
```

说明 Nginx 到后端的链路是通的。

### 9.2 浏览器访问

直接访问：

```text
http://你的公网IP
```

如果页面能打开，且登录后接口正常，说明基本部署成功。

## 10. 常见问题

### 10.1 页面能打开，但接口报跨域

通常是 `.env.production` 里的 `FRONTEND_URL` 没写对。

检查当前浏览器实际访问地址，是：

- `http://公网IP`
- 还是 `https://域名`

然后把 `FRONTEND_URL` 改成对应 origin，重启容器：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

### 10.2 容器起来了，但后端连接数据库失败

优先检查：

- `POSTGRES_PASSWORD` 是否为空
- `backend` 是否读到了正确的 `DB_HOST/DB_NAME/DB_USER/DB_PASSWORD`
- `postgres` 容器是否健康

查看：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs backend
docker compose --env-file .env.production -f docker-compose.prod.yml logs postgres
```

### 10.3 导入 Excel 时报上传失败

当前 Nginx 已设置：

- `client_max_body_size 20m`

如果后续导入文件更大，需要同步调整 [nginx.conf](/E:/InventoryManagement_bicycle/frontend/nginx.conf)。

## 11. 后续建议

项目稳定后，建议继续做：

1. 绑定正式域名
2. 完成备案
3. 接入 HTTPS
4. 评估是否把 PostgreSQL 拆到腾讯云数据库
5. 再增加小程序后端服务
