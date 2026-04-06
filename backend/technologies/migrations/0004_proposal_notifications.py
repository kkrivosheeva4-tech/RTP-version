# Generated migration for adding proposal notifications

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('technologies', '0003_technologyproposal'),
    ]

    operations = [
        migrations.AddField(
            model_name='technologyproposal',
            name='editor_notified',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='technologyproposal',
            name='notification_sent_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name='ProposalNotification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('notification_type', models.CharField(choices=[('approved', 'Одобрено'), ('rejected', 'Отклонено'), ('postponed', 'Отложено')], max_length=16)),
                ('title', models.CharField(max_length=255)),
                ('message', models.TextField()),
                ('is_read', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('read_at', models.DateTimeField(blank=True, null=True)),
                ('proposal', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='editor_notifications', to='technologies.technologyproposal')),
                ('recipient', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='proposal_notifications_received', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
