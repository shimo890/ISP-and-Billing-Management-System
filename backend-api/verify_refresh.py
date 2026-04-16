from apps.customers.models import CustomerMaster
from apps.bills.models import CustomerEntitlementMaster, CustomerEntitlementDetails
from apps.package.models import PackageMaster
from decimal import Decimal
from datetime import date

# 1. Setup Data
print("--- Setting up Test Data ---")
customer = CustomerMaster.objects.first()
if not customer:
    print("No customer found for test.")
    exit()

package = PackageMaster.objects.first()
if not package:
    # create dummy package
    package = PackageMaster.objects.create(package_name="Test Package", package_type="bw")

# Create a fresh entitlement
entitlement = CustomerEntitlementMaster.objects.create(
    customer_master_id=customer,
    activation_date=date.today()
)
print(f"Created Entitlement ID: {entitlement.id}")
print(f"Initial Total Bill (In Memory): {entitlement.total_bill}")

# 2. Simulate the 'Stale' State
# We create a detail. The detail's save method triggers 'calculate_total_bill' on the entitlement.
# BUT, that calculation updates the DB row directly using .update(), NOT our 'entitlement' python object.
print("\n--- Triggering Calculation (Creating Detail) ---")
detail = CustomerEntitlementDetails.objects.create(
    cust_entitlement_id=entitlement,
    type='bw',
    package_master_id=package,
    mbps=Decimal('10'),
    unit_price=Decimal('50'),
    start_date=date(2025, 1, 1),
    is_active=True,
    status='active',
    created_by=None
)
print("Detail Created. This triggered 'calculate_total_bill' in the background.")

# 3. Show Stale Value
print(f"\nBefore Refresh - Entitlement Total Bill: {entitlement.total_bill}")
if entitlement.total_bill == 0:
    print("-> NOTICE: It is still 0.0 because this object doesn't know the DB changed!")

# 4. Use refresh_from_db()
print("\n--- Calling entitlement.refresh_from_db() ---")
entitlement.refresh_from_db()

# 5. Show Updated Value
print(f"After Refresh - Entitlement Total Bill: {entitlement.total_bill}")
if entitlement.total_bill > 0:
    print("-> SUCCESS: Now it matches the database value!")

# Cleanup
entitlement.delete()
print("\nTest Complete (Cleanup Done)")
