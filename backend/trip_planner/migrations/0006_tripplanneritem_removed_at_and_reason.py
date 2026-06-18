from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('trip_planner', '0005_remove_tripplanneritem_trip_planner_item_xor_listing_package_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='tripplanneritem',
            name='removed_at',
            field=models.DateTimeField(
                blank=True,
                db_index=True,
                help_text='Set when the item is system-removed from the active trip planner UI.',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='tripplanneritem',
            name='removal_reason',
            field=models.CharField(
                blank=True,
                choices=[
                    ('host_deleted_listing', 'Host Deleted Listing'),
                    ('admin_deactivated_listing', 'Admin Deactivated Listing'),
                ],
                default='',
                help_text='Why the item was system-removed from the active trip planner UI.',
                max_length=40,
            ),
        ),
    ]
