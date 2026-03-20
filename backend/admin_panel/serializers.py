from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from admin_panel.models import AuditLog, BackupSnapshot
from auth_custom.models import UserProfile
from references.models import Enterprise, EnterpriseBlockMapping, FunctionalBlock

User = get_user_model()


class AdminUserSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    username = serializers.CharField(read_only=True)
    email = serializers.EmailField(read_only=True, allow_blank=True)
    role = serializers.CharField(read_only=True)
    legacy_role = serializers.CharField(read_only=True, allow_blank=True)
    is_active = serializers.BooleanField(read_only=True)
    is_2fa_enabled = serializers.BooleanField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    def to_representation(self, instance):
        profile, _ = UserProfile.objects.get_or_create(user=instance)
        return {
            "id": instance.id,
            "username": instance.username,
            "email": instance.email or "",
            "role": profile.get_effective_role(),
            "legacy_role": profile.legacy_role or "",
            "is_active": instance.is_active,
            "is_2fa_enabled": profile.is_2fa_enabled,
            "created_at": instance.date_joined,
            "updated_at": profile.updated_at,
        }


class AdminUserWriteSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150, required=False)
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(
        required=False, min_length=6, write_only=True, trim_whitespace=False
    )
    role = serializers.ChoiceField(choices=UserProfile.ROLE_CHOICES, required=False)
    is_active = serializers.BooleanField(required=False)
    is_2fa_enabled = serializers.BooleanField(required=False)

    def validate(self, attrs):
        is_create = self.instance is None
        if is_create:
            missing = [field for field in ("username", "password", "role") if field not in attrs]
            if missing:
                raise serializers.ValidationError(
                    {field: "This field is required." for field in missing}
                )
        return attrs

    def validate_username(self, value):
        username = value.strip()
        if not username:
            raise serializers.ValidationError("Username must not be empty.")
        queryset = User.objects.filter(username=username)
        if self.instance is not None:
            queryset = queryset.exclude(id=self.instance.id)
        if queryset.exists():
            raise serializers.ValidationError("User with this username already exists.")
        return username

    def validate_email(self, value):
        email = value.strip()
        if not email:
            return ""
        queryset = User.objects.filter(email=email)
        if self.instance is not None:
            queryset = queryset.exclude(id=self.instance.id)
        if queryset.exists():
            raise serializers.ValidationError("User with this email already exists.")
        return email

    @transaction.atomic
    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
            is_active=validated_data.get("is_active", True),
        )
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = validated_data["role"]
        profile.legacy_role = ""
        profile.is_2fa_enabled = validated_data.get("is_2fa_enabled", False)
        if not profile.is_2fa_enabled:
            profile.totp_secret = ""
        profile.save(
            update_fields=["role", "legacy_role", "is_2fa_enabled", "totp_secret", "updated_at"]
        )
        return user

    @transaction.atomic
    def update(self, instance, validated_data):
        if "username" in validated_data:
            instance.username = validated_data["username"]
        if "email" in validated_data:
            instance.email = validated_data["email"]
        if "is_active" in validated_data:
            instance.is_active = validated_data["is_active"]
        if "password" in validated_data:
            instance.set_password(validated_data["password"])
        instance.save()

        profile, _ = UserProfile.objects.get_or_create(user=instance)
        if "role" in validated_data:
            profile.role = validated_data["role"]
            profile.legacy_role = ""
        if "is_2fa_enabled" in validated_data:
            profile.is_2fa_enabled = validated_data["is_2fa_enabled"]
            if not profile.is_2fa_enabled:
                profile.totp_secret = ""
        profile.save(
            update_fields=["role", "legacy_role", "is_2fa_enabled", "totp_secret", "updated_at"]
        )
        return instance


class AuditLogSerializer(serializers.ModelSerializer):
    actor = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "actor",
            "action",
            "entity_type",
            "entity_id",
            "before_data",
            "after_data",
            "metadata",
            "ip_address",
            "user_agent",
            "created_at",
        ]

    @staticmethod
    def get_actor(obj):
        if not obj.actor:
            return None
        return {
            "id": obj.actor_id,
            "username": obj.actor.username,
        }


