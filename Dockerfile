FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY . /usr/share/nginx/html/
RUN rm -f /usr/share/nginx/html/Dockerfile /usr/share/nginx/html/nginx.conf /usr/share/nginx/html/.firebaserc /usr/share/nginx/html/firebase.json
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
