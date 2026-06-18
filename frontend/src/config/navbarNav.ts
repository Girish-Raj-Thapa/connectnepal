import type { UserRole } from "@/types/accounts";
import { ROUTES } from '@constants/routes';

// ─── Types ───────────────────────────────────────────────

export interface NavbarLinkItem {
    id: string;
    label: string;
    path: string;
}

/**
 * NavbarRole extends UserRole with 'guest' for unauthenticated users.
 * The Navbar component determines which key to use:
 *   const navRole: NavbarRole = user ? user.role : 'guest';
 */
export type NavbarRole = UserRole | 'guest';

type NavbarConfig = Record<NavbarRole, NavbarLinkItem[]>;

// ─── Config ──────────────────────────────────────────────

export const navbarConfig: NavbarConfig = {
    guest: [
        { id: 'guest-home',        label: 'Home',           path: ROUTES.HOME },
        { id: 'guest-discover',    label: 'Discover',       path: ROUTES.DISCOVER },
        { id: 'guest-about',       label: 'About Us',       path: ROUTES.ABOUT_US },
        { id: 'guest-become-host', label: 'Become a Host',  path: ROUTES.REGISTER },
    ],

    traveller: [
        { id: 'traveller-home',     label: 'Home',      path: ROUTES.HOME },
        { id: 'traveller-discover', label: 'Discover',  path: ROUTES.DISCOVER },
        { id: 'traveller-about',    label: 'About Us',  path: ROUTES.ABOUT_US },
    ],

    host: [
        { id: 'host-home',     label: 'Home',     path: ROUTES.HOME },
        { id: 'host-discover', label: 'Discover', path: ROUTES.DISCOVER },
        { id: 'host-about',    label: 'About Us', path: ROUTES.ABOUT_US },
    ],

    admin: [
        { id: 'admin-home',    label: 'Home',     path: ROUTES.HOME },
        { id: 'admin-discover',label: 'Discover', path: ROUTES.DISCOVER },
        { id: 'admin-about',   label: 'About Us', path: ROUTES.ABOUT_US },
    ],
};