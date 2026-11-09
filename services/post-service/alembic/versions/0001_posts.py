"""Create posts and per-platform targets."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_posts"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("posts", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True), sa.Column("title", sa.String(100), nullable=False), sa.Column("caption", sa.Text, nullable=False), sa.Column("media_id", postgresql.UUID(as_uuid=True), nullable=False), sa.Column("status", sa.String(24), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False), schema="post_svc")
    op.create_table("post_targets", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True), sa.Column("post_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("post_svc.posts.id", ondelete="CASCADE"), nullable=False), sa.Column("platform", sa.String(24), nullable=False), sa.Column("status", sa.String(24), nullable=False), sa.Column("attempts", sa.Integer, nullable=False), sa.Column("external_id", sa.Text), sa.Column("external_url", sa.Text), sa.Column("error", sa.Text), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint("post_id", "platform", name="uq_post_target_platform"), schema="post_svc")
    op.create_index("ix_posts_created_at_desc", "posts", [sa.text("created_at DESC")], schema="post_svc")
    op.create_index("ix_post_targets_post_id", "post_targets", ["post_id"], schema="post_svc")
    op.create_index("ix_post_targets_status", "post_targets", ["status"], schema="post_svc")


def downgrade():
    op.drop_table("post_targets", schema="post_svc")
    op.drop_table("posts", schema="post_svc")
