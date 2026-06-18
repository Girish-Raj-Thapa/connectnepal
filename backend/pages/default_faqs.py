DEFAULT_FAQ_CATEGORIES = [
    {
        "name": "Guest & Public Browsing",
        "slug": "guest-public-browsing",
        "items": [
            {
                "question": "Can I use ConnectNepal without creating an account?",
                "answer": (
                    "Yes. Guests can browse public listings, packages, pages, FAQs, and use "
                    "basic chatbot features. You need a traveller account for booking, trip plans, "
                    "booking history, reviews, and personalized recommendations."
                ),
            },
            {
                "question": "Can I browse listings and packages without logging in?",
                "answer": (
                    "Yes. Active, bookable listings and packages are publicly browsable. Guests "
                    "can view list pages, detail pages, and public review pages for listings and packages."
                ),
            },
            {
                "question": "Can I search and filter experiences before signing up?",
                "answer": (
                    "Yes. Public listing and package browsing supports searching, ordering, and "
                    "filtering so you can explore options before creating an account."
                ),
            },
            {
                "question": "Can I see dates or availability before logging in?",
                "answer": (
                    "Yes. Public availability and slot endpoints are available for listings and packages, "
                    "so guests can check available dates before deciding to sign up."
                ),
            },
            {
                "question": "Can I book as a guest without logging in?",
                "answer": (
                    "No. Booking creation requires an authenticated traveller account. Guests can browse "
                    "and plan what they want, but they must register and log in before booking."
                ),
            },
            {
                "question": "Can I read reviews without logging in?",
                "answer": (
                    "Yes. Published reviews for listings and packages are public, so guests can read them "
                    "without a traveller account."
                ),
            },
        ],
    },
    {
        "name": "Accounts & Access",
        "slug": "accounts-access",
        "items": [
            {
                "question": "How do I create a traveller account?",
                "answer": (
                    "Register with your email and password, activate your account from the "
                    "verification link, then log in and complete traveller onboarding. "
                    "Traveller onboarding includes a basic profile step and a preferences step."
                ),
            },
            {
                "question": "What happens after I register on ConnectNepal?",
                "answer": (
                    "After registration, you verify your email, log in, and complete traveller onboarding. "
                    "The traveller onboarding flow includes a basic profile step followed by a preferences step."
                ),
            },
            {
                "question": "What should I do if I forgot my password?",
                "answer": (
                    "Use the password reset flow. ConnectNepal always returns a success "
                    "message, and if an account exists for that email address, password "
                    "reset instructions are sent to it."
                ),
            },
            {
                "question": "Can I change my traveller preferences later?",
                "answer": (
                    "Yes. Traveller preferences are not limited to onboarding. Logged-in travellers "
                    "can update their saved preferences later from the traveller preferences settings endpoint."
                ),
            },
            {
                "question": "Do I need to log in to use all ConnectNepal features?",
                "answer": (
                    "No. Public browsing for listings, packages, static pages, and basic "
                    "chatbot access is available without login. Traveller-only features such "
                    "as booking creation, booking history, trip planning, booking summaries, "
                    "and personalized recommendations require an authenticated traveller account."
                ),
            },
        ],
    },
    {
        "name": "Bookings & Payments",
        "slug": "bookings-payments",
        "items": [
            {
                "question": "How do I book a trip on ConnectNepal?",
                "answer": (
                    "Pick the listing or package you want to book, choose the available slot "
                    "or departure date if the product uses one, and create the booking from "
                    "your traveller account. ConnectNepal then keeps the booking in pending "
                    "payment status until you complete checkout through eSewa."
                ),
            },
            {
                "question": "How do I book a listing or package on ConnectNepal?",
                "answer": (
                    "Choose the listing or package you want, select the available slot or "
                    "departure date when needed, and create the booking from your traveller "
                    "account. The platform checks pricing and availability first, creates the "
                    "booking in pending payment status, and then you complete checkout through eSewa."
                ),
            },
            {
                "question": "Can I get a price and availability quote before confirming a booking?",
                "answer": (
                    "Yes. ConnectNepal has a booking quote flow that calculates item pricing and "
                    "checks availability before a booking is created."
                ),
            },
            {
                "question": "How long do I have to pay after creating a booking?",
                "answer": (
                    "Bookings stay in pending payment status for 15 minutes. If payment is not "
                    "completed within that window, the booking expires automatically and the "
                    "availability hold is released."
                ),
            },
            {
                "question": "What payment method is supported right now?",
                "answer": (
                    "The current checkout flow is built around eSewa. Booking payment initiation, "
                    "callback handling, and payment status polling are all implemented for eSewa."
                ),
            },
            {
                "question": "How can I check my bookings?",
                "answer": (
                    "Logged-in travellers can open their booking list and booking detail views. "
                    "The booking APIs expose booking status, payment status, totals, booking items, "
                    "and booking history."
                ),
            },
            {
                "question": "How do I know if my booking is confirmed?",
                "answer": (
                    "A booking starts in pending payment status. After successful payment verification, "
                    "its booking and payment status move forward and the booking appears in your booking history."
                ),
            },
            {
                "question": "Can I cancel a booking myself?",
                "answer": (
                    "Travellers can cancel their own booking only while it is still in "
                    "pending payment status. Once a booking is already confirmed, completed, "
                    "cancelled, or expired, the traveller self-cancel endpoint does not allow it."
                ),
            },
            {
                "question": "What happens if my payment is cancelled or not completed?",
                "answer": (
                    "If payment is not successfully verified, the booking stays pending payment "
                    "until it is cancelled or expires. Once the payment window passes, the "
                    "booking is marked expired and the held availability is released."
                ),
            },
        ],
    },
    {
        "name": "Traveller Planning & Reviews",
        "slug": "platform-basics",
        "items": [
            {
                "question": "What are some common things I can ask ConnectNepal about?",
                "answer": (
                    "You can ask about traveller accounts, booking and payment flow, listings, "
                    "packages, trip planning, booking summaries, and personalized recommendations."
                ),
            },
            {
                "question": "What can I book on ConnectNepal?",
                "answer": (
                    "In the current backend, ConnectNepal focuses on Nepal travel experiences "
                    "and host-created packages. That means active, bookable listings and packages, "
                    "not a separate hotel, flight, or car-rental booking system."
                ),
            },
            {
                "question": "What is the difference between a listing and a package?",
                "answer": (
                    "A listing is a single travel experience or activity offered by a host. "
                    "A package is a larger product with its own duration, price, and departure "
                    "slots, and it can bundle multiple listings together."
                ),
            },
            {
                "question": "Can I build a trip plan before booking?",
                "answer": (
                    "Yes. Logged-in travellers can create trip plans, add listings to specific "
                    "days, reorder items, and later convert selected trip plan items into a booking "
                    "while the trip plan is still in planning status."
                ),
            },
            {
                "question": "Can I convert a trip plan into a booking?",
                "answer": (
                    "Yes. Selected trip plan items can be converted into a booking while the trip plan "
                    "is still in planning status."
                ),
            },
            {
                "question": "Can I leave a review after my trip?",
                "answer": (
                    "Yes, but only for your own completed booking item. Reviews are tied to booking items, "
                    "and the review window closes 90 days after completion."
                ),
            },
            {
                "question": "Can I edit or delete my review later?",
                "answer": (
                    "Yes. Travellers can edit their own review within 30 days of creation, and they can "
                    "also soft-delete their own review."
                ),
            },
            {
                "question": "Do low ratings need a written comment?",
                "answer": (
                    "Yes. For ratings of 1 or 2 stars, ConnectNepal requires a written comment with at "
                    "least 20 characters."
                ),
            },
        ],
    },
    {
        "name": "Recommendations & Chatbot",
        "slug": "recommendations-chatbot",
        "items": [
            {
                "question": "Can I get personalized recommendations on ConnectNepal?",
                "answer": (
                    "Yes. Logged-in travellers can use the For You recommendation endpoints for "
                    "listings and packages. These recommendations use saved traveller preferences "
                    "and can also use behavior signals from browsing and interaction events."
                ),
            },
            {
                "question": "Can guests get personalized recommendations?",
                "answer": (
                    "No. Personalized recommendations are for authenticated travellers because they use "
                    "saved preferences and traveller-linked behavior data. Guests can still browse public experiences."
                ),
            },
            {
                "question": "What can the ConnectNepal chatbot help me with?",
                "answer": (
                    "The chatbot can answer platform FAQ questions, explain listings and packages, "
                    "suggest Nepal travel experiences, summarize bookings for logged-in travellers, "
                    "and provide personalized recommendations for logged-in travellers."
                ),
            },
            {
                "question": "Can guests use the chatbot?",
                "answer": (
                    "Yes. Guest chat sessions are supported, so basic chatbot use does not require "
                    "login. However, booking summaries and personalized recommendations depend on "
                    "an authenticated traveller account."
                ),
            },
        ],
    },
]
