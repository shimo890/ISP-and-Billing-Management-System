from django.core.management.base import BaseCommand
from django.db import transaction

from apps.authentication.models import MenuItem, Permission, Role
from apps.users.models import User


PERMISSIONS = [
    # Users / RBAC
    ("users:read", "users", "read", "Read users"),
    ("users:create", "users", "create", "Create users"),
    ("users:update", "users", "update", "Update users"),
    ("users:delete", "users", "delete", "Delete users"),
    ("roles:read", "roles", "read", "Read roles"),
    ("roles:write", "roles", "update", "Manage roles and permissions"),
    # Core domain
    ("customers:read", "customers", "read", "Read customers"),
    ("customers:create", "customers", "create", "Create customers"),
    ("customers:update", "customers", "update", "Update customers"),
    ("customers:delete", "customers", "delete", "Delete customers"),
    ("customers:import", "customers", "import", "Import customers"),
    ("customers:export", "customers", "export", "Export customers"),
    ("kam:read", "kam", "read", "Read KAM"),
    ("kam:write", "kam", "update", "Manage KAM"),
    ("entitlements:read", "entitlements", "read", "Read entitlements"),
    ("entitlements:create", "entitlements", "create", "Create entitlements"),
    ("entitlements:update", "entitlements", "update", "Update entitlements"),
    ("entitlements:delete", "entitlements", "delete", "Delete entitlements"),
    ("entitlement_details:read", "entitlement_details", "read", "Read entitlement details"),
    ("entitlement_details:create", "entitlement_details", "create", "Create entitlement details"),
    ("entitlement_details:update", "entitlement_details", "update", "Update entitlement details"),
    ("entitlement_details:delete", "entitlement_details", "delete", "Delete entitlement details"),
    ("invoices:read", "invoices", "read", "Read invoices"),
    ("invoices:create", "invoices", "create", "Create invoices"),
    ("invoices:update", "invoices", "update", "Update invoices"),
    ("invoices:delete", "invoices", "delete", "Delete invoices"),
    ("invoices:export", "invoices", "export", "Export invoices"),
    ("ledger:read", "ledger", "read", "Read ledger"),
    ("payments:read", "payments", "read", "Read payments"),
    ("payments:create", "payments", "create", "Create payments"),
    ("payments:update", "payments", "update", "Update payments"),
    ("payments:delete", "payments", "delete", "Delete payments"),
    ("payment_details:read", "payment_details", "read", "Read payment details"),
    ("payment_details:create", "payment_details", "create", "Create payment details"),
    ("payment_details:update", "payment_details", "update", "Update payment details"),
    ("payment_details:delete", "payment_details", "delete", "Delete payment details"),
    ("packages:read", "packages", "read", "Read packages"),
    ("packages:write", "packages", "update", "Manage packages"),
    ("package_pricing:read", "package_pricing", "read", "Read package pricing"),
    ("package_pricing:create", "package_pricing", "create", "Create package pricing"),
    ("package_pricing:update", "package_pricing", "update", "Update package pricing"),
    ("package_pricing:delete", "package_pricing", "delete", "Delete package pricing"),
    ("utilities:read", "utilities", "read", "Read utilities"),
    ("utilities:write", "utilities", "update", "Manage utilities"),
    ("reports:read", "reports", "read", "Read reports"),
    ("logs:read", "logs", "read", "Read activity logs"),
    ("audit:read", "audit", "read", "Read audit logs"),
]


