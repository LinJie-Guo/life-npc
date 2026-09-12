-- 只读检查；先连接已选定的 life_npc 数据库。
SELECT VERSION() AS mysql_version, DATABASE() AS current_database;
SELECT TABLE_NAME, ENGINE, TABLE_COLLATION
FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME;
SELECT status, COUNT(*) AS tasks FROM community_tasks GROUP BY status;
SELECT status, COUNT(*) AS participations FROM participations GROUP BY status;
-- 正常情况下返回零行：奖励不应重复。
SELECT participation, COUNT(*) AS copies FROM xp_ledger GROUP BY participation HAVING COUNT(*)>1;
-- 正常情况下返回零行：参与人数不能超过名额。
SELECT t.id,t.capacity,COUNT(p.id) AS occupied
FROM community_tasks t LEFT JOIN participations p ON p.task=t.id AND p.status NOT IN ('withdrawn','cancelled')
GROUP BY t.id,t.capacity HAVING occupied>t.capacity;
SELECT name,checksum,applied FROM schema_migrations ORDER BY name;
