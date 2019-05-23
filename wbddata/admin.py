from django.contrib import admin

from .models import HUC, WBD, WBDAttributes

admin.site.register(HUC)
admin.site.register(WBD)
admin.site.register(WBDAttributes)