from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import Account, TravellerDetail, HostDetail, AdminDetail, HostDocument


class TravellerDetailInline(admin.StackedInline):
    model = TravellerDetail
    can_delete = False
    verbose_name_plural = 'Traveller Details'


class HostDetailInline(admin.StackedInline):
    model = HostDetail
    fk_name = 'user'
    can_delete = False
    verbose_name_plural = 'Host Details'


class AdminDetailInline(admin.StackedInline):
    model = AdminDetail
    can_delete = False
    verbose_name_plural = 'Admin Details'


@admin.register(Account)
class AccountAdmin(BaseUserAdmin):
    list_display = ('email', 'full_name', 'role', 'has_completed_onboarding', 'is_active', 'created_at')
    list_filter = ('role', 'is_active', 'has_completed_onboarding', 'created_at')
    search_fields = ('email', 'first_name', 'last_name', 'phone')
    ordering = ('-created_at',)

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal Info', {
            'fields': (
                'first_name', 'middle_name', 'last_name',
                'phone', 'date_of_birth', 'gender',
                'profile_photo', 'address', 'country', 'city'
            )
        }),
        ('Role & Onboarding', {
            'fields': ('role', 'has_completed_onboarding', 'onboarding_step', 'total_revenue')
        }),
        ('Permissions', {
            'fields': ('is_active', 'is_staff', 'is_admin', 'is_superadmin', 'groups', 'user_permissions')
        }),
        ('Important Dates', {
            'fields': ('last_login', 'created_at')
        }),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password1', 'password2', 'role'),
        }),
    )

    readonly_fields = ('created_at', 'last_login')

    def get_inline_instances(self, request, obj=None):
        if not obj:
            return []

        inlines = []
        if obj.role == Account.Role.TRAVELLER:
            inlines.append(TravellerDetailInline(self.model, self.admin_site))
        elif obj.role == Account.Role.HOST:
            inlines.append(HostDetailInline(self.model, self.admin_site))
        elif obj.role == Account.Role.ADMIN:
            inlines.append(AdminDetailInline(self.model, self.admin_site))

        return inlines


@admin.register(TravellerDetail)
class TravellerDetailAdmin(admin.ModelAdmin):
    list_display = ('user', 'preferred_trip_style', 'preferred_min_budget', 'preferred_max_budget')
    search_fields = ('user__email', 'user__first_name', 'user__last_name')


@admin.register(HostDetail)
class HostDetailAdmin(admin.ModelAdmin):
    list_display = ('user', 'business_name', 'verification_status', 'verified_at')
    list_filter = ('verification_status',)
    search_fields = ('user__email', 'business_name', 'business_phone')
    readonly_fields = ('verified_at',)


@admin.register(AdminDetail)
class AdminDetailAdmin(admin.ModelAdmin):
    list_display = ('user', 'admin_level', 'date_of_joining')
    search_fields = ('user__email',)
    readonly_fields = ('date_of_joining',)


@admin.register(HostDocument)
class HostDocumentAdmin(admin.ModelAdmin):
    list_display = ('host', 'document_type', 'uploaded_at', 'updated_at')
    list_filter = ('document_type', 'uploaded_at')
    search_fields = ('host__user__email', 'host__business_name')
    readonly_fields = ('uploaded_at', 'updated_at')
