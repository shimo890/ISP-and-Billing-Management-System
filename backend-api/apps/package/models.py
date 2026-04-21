from django.db import models


class PackageMaster(models.Model):
    """Package Master - Defines available packages"""
    PACKAGE_TYPE_CHOICES = [
        ('bw', 'Bandwidth'),
    ]

    id = models.AutoField(primary_key=True)
    package_name = models.CharField(max_length=200)
    package_type = models.CharField(max_length=20, choices=PACKAGE_TYPE_CHOICES)
    service_name = models.CharField(max_length=200, null=True, blank=True, help_text="Optional business-friendly service category for invoicing and reporting")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'package_master'
        ordering = ['package_name']

    def __str__(self):
        return f"{self.package_name} ({self.get_package_type_display()})"


class PackagePricing(models.Model):
    """Package Pricing - Pricing information for packages"""
    id = models.AutoField(primary_key=True)
    package_master_id = models.ForeignKey(
        PackageMaster,
        on_delete=models.CASCADE,
        db_column='package_master_id',
        related_name='pricings'
    )
    rate = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, help_text="Only for home packages")
    mbps = models.IntegerField(null=True, blank=True, help_text="Bandwidth in Mbps")
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    val_start_at = models.DateField(help_text="Validity start date")
    val_end_at = models.DateField(help_text="Validity end date")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'package_pricing'
        ordering = ['-val_start_at']

    def __str__(self):
        return f"{self.package_master_id.package_name} - {self.val_start_at} to {self.val_end_at}"