ROLES = {
    "super_admin": {
        "description": "Super admin (full access).",
        "permissions": "ALL",
    },
    "admin": {
        "description": "Admin with full operational access.",
        "permissions": "ALL",
    },
    "sales_manager": {
        "description": "KAM/sales manager.",
        "permissions": [
            "customers:read",
            "customers:create",
            "customers:update",
            "customers:export",
            "kam:read",
            "entitlements:read",
            "entitlement_details:read",
            "invoices:read",
            "ledger:read",
            "payments:read",
            "reports:read",
        ],
    },
    "sales_person": {
        "description": "Field/KAM user.",
        "permissions": [
            "customers:read",
            "kam:read",
            "entitlements:read",
            "entitlement_details:read",
            "invoices:read",
            "ledger:read",
        ],
    },
    "billing_manager": {
        "description": "Billing manager.",
        "permissions": [
            "customers:read",
            "kam:read",
            "entitlements:read",
            "entitlements:create",
            "entitlements:update",
            "entitlement_details:read",
            "entitlement_details:create",
            "entitlement_details:update",
            "invoices:read",
            "invoices:create",
            "invoices:update",
            "invoices:export",
            "ledger:read",
            "payments:read",
            "payments:create",
            "payments:update",
            "payment_details:read",
            "payment_details:create",
            "payment_details:update",
            "reports:read",
        ],
    },
    "data_entry": {
        "description": "Data entry officer.",
        "permissions": [
            "customers:read",
            "kam:read",
            "entitlements:read",
            "entitlements:create",
            "entitlements:update",
            "entitlement_details:read",
            "entitlement_details:create",
            "entitlement_details:update",
            "invoices:read",
            "invoices:create",
            "invoices:update",
            "payments:read",
            "payments:create",
            "payment_details:read",
            "payment_details:create",
            "packages:read",
        ],
    },
    "accountant": {
        "description": "Accountant.",
        "permissions": [
            "customers:read",
            "ledger:read",
            "invoices:read",
            "invoices:export",
            "payments:read",
            "payments:create",
            "payments:update",
            "payment_details:read",
            "payment_details:create",
            "payment_details:update",
            "reports:read",
        ],
    },
    "user": {
        "description": "Regular user (read-only core access).",
        "permissions": [
            "customers:read",
            "entitlements:read",
            "invoices:read",
            "ledger:read",
            "payments:read",
            "packages:read",
        ],
    },
}


MENU = [
    {
        "slug": "dashboard",
        "title": "Dashboard",
        "path": "/dashboard",
        "icon": "LayoutDashboard",
        "order": 1,
        "required_permissions": [],
        "children": [],
    },
    {
        "slug": "customers",
        "title": "Customers",
        "path": "/customers",
        "icon": "Users",
        "order": 2,
        "required_permissions": ["customers:read"],
        "children": [],
    },
    {
        "slug": "billing",
        "title": "Billing",
        "path": "/entitlement",
        "icon": "FileText",
        "order": 3,
        "required_permissions": ["entitlements:read"],
        "children": [
            {
                "slug": "invoices",
                "title": "Invoices",
                "path": "/invoices",
                "icon": "Receipt",
                "order": 1,
                "required_permissions": ["invoices:read"],
            },
            {
                "slug": "payments",
                "title": "Payments",
                "path": "/payments",
                "icon": "CreditCard",
                "order": 2,
                "required_permissions": ["payments:read"],
            },
            {
                "slug": "ledger",
                "title": "Ledger",
                "path": "/ledger",
                "icon": "BookOpen",
                "order": 3,
                "required_permissions": ["ledger:read"],
            },
        ],
    },
    {
        "slug": "admin",
        "title": "Administration",
        "path": "/users",
        "icon": "Shield",
        "order": 99,
        "required_permissions": ["users:read"],
        "children": [
            {
                "slug": "roles",
                "title": "Roles",
                "path": "/roles",
                "icon": "Shield",
                "order": 1,
                "required_permissions": ["roles:read"],
            },
            {
                "slug": "activity-logs",
                "title": "Activity Logs",
                "path": "/activity-logs",
                "icon": "Activity",
                "order": 2,
                "required_permissions": ["logs:read"],
            },
            {
                "slug": "audit-logs",
                "title": "Audit Logs",
                "path": "/audit-logs",
                "icon": "ClipboardList",
                "order": 3,
                "required_permissions": ["audit:read"],
            },
        ],
    },
]


