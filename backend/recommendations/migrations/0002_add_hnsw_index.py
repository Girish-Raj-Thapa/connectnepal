from django.db import migrations


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('recommendations', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_snapshot_embedding_hnsw
                ON recommendations_listingfeaturesnapshot
                USING hnsw (embedding vector_cosine_ops)
                WITH (m = 16, ef_construction = 64);
            """,
            reverse_sql="DROP INDEX IF EXISTS idx_snapshot_embedding_hnsw;",
        ),
    ]
    