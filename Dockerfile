# build stage
FROM nginx:alpine
LABEL maintainer="Fighter Jet Game Team"

# copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# copy static files
COPY index.html /usr/share/nginx/html/
COPY css/style.css /usr/share/nginx/html/css/style.css
COPY js/all.js /usr/share/nginx/html/js/all.js
COPY js/audio.js /usr/share/nginx/html/js/audio.js
COPY js/game.js /usr/share/nginx/html/js/game.js
COPY js/ui.js /usr/share/nginx/html/js/ui.js
COPY js/main.js /usr/share/nginx/html/js/main.js

# expose port
EXPOSE 80

# health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# start nginx
CMD ["nginx", "-g", "daemon off;"]