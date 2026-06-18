import django_filters
from django.db.models import Q

from .models import Account


class AdminUserFilter(django_filters.FilterSet):
    role = django_filters.ChoiceFilter(choices=Account.Role.choices)
    is_active = django_filters.BooleanFilter()
    search = django_filters.CharFilter(method="filter_search")

    class Meta:
        model = Account
        fields = ["role", "is_active"]

    def filter_search(self, queryset, name, value):
        if not value:
            return queryset
        for token in value.strip().split():
            queryset = queryset.filter(
                Q(first_name__icontains=token)
                | Q(last_name__icontains=token)
                | Q(email__icontains=token)
            )
        return queryset
