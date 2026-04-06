from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


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


class TechnologyProposal(models.Model):
    ACTION_CREATE = "create"
    ACTION_UPDATE = "update"
    ACTION_DELETE = "delete"

    ACTION_CHOICES = [
        (ACTION_CREATE, "Create"),
        (ACTION_UPDATE, "Update"),
        (ACTION_DELETE, "Delete"),
    ]

    STATUS_DRAFT = "draft"
    STATUS_POSTPONED = "postponed"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"

    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_POSTPONED, "Postponed"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
    ]

    technology = models.ForeignKey(
        Technology,
        on_delete=models.SET_NULL,
        related_name="proposals",
        null=True,
        blank=True,
    )
    target_technology_id = models.IntegerField(null=True, blank=True)
    action = models.CharField(max_length=16, choices=ACTION_CHOICES, default=ACTION_UPDATE)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    payload = models.JSONField(default=dict, blank=True)
    comment = models.TextField(blank=True)
    review_comment = models.TextField(blank=True)
    hidden_from_creator_history = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="technology_proposals_created",
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="technology_proposals_reviewed",
        null=True,
        blank=True,
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    editor_notified = models.BooleanField(default=False)
    notification_sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"proposal#{self.id} {self.action} ({self.status})"


class ProposalNotification(models.Model):
    """Хранит уведомления редакторам о результатах модерации их предложений"""
    
    TYPE_APPROVED = "approved"
    TYPE_REJECTED = "rejected"
    TYPE_POSTPONED = "postponed"
    
    TYPE_CHOICES = [
        (TYPE_APPROVED, "Одобрено"),
        (TYPE_REJECTED, "Отклонено"),
        (TYPE_POSTPONED, "Отложено"),
    ]
    
    proposal = models.ForeignKey(
        TechnologyProposal,
        on_delete=models.CASCADE,
        related_name="editor_notifications"
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="proposal_notifications_received"
    )
    notification_type = models.CharField(max_length=16, choices=TYPE_CHOICES)
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ["-created_at"]
        unique_together = ("proposal", "recipient", "notification_type")
    
    def __str__(self) -> str:
        return f"notification#{self.id} to {self.recipient.username} ({self.notification_type})"

