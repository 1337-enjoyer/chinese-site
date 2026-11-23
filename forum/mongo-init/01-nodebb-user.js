/* ============================================================
   MongoDB: пользователь для NodeBB.

   Скрипт выполняется один раз при создании пустого тома mongo-data
   (образ mongo:7 запускает файлы из /docker-entrypoint-initdb.d).
   Имя базы, пользователь и пароль берутся из переменных окружения,
   которые задаёт docker-compose.yml.
   ============================================================ */

"use strict";

const dbName = process.env.NODEBB_DB_NAME || "nodebb";
const userName = process.env.NODEBB_DB_USER || "nodebb";
const password = process.env.NODEBB_DB_PASSWORD || "nodebbpass";

const forumDb = db.getSiblingDB(dbName);

forumDb.createUser({
  user: userName,
  pwd: password,
  roles: [
    { role: "readWrite", db: dbName },
    { role: "clusterMonitor", db: "admin" }
  ]
});

print("MongoDB: пользователь " + userName + " создан для базы " + dbName);
