"""Create media service tables."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_media"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("media_files", sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True), sa.Column("original_name", sa.String(255), nullable=False), sa.Column("mime_type", sa.String(80), nullable=False), sa.Column("size_bytes", sa.BigInteger, nullable=False), sa.Column("stored_path", sa.Text, nullable=False), sa.Column("converted_path", sa.Text), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), schema="media_svc")


def downgrade():
    op.drop_table("media_files", schema="media_svc")
