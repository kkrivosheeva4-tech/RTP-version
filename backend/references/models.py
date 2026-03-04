from django.db import models


class FunctionalBlock(models.Model):
    name = models.CharField(max_length=255, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class FunctionReference(models.Model):
    name = models.CharField(max_length=255, unique=True)
    block = models.ForeignKey(
        FunctionalBlock,
        on_delete=models.SET_NULL,
        related_name="functions",
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class DigitalDirection(models.Model):
    name = models.CharField(max_length=255, unique=True)
    quadrant = models.PositiveSmallIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Vendor(models.Model):
    name = models.CharField(max_length=255, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Integrator(models.Model):
    name = models.CharField(max_length=255, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Enterprise(models.Model):
    name = models.CharField(max_length=255, unique=True)
    code = models.CharField(max_length=64, unique=True, null=True, blank=True)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class EnterpriseBlockMapping(models.Model):
    enterprise = models.ForeignKey(
        Enterprise,
        on_delete=models.CASCADE,
        related_name="block_mappings",
    )
    block = models.ForeignKey(
        FunctionalBlock,
        on_delete=models.CASCADE,
        related_name="enterprise_mappings",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["enterprise", "block"],
                name="uq_enterprise_block_mapping",
            )
        ]
        ordering = ["enterprise_id", "block_id"]

    def __str__(self) -> str:
        return f"{self.enterprise} -> {self.block}"
