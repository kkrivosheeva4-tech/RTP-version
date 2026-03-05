from django.urls import path

from references.views import ReferenceAPIView

urlpatterns = [
    path("<str:name>", ReferenceAPIView.as_view(), name="references-detail-noslash"),
    path("<str:name>/", ReferenceAPIView.as_view(), name="references-detail"),
]
