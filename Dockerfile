# 江城小境 · WUHAN IN MINIATURE —— 静态站镜像
#
# 刻意保持极简：本站是纯静态产物（8 个文件、零外部请求、零构建步骤），
# 所以不需要 node 构建阶段，直接把 site/ 交给 nginx 托管。
# 目录里的文件就是最终产物，镜像里拷的就是仓库里的字节，不存在"构建产物与仓库不一致"的问题。
#
# 镜像大小约 25MB（nginx:alpine 基础 20MB + 站点 5MB），
# 其中 vendor/three.core.js 1.4MB 是大头，靠 gzip 传输压到约 350KB。

FROM nginx:1.27-alpine

# 站点根目录的默认页与自带配置清掉，避免 nginx 默认首页抢先命中
RUN rm -f /usr/share/nginx/html/index.html \
          /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/wuhan.conf

# 站点全部内容：index.html / styles.css / favicon.svg / js/ / vendor/
COPY site/ /usr/share/nginx/html/

# 启动前自检：缺任何一个入口文件都直接让构建失败。
# 静态站最阴的故障是"镜像构建成功但目录少拷了一层"，结果是 403/404 上线；
# 与其等 k8s 探测出问题，不如在构建时就断言。
RUN set -eux; \
    test -s /usr/share/nginx/html/index.html; \
    test -s /usr/share/nginx/html/styles.css; \
    test -s /usr/share/nginx/html/js/app.js; \
    test -s /usr/share/nginx/html/js/city.js; \
    test -s /usr/share/nginx/html/js/geom.js; \
    test -s /usr/share/nginx/html/vendor/three.module.js; \
    test -s /usr/share/nginx/html/vendor/three.core.js; \
    echo "站点文件校验通过: $(find /usr/share/nginx/html -type f | wc -l) 个文件"

# 健康检查走本机，不额外装 curl（alpine 里用 wget 是现成的）
HEALTHCHECK --interval=30s --timeout=4s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]