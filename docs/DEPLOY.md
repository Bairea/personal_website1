# 部署指南

面向 2 核 2G 低资源服务器，基于 Nginx 反向代理 + systemd 的安全部署方案。

## 架构

```
互联网 → :80/:443 → Nginx → 127.0.0.1:8787 → Express
```

- Nginx 处理 TLS 终结、安全头、静态文件和速率限制
- Express 仅监听 loopback，提供静态文件兜底与速率限制（120 次/分钟/IP）
- systemd 管理进程，自动重启

## 1. 服务器基础设置

### 1.1 SSH 加固

在修改 SSH 配置前，先确认密钥登录可用：

```bash
# 从本地测试密钥登录（保持当前会话不断开）
ssh -i ~/.ssh/your_key user@your-server
```

确认密钥登录成功后，编辑 SSH 配置：

```bash
sudo nano /etc/ssh/sshd_config.d/hardening.conf
```

```sshd_config
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

验证配置语法后重载：

```bash
sudo sshd -t && sudo systemctl reload sshd
```

> ⚠️ 在第二个 SSH 会话中验证密钥登录仍可使用，再关闭第一个会话。切勿在唯一会话中硬ening SSH。

### 1.2 防火墙

```bash
# 默认拒绝入站，仅开放必要端口
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status
```

## 2. 安装 Nginx

```bash
sudo apt update && sudo apt install -y nginx
sudo systemctl enable nginx
sudo nginx -t && sudo systemctl start nginx
```

## 3. 部署应用

### 3.1 上传代码

```bash
# 初始化主题子模块（首次克隆或更新主题后执行）
git submodule update --init --recursive

# 在本地构建
npm run build

# 上传到服务器（本机部署则直接复制；主题作为 git submodule 单独复制以避免拷入 .git）
sudo rsync -av --exclude='node_modules' --exclude='.git' --exclude='themes' \
  ./ /srv/personal-website/
sudo cp -r themes/PaperMod /srv/personal-website/themes/
```

### 3.2 在服务器上安装依赖并构建

```bash
cd /srv/personal-website
npm install          # 需要完整依赖来构建（含 TypeScript）
npm run build
npm prune --omit=dev # 构建后移除开发依赖
```

### 3.3 Node.js 路径

systemd 服务需要 Node.js 的绝对路径。如果使用 nvm 安装的 Node，需要复制到系统路径：

```bash
# 将 nvm 的 node 复制到系统路径（www-data 用户无法访问 /home 下的 nvm）
sudo cp /home/bai/.nvm/versions/node/v24.15.0/bin/node /usr/local/bin/node
```

> 注意：`ProtectHome=true` 会阻止 systemd 服务访问 /home 目录，因此 Node 必须在系统路径中。

### 3.4 设置权限

```bash
sudo chown -R www-data:www-data /srv/personal-website
sudo chmod -R 755 /srv/personal-website
```

### 3.5 创建 systemd 服务

```bash
sudo cp deploy/personal-website.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable personal-website
sudo systemctl start personal-website
sudo systemctl status personal-website
```

## 4. 配置 Nginx

### 4.1 创建配置

```bash
# 安全头 snippet（nginx.conf 通过 include 引用，缺失则 Nginx 启动失败）
sudo mkdir -p /etc/nginx/snippets
sudo cp deploy/snippets/security-headers.conf /etc/nginx/snippets/

# 站点配置
sudo cp deploy/nginx-personal-website.conf /etc/nginx/sites-available/personal-website
```

编辑配置，将 `YOUR_DOMAIN` 替换为实际域名（无域名时用 `_` 通配）。

### 4.2 启用站点

```bash
sudo ln -sf /etc/nginx/sites-available/personal-website /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### 4.3 验证 HTTP

```bash
curl -I http://YOUR_SERVER_IP
# 应返回 200，含安全头（X-Frame-Options、CSP 等）
```

> **注意**：Nginx 的 `add_header` 指令在 location 块中不会继承 server 级别的 header。
> 因此每个 location 块都需要单独添加安全头。项目配置文件已处理此问题。

## 5. HTTPS（Let's Encrypt）

> 需要先有域名并完成 DNS 解析。

### 5.1 确认 DNS 解析

```bash
dig +short your-domain.com
# 应返回服务器 IP
```

### 5.2 确认 HTTP 可达

```bash
curl -I http://your-domain.com
# 应返回 200
```

### 5.3 申请证书

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 5.4 验证自动续期

```bash
sudo certbot renew --dry-run
sudo systemctl list-timers | grep certbot
```

### 5.5 启用 HTTPS 配置

取消 `deploy/nginx-personal-website.conf` 中 HTTPS server 块的注释，
替换 `YOUR_DOMAIN`，然后重载 Nginx。

### 5.6 验证 HTTPS

```bash
curl -I https://your-domain.com
# 应返回 200，含 Strict-Transport-Security 头
```

## 6. 最终验证

```bash
# 安全头检查
curl -sI http://YOUR_SERVER_IP | grep -iE \
  'x-frame|x-content-type|referrer-policy|content-security|permissions-policy'

# 静态内容检查（首页与搜索页应返回 200）
curl -sI http://YOUR_SERVER_IP/ | head -1
curl -sI http://YOUR_SERVER_IP/search/ | head -1

# Express 速率限制检查（直连 loopback，快速发送 130 次，应在 120 次后返回 429）
for i in $(seq 1 130); do curl -s -o /dev/null -w "%{http_code} " http://127.0.0.1:8787/; done

# 进程自动重启
MAIN_PID=$(sudo systemctl show personal-website --property=MainPID --value)
sudo kill -9 $MAIN_PID
sleep 5
sudo systemctl status personal-website
# 应显示 active (running)
```

## 7. 日常维护

### 更新内容

```bash
# 本地
npm run build

# 服务器（本机部署时）
cd /home/bai/inbox_proj/personal_website1
npm run build
sudo rsync -av --exclude='node_modules' --exclude='.git' --exclude='themes' \
  ./ /srv/personal-website/
sudo cp -r themes/PaperMod /srv/personal-website/themes/
cd /srv/personal-website
npm install && npm run build && npm prune --omit=dev
sudo chown -R www-data:www-data /srv/personal-website
sudo systemctl restart personal-website
```

### 证书续期

Certbot 自动续期，无需手动操作。可通过以下命令检查：

```bash
sudo certbot certificates
```

### 日志查看

```bash
# 应用日志
sudo journalctl -u personal-website -f

# Nginx 访问日志
sudo tail -f /var/log/nginx/access.log

# Nginx 错误日志
sudo tail -f /var/log/nginx/error.log
```
