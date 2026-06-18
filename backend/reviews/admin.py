from django.contrib import admin
from .models import Review, ReviewReport, ReviewEvent

@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display  = ('id', 'traveller', 'listing', 'package', 'rating', 'status', 'host_reply_status', 'created_at')
    list_filter   = ('rating', 'status', 'host_reply_status')
    search_fields = ('traveller__email', 'comment')
    readonly_fields = ('created_at', 'updated_at', 'host_replied_at', 'edited_at', 'deleted_at', 'moderated_at',
    'completion_date_snapshot',)
    

@admin.register(ReviewReport)
class ReviewReportAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'review', 'reporter', 'target_type',
        'reason', 'status', 'created_at',
    )
    list_filter = ('status', 'target_type', 'reason')
    search_fields = ('reporter__email', 'details')
    readonly_fields = ('created_at', 'resolved_at')


@admin.register(ReviewEvent)
class ReviewEventAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'review', 'actor', 'actor_role',
        'event_type', 'created_at',
    )
    list_filter = ('event_type', 'actor_role')
    search_fields = ('review__id',)
    readonly_fields = ('created_at',)