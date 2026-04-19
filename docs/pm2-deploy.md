# PM2 部署与管理说明

本文档用于在 Ubuntu 服务器上使用 `pm2` 管理本项目的生产运行，而不是直接占用一个终端窗口执行 `pnpm dev`。

## 1. 适用前提

- 操作系统：Ubuntu
- 已安装 Node.js 20+ 与 `pnpm`
- 项目代码已拉到服务器，例如：

```bash
cd /root/wh_gp/GP_wanghao
```

- 已准备好 `.env` / `.env.local`

## 2. 安装 PM2

推荐直接使用 `npm` 全局安装：

```bash
sudo npm install -g pm2
pm2 -v
```

如果返回版本号，说明安装完成。

## 3. 首次部署步骤

1. 进入项目目录：

```bash
cd /root/wh_gp/GP_wanghao
```

2. 准备环境变量：

```bash
cp .env.example .env
cp .env.example .env.local
```

3. 确认数据库连接配置无误后，执行首次安装和构建：

```bash
chmod +x pm2-manage.sh
./pm2-manage.sh install
```

这一步会执行：

- `pnpm install`
- `pnpm db:generate`
- `pnpm build`

4. 启动项目：

```bash
./pm2-manage.sh start
```

5. 查看状态：

```bash
./pm2-manage.sh status
```

## 4. 常用管理命令

```bash
./pm2-manage.sh install
./pm2-manage.sh start
./pm2-manage.sh restart
./pm2-manage.sh reload
./pm2-manage.sh stop
./pm2-manage.sh delete
./pm2-manage.sh status
./pm2-manage.sh logs
./pm2-manage.sh save
./pm2-manage.sh startup
```

说明：

- `restart`：直接重启进程
- `reload`：平滑重载，适合已有生产进程时更新代码后使用
- `delete`：从 `pm2` 进程列表中移除该应用
- `logs`：实时查看日志
- `save`：保存当前进程列表，供开机恢复使用
- `startup`：生成 `systemd` 自启动命令

## 5. 推荐更新流程

如果服务器上已经有旧版本在运行，推荐按下面顺序更新：

```bash
cd /root/wh_gp/GP_wanghao
git pull
./pm2-manage.sh install
./pm2-manage.sh reload
```

如果只是第一次部署，也可以直接用：

```bash
./pm2-manage.sh bootstrap
```

## 6. 配置文件说明

项目根目录已提供：

- [ecosystem.config.cjs](../ecosystem.config.cjs)
- [pm2-manage.sh](../pm2-manage.sh)

默认配置如下：

- 应用名：`gp-wanghao`
- 监听地址：`0.0.0.0`
- 端口：`3000`
- 启动方式：`next start`

如果需要自定义进程名或端口，可以在执行命令时带环境变量：

```bash
PM2_APP_NAME=gp-wh PORT=3001 ./pm2-manage.sh start
```

## 7. 开机自启

执行：

```bash
./pm2-manage.sh startup
```

该命令会输出一条带 `sudo` 的 `systemd` 注册命令。按输出结果执行后，再保存当前进程列表：

```bash
./pm2-manage.sh save
```

## 8. 说明

- 生产环境不要再使用 `pnpm dev`，应使用 `pm2 + next start`。
- 本脚本不会自动执行 `pnpm db:push` 或 `pnpm db:seed`，避免在普通发布流程中误改数据库。
- 如果启动时报 `Cannot find module '.prisma/client/default'`，先重新执行：

```bash
./pm2-manage.sh install
```
