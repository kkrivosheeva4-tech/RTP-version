from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("auth_custom", "0004_encrypt_totp_secret"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="must_change_password",
            field=models.BooleanField(default=False),
        ),
    ]
