from django.contrib import admin

from .models import ChatSession, ChatMessage, FAQEmbeddingIndex


class ChatMessageInline(admin.TabularInline):
    model = ChatMessage
    readonly_fields = ('role', 'content', 'intent', 'metadata', 'created_at')
    extra = 0
    ordering = ('created_at',)

    def has_add_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ChatSession)
class ChatSessionAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'guest_session_id', 'title', 'is_active', 'created_at', 'updated_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('user__email', 'title', 'guest_session_id')
    readonly_fields = ('created_at', 'updated_at')
    inlines = [ChatMessageInline]


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'session', 'role', 'short_content', 'intent', 'created_at')
    list_filter = ('role', 'intent', 'created_at')
    search_fields = ('content',)
    readonly_fields = ('session', 'role', 'content', 'intent', 'metadata', 'created_at')

    @admin.display(description='Content')
    def short_content(self, obj):
        return obj.content[:100] + '...' if len(obj.content) > 100 else obj.content


@admin.register(FAQEmbeddingIndex)
class FAQEmbeddingIndexAdmin(admin.ModelAdmin):
    list_display = ('id', 'short_question', 'category_name', 'has_embedding', 'updated_at')
    list_filter = ('updated_at',)
    search_fields = ('faq_item__question', 'faq_item__answer', 'faq_item__category__name')
    readonly_fields = ('embedding', 'created_at', 'updated_at')

    @admin.display(description='Question')
    def short_question(self, obj):
        question = obj.faq_item.question
        return question[:80] + '...' if len(question) > 80 else question

    @admin.display(description='Category')
    def category_name(self, obj):
        return obj.faq_item.category.name

    @admin.display(boolean=True, description='Embedded')
    def has_embedding(self, obj):
        return obj.embedding is not None
    