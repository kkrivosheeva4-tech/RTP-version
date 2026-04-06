from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("technologies", "0004_alter_technologyproposal_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="technologyproposal",
            name="hidden_from_creator_history",
            field=models.BooleanField(default=False),
        ),
    ]
