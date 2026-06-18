from decimal import Decimal

# Maximum number of active, bookable listings an unverified host may have.
UNVERIFIED_HOST_LISTING_LIMIT = 2

# Maximum cumulative booking revenue (NPR) allowed for an unverified host.
UNVERIFIED_HOST_TRANSACTION_LIMIT = Decimal('50000.00')
