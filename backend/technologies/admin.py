from django.contrib import admin
from .models import (
    Technology,
    TechnologyBlock,
    TechnologyDirection,
    TechnologyEnterpriseReadiness,
    TechnologyFunctionCoverage,
    TechnologyVendor,
    TechnologyVendorIntegrator,
)

admin.site.register(Technology)
admin.site.register(TechnologyBlock)
admin.site.register(TechnologyFunctionCoverage)
admin.site.register(TechnologyDirection)
admin.site.register(TechnologyVendor)
admin.site.register(TechnologyVendorIntegrator)
admin.site.register(TechnologyEnterpriseReadiness)
