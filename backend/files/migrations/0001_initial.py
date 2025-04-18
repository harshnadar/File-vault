# Generated by Django 4.2.20 on 2025-04-11 22:26

from django.db import migrations, models
import django.db.models.deletion
import files.date_time_util
import files.models
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='File',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('file_hash', models.CharField(db_index=True, default=uuid.uuid4, max_length=32, unique=True)),
                ('file', models.FileField(upload_to=files.models.file_upload_path)),
                ('file_type', models.CharField(max_length=100)),
                ('size', models.BigIntegerField(db_index=True)),
                ('reference_count', models.PositiveIntegerField(default=0)),
            ],
            options={
                'ordering': ['-size'],
            },
        ),
        migrations.CreateModel(
            name='FileReference',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('original_filename', models.CharField(db_index=True, max_length=255)),
                ('uploaded_at_epoch', models.BigIntegerField(db_index=True, default=files.date_time_util.now_epoch_ms)),
                ('reference_file', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='references', to='files.file')),
            ],
            options={
                'ordering': ['-uploaded_at_epoch'],
            },
        ),
    ]
