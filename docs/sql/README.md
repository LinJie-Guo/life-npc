# SQL 文件

- [schema.mysql.sql](schema.mysql.sql)：MySQL 8 空库结构快照，不含数据。
- [inspect.mysql.sql](inspect.mysql.sql)：只读结构与状态检查。
- [正式迁移目录](../../server/migrations/)：应用部署使用的唯一迁移来源。

应用初始化推荐在根目录运行 `npm run db:migrate`。结构快照供审阅或独立空库手工验证使用，不与迁移器混用，不在已有数据的数据库上执行。这里不提供数据库密码、账号数据或生产备份。
