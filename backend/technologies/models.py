from django.db import models
from django.core.validators import MaxValueValidator, MinValueValidator


class Technology(models.Model):
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True)
    primary_block = models.ForeignKey(
        "references.FunctionalBlock",
        on_delete=models.SET_NULL,
        related_name="primary_technologies",
        null=True,
        blank=True,
    )
    legacy_function = models.CharField(max_length=255, blank=True)
    trl_stage = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(9)],
        default=1,
    )
    status = models.CharField(max_length=64, blank=True, default="research")
    market_examples = models.JSONField(default=list, blank=True)
    documentation_files = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    blocks = models.ManyToManyField(
        "references.FunctionalBlock",
        through="TechnologyBlock",
        related_name="technologies",
        blank=True,
    )
    function_coverage = models.ManyToManyField(
        "references.FunctionReference",
        through="TechnologyFunctionCoverage",
        related_name="technologies",
        blank=True,
    )
    directions = models.ManyToManyField(
        "references.DigitalDirection",
        through="TechnologyDirection",
        related_name="technologies",
        blank=True,
    )
    vendors = models.ManyToManyField(
        "references.Vendor",
        through="TechnologyVendor",
        related_name="technologies",
        blank=True,
    )
    enterprises = models.ManyToManyField(
        "references.Enterprise",
        through="TechnologyEnterpriseReadiness",
        related_name="technologies",
        blank=True,
    )

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class TechnologyBlock(models.Model):
    technology = models.ForeignKey(
        Technology,
        on_delete=models.CASCADE,
        related_name="technology_blocks",
    )
    block = models.ForeignKey(
        "references.FunctionalBlock",
        on_delete=models.CASCADE,
        related_name="technology_links",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["technology", "block"],
                name="uq_technology_block",
            )
        ]

    def __str__(self) -> str:
        return f"{self.technology} / {self.block}"


class TechnologyFunctionCoverage(models.Model):
    technology = models.ForeignKey(
        Technology,
        on_delete=models.CASCADE,
        related_name="technology_functions",
    )
    function = models.ForeignKey(
        "references.FunctionReference",
        on_delete=models.CASCADE,
        related_name="technology_links",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["technology", "function"],
                name="uq_technology_function",
            )
        ]

    def __str__(self) -> str:
        return f"{self.technology} / {self.function}"


class TechnologyDirection(models.Model):
    technology = models.ForeignKey(
        Technology,
        on_delete=models.CASCADE,
        related_name="technology_directions",
    )
    direction = models.ForeignKey(
        "references.DigitalDirection",
        on_delete=models.CASCADE,
        related_name="technology_links",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["technology", "direction"],
                name="uq_technology_direction",
            )
        ]

    def __str__(self) -> str:
        return f"{self.technology} / {self.direction}"


class TechnologyVendor(models.Model):
    technology = models.ForeignKey(
        Technology,
        on_delete=models.CASCADE,
        related_name="technology_vendors",
    )
    vendor = models.ForeignKey(
        "references.Vendor",
        on_delete=models.CASCADE,
        related_name="technology_links",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["technology", "vendor"],
                name="uq_technology_vendor",
            )
        ]

    def __str__(self) -> str:
        return f"{self.technology} / {self.vendor}"


class TechnologyVendorIntegrator(models.Model):
    technology_vendor = models.ForeignKey(
        TechnologyVendor,
        on_delete=models.CASCADE,
        related_name="integrator_links",
    )
    integrator = models.ForeignKey(
        "references.Integrator",
        on_delete=models.CASCADE,
        related_name="technology_vendor_links",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["technology_vendor", "integrator"],
                name="uq_technology_vendor_integrator",
            )
        ]

    def __str__(self) -> str:
        return f"{self.technology_vendor} / {self.integrator}"


class TechnologyEnterpriseReadiness(models.Model):
    technology = models.ForeignKey(
        Technology,
        on_delete=models.CASCADE,
        related_name="enterprise_readiness",
    )
    enterprise = models.ForeignKey(
        "references.Enterprise",
        on_delete=models.CASCADE,
        related_name="technology_readiness",
    )
    technological_readiness = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(9)],
        null=True,
        blank=True,
    )
    organizational_readiness = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(9)],
        null=True,
        blank=True,
    )
    status = models.CharField(max_length=64, default="planned")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["technology", "enterprise"],
                name="uq_technology_enterprise_readiness",
            )
        ]

    def __str__(self) -> str:
        return f"{self.technology} / {self.enterprise}"
