from django.contrib import admin
from .models import (
    DigitalDirection,
    Enterprise,
    EnterpriseBlockMapping,
    FunctionalBlock,
    FunctionReference,
    Integrator,
    Vendor,
)

admin.site.register(FunctionalBlock)
admin.site.register(FunctionReference)
admin.site.register(DigitalDirection)
admin.site.register(Vendor)
admin.site.register(Integrator)
admin.site.register(Enterprise)
admin.site.register(EnterpriseBlockMapping)
