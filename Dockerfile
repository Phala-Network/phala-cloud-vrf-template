FROM node:18-alpine
WORKDIR /app

COPY ./artifacts ./artifacts/
COPY tsconfig.json .
COPY package.json .
COPY tee.ts ./tee.ts
RUN npm install --include=dev
ENV NODE_ENV=production
EXPOSE 3000/tcp

ENTRYPOINT ["npx", "ts-node", "tee.ts"]