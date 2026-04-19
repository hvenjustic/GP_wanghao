#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

APP_NAME="${PM2_APP_NAME:-gp-wanghao}"
ECOSYSTEM_FILE="${PROJECT_ROOT}/ecosystem.config.cjs"

function usage() {
  cat <<EOF
用法: $(basename "$0") <command>

可用命令:
  install    安装依赖、生成 Prisma Client、构建生产包
  start      使用 pm2 启动项目
  restart    重启 pm2 中的项目进程
  reload     先 git pull，再构建生产包并平滑重载 pm2 进程
  stop       停止 pm2 中的项目进程
  delete     从 pm2 中删除项目进程
  status     查看项目进程状态
  logs       查看项目日志
  save       保存当前 pm2 进程列表
  startup    生成 systemd 开机自启命令
  bootstrap  首次部署: install + start
  help       显示帮助

环境变量:
  PM2_APP_NAME  pm2 应用名，默认 gp-wanghao
  PORT          服务端口，默认 3000
  HOST          监听地址，默认 0.0.0.0
EOF
}

function require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "缺少命令: $1" >&2
    exit 1
  fi
}

function run_in_root() {
  (
    cd "$PROJECT_ROOT"
    "$@"
  )
}

function install_project() {
  require_command pnpm
  run_in_root pnpm install
  run_in_root pnpm db:generate
  run_in_root pnpm build
}

function pull_project() {
  require_command git
  run_in_root git pull --ff-only
}

function build_project() {
  require_command pnpm
  run_in_root pnpm build
}

function ensure_pm2() {
  require_command pm2
}

COMMAND="${1:-help}"

case "$COMMAND" in
  install)
    install_project
    ;;
  start)
    ensure_pm2
    run_in_root pm2 start "$ECOSYSTEM_FILE" --only "$APP_NAME" --update-env
    ;;
  restart)
    ensure_pm2
    run_in_root pm2 restart "$APP_NAME" --update-env
    ;;
  reload)
    ensure_pm2
    pull_project
    build_project
    run_in_root pm2 reload "$APP_NAME" --update-env
    ;;
  stop)
    ensure_pm2
    run_in_root pm2 stop "$APP_NAME"
    ;;
  delete)
    ensure_pm2
    run_in_root pm2 delete "$APP_NAME"
    ;;
  status)
    ensure_pm2
    run_in_root pm2 status "$APP_NAME"
    ;;
  logs)
    ensure_pm2
    run_in_root pm2 logs "$APP_NAME"
    ;;
  save)
    ensure_pm2
    run_in_root pm2 save
    ;;
  startup)
    ensure_pm2
    run_in_root pm2 startup systemd -u "$(id -un)" --hp "$HOME"
    ;;
  bootstrap)
    install_project
    ensure_pm2
    run_in_root pm2 start "$ECOSYSTEM_FILE" --only "$APP_NAME" --update-env
    ;;
  help|-h|--help)
    usage
    ;;
  *)
    echo "未知命令: $COMMAND" >&2
    usage
    exit 1
    ;;
esac
