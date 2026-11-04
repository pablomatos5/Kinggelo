# Site + painel King Gelo. Só Node, sem dependências; o banco fica no volume /dados.
FROM node:22-alpine
ENV NODE_ENV=production PORT=8090 KG_BANCO=/dados/kinggelo.db
WORKDIR /app
COPY index.html style.css hero.js liquido.js efeitos.js robots.txt ./
COPY img ./img
COPY painel/package.json painel/*.js ./painel/
COPY painel/public ./painel/public
RUN mkdir -p /dados && chown node:node /dados
USER node
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8090/robots.txt >/dev/null || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "painel/server.js"]
