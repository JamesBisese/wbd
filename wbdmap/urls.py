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
from django.urls import path, include

from .views import Index, IndexMap, OldMap, ElevationSlopeMap

"""
    this tag makes all the urls reverse into 'wbdmap:{name}'
"""
app_name = 'wbdmap'

urlpatterns = [
    # path('index/', IndexMap),
    path(settings.IIS_APP_ALIAS , IndexMap, name='index'),
    path(settings.IIS_APP_ALIAS + 'old/', OldMap, name='old'),
    path(settings.IIS_APP_ALIAS + 'slope/', ElevationSlopeMap, name='elevationslope'),

]
