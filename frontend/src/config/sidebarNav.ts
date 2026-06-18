import type { LucideIcon } from "lucide-react";
import {
    LayoutDashboard,
    Package,
    Boxes,
    CalendarDays,
    Star,
    ClipboardList,
    BookOpen,
    AlertTriangle,
    MessageCircle,
    Users,
    ShieldCheck,
    Settings,
} from 'lucide-react';
import type { UserRole } from "@/types/accounts";
import { ROUTES } from "@/constants/routes";

// ─── Types ───────────────────────────────────────────────

interface SidebarItemBase {
    id: string;
    label: string;
    icon: LucideIcon;
    variant?: 'default' | 'danger';
    badge?: string | number;
    disabled?: boolean;
}

interface SidebarLinkItem extends SidebarItemBase {
    type: 'link';
    path: string;
    activeMatch?: 'exact' | 'prefix';
}

export type SidebarItem = SidebarLinkItem;

export interface SidebarSection {
    items: SidebarItem[];
}

type SidebarConfig = Record<UserRole, SidebarSection[]>;


// ─── Config ──────────────────────────────────────────────

export const sidebarConfig: SidebarConfig = {
    host: [
        {
            items: [
                {
                    id: 'host-dashboard',
                    type: 'link',
                    label: 'Dashboard',
                    icon: LayoutDashboard,
                    path: ROUTES.HOST_DASHBOARD,
                    activeMatch: 'exact',
                },
                {
                    id: 'host-listings',
                    type: 'link',
                    label: 'Manage Listings',
                    icon: Package,
                    path: ROUTES.HOST_LISTINGS,
                },
                {
                    id: 'host-packages',
                    type: 'link',
                    label: 'Manage Packages',
                    icon: Boxes,
                    path: ROUTES.HOST_PACKAGES,
                },
                {
                    id: 'host-bookings',
                    type: 'link',
                    label: 'Bookings',
                    icon: CalendarDays,
                    path: ROUTES.HOST_BOOKINGS,
                },
                {
                    id: 'host-reviews',
                    type: 'link',
                    label: 'Reviews',
                    icon: Star,
                    path: ROUTES.HOST_REVIEWS,
                },
                {
                    id: 'host-complaints',
                    type: 'link',
                    label: 'Complaints',
                    icon: AlertTriangle,
                    path: ROUTES.HOST_COMPLAINTS,
                },
            ],
        },
        {
            items: [
                {
                    id: 'host-settings',
                    type: 'link',
                    label: 'Settings',
                    icon: Settings,
                    path: ROUTES.HOST_SETTINGS,
                },
            ],
        },
    ],

    traveller: [
        {
            items: [
                {
                    id: 'traveller-dashboard',
                    type: 'link',
                    label: 'Dashboard',
                    icon: LayoutDashboard,
                    path: ROUTES.TRAVELLER_DASHBOARD,
                    activeMatch: 'exact',
                },
                {
                    id: 'traveller-trips',
                    type: 'link',
                    label: 'Trip Planner',
                    icon: ClipboardList,
                    path: ROUTES.TRAVELLER_TRIPS,
                },
                {
                    id: 'traveller-bookings',
                    type: 'link',
                    label: 'My Bookings',
                    icon: BookOpen,
                    path: ROUTES.TRAVELLER_BOOKINGS,
                },
                {
                    id: 'traveller-reviews',
                    type: 'link',
                    label: 'My Reviews',
                    icon: Star,
                    path: ROUTES.TRAVELLER_REVIEWS,
                },
                {
                    id: 'traveller-complaints',
                    type: 'link',
                    label: 'Complaints',
                    icon: AlertTriangle,
                    path: ROUTES.TRAVELLER_COMPLAINTS,
                },
                {
                    id: 'traveller-chat-history',
                    type: 'link',
                    label: 'Chat History',
                    icon: MessageCircle,
                    path: ROUTES.TRAVELLER_CHAT_HISTORY,
                },
            ],
        },
        {
            items: [
                {
                    id: 'traveller-settings',
                    type: 'link',
                    label: 'Settings',
                    icon: Settings,
                    path: ROUTES.TRAVELLER_SETTINGS,
                },
            ],
        },
    ],

    admin: [
        {
            items: [
                {
                    id: 'admin-dashboard',
                    type: 'link',
                    label: 'Dashboard',
                    icon: LayoutDashboard,
                    path: ROUTES.ADMIN_DASHBOARD,
                    activeMatch: 'exact',
                },
                {
                    id: 'admin-users',
                    type: 'link',
                    label: 'Users',
                    icon: Users,
                    path: ROUTES.ADMIN_USERS,
                },
                {
                    id: 'admin-verify-hosts',
                    type: 'link',
                    label: 'Verify Hosts',
                    icon: ShieldCheck,
                    path: ROUTES.ADMIN_VERIFY_HOSTS,
                },
                {
                    id: 'admin-complaints',
                    type: 'link',
                    label: 'Complaints',
                    icon: AlertTriangle,
                    path: ROUTES.ADMIN_COMPLAINTS,
                },
                {
                    id: 'admin-reviews',
                    type: 'link',
                    label: 'Reviews',
                    icon: Star,
                    path: ROUTES.ADMIN_REVIEWS,
                },
            ],
            },
            {
            items: [
                {
                    id: 'admin-settings',
                    type: 'link',
                    label: 'Settings',
                    icon: Settings,
                    path: ROUTES.ADMIN_SETTINGS,
                },
            ],
        },
    ],
};
