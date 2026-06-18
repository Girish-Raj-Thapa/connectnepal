from accounts.permissions import IsAdmin as AccountsIsAdmin
from accounts.permissions import IsHost as AccountsIsHost
from accounts.permissions import IsTraveller as AccountsIsTraveller


class IsAnalyticsTraveller(AccountsIsTraveller):
    message = 'Only travellers can access traveller analytics.'


class IsAnalyticsHost(AccountsIsHost):
    message = 'Only hosts can access host analytics.'


class IsAnalyticsAdmin(AccountsIsAdmin):
    message = 'Only admins can access admin analytics.'
    