class BackupSnapshotSerializer(serializers.ModelSerializer):
    created_by = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = BackupSnapshot
        fields = [
            "id",
            "name",
            "description",
            "checksum",
            "size_bytes",
            "metadata",
            "is_restorable",
            "created_by",
            "created_at",
            "download_url",
        ]

    @staticmethod
    def get_created_by(obj):
        if not obj.created_by:
            return None
        return {
            "id": obj.created_by_id,
            "username": obj.created_by.username,
        }

    @staticmethod
    def get_download_url(obj):
        return f"/api/v1/admin-panel/backups/{obj.id}/download"


class EnterpriseSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    name = serializers.CharField(read_only=True)
    code = serializers.CharField(read_only=True, allow_blank=True)
    description = serializers.CharField(read_only=True, allow_blank=True)
    block_ids = serializers.ListField(child=serializers.IntegerField(), read_only=True)

    def to_representation(self, instance):
        block_ids = list(
            instance.block_mappings.order_by("block_id").values_list("block_id", flat=True)
        )
        return {
            "id": instance.id,
            "name": instance.name,
            "code": instance.code or "",
            "description": instance.description or "",
            "block_ids": block_ids,
        }


class EnterpriseWriteSerializer(serializers.Serializer):
    name = serializers.CharField(required=False, max_length=255)
    code = serializers.CharField(required=False, allow_blank=True, max_length=64)
    description = serializers.CharField(required=False, allow_blank=True)
    block_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        default=list,
    )

    def validate(self, attrs):
        is_create = self.instance is None
        if is_create and "name" not in attrs:
            raise serializers.ValidationError({"name": "This field is required."})
        return attrs

    def validate_name(self, value):
        name = value.strip()
        if not name:
            raise serializers.ValidationError("Name must not be empty.")
        queryset = Enterprise.objects.filter(name__iexact=name)
        if self.instance is not None:
            queryset = queryset.exclude(id=self.instance.id)
        if queryset.exists():
            raise serializers.ValidationError("Enterprise with this name already exists.")
        return name

    def validate_code(self, value):
        code = value.strip()
        if not code:
            return ""
        queryset = Enterprise.objects.filter(code__iexact=code)
        if self.instance is not None:
            queryset = queryset.exclude(id=self.instance.id)
        if queryset.exists():
            raise serializers.ValidationError("Enterprise with this code already exists.")
        return code

    def validate_block_ids(self, value):
        unique_ids = []
        seen = set()
        for item in value:
            if item in seen:
                continue
            seen.add(item)
            unique_ids.append(item)
        existing_ids = set(
            FunctionalBlock.objects.filter(id__in=unique_ids).values_list("id", flat=True)
        )
        missing = sorted(set(unique_ids) - existing_ids)
        if missing:
            raise serializers.ValidationError(f"Unknown block ids: {missing}")
        return unique_ids

    @transaction.atomic
    def create(self, validated_data):
        enterprise = Enterprise.objects.create(
            name=validated_data["name"],
            code=validated_data.get("code") or None,
            description=validated_data.get("description", ""),
        )
        self._sync_mappings(enterprise, validated_data.get("block_ids", []))
        return enterprise

    @transaction.atomic
    def update(self, instance, validated_data):
        if "name" in validated_data:
            instance.name = validated_data["name"]
        if "code" in validated_data:
            instance.code = validated_data["code"] or None
        if "description" in validated_data:
            instance.description = validated_data["description"]
        instance.save()
        if "block_ids" in validated_data:
            self._sync_mappings(instance, validated_data["block_ids"])
        return instance

    @staticmethod
    def _sync_mappings(enterprise, block_ids):
        EnterpriseBlockMapping.objects.filter(enterprise=enterprise).exclude(
            block_id__in=block_ids
        ).delete()
        existing = set(
            EnterpriseBlockMapping.objects.filter(enterprise=enterprise).values_list(
                "block_id", flat=True
            )
        )
        for block_id in block_ids:
            if block_id in existing:
                continue
            EnterpriseBlockMapping.objects.create(enterprise=enterprise, block_id=block_id)
