from django.contrib.auth.password_validation import validate_password
from django.contrib.auth import authenticate
from rest_framework import serializers

from .models import Account, TravellerDetail, HostDetail, AdminDetail, HostDocument


class AccountRegisterSerializer(serializers.ModelSerializer):
    """
    Serializer for validating and creating user accounts
    during the registration process.
    """

    confirm_password = serializers.CharField(write_only=True, required=True)

    role = serializers.ChoiceField(
        choices=[
            Account.Role.TRAVELLER,
            Account.Role.HOST,
        ],
        default = Account.Role.TRAVELLER,
        required=False
    )

    class Meta:
        model = Account 

        fields = ('email', 'password', 'confirm_password', 'role')

        extra_kwargs = {
            'password': {'write_only': True}, # password should not be readable
        }

    def validate_email(self, value):
        """
        Normalize the email address to ensure consistency.
        """
        return value.lower().strip()
    

    def validate(self, attrs):
        """
        Perform cross-field validation and enforce
        registration security rules.
        """
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {"password": "Passwords do not match."}
            )

        validate_password(attrs["password"])

        # Prevent privilege escalation from public registration
        if attrs.get("role") == Account.Role.ADMIN:
            raise serializers.ValidationError(
                {"role": "Admin accounts cannot be created via registration."}
            )
        
        return attrs 


    def create(self, validated_data):
        """
        Create and return a new inactive user instance.

        The user must activate the account via the
        email verification link before logging in.
        """

        validated_data.pop('confirm_password')

        user = Account.objects.create_user(**validated_data)
    
        return user 


class LoginSerializer(serializers.Serializer):
    """
    Serializer for user login.
    Handles authentication and activation check.
    """

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get("email").lower().strip()
        password = attrs.get("password")

        user = authenticate(
            request=self.context.get("request"),
            email=email,
            password=password,
        )

        if not user:
            raise serializers.ValidationError(
                {"detail": "Invalid email or password."}
            )
        
        if not user.is_active:
            raise serializers.ValidationError(
                {"detail": "Account is not activated. Please verify your email."}
            )
        
        attrs["user"] = user
        return attrs
    

class LoginUserSerializer(serializers.ModelSerializer):
    """
    Minimal user payload returned in the login response.
    """
    user_id = serializers.IntegerField(source='id', read_only=True)
    full_name = serializers.ReadOnlyField()

    class Meta:
        model = Account
        fields = (
            "user_id",
            "email",
            "first_name",
            "middle_name",
            "last_name",
            "full_name",
            "role",
            "has_completed_onboarding",
            "onboarding_step",
        )
        read_only_fields = fields


class UserReadSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()
    age = serializers.ReadOnlyField()

    class Meta:
        model = Account
        fields = (
            "id",
            "email",
            "first_name",
            "middle_name",
            "last_name",
            "full_name",
            "phone",
            "date_of_birth",
            "age",
            "gender",
            "profile_photo",
            "address",
            "country",
            "city",
            "role",
            "has_completed_onboarding",
            "onboarding_step",
        )
        read_only_fields = fields


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating user profile.
    Email and role are read-only (cannot be changed).
    """
    class Meta:
        model = Account
        fields = [
            'first_name',
            'middle_name', 
            'last_name',
            'phone',
            'date_of_birth',
            'gender',
            'address',
            'profile_photo',
        ]


class PasswordChangeSerializer(serializers.Serializer):
    """
    Serializer for changing password (logged-in user).
    """
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)
    
    def validate_current_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value
    
    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({
                "confirm_password": "New passwords do not match."
            })
        
        # Use Django's password validators
        validate_password(attrs['new_password'], self.context['request'].user)
        return attrs

class PasswordResetRequestSerializer(serializers.Serializer):
    """
    Serialzer for requestiing password reset 
    User provides email to recieve reset link
    """
    email = serializers.EmailField()

    def validate_email(self, value):
        """
        Normalize email
        """
        return value.lower().strip()
    

class PasswordResetConfirmSerializer(serializers.Serializer):
    """
    Serializer for confirming password reset
    User provides new password along with uid and token
    """
    new_password = serializers.CharField(write_only=True, required=True)
    confirm_password = serializers.CharField(write_only=True, required=True)

    def validate(self, attrs):
        """
        Validate that passsword match
        """
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError(
                {'password': "Password do not match"}
            )
        
        # validate password strength 
        validate_password(attrs['new_password'])

        return attrs
    

# Onboarding Serializers
class TravellerBasicProfileSerializer(serializers.ModelSerializer):
    """
    Serializer for Traveller Onboarding Step 1: Basic Profile
    """

    class Meta:
        model = Account
        fields = (
            "first_name",
            "middle_name",
            "last_name",
            "phone",
            "date_of_birth",
            "gender",
            "profile_photo",
            "address",
            "country",
            "city",
        )

    def validate(self, attrs):
        # Ensure required fields are provided
        required_fields = ["first_name", "last_name", "phone", "country", "city"]
        for field in required_fields:
            if not attrs.get(field):
                raise serializers.ValidationError(
                    {field: f"{field.replace('_', ' ').title()} is required."}
                )
        return attrs


class TravellerPreferencesSerializer(serializers.Serializer):
    """
    Serializer for Traveller Onboarding Step 2: Travel Preferences
    """

    emergency_contact = serializers.CharField(max_length=30, required=False, allow_blank=True)
    preferred_activities = serializers.ListField(child=serializers.CharField(max_length=100),required=False, allow_empty=True)
    preferred_min_budget = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    preferred_max_budget = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    preferred_trip_style = serializers.CharField(max_length=50, required=False, allow_blank=True)

    def validate(self, attrs):
        # Validate budget range
        min_budget = attrs.get("preferred_min_budget")
        max_budget = attrs.get("preferred_max_budget")

        if min_budget and max_budget and min_budget > max_budget:
            raise serializers.ValidationError(
                {"preferred_min_budget": "Minimum budget cannot be greater than maximum budget."}
            )

        return attrs


class HostBasicProfileSerializer(serializers.ModelSerializer):
    """
    Serializer for Host Onboarding Step 1: Basic Profile
    """

    class Meta:
        model = Account
        fields = (
            "first_name",
            "middle_name",
            "last_name",
            "phone",
            "profile_photo",
            "address",
        )

    def validate(self, attrs):
        required_fields = ["first_name", "last_name", "phone"]
        for field in required_fields:
            if not attrs.get(field):
                raise serializers.ValidationError(
                    {field: f"{field.replace('_', ' ').title()} is required."}
                )
        return attrs


class HostBusinessInfoSerializer(serializers.Serializer):
    """
    Serializer for Host Onboarding Step 2: Business Information
    """

    business_name = serializers.CharField(max_length=255, required=True)
    business_address = serializers.CharField(required=True)
    business_phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    about_service = serializers.CharField(required=False, allow_blank=True)


class HostDocumentUploadSerializer(serializers.Serializer):
    """
    Serializer for Host Document Upload (Optional Step 3)
    """

    citizenship_file = serializers.FileField(required=False, allow_null=True)
    pan_file = serializers.FileField(required=False, allow_null=True)
    business_license_file = serializers.FileField(required=False, allow_null=True)

    def validate(self, attrs):
        # At least one document should be uploaded
        if not any([attrs.get("citizenship_file"), attrs.get("pan_file"), attrs.get("business_license_file")]):
            raise serializers.ValidationError(
                "Please upload at least one verification document."
            )
        return attrs


class OnboardingStatusSerializer(serializers.Serializer):
    """
    Serializer for Onboarding Status Response
    """

    has_completed_onboarding = serializers.BooleanField()
    current_step = serializers.IntegerField()
    role = serializers.CharField()
    next_step_url = serializers.CharField(allow_null=True)


# PROFILE / SETTINGS SERIALIZERS


class HostProfileSerializer(serializers.ModelSerializer):
    """
    Read/write serializer for host profile settings (post-onboarding).

    Business fields are writable. Verification fields are read-only —
    only admin can change those.
    """
    is_verified = serializers.BooleanField(read_only=True)

    class Meta:
        model = HostDetail
        fields = [
            'business_name',
            'business_address',
            'business_phone',
            'about_service',
            'verification_status',
            'verification_remarks',
            'is_verified',
        ]
        read_only_fields = ['verification_status', 'verification_remarks']


class HostDocumentReadSerializer(serializers.ModelSerializer):
    """
    Read-only serializer for a host's own uploaded documents.
    Returns the file as an absolute URL using the request context.
    """
    file_url = serializers.SerializerMethodField()
    document_type_display = serializers.CharField(
        source='get_document_type_display', read_only=True
    )

    class Meta:
        model = HostDocument
        fields = ['id', 'document_type', 'document_type_display', 'file_url', 'uploaded_at', 'updated_at']

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file_path and request:
            return request.build_absolute_uri(obj.file_path.url)
        return None


class TravellerPreferencesReadSerializer(serializers.ModelSerializer):
    """
    Read serializer for traveller preferences settings (post-onboarding).
    """
    class Meta:
        model = TravellerDetail
        fields = [
            'emergency_contact',
            'preferred_activities',
            'preferred_min_budget',
            'preferred_max_budget',
            'preferred_trip_style',
        ]


# ADMIN - HOST VERIFICATION SERIALIZERS

class HostDocumentSerializer(serializers.ModelSerializer):
    """
    Read-only serializer for a single host document.

    Used inside HostVerificationDetailSerializer.
    """
    class Meta:
        model = HostDocument
        fields = ('id', 'document_type', 'file_path', 'uploaded_at')
        read_only_fields = fields


class HostVerificationListSerializer(serializers.ModelSerializer):
    """
    Compact serializer for the admin host list view.

    Shows identity, verification status, and document count.

    No documents array here — keep the list fast.
    """
    email = serializers.EmailField(source='user.email', read_only=True)
    full_name = serializers.CharField(source='user.full_name', read_only=True)
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    document_count = serializers.SerializerMethodField()

    class Meta:
        model = HostDetail
        fields = (
            'user_id',
            'email',
            'full_name',
            'business_name',
            'verification_status',
            'verification_remarks',
            'verified_at',
            'document_count',
        )
        read_only_fields = fields
    
    def get_document_count(self, obj):
        # prefetch_related('documents') is set in list_hosts() so this is O(1)
        return obj.documents.count()
    

class HostVerificationDetailSerializer(serializers.ModelSerializer):
    """
    Full serializer for the admin host detail view.
    
    Includes all business info and the full documents list.
    
    Also returned by the approve and reject endpoints so the frontend can update state without a second GET.
    """
    email = serializers.EmailField(source='user.email', read_only=True)
    full_name = serializers.CharField(source='user.full_name', read_only=True)
    phone = serializers.CharField(source='user.phone', read_only=True)
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    verified_by_email = serializers.EmailField(
        source='verified_by.email',
        read_only=True,
        allow_null=True,
    )
    documents = HostDocumentSerializer(many=True, read_only=True)

    class Meta:
        model = HostDetail
        fields = (
            'user_id',
            'email',
            'full_name',
            'phone',
            'business_name',
            'business_address',
            'business_phone',
            'about_service',
            'verification_status',
            'verification_remarks',
            'verified_by_email',
            'verified_at',
            'documents',
        )
        read_only_fields = fields
    
    
class HostRejectSerializer(serializers.Serializer):
    """
    Input serializer for the reject endpoint.
    Only field is 'remarks' — required, non-blank, min 10 chars.
    """
    remarks = serializers.CharField(
        required=True,
        allow_blank=False,
        min_length=10,
        max_length=1000,
        help_text="Reason for rejection (10–1000 characters).",
    )

    def validate_remarks(self, value):
        return value.strip()


# ============================================================================
# ADMIN — USER MANAGEMENT SERIALIZERS
# ============================================================================

class AdminUserListSerializer(serializers.ModelSerializer):
    """Compact serializer for the admin user list view."""
    full_name = serializers.ReadOnlyField()

    class Meta:
        model = Account
        fields = (
            "id", "email", "full_name", "role",
            "is_active", "has_completed_onboarding",
            "created_at",
        )
        read_only_fields = fields


class AdminUserDetailSerializer(serializers.ModelSerializer):
    """Full user detail for admin. Includes role-specific nested info."""
    full_name = serializers.ReadOnlyField()
    age = serializers.ReadOnlyField()
    traveller_detail = serializers.SerializerMethodField()
    host_detail = serializers.SerializerMethodField()
    status_logs = serializers.SerializerMethodField()

    class Meta:
        model = Account
        fields = (
            "id", "email", "first_name", "middle_name", "last_name",
            "full_name", "phone", "date_of_birth", "age", "gender",
            "profile_photo", "address", "country", "city",
            "role", "is_active", "has_completed_onboarding",
            "onboarding_step", "total_revenue", "created_at",
            "traveller_detail", "host_detail", "status_logs",
        )
        read_only_fields = fields

    def get_traveller_detail(self, obj):
        if obj.role != Account.Role.TRAVELLER:
            return None
        try:
            td = obj.traveller_detail
        except TravellerDetail.DoesNotExist:
            return None
        return {
            "emergency_contact": td.emergency_contact,
            "preferred_activities": td.preferred_activities,
            "preferred_min_budget": str(td.preferred_min_budget) if td.preferred_min_budget else None,
            "preferred_max_budget": str(td.preferred_max_budget) if td.preferred_max_budget else None,
            "preferred_trip_style": td.preferred_trip_style,
        }

    def get_host_detail(self, obj):
        if obj.role != Account.Role.HOST:
            return None
        try:
            hd = obj.host_detail
        except HostDetail.DoesNotExist:
            return None
        return {
            "business_name": hd.business_name,
            "business_address": hd.business_address,
            "business_phone": hd.business_phone,
            "about_service": hd.about_service,
            "verification_status": hd.verification_status,
            "verification_remarks": hd.verification_remarks,
            "verified_at": hd.verified_at.isoformat() if hd.verified_at else None,
        }

    def get_status_logs(self, obj):
        logs = obj.status_logs.select_related("performed_by").all()[:10]
        return [
            {
                "id": log.id,
                "action": log.action,
                "reason": log.reason,
                "performed_by_email": log.performed_by.email if log.performed_by else None,
                "created_at": log.created_at.isoformat(),
            }
            for log in logs
        ]


class AdminBlockUserSerializer(serializers.Serializer):
    """Input serializer for the block endpoint."""
    reason = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=1000,
        default="",
    )

