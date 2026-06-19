FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./

ARG VITE_API_URL=http://localhost/api
ARG VITE_ENABLE_CHATBOT=false
ARG VITE_ENABLE_RECOMMENDATIONS=false
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_ENABLE_CHATBOT=${VITE_ENABLE_CHATBOT}
ENV VITE_ENABLE_RECOMMENDATIONS=${VITE_ENABLE_RECOMMENDATIONS}

RUN npm run build


FROM nginx:1.27-alpine

COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html
