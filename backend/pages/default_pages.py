def _page(
    *,
    title,
    slug,
    kind,
    sort_order,
    content,
    is_active=True,
    show_in_footer=True,
    show_in_chatbot=True,
):
    return {
        "title": title,
        "slug": slug,
        "kind": kind,
        "is_active": is_active,
        "show_in_footer": show_in_footer,
        "show_in_chatbot": show_in_chatbot,
        "sort_order": sort_order,
        "content": content,
    }


DEFAULT_PAGES = [
    _page(
        title="About Us",
        slug="about-us",
        kind="about",
        sort_order=10,
        content="""# About ConnectNepal

ConnectNepal is a travel marketplace built to help travellers discover authentic experiences across Nepal while giving local hosts a trusted platform to share what they do best.

## Our Story

Nepal has no shortage of extraordinary places, cultures, and communities, but finding reliable, high-quality local experiences can still be fragmented. ConnectNepal was created to make that journey simpler.

We bring together travellers looking for meaningful trips and hosts offering guided activities, cultural experiences, adventure outings, wellness sessions, food journeys, village stays, and curated packages. Our goal is to make discovery, comparison, booking, and communication more transparent for everyone involved.

## What We Do

ConnectNepal helps travellers:

- browse a wide range of experiences and packages in one place
- compare destinations, prices, duration, and activity details more easily
- book with clearer information and better confidence
- discover local experiences beyond the usual tourist shortlist

ConnectNepal helps hosts:

- present their services professionally to a wider audience
- manage listings, schedules, and bookings more efficiently
- build trust through a structured platform presence
- reach travellers looking for verified, well-described local experiences

## What Makes ConnectNepal Different

We are focused on authentic, local-first travel. That means the platform is designed around real host offerings, practical booking information, and experiences that reflect Nepal's diversity rather than generic travel catalog content.

Our platform emphasizes:

- local discovery over mass-market tourism
- clearer listing details and booking transparency
- a better balance between traveller convenience and host visibility
- experiences rooted in culture, nature, food, adventure, wellness, and community

## Our Mission

Our mission is to make travel in Nepal easier to explore, easier to trust, and more beneficial to the local people who create unforgettable experiences every day.

## Our Vision

We want ConnectNepal to become a dependable digital bridge between travellers and the people, places, and communities that make Nepal special.

## Our Commitment

We are committed to building a platform that is:

- useful for real travellers planning real trips
- valuable for local hosts and experience providers
- transparent in how information is presented
- flexible enough to support both short activities and longer travel packages

## For Travellers

Whether someone is planning a cultural day in Kathmandu, an adventure in Pokhara, a wildlife trip in Chitwan, a wellness retreat, or a multi-day Himalayan itinerary, ConnectNepal is designed to make that planning process more informed and more convenient.

## For Hosts

For local operators, guides, and businesses, ConnectNepal is a place to showcase services, build credibility, and connect with people who are actively looking for experiences in Nepal.

## Looking Ahead

We see ConnectNepal as more than a booking tool. It is a foundation for better travel discovery, stronger local visibility, and a more connected travel ecosystem for Nepal.
""",
    ),
    _page(
        title="Contact Us",
        slug="contact-us",
        kind="general",
        sort_order=20,
        content="""# Contact Us

If you need help with a booking, account access, host onboarding, platform feedback, or a support issue, the ConnectNepal team can be reached through our support inbox.

## General Support

Email us at **info@connectnepal.com** for general questions about the platform, booking support, account issues, or help understanding how ConnectNepal works.

## Traveller Support

Travellers can contact us for help with:

- booking questions
- pending or failed payment issues
- cancellation or refund questions
- account access problems
- review and complaint guidance

## Host Support

Hosts can contact us for help with:

- onboarding and profile setup
- listing or package submission questions
- booking management questions
- schedule and availability issues
- account verification and platform policy clarification

## What To Include In Your Message

To help us respond faster, include:

- your full name and account email
- your booking reference, if you have one
- the listing or package title involved
- a short description of the issue
- screenshots when relevant

## Response Expectations

Support requests are reviewed as quickly as possible. For urgent booking or payment issues, mention your booking reference clearly in the email subject line.

## Feedback And Partnerships

If you want to share product feedback, discuss partnerships, or suggest improvements to ConnectNepal, send your message to **info@connectnepal.com** and include a short summary of the purpose of your request.
""",
    ),
    _page(
        title="How It Works",
        slug="how-it-works",
        kind="help",
        sort_order=30,
        content="""# How ConnectNepal Works

ConnectNepal helps travellers discover and book experiences across Nepal while giving local hosts a structured platform to present and manage their offerings.

## 1. Explore Experiences

Travellers can browse listings and packages across categories such as culture, food, adventure, wellness, nature, village experiences, and multi-day trips.

Each experience page is designed to help users understand:

- what the experience includes
- where it takes place
- how long it lasts
- who it is best for
- pricing and availability details

## 2. Review Details Before Booking

Before booking, travellers can compare destinations, inclusions, schedules, pricing, and cancellation terms. This helps users make more informed decisions before committing to a trip.

## 3. Create A Booking

When a traveller chooses a listing or package, the platform checks availability and pricing first. If everything is valid, ConnectNepal creates the booking in a pending payment state.

## 4. Complete Payment

The current booking flow is built around **eSewa**. After the booking is created, the traveller completes checkout through the supported payment flow.

Bookings remain in pending payment status for **15 minutes**. If payment is not completed within that window, the booking expires automatically and the held availability is released.

## 5. Manage Your Booking

Once payment succeeds, the booking moves into a confirmed state. Travellers can then view booking history, references, and related updates through their account.

## 6. Attend The Experience

Travellers join the booked experience on the confirmed date or time slot. Hosts are responsible for delivering the experience as described in their listing or package.

## 7. Leave Reviews

After the experience, travellers can leave ratings and written reviews. Reviews help future travellers make better decisions and help hosts build credibility on the platform.

## Account Requirement

Some ConnectNepal features can be explored publicly, but important actions such as creating bookings, accessing booking history, managing traveller preferences, and using personalized features require an account.

## For Hosts

Hosts use ConnectNepal to:

- complete onboarding
- manage listings or packages
- handle booking-related activity
- build trust through reviews and platform presence

## In Short

The core ConnectNepal journey is simple:

**discover -> compare -> book -> pay -> attend -> review**
""",
    ),
    _page(
        title="For Hosts",
        slug="for-hosts",
        kind="about",
        sort_order=40,
        content="""# For Hosts

ConnectNepal is designed to help local experience providers reach more travellers, present their services more clearly, and manage bookings through a dedicated platform workflow.

## Who This Is For

ConnectNepal is built for hosts such as:

- local guides
- activity operators
- wellness facilitators
- cultural experience providers
- homestay and village experience organizers
- multi-day package operators

## Why Host On ConnectNepal

Hosting on ConnectNepal gives you a structured place to:

- present your offerings professionally
- reach travellers actively looking for Nepal experiences
- explain your itinerary, inclusions, pricing, and expectations clearly
- manage bookings and customer communication more consistently

## Host Onboarding

To start hosting, you create an account and complete the host onboarding flow. Depending on platform requirements, this may include profile details, business information, and supporting documents.

## Listings And Packages

Hosts can add experiences with clear descriptions, destinations, duration, pricing, and activity details. The goal is to make it easier for travellers to understand exactly what is being offered before booking.

## Booking Management

When travellers successfully book and pay, hosts receive booking-related notifications and can manage confirmed activity through the host side of the platform.

## Trust And Reputation

Clear descriptions, accurate availability, strong communication, and quality delivery all contribute to better reviews and stronger traveller trust.

## Host Responsibilities

Hosts are expected to:

- keep listing information accurate and up to date
- honor confirmed bookings
- communicate clearly with travellers
- deliver experiences as described
- follow platform policies and fair conduct expectations

## Growing With The Platform

ConnectNepal aims to help local hosts build long-term visibility, not just short-term exposure. The better your information, service quality, and consistency, the better your results on the platform are likely to be.
""",
    ),
    _page(
        title="Privacy Policy",
        slug="privacy-policy",
        kind="policy",
        sort_order=50,
        content="""# Privacy Policy

This Privacy Policy explains, in plain language, how ConnectNepal collects, uses, and protects information related to the platform. This seeded version is intended for product use and should be reviewed further before formal production release.

## Information We Collect

Depending on how you use ConnectNepal, we may collect:

- account information such as name, email address, and profile details
- traveller or host profile details provided during onboarding
- booking-related information such as selected listings, dates, guests, and booking status
- payment-related metadata needed to track booking payment state
- reviews, complaints, support messages, and platform interactions
- usage and device information used for security, debugging, and product improvement

## How We Use Information

We use platform data to:

- create and manage user accounts
- support bookings and booking history
- process platform workflows related to payment status
- improve platform reliability and user experience
- provide support and respond to complaints or disputes
- generate product insights, recommendations, and service improvements

## Information Shared On The Platform

Certain information may be shared between travellers and hosts when required to support a booking, deliver an experience, or resolve a support issue.

## Payments

ConnectNepal may rely on supported payment providers to complete transactions. The platform stores the payment and booking metadata required to track booking state, verify payment outcomes, and support follow-up actions.

## Reviews, Complaints, And Support

If you submit reviews, complaints, or support requests, that information may be stored and used to investigate issues, improve the platform, and maintain service quality.

## Chatbot And Help Content

Questions submitted through support or chatbot features may be processed to provide relevant help content, improve retrieval quality, and support future product improvements.

## Data Retention

We retain data for as long as reasonably necessary to operate the platform, maintain account and booking history, resolve disputes, comply with platform obligations, and improve the service.

## Security

ConnectNepal takes reasonable steps to protect account and platform data, but no internet-based system can guarantee absolute security.

## Your Responsibilities

Users should keep passwords secure, provide accurate account information, and avoid sharing sensitive account access with others.

## Policy Updates

This Privacy Policy may be updated as the platform evolves. The latest published version on ConnectNepal should be treated as the current reference version.

## Contact

For privacy-related questions, contact **info@connectnepal.com**.
""",
    ),
    _page(
        title="Terms and Conditions",
        slug="terms-and-conditions",
        kind="policy",
        sort_order=60,
        content="""# Terms and Conditions

These Terms and Conditions describe the general rules for using ConnectNepal. This seeded version is intended for product use and should be reviewed further before formal production release.

## Acceptance Of Terms

By using ConnectNepal, users agree to use the platform responsibly and in accordance with the platform rules, policies, and applicable requirements.

## Platform Role

ConnectNepal is a digital marketplace that helps travellers discover and book experiences and helps hosts present and manage their offerings. Specific experiences are offered by hosts, and each host remains responsible for the accuracy and delivery of what they publish.

## Accounts

Users are responsible for maintaining the confidentiality of their account credentials and for ensuring that the information they provide is accurate and current.

## Bookings And Payments

Bookings are subject to availability, pricing validation, and payment completion. A booking is not treated as fully confirmed until the required payment flow has completed successfully.

## Cancellation And Refunds

Cancellation and refund outcomes may depend on the cancellation policy attached to a listing or package, the timing of the cancellation, and the payment state of the booking. Users should review the relevant cancellation and refund information before booking.

## Host Responsibilities

Hosts are expected to:

- provide accurate listing and package information
- communicate clearly and fairly
- honor confirmed bookings when possible
- deliver experiences substantially as described
- follow platform rules and conduct expectations

## Traveller Responsibilities

Travellers are expected to:

- provide accurate booking information
- respect hosts, guides, and local communities
- follow experience instructions and safety guidance
- use the platform in good faith

## Reviews And User Content

Users are responsible for reviews, messages, and other content they submit. Content that is abusive, misleading, fraudulent, or harmful may be removed or moderated.

## Prohibited Conduct

Users must not misuse the platform, engage in fraud, harass others, manipulate reviews, or attempt to disrupt platform operations.

## Suspension Or Removal

ConnectNepal may suspend, restrict, or remove access to accounts or content that violate platform rules, create safety concerns, or cause operational risk.

## Service Changes

ConnectNepal may update, improve, limit, or discontinue parts of the platform as the product evolves.

## Limitation Of Liability

ConnectNepal works to provide a reliable platform, but platform availability, host performance, and travel outcomes can be affected by factors beyond direct control. Users should exercise judgment and review experience details carefully before booking.

## Contact

For questions about these Terms and Conditions, contact **info@connectnepal.com**.
""",
    ),
    _page(
        title="Refund and Cancellation Policy",
        slug="refund-and-cancellation-policy",
        kind="policy",
        sort_order=70,
        content="""# Refund and Cancellation Policy

This page explains the current platform-level cancellation and refund approach on ConnectNepal. This seeded version is intended for product use and should be reviewed further before formal production release.

## Important Overview

Cancellation and refund outcomes can depend on the specific listing or package booked, the cancellation policy assigned to it, and whether payment was completed successfully.

## Pending Payment Expiry

After a booking is created, ConnectNepal keeps it in pending payment status for **15 minutes**. If payment is not completed within that time, the booking expires automatically and the held availability is released.

## Listing And Package Cancellation Policies

Hosts may configure cancellation rules on their offerings. The current policy options used by the platform include:

- **Flexible**: free cancellation up to 24 hours before the experience
- **Moderate**: free cancellation up to 3 days before the experience
- **Strict**: 50% refund up to 7 days before the experience
- **Non-refundable**: no refund after booking under that policy

Travellers should always review the specific cancellation terms shown on the listing or package before booking.

## Host Or Platform Cancellations

If a confirmed booking must be cancelled by the host or due to a platform-level issue, ConnectNepal should review the case and determine the appropriate next step based on the booking and payment state.

## Refund Timing

Where a refund is applicable, processing time can depend on the payment method, provider behavior, and the operational review required for the case.

## Partial Or Case-Based Outcomes

Some situations may require manual review, especially when the issue involves:

- disputed service delivery
- host no-show or traveller no-show
- refund disputes
- payment anomalies
- operational or safety problems

## How To Request Help

If you need help with a cancellation or refund question, contact **info@connectnepal.com** and include:

- your booking reference
- the affected listing or package
- the date of the experience
- a short summary of the issue

## Final Note

The platform-level guidance on this page does not replace the specific policy shown on the booked experience. The listing or package details and the actual booking state should always be checked first.
""",
    ),
    _page(
        title="Community Guidelines",
        slug="community-guidelines",
        kind="policy",
        sort_order=80,
        content="""# Community Guidelines

These Community Guidelines explain the standards of behaviour expected on ConnectNepal. They apply to travellers, hosts, and anyone using the platform to browse, book, communicate, review, or raise complaints.

## Why These Guidelines Matter

ConnectNepal works best when people use the platform honestly, respectfully, and responsibly. These guidelines are here to support trust, safety, accurate expectations, and fair treatment across the platform.

## Treat Others With Respect

Travellers and hosts are expected to communicate respectfully and avoid abusive, threatening, discriminatory, or harassing behaviour at all times.

This includes:

- respectful messages and booking-related communication
- fair treatment of hosts, travellers, guides, and local communities
- appropriate conduct during experiences, support interactions, and reviews

## Be Honest And Accurate

Hosts should present listings and packages accurately. Travellers should also provide truthful booking information, review content, and complaint details.

Do not:

- post misleading listing or package details
- make false claims about what happened during a booking
- submit dishonest reviews
- file malicious or knowingly false complaints

## Keep Payments On Platform

Users must not pressure others into unsafe or unauthorized payment arrangements outside the platform flow.

This includes:

- pressuring travellers to pay off-platform
- requesting hidden or unfair extra charges
- attempting to bypass platform booking and payment rules in bad faith

## Respect Booking Terms And Commitments

Hosts should honor confirmed bookings when possible and deliver experiences substantially as described. Travellers should arrive prepared, follow instructions, and respect the expectations of the booked experience.

Everyone should:

- review booking details carefully before confirming
- respect cancellation terms and time commitments
- communicate promptly when issues arise

## Use Reviews Responsibly

Reviews should be based on genuine booking experiences and should remain relevant, accurate, and respectful.

Do not use reviews to:

- harass or intimidate other users
- make defamatory or knowingly false statements
- manipulate ratings unfairly
- post irrelevant, abusive, or spam content

## Protect Safety And Well-Being

Safety comes first. Behaviour involving harassment, discrimination, fraud, threats, intimidation, or serious safety concerns is treated as especially serious on ConnectNepal.

Users should not:

- engage in threatening behaviour
- harass, discriminate against, or intimidate others
- pressure others into unsafe situations
- attempt scams, fraud, or deceptive conduct

## Respect Property, Communities, And Experiences

Travellers should respect host property, local customs, community spaces, and the practical rules of each experience. Hosts should create reasonable expectations and treat travellers fairly during delivery.

## Reporting Problems

If something goes wrong, users should use the platform's complaint and support channels rather than escalating through abuse or retaliation.

ConnectNepal supports reporting issues such as:

- misleading listings or packages
- no-show or non-delivery
- poor communication
- host or traveller misconduct
- off-platform payment pressure
- refund disputes
- harassment, fraud, or safety concerns

## What Can Happen If Guidelines Are Violated

Depending on severity, ConnectNepal may:

- warn a user
- restrict content or platform actions
- moderate or remove reviews or other submitted content
- investigate complaints and request more information
- suspend or remove access to the platform

## Final Principle

Use ConnectNepal in a way that supports trust, fairness, safety, and real respect for the people and communities involved in travel across Nepal.
""",
    ),
    _page(
        title="Trust and Safety",
        slug="trust-and-safety",
        kind="policy",
        sort_order=90,
        content="""# Trust and Safety

Trust and safety matter on ConnectNepal because travel often involves real people, real places, real payments, and real-time decisions. This page explains the platform's general approach to safer use of ConnectNepal for travellers and hosts.

## Our Goal

ConnectNepal aims to create a platform where travellers can book with more confidence and hosts can offer experiences in an environment built around clearer expectations, fair conduct, and accountable reporting.

## Safety Starts Before Booking

Travellers should review listings and packages carefully before booking. Hosts should keep their information accurate, current, and realistic.

Before confirming a booking, users should pay attention to:

- the experience description
- location and meeting details
- inclusions and exclusions
- activity difficulty and suitability
- cancellation terms
- special requirements or age restrictions

## Keep Communication Clear And Respectful

Respectful communication is one of the most important trust signals on the platform. Travellers and hosts should communicate honestly and professionally before, during, and after a booking.

Problems such as abusive language, harassment, discrimination, threats, or intimidation are taken seriously.

## Use Platform Booking And Payment Flows Properly

For trust and traceability, users should follow the official ConnectNepal booking and payment flow.

Be cautious if anyone:

- pressures you to pay outside the platform
- asks for hidden charges not reflected in the booking
- tries to avoid the normal booking process
- makes misleading claims about availability, payment, or confirmation

## Misleading Or Unsafe Behaviour

ConnectNepal treats the following issues seriously:

- misleading listing or package information
- no-show or non-delivery
- poor communication around confirmed bookings
- off-platform payment pressure
- refund disputes
- host misconduct or traveller misconduct
- fraud or scam behavior
- harassment, discrimination, or threatening behavior
- safety concerns connected to an experience

## If Something Feels Wrong

If something seems unsafe, deceptive, or seriously inappropriate, users should stop and use the platform's support or complaint channels as appropriate.

Examples include:

- the actual experience is materially different from what was advertised
- someone demands extra money unfairly
- someone pressures you into unsafe or unauthorized arrangements
- you experience harassment, intimidation, or threatening conduct
- you believe a scam or fraud attempt is happening

## Complaints And Reporting

ConnectNepal supports complaint reporting for a range of operational, conduct, financial, and safety-related issues. Depending on the case, the platform may review submitted details, request more information, collect evidence, and apply follow-up actions.

Users should report issues clearly and provide:

- the booking reference
- the listing or package involved
- a short factual description of what happened
- relevant screenshots, photos, or other supporting evidence when available

## During An Experience

Travellers should follow reasonable safety instructions from hosts or guides. Hosts should run experiences responsibly, communicate clearly, and avoid creating unnecessary risk through poor coordination or misleading promises.

Users should also respect:

- local communities
- cultural spaces
- private property
- activity-specific rules and limits

## What ConnectNepal May Do

Depending on the seriousness of an issue, ConnectNepal may:

- review reports and complaints
- request more information or evidence
- moderate content or reviews
- restrict platform activity
- suspend or remove access to the platform

## Emergencies

ConnectNepal is a platform, not an emergency service. If there is an immediate danger, medical emergency, or urgent personal safety risk, users should contact the relevant local emergency services or local authorities first.

## Final Reminder

Trust and safety are shared responsibilities. Travellers, hosts, and platform operators all play a role in making ConnectNepal more reliable, more respectful, and safer to use.
""",
    ),
]
