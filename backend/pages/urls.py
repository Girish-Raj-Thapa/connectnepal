from django.urls import path

from pages.views import (
    PageListView,
    PageDetailView,
    FAQListView,
    FAQCategoryListView,
)

app_name = "pages"

urlpatterns = [
    path("", PageListView.as_view(), name="page-list"),
    path("faqs/", FAQListView.as_view(), name="faq-list"),
    path("faq-categories/", FAQCategoryListView.as_view(), name="faq-category-list"),
    path("<slug:slug>/", PageDetailView.as_view(), name="page-detail"),
]