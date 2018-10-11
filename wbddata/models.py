from django.db import models
from django.core.exceptions import ValidationError
import re

# huc_code really needs to be \d{2,8} but users accidentally loose the leading zero when data is opened in MS Excel
def validate_huc_code(value):
    reg = re.compile('^\d{1,8}$')
    if not reg.match(value) :
        raise ValidationError(u'%s huc_code is not valid \d{1,12}' % value)

# huc_code, huc_type, name
class HUC(models.Model):
    huc_code = models.CharField('HUC Code', max_length=8, validators=[validate_huc_code], primary_key=True, default=None, blank=False, null=False)
    huc_type = models.CharField('HUC Category', max_length=25, default=None, blank=False, null=False)
    name = models.CharField('HUC Name', max_length=124, default=None, blank=False, null=False)
    def __str__(self):
        return self.huc_code + ' - ' + self.name

    class Meta:
        ordering = ["huc_code"]

class WBD(models.Model):
    huc_code = models.CharField('HUC Code', max_length=12, primary_key=True, default=None, blank=False, null=False)
    name = models.CharField('HUC12 Name', max_length=124, default=None, blank=False, null=False)
    area_sq_km = models.FloatField("Area km2", default=None, blank=True, null=True)
    water_area_sq_km = models.FloatField("Water Area km2", default=None, blank=True, null=True)
    comid = models.IntegerField("COMID", default=None, blank=True, null=True)
    huc12_ds = models.CharField('Downstream HUC12', max_length=12, default=None, blank=True, null=True)
    distance_km = models.FloatField("Distance down mainstem km", default=None, blank=True, null=True)
    traveltime_hrs = models.FloatField("Travel time down mainstem hrs", default=None, blank=True, null=True)
    multiple_outlet_bool = models.NullBooleanField("Multiple Outlets y/n")
    sink_bool = models.NullBooleanField("Sink y/n")
    headwater_bool = models.NullBooleanField("Headwater y/n")
    terminal_bool = models.NullBooleanField("Terminal y/n")
    terminal_huc12_ds = models.CharField('Terminal HUC12', max_length=12, default=None, blank=True, null=True)
    terminal_outlet_type_code = models.CharField('Terminal Outlet Type', max_length=6, default=None, blank=True, null=True)
    huc12_ds_count_nu = models.IntegerField("HUC12 Downstream Count", default=None, blank=True, null=True)

    def __str__(self):
        return self.huc_code + ' - ' + self.name

    class Meta:
        ordering = ["huc_code"]

