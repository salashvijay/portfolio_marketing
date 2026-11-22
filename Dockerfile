FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html styles.css site.js og.png robots.txt sitemap.xml /usr/share/nginx/html/
# Vihsm Labs (free tools) at /labs. Tests, notes and package files stay out of the image.
COPY labs/ /usr/share/nginx/html/labs/
RUN cd /usr/share/nginx/html/labs && rm -rf tests node_modules package.json package-lock.json README.md CLAUDE.md .gitignore
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1/health || exit 1
