FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html styles.css site.js og.png robots.txt sitemap.xml /usr/share/nginx/html/
