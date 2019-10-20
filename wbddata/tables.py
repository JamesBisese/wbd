from django.contrib.auth import get_user_model
import django_tables2 as tables

from . import models

class WBDAttributeTable(tables.Table):
    export_formats = ['csv', 'xls']
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    class Meta:
        model = models.WBDAttributes
        template_name = 'django_tables2/bootstrap.html'
        order_by = 'id'
        attrs = {"class": "paleblue"}
