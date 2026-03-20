from django.contrib import admin

from .models import AuditLog, BackupSnapshot

admin.site.register(AuditLog)
admin.site.register(BackupSnapshot)
