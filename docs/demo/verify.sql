-- Set the room code with psql -v room=ABC123 -f docs/demo/verify.sql.
-- Read-only: excludes cookies, token hashes, account emails, and passwords.
SELECT r.code, a.round_id,
       count(*) AS answer_records,
       count(DISTINCT a.session_id) AS players,
       sum(a.points) AS total_points,
       count(*) FILTER (WHERE a.choice IS NULL) AS timeouts
FROM accepted_answers a JOIN rooms r ON r.id = a.room_id
WHERE r.code = :'room'
GROUP BY r.code, a.round_id;

SELECT r.state->'members'->a.session_id->>'name' AS player,
       count(*) AS answer_records, sum(a.points) AS score,
       count(*) FILTER (WHERE a.choice IS NULL) AS timeouts
FROM accepted_answers a JOIN rooms r ON r.id = a.room_id
WHERE r.code = :'room'
GROUP BY player ORDER BY score DESC, player;
