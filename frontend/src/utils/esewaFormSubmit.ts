/**
 * eSewa Form Submit Utility
 * -------------------------
 * Creates a hidden HTML form and submits it to eSewa's payment page.
 *
 * WHY A FORM POST (NOT fetch/XHR):
 * eSewa requires a full-page browser navigation for their hosted payment flow.
 * They set cookies and perform 3DS redirects that only work with real browser navigation.
 * A fetch/XHR request cannot trigger this.
 *
 * AFTER CALLING THIS FUNCTION:
 * The browser navigates away from the React app immediately.
 * No JavaScript after form.submit() will execute.
 */

import type { EsewaFormFields } from '@/types/payments';

/**
 * Dynamically create and submit a hidden HTML form to eSewa's payment URL.
 *
 * @param formUrl - The eSewa payment page URL (from API: form_url / formUrl after re-snakify)
 * @param fields  - All snake_case form fields from the API response (after re-snakification)
 */
export function submitToEsewa(
    formUrl: string,
    fields: EsewaFormFields | Record<string, string>,
): void {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = formUrl;

    Object.entries(fields).forEach(([key, value]) => {
        const input = document.createElement('input');
        input.type  = 'hidden';
        input.name  = key;
        input.value = String(value);
        form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
    // browser navigates away — nothing after this line will execute
}
