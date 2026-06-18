from rest_framework import serializers

from pages.models import Page, FAQCategory, FAQItem


class PageListSerializer(serializers.ModelSerializer):
    kind_display = serializers.CharField(source="get_kind_display", read_only=True)

    class Meta:
        model = Page
        fields = (
            "title",
            "slug",
            "kind",
            "kind_display",
            "show_in_footer",
            "sort_order",
            "updated_at",
        )
        read_only_fields = fields


class PageDetailSerializer(serializers.ModelSerializer):
    kind_display = serializers.CharField(source="get_kind_display", read_only=True)

    class Meta:
        model = Page
        fields = (
            "title",
            "slug",
            "kind",
            "kind_display",
            "content",
            "updated_at",
        )
        read_only_fields = fields


class FAQCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = FAQCategory
        fields = ("name", "slug")
        read_only_fields = fields


class FAQItemSerializer(serializers.ModelSerializer):
    category = serializers.SlugField(source="category.slug", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = FAQItem
        fields = (
            "id",
            "category",
            "category_name",
            "question",
            "answer",
            "sort_order",
        )
        read_only_fields = fields


class FAQItemNestedSerializer(serializers.ModelSerializer):
    class Meta:
        model = FAQItem
        fields = ("id", "question", "answer", "sort_order")
        read_only_fields = fields


class FAQCategoryWithItemsSerializer(serializers.ModelSerializer):
    items = FAQItemNestedSerializer(source="public_items", many=True, read_only=True)

    class Meta:
        model = FAQCategory
        fields = ("name", "slug", "items")
        read_only_fields = fields
        