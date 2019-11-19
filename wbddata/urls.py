"""wbdtree URL Configuration

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

from django.urls import path, re_path
from django.conf.urls import url, include

from rest_framework import routers
from rest_framework.documentation import include_docs_urls
# from proxy.views import proxy_view
# from django.views.decorators.csrf import csrf_exempt

from .views import HUCRegionViewSet, HUCSubregionViewSet, \
    HUCAccountingUnitViewSet, HUCCatalogingUnitViewSet, HUCSubwatershedViewSet, \
    csv_view, csv_view2, WBDAtttributeViewSet, WBDAtttributeList, \
    APIJSONDownstreamMetaDataPage,     APIJSONUpstreamMetaDataPage,\
    DownloadAttributesMetaDataPage,\
    DownloadMetrics2016MetaDataPage,\
    DownloadMetrics2017MetaDataPage,\
    DownloadGeographyMetaDataPage

# proxy this request
# @csrf_exempt
# def nldi_proxy(request, huc_code):
# 	extra_requests_args = {}
# 	remoteurl = 'http://cida.usgs.gov/nldi/huc12pp/' + huc_code + '/navigate/UT?distance='
# 	return proxy_view(request, remoteurl, extra_requests_args)

"""
    this tag makes all the urls reverse into 'wbddata:{name}'
"""
app_name = 'wbddata'

urlpatterns = [

    path(r'hum/', csv_view),
    path(r'hum2/', csv_view2),
    re_path(r'hum/(?P<huc_code>\d{2})/', HUCRegionViewSet.as_view({'get': 'csv'}), name='region-csv'),

    path(r'hu2/',  HUCRegionViewSet.as_view({'get': 'list'}),           name='region-ulist'),
    path(r'hu4/',  HUCSubregionViewSet.as_view({'get': 'list'}),        name='subregion-ulist'),
    path(r'hu6/',  HUCAccountingUnitViewSet.as_view({'get': 'list'}),   name='accountingunit-ulist'),
    path(r'hu8/',  HUCCatalogingUnitViewSet.as_view({'get': 'list'}),   name='catalogingunit-ulist'),
    path(r'hu12/', HUCSubwatershedViewSet.as_view({'get': 'list'}),     name='subwatershedvs-ulist'),

    path(r'wbdattributes/', WBDAtttributeViewSet.as_view({'get': 'list'}), name='wbdattributes-ulist'),
    path(r'wbdattributes_list/', WBDAtttributeList.as_view(), name='wbdattributes_list'),

    re_path(r'huc/(?P<huc_code>\d{2})/drilldown/', HUCRegionViewSet.as_view({'get': 'drilldown'}), name='region-drilldown'),
    re_path(r'huc/(?P<huc_code>\d{4})/drilldown/', HUCSubregionViewSet.as_view({'get': 'drilldown'}), name='subregion-drilldown'),
    re_path(r'huc/(?P<huc_code>\d{6})/drilldown/', HUCAccountingUnitViewSet.as_view({'get': 'drilldown'}), name='accountingunit-drilldown'),
    re_path(r'huc/(?P<huc_code>\d{8})/drilldown/', HUCCatalogingUnitViewSet.as_view({'get': 'drilldown'}), name='catalogingunit-drilldown'),

    re_path(r'huc/(?P<huc_code>\d{12})/upstream/', HUCSubwatershedViewSet.as_view({'get': 'upstream'}), name='subwatershed-upstream'),
    re_path(r'huc/(?P<huc_code>\d{12})/downstream/', HUCSubwatershedViewSet.as_view({'get': 'downstream'}), name='subwatershed-downstream'),

    path(r'huc/',  HUCRegionViewSet.as_view({'get': 'list'}), name='region-list'),
    re_path(r'huc/(?P<huc_code>\d{2})/',  HUCRegionViewSet.as_view({'get': 'retrieve'}), name='region-list'),
    re_path(r'huc/(?P<huc_code>\d{4})/', HUCSubregionViewSet.as_view({'get': 'retrieve'}), name='subregion-list'),
    re_path(r'huc/(?P<huc_code>\d{6})/', HUCAccountingUnitViewSet.as_view({'get': 'retrieve'}), name='accountingunit-list'),
    re_path(r'huc/(?P<huc_code>\d{8})/', HUCCatalogingUnitViewSet.as_view({'get': 'retrieve'}), name='catalogingunit-list'),

    re_path(r'huc/(?P<huc_code>\d{12})/',  HUCSubwatershedViewSet.as_view({'get': 'retrieve'}), name='subwatershed-udetail'),

    # re_path(r'nldi/(?P<huc_code>\d{12})', nldi_proxy),
    # alternate methodology
    # path(r'hu12List/', HUCSubwatershedList.as_view(), name='subwatershed-ulist'),

    path(r'api-auth/', include('rest_framework.urls', namespace='wbd_rest_framework')),
    path(r'docs/', include_docs_urls(title='WBD Navigator API',
                                     description="API to explore Hydrologic Unit Codes",
                                     # patterns=['huc/', 'hu12'],
                                     )),

    path(r'metadata/api_downstream', APIJSONDownstreamMetaDataPage.as_view()),
    path(r'metadata/api_upstream', APIJSONUpstreamMetaDataPage.as_view()),
    path(r'metadata/download_attributes', DownloadAttributesMetaDataPage.as_view()),
    path(r'metadata/download_metrics2016', DownloadMetrics2016MetaDataPage.as_view()),
    path(r'metadata/download_metrics2017', DownloadMetrics2017MetaDataPage.as_view()),
    path(r'metadata/download_geography', DownloadGeographyMetaDataPage.as_view())

]


# Routers provide an easy way of automatically determining the URL conf.
# i couldn't get it working
# router = routers.DefaultRouter()
# router.register(r'huc', HUCRegionViewSet, base_name='region')
# # router.register(r'huc', HUCRegionViewSet, base_name='subregion')
# router.register(r'huc', HUCSubregionViewSet, base_name='subregion')
# router.register(r'accountingunit', HUCAccountingUnitViewSet)
# router.register(r'catalogingunit', HUCCatalogingUnitViewSet)

# these are repeated, but use the HU Digit Domain (EPA designatio)
# router.register(r'hu2',                          HUCRegionViewSet,          base_name='region-list')
# #router.register(r'hu2/(?P<hu2>\d{2})/drilldown', HUCRegionViewSet,          base_name='region-drilldown')
# router.register(r'hu4',                          HUCSubregionViewSet,       base_name='subregion-list')
# # router.register(r'hu4/(?P<hu2>\d{4})/drilldown', HUCSubregionViewSet,       base_name='subregion-drilldown')
# router.register(r'hu6',                          HUCAccountingUnitViewSet, base_name='accountingunit-list')
# #router.register(r'hu6/(?P<hu2>\d{6})/drilldown', HUCAccountingUnitViewSet, base_name='accountingunit-drilldown')
# router.register(r'hu8',                          HUCCatalogingUnitViewSet, base_name='catalogingunit-list')
# router.register(r'hu12',                          HUCSubwatershedViewSet, base_name='subwatershed-list')
#router.register(r'hu8/(?P<hu2>\d{8})/drilldown', HUCCatalogingUnitViewSet, base_name='catalogingunit-drilldown')
# ...
#     # path(r'', include(router.urls)),