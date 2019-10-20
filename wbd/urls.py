"""wbd URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/2.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.contrib import admin
from django.urls import path, include
from django.contrib.auth.views import LoginView
from rest_framework import routers

from . import views

from wbddata.views import WBDAtttributeViewSet

"""
    this tag makes all the urls reverse into 'wbd:{name}'
"""
app_name = 'wbd'

router = routers.DefaultRouter()
router.register(r'wbdattributes', WBDAtttributeViewSet)

urlpatterns = [

    path(settings.IIS_APP_ALIAS + 'api/', include(router.urls)),

    path(settings.IIS_APP_ALIAS + 'admin/', admin.site.urls),
    path(settings.IIS_APP_ALIAS + r'accounts/login/',
        LoginView.as_view(
            template_name='admin/login.html',
            extra_context={
                'title': 'Login',
                'site_title': 'My Site',
                'site_header': 'My Site Login'}),
        name='login'),
    path(settings.IIS_APP_ALIAS + r'api-auth/', include('rest_framework.urls')),
    path(settings.IIS_APP_ALIAS + 'chart/', include('wbdchart.urls')),
    path(settings.IIS_APP_ALIAS + 'map/', include('wbdmap.urls')),
    path(settings.IIS_APP_ALIAS, include('wbddata.urls')),

    path(settings.IIS_APP_ALIAS + '', views.HomePage.as_view(), name='home'),
]
