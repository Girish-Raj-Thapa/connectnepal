"""
OpenAPI schema customization for drf-spectacular.
Auto-tags endpoints based on URL patterns.
"""


def preprocessing_filter_spec(endpoints):
    """
    Preprocessing hook - passes through all endpoints.
    Actual tagging is done via postprocessing.
    """
    return endpoints


def custom_postprocessing_hook(result, generator, request, public):
    """
    Postprocessing hook to auto-assign tags based on URL paths.
    Modifies the generated OpenAPI schema to organize endpoints by logical groups.
    """
    paths = result.get('paths', {})

    for path, methods in paths.items():
        tag = get_tag_for_path(path)

        for method, operation in methods.items():
            if isinstance(operation, dict) and 'tags' in operation:
                operation['tags'] = [tag]

    return result


def get_tag_for_path(path: str) -> str:
    """
    Determine the appropriate tag based on the URL path.
    """
    # Authentication endpoints
    if any(x in path for x in ['/login', '/logout', '/token/refresh']):
        return 'Authentication'

    # Registration endpoints
    if '/register' in path or '/activate/' in path:
        return 'Registration'

    # Password reset endpoints
    if '/password-reset' in path:
        return 'Password Reset'

    # User profile
    if path.endswith('/me/'):
        return 'User Profile'

    # Onboarding status
    if '/onboarding/status' in path:
        return 'Onboarding Status'

    # Traveller onboarding
    if '/onboarding/traveller/' in path:
        return 'Onboarding - Traveller'

    # Host onboarding
    if '/onboarding/host/' in path:
        return 'Onboarding - Host'
    
    # Password change (under User Profile)
    if '/me/password' in path:
        return 'User Profile'

    # Trip Planner (split plans vs items)
    if '/trip-planner/' in path:
        if '/items/' in path:
            return 'Trip Planner Items'
        return 'Trip Planner'


    # Default: derive from app name in URL
    parts = path.strip('/').split('/')
    if len(parts) >= 2:
        return parts[1].replace('-', ' ').title()

    return 'Other'