DEFAULT_USERS = [
    {"email": "superadmin@isp.local", "username": "superadmin", "role": "super_admin", "is_superuser": True, "is_staff": True},
    {"email": "admin@isp.local", "username": "admin", "role": "admin", "is_superuser": False, "is_staff": True},
    {"email": "billing@isp.local", "username": "billing_manager", "role": "billing_manager", "is_superuser": False, "is_staff": True},
    {"email": "dataentry@isp.local", "username": "data_entry", "role": "data_entry", "is_superuser": False, "is_staff": False},
    {"email": "accountant@isp.local", "username": "accountant", "role": "accountant", "is_superuser": False, "is_staff": False},
    {"email": "kam.manager@isp.local", "username": "sales_manager", "role": "sales_manager", "is_superuser": False, "is_staff": False},
    {"email": "kam.user@isp.local", "username": "sales_person", "role": "sales_person", "is_superuser": False, "is_staff": False},
]


class Command(BaseCommand):
    help = "Seed permissions, roles, menu items, and optional default users for RBAC."

    def add_arguments(self, parser):
        parser.add_argument(
            "--seed-users",
            action="store_true",
            help="Create/update default RBAC users.",
        )
        parser.add_argument(
            "--password",
            default="ChangeMe123!",
            help="Password for seeded users when --seed-users is used.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        code_to_perm = {}
        for codename, resource, action, desc in PERMISSIONS:
            perm, _ = Permission.objects.get_or_create(
                codename=codename,
                defaults={
                    "resource": resource,
                    "action": action,
                    "name": codename.replace(":", " ").title(),
                    "description": desc,
                },
            )
            # Keep definitions synced for existing rows as well
            perm.resource = resource
            perm.action = action
            perm.description = desc
            perm.name = codename.replace(":", " ").title()
            perm.save(update_fields=["resource", "action", "description", "name"])
            code_to_perm[codename] = perm
        self.stdout.write(self.style.SUCCESS(f"Seeded/updated {len(code_to_perm)} permissions"))

        for role_name, meta in ROLES.items():
            role, _ = Role.objects.get_or_create(
                name=role_name,
                defaults={"description": meta["description"], "is_active": True},
            )
            role.description = meta["description"]
            role.is_active = True
            role.save(update_fields=["description", "is_active"])

            role.permissions.clear()
            if meta["permissions"] == "ALL":
                role.permissions.set(Permission.objects.all())
            else:
                role.permissions.set([code_to_perm[c] for c in meta["permissions"] if c in code_to_perm])
        self.stdout.write(self.style.SUCCESS("Seeded/updated roles and permissions"))

        def upsert_menu(item, parent=None):
            entry, _ = MenuItem.objects.get_or_create(
                slug=item["slug"],
                defaults={
                    "title": item["title"],
                    "path": item["path"],
                    "icon": item.get("icon", ""),
                    "order": item.get("order", 0),
                    "parent": parent,
                    "is_active": True,
                },
            )
            entry.title = item["title"]
            entry.path = item["path"]
            entry.icon = item.get("icon", "")
            entry.order = item.get("order", 0)
            entry.parent = parent
            entry.is_active = True
            entry.save()
            entry.required_permissions.clear()
            perms = [code_to_perm[c] for c in item.get("required_permissions", []) if c in code_to_perm]
            if perms:
                entry.required_permissions.add(*perms)
            for child in item.get("children", []):
                upsert_menu(child, parent=entry)

        for root in MENU:
            upsert_menu(root, parent=None)
        self.stdout.write(self.style.SUCCESS("Seeded/updated menu items"))

        if options["seed_users"]:
            password = options["password"]
            for u in DEFAULT_USERS:
                role = Role.objects.get(name=u["role"])
                user, created = User.objects.get_or_create(
                    email=u["email"],
                    defaults={
                        "username": u["username"],
                        "role": role,
                        "is_active": True,
                        "is_staff": u["is_staff"],
                        "is_superuser": u["is_superuser"],
                    },
                )
                user.username = u["username"]
                user.role = role
                user.is_staff = u["is_staff"]
                user.is_superuser = u["is_superuser"]
                user.is_active = True
                user.set_password(password)
                user.save()
                action = "Created" if created else "Updated"
                self.stdout.write(self.style.SUCCESS(f"{action} user: {user.email} [{role.name}]"))

            self.stdout.write(
                self.style.WARNING(
                    "Seed users completed. Change the seeded passwords immediately in non-local environments."
                )
            )

        self.stdout.write(self.style.SUCCESS("RBAC seed completed"))