from django.db import models


class UtilityInformationMaster(models.Model):
    """Utility Information Master - Invoice terms, VAT, and other utility information"""
    id = models.AutoField(primary_key=True)
    terms_condition = models.TextField(blank=True)
    vat_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    regards = models.CharField(max_length=200, blank=True)
    remarks = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'utility_information_master'
        ordering = ['-created_at']

    def __str__(self):
        return f"Utility Info #{self.id} - VAT: {self.vat_rate}%"


class UtilityDetails(models.Model):
    """Utility Details - Bank, bKash, Nagad account details"""
    

    id = models.AutoField(primary_key=True)
    utility_master_id = models.ForeignKey(
        UtilityInformationMaster,
        on_delete=models.CASCADE,
        db_column='utility_master_id',
        related_name='details'
    )
    type = models.CharField(max_length=20,)
    name = models.CharField(max_length=200)
    number = models.CharField(max_length=100)
    branch = models.CharField(max_length=200, blank=True)
    routing_no = models.CharField(max_length=50, blank=True)
    swift_no = models.CharField(max_length=50, blank=True)
    remarks = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'utility_details'
        ordering = ['type', 'name']

    def __str__(self):
        return f"{self.type} - {self.name} ({self.number})"

