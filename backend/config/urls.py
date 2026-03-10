from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path

from config.views import frontend_dist_view

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("config.api_urls")),
]

if settings.SERVE_FRONTEND_FROM_DJANGO:
    urlpatterns += [
        path("", frontend_dist_view, name="frontend-root"),
        re_path(
            r"^(?!api/v1/|admin/|static/)(?P<path>.*)$",
            frontend_dist_view,
            name="frontend-dist",
        ),
    ]
