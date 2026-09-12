-- 人生 NPC / MySQL 8 初始化结构（不含任何用户数据）
-- 仅用于空数据库；已有数据库请运行 npm run db:migrate。
-- 本文件由 server/migrations 按顺序汇总，正式迁移仍以源文件为准。
SET NAMES utf8mb4;

-- Source: server/migrations/001_mysql.sql
CREATE TABLE accounts (
 id CHAR(36) PRIMARY KEY, username VARCHAR(32) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL,
 recovery_hash CHAR(64) NOT NULL, created BIGINT NOT NULL
) ENGINE=InnoDB;
CREATE TABLE sessions (
 token_hash CHAR(64) PRIMARY KEY, user CHAR(36) NOT NULL, expires BIGINT NOT NULL,
 FOREIGN KEY(user) REFERENCES accounts(id) ON DELETE CASCADE, INDEX(expires)
) ENGINE=InnoDB;
CREATE TABLE auth_limits (bucket CHAR(64) PRIMARY KEY, hits INT NOT NULL, expires BIGINT NOT NULL) ENGINE=InnoDB;
CREATE TABLE profiles (
 id CHAR(36) PRIMARY KEY, name VARCHAR(24) NOT NULL, role VARCHAR(24) NOT NULL, city VARCHAR(24) NOT NULL,
 answers TEXT NOT NULL, discoverable TINYINT NOT NULL DEFAULT 0, created BIGINT NOT NULL,
 FOREIGN KEY(id) REFERENCES accounts(id)
) ENGINE=InnoDB;
CREATE TABLE runs (
 id CHAR(36) PRIMARY KEY, user CHAR(36) NOT NULL, task VARCHAR(32) NOT NULL, day CHAR(10) NOT NULL,
 status VARCHAR(16) NOT NULL, started BIGINT NOT NULL, completed BIGINT NULL,
 note TEXT NOT NULL, place VARCHAR(100) NOT NULL DEFAULT '', invitation VARCHAR(100) NOT NULL DEFAULT '',
 location TEXT NULL, partner CHAR(36) NULL, match_id CHAR(36) NULL,
 active_user CHAR(36) GENERATED ALWAYS AS (IF(status='active',user,NULL)) STORED,
 valid_day CHAR(10) GENERATED ALWAYS AS (IF(status<>'cancelled',day,NULL)) STORED,
 UNIQUE(active_user), UNIQUE(user,task,valid_day), INDEX(user,status), INDEX(match_id), INDEX(task,status,partner),
 FOREIGN KEY(user) REFERENCES accounts(id)
) ENGINE=InnoDB;
CREATE TABLE media (
 id CHAR(36) PRIMARY KEY, user CHAR(36) NOT NULL, run CHAR(36) NOT NULL, type VARCHAR(64) NOT NULL,
 size INT NOT NULL, created BIGINT NOT NULL, INDEX(run,user), FOREIGN KEY(user) REFERENCES accounts(id)
) ENGINE=InnoDB;
CREATE TABLE media_objects (id CHAR(36) PRIMARY KEY, bytes MEDIUMBLOB NOT NULL) ENGINE=InnoDB;
CREATE TABLE favorites (user CHAR(36) NOT NULL, task VARCHAR(32) NOT NULL, PRIMARY KEY(user,task), FOREIGN KEY(user) REFERENCES accounts(id)) ENGINE=InnoDB;
CREATE TABLE events (id CHAR(36) PRIMARY KEY, user CHAR(36) NOT NULL UNIQUE, started BIGINT NOT NULL, completed BIGINT NULL, FOREIGN KEY(user) REFERENCES accounts(id)) ENGINE=InnoDB;
CREATE TABLE community_tasks (
 id CHAR(36) PRIMARY KEY, owner CHAR(36) NOT NULL, title VARCHAR(60) NOT NULL,
 description TEXT NOT NULL, requirements TEXT NOT NULL, category VARCHAR(24) NOT NULL,
 city VARCHAR(24) NOT NULL, place VARCHAR(100) NOT NULL, deadline BIGINT NOT NULL,
 capacity INT NOT NULL, reward INT NOT NULL DEFAULT 20,
 status VARCHAR(16) NOT NULL DEFAULT 'draft', created BIGINT NOT NULL, updated BIGINT NOT NULL,
 cancel_reason VARCHAR(300) NOT NULL DEFAULT '',
 FOREIGN KEY(owner) REFERENCES accounts(id), INDEX(status,city,deadline), INDEX(owner,created)
) ENGINE=InnoDB;
CREATE TABLE participations (
 id CHAR(36) PRIMARY KEY, task CHAR(36) NOT NULL, user CHAR(36) NOT NULL,
 status VARCHAR(16) NOT NULL DEFAULT 'joined', note TEXT NOT NULL,
 feedback VARCHAR(500) NOT NULL DEFAULT '', joined BIGINT NOT NULL, submitted BIGINT NULL, reviewed BIGINT NULL,
 UNIQUE(task,user), FOREIGN KEY(task) REFERENCES community_tasks(id), FOREIGN KEY(user) REFERENCES accounts(id), INDEX(user,status)
) ENGINE=InnoDB;
CREATE TABLE task_history (
 id CHAR(36) PRIMARY KEY, task CHAR(36) NOT NULL, actor CHAR(36) NULL,
 participation CHAR(36) NULL, action VARCHAR(32) NOT NULL, detail VARCHAR(500) NOT NULL DEFAULT '', created BIGINT NOT NULL,
 FOREIGN KEY(task) REFERENCES community_tasks(id), INDEX(task,created)
) ENGINE=InnoDB;
CREATE TABLE xp_ledger (
 id CHAR(36) PRIMARY KEY, user CHAR(36) NOT NULL, participation CHAR(36) NOT NULL UNIQUE,
 amount INT NOT NULL, created BIGINT NOT NULL, FOREIGN KEY(user) REFERENCES accounts(id), FOREIGN KEY(participation) REFERENCES participations(id)
) ENGINE=InnoDB;


-- Source: server/migrations/002_exploration_deadlines.sql
ALTER TABLE runs ADD COLUMN deadline BIGINT NULL;
UPDATE runs SET deadline=started+86400000 WHERE deadline IS NULL;
ALTER TABLE runs MODIFY COLUMN deadline BIGINT NOT NULL;
CREATE INDEX runs_deadline ON runs(status,deadline);
