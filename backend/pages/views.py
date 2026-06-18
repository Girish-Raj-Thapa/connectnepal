from rest_framework import generics
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from pages.serializers import (
    PageListSerializer,
    PageDetailSerializer,
    FAQCategorySerializer,
    FAQCategoryWithItemsSerializer,
)
from pages.services.page_service import (
    get_active_pages,
    get_page_by_slug,
    get_public_faq_categories,
    get_public_faq_categories_with_items,
)


class PageListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = PageListSerializer
    pagination_class = None

    def get_queryset(self):
        kind = self.request.query_params.get("kind")
        return get_active_pages(kind=kind)


class PageDetailView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = PageDetailSerializer
    lookup_url_kwarg = "slug"
    lookup_field = "slug"

    def get_object(self):
        return get_page_by_slug(self.kwargs["slug"])


class FAQCategoryListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = FAQCategorySerializer
    pagination_class = None

    def get_queryset(self):
        return get_public_faq_categories()


class FAQListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        category_slug = request.query_params.get("category")
        categories = get_public_faq_categories_with_items(category_slug=category_slug)
        serializer = FAQCategoryWithItemsSerializer(categories, many=True)
        return Response(serializer.data)
    