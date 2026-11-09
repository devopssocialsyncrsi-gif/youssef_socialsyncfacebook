-- Executed by init.sh (Compose) or the Kubernetes migration Job.
-- Passwords are psql variables supplied through the environment, never literals.
SELECT format('CREATE ROLE socialsync_post LOGIN PASSWORD %L', :'post_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'socialsync_post') \gexec
SELECT format('CREATE ROLE socialsync_media LOGIN PASSWORD %L', :'media_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'socialsync_media') \gexec
SELECT format('ALTER ROLE socialsync_post PASSWORD %L', :'post_password') \gexec
SELECT format('ALTER ROLE socialsync_media PASSWORD %L', :'media_password') \gexec
CREATE SCHEMA IF NOT EXISTS post_svc AUTHORIZATION socialsync_post;
CREATE SCHEMA IF NOT EXISTS media_svc AUTHORIZATION socialsync_media;
ALTER SCHEMA post_svc OWNER TO socialsync_post;
ALTER SCHEMA media_svc OWNER TO socialsync_media;
REVOKE ALL ON SCHEMA post_svc FROM PUBLIC;
REVOKE ALL ON SCHEMA media_svc FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA post_svc TO socialsync_post;
GRANT USAGE, CREATE ON SCHEMA media_svc TO socialsync_media;
