from django.contrib import admin

from .models import RefreshToken, UserProfile

admin.site.register(UserProfile)
admin.site.register(RefreshToken)
