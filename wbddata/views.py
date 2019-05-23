import datetime
import io
import csv

from django.conf import settings
from django.db.models import IntegerField, BigIntegerField
from django.db.models.functions import Cast
from django.http import Http404, HttpResponse

from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework import status
from rest_framework import generics
from rest_framework import permissions
from rest_framework.decorators import action, api_view, renderer_classes, permission_classes
from rest_framework.pagination import PageNumberPagination

from rest_framework.views import APIView
from rest_framework.settings import api_settings
import rest_framework_csv.renderers

from .models import HUC, WBD, WBDAttributes
from .serializers import HUCSerializer, WBDSerializer, WBDAttributeSerializer
from .pagination import WBDCustomPagination

# from .attributes import Attribute
'''
	'code' can be any string of integers from a Region (2-digits) to a Subwatershed (12-digit)
	If it is lower than a subwatershed it returns data for the next level.  
	If it is a subwatershed, it returns summary data for upstream (default) or downstream navigation
	The terms are defined in https://nhd.usgs.gov/wbd_facts.html

	Watershed Definitions
	Name			Level	Digit	Number of HUCs
	Region			1		2		21
	Subregion		2		4		222
	Basin			3		6		352
	Subbasin		4		8		2,149
	Watershed		5		10		22,000
	Subwatershed	6		12		160,000

    The pagination code comes from 
        https://stackoverflow.com/questions/35625251/how-do-you-use-pagination-in-a-django-rest-framework-viewset-subclass/46173281#46173281

'''


def huc_type(argument):
    switcher = {
        2: "Region",
        4: "Subregion",
        6: "AccountingUnit",
        8: "CatalogingUnit",
        12: "Subwatershed",
    }
    return switcher.get(argument, "Invalid huc_type")

# use this for pre-defined rendering order override
class HuCSVRenderer (rest_framework_csv.renderers.CSVRenderer):
    header = ['huc_code', 'huc_type', 'name']
    labels = {'huc_code':'Code', 'huc_type':'Category', 'name':'Name'}

@api_view(['GET'])
@permission_classes((permissions.AllowAny,))
@renderer_classes((HuCSVRenderer,))
def csv_view(request):
    filename = 'HUC' + '.csv'
    hucs = HUC.objects.all()
    content = [{'huc_code': huc.huc_code,
                'name': huc.name,
                'huc_type': huc.huc_type,
                }
               for huc in hucs]
    return Response(content,
                    content_type='application/vnd.ms-excel',
                    headers={'Content-Disposition': 'attachment; filename="{}"'.format(filename)})

# this will be ordered as it is shown in content
@api_view(['GET'])
@permission_classes((permissions.AllowAny,))
@renderer_classes((rest_framework_csv.renderers.CSVRenderer,))
def csv_view2(request):
    filename = 'HUC2' + '.csv'
    hucs = HUC.objects.all()
    content = [{'huc_code': huc.huc_code,
                'huc_type': huc.huc_type,
                'name': huc.name
                }
               for huc in hucs]
    return Response(content,
                    # development
                    content_type='text/plain',
                    headers={'Content-Disposition': 'inline'},
                    # production
                    # content_type='text/csv',
                    # headers={'Content-Disposition': 'attachment; filename="{}"'.format(filename)}
                    )

'''

    used to overwrite viewset and add one extra pagination thing
    
'''
class mReadOnlyModelViewSet(viewsets.ReadOnlyModelViewSet):
    def get_paginated_data(self, data):
        """
        Return a paginated style `Response` object for the given output data.
        """
        assert self.paginator is not None
        return self.paginator.get_paginated_data(data)

'''

    Base Class for the HUC###ViewSets

'''
class HUCViewSet(viewsets.ReadOnlyModelViewSet):
    """
        HUCView Set
    """
    pagination_class = WBDCustomPagination
    lookup_field = 'huc_code'

    serializer_class = HUCSerializer
    queryset = HUC.objects.all()
    ordering = ('huc_code',)

    huc_code = None
    huc_label = 'Region'
    hudigit = 2

    def get_paginated_data(self, data):
        """
        Return a paginated style `Response` object for the given output data.
        """
        assert self.paginator is not None
        return self.paginator.get_paginated_data(data)

    def get_renderer_context(self):
        context = super().get_renderer_context()

        # start of list of fields to include in output
        context['header'] = (
            self.request.GET['fields'].split(',')
            if 'fields' in self.request.GET else None)

        # comma-separated list of things to exclude from the output
        # things to exclude is a dot.notation that identifies something in the JSON to exclude
        # i.e. exclude=navigation_data or exclude=navigation_data.hu_data.resources (list of url resources)
        context['exclude'] = (
            self.request.GET['exclude'].split(',')
            if 'exclude' in self.request.GET else None)

        return context

    def csv(self, request, *args, **kwargs):
        hucs = HUC.objects.all()
        content = [{'huc_code': huc.huc_code,
                    'huc_type': huc.huc_type,
                    'name': huc.name
                    }
                   for huc in hucs]
        return Response(content,
                        # development
                        content_type='text/plain',
                        headers={'Content-Disposition': 'inline'},
                        # production
                        # content_type='text/csv',
                        # headers={'Content-Disposition': 'attachment; filename="{}"'.format(filename)}
                        )




    '''
        "lists" the Hydrologic Units at the selected hudigit level, with pagination
        regions 01, 02, 03, 04, ...
    '''
    def list(self, request, *args, **kwargs):
        """
        HUCViewSet list - use any HUC CODE (2-digit, 4-digit, 6-digit, 8-digit, 12-digit)

        """
        startTime = datetime.datetime.now()

        navigation_type = 'list'
        if kwargs and 'navigation_type' in kwargs:
            navigation_type = kwargs['navigation_type']

        if request.method == 'GET':
            hudigit_nu = self.hudigit
            if kwargs and 'huc_code' in kwargs:
                self.huc_code = kwargs['huc_code']
                self.queryset = HUC.objects.filter(huc_code__exact=self.huc_code)
                hudigit_nu = len(self.huc_code)

            serializer_context = {
                'request': request,
            }

            serializer = self.get_serializer(self.paginate_queryset(self.queryset), many=True, hudigit_nu=hudigit_nu)

            title = None
            if navigation_type == 'detail':
                title = "2. {} of {}(hu{}) '{}'".format(navigation_type.title(), self.huc_label, self.hudigit, self.huc_code)
            else:
                title = "1. {} of all {}(hu{}) hydrologic units".format(navigation_type.title(), self.huc_label, self.hudigit)

            response = {
                'status': status.HTTP_200_OK,
                'time_elapsed': "{0} seconds".format((datetime.datetime.now() - startTime).total_seconds()),
                'navigation_type': navigation_type,
                'title': title,
                'hudigit_name': self.huc_label,
                'hudigit_nu': self.hudigit,

            }
            # jab -- this is a custom function, and relies on a custom paginator
            custom_data = self.get_paginated_data(serializer.data)

            pager = None
            if 'page_size' in request.query_params or custom_data['next'] or custom_data['previous']:
                pager = {}
                if 'page_size' in request.query_params:
                    pager['page_size'] = request.query_params['page_size']
                else:
                    pager['page_size'] = self.paginator.page_size

                if custom_data['previous']:
                    pager['previous'] = custom_data['previous']
                if custom_data['next']:
                    pager['next'] = custom_data['next']
                    pager['all'] = request.build_absolute_uri() + '?page_size=' + str(custom_data['count'])

            response['navigation_data'] = {}

            if pager:
                response['navigation_data']['pager'] = pager

            response['navigation_data']['download'] = 'TBD'
            response['navigation_data']['results'] = {}
            if navigation_type != 'detail':
                response['navigation_data']['results']['summary_data'] = {'count_nu': custom_data['count']}
            response['navigation_data']['results']['hu_data'] = custom_data['results']


            return Response(response)

    # this just sets a few variables
    # @action(detail=True)
    def retrieve(self, request, *args, **kwargs):
        kwargs['navigation_type'] = 'detail'
        return self.list(request, *args, **kwargs)

    @action(detail=True)
    def drilldown(self, request, *args, **kwargs):
        """
            Drilldown to the next deeper HU level (2 -> 4 -> 6 -> 8 -> 12)

        """
        startTime = datetime.datetime.now()

        if request.method == 'GET':
            # this has to be true - that is how you get into the function
            if kwargs and 'huc_code' in kwargs:
                self.huc_code = kwargs['huc_code']
                hudigit_nu = len(self.huc_code)
                """
                "HU Drilldown from Subregion(4) to AccountingUnit(6)",
                 HU List of Subregion(4) where HUC_CODE match '01*'
                 HU List of all Subregion(4)
                """
                # def huc_type(argument):
                #     switcher = {
                #         2:  "Region",
                #         4:  "Subregion",
                #         6:  "AccountingUnit",
                #         8:  "CatalogingUnit",
                #         12: "Subwatershed",
                #     }
                #     return switcher.get(argument, "Invalid huc_type")

                # bad
                # huc_type_match_tx = huc_type(hudigit_nu + 2)

                parent_queryset = HUC.objects.filter(huc_code__exact=self.huc_code)
                parent_data = self.get_serializer(parent_queryset[0], many=False, hudigit_nu=hudigit_nu).data

                '''
                    get all of the next level-down that start with the huc_code
                '''
                self.queryset = HUC.objects.filter(huc_type__exact=huc_type(hudigit_nu + 2),
                                                   huc_code__startswith=self.huc_code).annotate(
                    huc_code_int=Cast('huc_code', IntegerField())
                ).order_by('huc_code_int', 'huc_code')

                # terrible
                self.huc_label = huc_type(hudigit_nu)
                # ibid
                self.hudigit = hudigit_nu # + 2

            serializer_context = {
                'request': request,
            }

            data = None
            page = request.GET.get('page')
            try:
                page = self.paginate_queryset(self.queryset)
            except Exception as e:
                page = []
                data = page
                return Response({
                    "status": status.HTTP_404_NOT_FOUND,
                    "message": 'No more record.',
                    "data" : data
                    })

            if page is not None:
                serializer = self.get_serializer(page, many=True, hudigit_nu=hudigit_nu)
                # data = serializer.data
                # return self.get_paginated_response(data)
                next_level = self.hudigit + 2
                if next_level == 10:
                    next_level += 2

                response = {
                    'status': status.HTTP_200_OK,
                    'time_elapsed': "{0} seconds".format((datetime.datetime.now() - startTime).total_seconds()),
                    'navigation_type': 'drilldown',
                    'title': "3. Drilldown to {}(hu{}) from {}(hu{}) hydrologic unit '{}'".format(huc_type(next_level), next_level,
                                                                                     self.huc_label, self.hudigit,
                                                                         self.huc_code),
                    "hudigit_name": self.huc_label,
                    "hudigit_nu": self.hudigit,
                    'query_params': {},

                }
                if kwargs and 'huc_code' in kwargs:
                    response['hu_data'] = parent_data

                #jab -- this is a custom function, and relies on a custom paginator
                custom_data = self.get_paginated_data(serializer.data)

                pager = None
                if 'page_size' in request.query_params or custom_data['next'] or custom_data['previous']:
                    pager = {}
                    if 'page_size' in request.query_params:
                        pager['page_size'] = request.query_params['page_size']
                    else:
                        pager['page_size'] = self.paginator.page_size

                    if custom_data['previous']:
                        pager['previous'] = custom_data['previous']
                    if custom_data['next']:
                        pager['next'] = custom_data['next']

                #TODO fix pager
                if custom_data['next'] or custom_data['previous']:
                    response['next'] = custom_data['next']
                    response['previous'] = custom_data['previous']

                response['navigation_data'] = {}

                if pager:
                    response['navigation_data']['pager'] = pager

                response['navigation_data']['download'] = request.build_absolute_uri() + '?format=csv'

                response['navigation_data']['results'] = {}
                response['navigation_data']['results']['summary_data'] = {
                    'count_nu': custom_data['count'],
                    'hudigit_name': self.huc_label,
                    'hudigit_nu': self.hudigit,
                }
                response['navigation_data']['results']['hu_data'] = custom_data['results']


                # apply the 'exclude' filter if it exists
                # if 'exclude' in self.context:
                #     pass


                #
                # now return data
                #
                return Response(response)

            return Response({
                "status": status.HTTP_200_OK,
                "message": 'ERROR RESPONSE A22.564.',
                "data" : data
            })


class HUCRegionViewSet(HUCViewSet):
    """
        HUCRegionViewSet
    """
    queryset = HUC.objects.filter(huc_type__exact="Region").annotate(
        huc_code_int=Cast('huc_code', IntegerField())
    ).order_by('huc_code_int', 'huc_code')
    huc_label = 'Region'
    hudigit = 2
    lookup_field = 'huc_code'

class HUCSubregionViewSet(HUCViewSet):
    """
        HUCSubregionViewSet
    """
    queryset = HUC.objects.filter(huc_type__exact="Subregion").annotate(
        huc_code_int=Cast('huc_code', IntegerField())
    ).order_by('huc_code_int', 'huc_code')
    huc_label = 'Subregion'
    hudigit = 4
    lookup_field = 'huc_code'

class HUCAccountingUnitViewSet(HUCViewSet):
    """
        HUCAccountingUnitViewSet
    """
    queryset = HUC.objects.filter(huc_type__exact="AccountingUnit").annotate(
        huc_code_int=Cast('huc_code', IntegerField())
    ).order_by('huc_code_int', 'huc_code')
    huc_label = 'AccountingUnit'
    hudigit = 6


'''
    this is a bit different in that the results are from WBD, not HUC
'''
class HUCCatalogingUnitViewSet(HUCViewSet):
    """
        HUCCatalogingUnitViewSet
    """
    queryset = HUC.objects.filter(huc_type__exact="CatalogingUnit").annotate(
                    huc_code_int=Cast('huc_code', IntegerField())).order_by('huc_code_int', 'huc_code')
    huc_code = None
    huc_label = 'CatalogingUnit'
    hudigit = 8
    next_level = None
    serializer_class = HUCSerializer

    # this provides the 'drill-down' behavior
    # it is using the WBD instead of the HUC model, since its getting hu12
    @action(detail=True)
    def drilldown(self, request, *args, **kwargs):
        """
            Drilldown to the next deeper HU level (2 -> 4 -> 6 -> 8 -> 12)

        """
        startTime = datetime.datetime.now()



        view_name = 'testing'
        if request.method == 'GET':
            if kwargs and 'huc_code' in kwargs:
                self.huc_code = kwargs['huc_code']
                self.hudigit = len(self.huc_code)

                hudigit_nu = len(self.huc_code)
                parent_queryset = HUC.objects.filter(huc_code__exact=self.huc_code)
                parent_data = self.get_serializer(parent_queryset[0], many=False, hudigit_nu=self.hudigit).data


                self.queryset = WBD.objects.filter(huc_code__startswith=self.huc_code).annotate(
                    huc_code_int=Cast('huc_code', BigIntegerField())
                ).order_by('huc_code_int')

            serializer_context = {
                'request': request,
            }

            data = None

            page = request.GET.get('page')

            try:
                page = self.paginate_queryset(self.queryset)
            except Exception as e:
                page = []
                data = page
                return Response({
                    "status": status.HTTP_404_NOT_FOUND,
                    "message": 'No more record.',
                    "data" : data
                    })

            if page is not None:
                self.serializer_class = WBDSerializer
                serializer = self.get_serializer(page, many=True, hudigit_nu=self.hudigit)

                # # serializer_class = self.get_serializer_class()
                # kwargs['context'] = self.get_serializer_context()
                # si = serializer_class(*args, **kwargs)
                #
                # serializer = si(page, many=True)
                # data = serializer.data
                self.next_level = self.hudigit + 2
                if self.next_level == 10:
                    self.next_level += 2

                response = {
                    'status': status.HTTP_200_OK,
                    'time_elapsed': "{0} seconds".format((datetime.datetime.now() - startTime).total_seconds()),
                    # 'title': "3. Drilldown from {}(hu{}) '{}' to {}(hu{}) ".format(self.huc_label, self.hudigit,
                    #                                                                  self.huc_code,
                    #                                                                  huc_type(self.next_level), self.next_level,
                    #                                                                  ),
                    'title': "3.5. Drilldown to {}(hu{}) within {}(hu{}) '{}' ".format(huc_type(self.next_level), self.next_level,
                                                                                      self.huc_label, self.hudigit,
                                                                                   self.huc_code,

                                                                                   ),
                    'navigation_type': 'drilldown',
                    "hudigit_name": self.huc_label,
                    "hudigit_nu": self.hudigit,
                    'query_params': {},
                    'hu_data': parent_data,
                    'navigation_data': {},
                }
                if kwargs and 'hu8' in kwargs:
                    response['parent'] = kwargs['hu8']

                custom_data = self.get_paginated_data(serializer.data)

                pager = None
                if 'page_size' in request.query_params or custom_data['next'] or custom_data['previous']:
                    pager = {}
                    if 'page_size' in request.query_params:
                        pager['page_size'] = request.query_params['page_size']
                    else:
                        pager['page_size'] = self.paginator.page_size
                    if custom_data['previous']:
                        pager['previous'] = custom_data['previous']
                    if custom_data['next']:
                        pager['next'] = custom_data['next']
                        pager['all'] = request.build_absolute_uri() + '?page_size=' + str(custom_data['count'])


                response['navigation_data'] = {}

                if pager:
                    response['navigation_data']['pager'] = pager

                download = {
                    'resources': {
                        'all': {
                            "title": "14. Download all {} {}(hu{}) within {}(hu{}) '{}'".format(custom_data['count'],
                                                                               huc_type(self.next_level), self.next_level,
                                                                               huc_type(self.hudigit), self.hudigit,
                                                                                self.huc_code),
                            "url": request.build_absolute_uri() + '&TBD',
                        },
                        'page': {
                            "title": "Download current page ({}) {} records".format(len(custom_data['results']), self.huc_label),
                            "url": request.build_absolute_uri() + '&TBD',
                        }
                    }
                }
                if not page or (int(pager['page_size']) >= int(custom_data['count'])):
                    download['resources'].pop('page')

                if int(custom_data['count']) == 0:
                    response['navigation_data'] = None
                else:
                    response['navigation_data']['download'] = download

                    # strip out some of the 'resources' if they are on the parent record
                    results = custom_data['results']
                    for r in results:
                        r['resources'].pop('h2')
                        r['resources'].pop('h4')
                        r['resources'].pop('h6')
                        r['resources'].pop('h8')

                    response['navigation_data']['results'] = {
                        'summary_data': {
                            'count_nu': custom_data['count'],
                            'hudigit_name': huc_type(self.next_level),
                            'hudigit_nu': self.next_level,
                        },
                        # 'pager': pager,
                        'hu_data': results,
                    }

                return Response(response)

            return Response({
                "status": status.HTTP_200_OK,
                "message": 'ERROR RESPONSE A22.334.',
                "data" : data
            })

'''
TODO: not working.  error 'set' object has no attribute 'items'
'''
class WBDAtttributeViewSet(viewsets.ViewSet):
    queryset = WBDAttributes.objects.all().order_by('row_nu')

    serializer_class = WBDAttributeSerializer

    def get_paginated_data(self, data):
        """
        Return a paginated style `Response` object for the given output data.
        """
        assert self.paginator is not None
        return self.paginator.get_paginated_data(data)

    def items(self, request, *args, **kwargs):
        return None

   # this list hu12 HUC12s
    def list(self, request, *args, **kwargs):
        """
        List:
        do something listy

        """
        startTime = datetime.datetime.now()

        if request.method == 'GET':


            serializer_context = {
                'request': request,
            }

            data = None
            page = request.GET.get('page')

            try:
                page = self.paginate_queryset(self.queryset)
            except Exception as e:
                page = []
                data = page
                return Response({
                    "status": status.HTTP_404_NOT_FOUND,
                    "message": 'No more record.',
                    "data" : data
                    })

            # def get_paginated_response(data):
            #     return Response(data)

            if page is not None:
                serializer = self.get_serializer(page, many=True)
                # data = serializer.data
                custom_data = self.get_paginated_response(serializer.data)
                navigation_type = 'list'


                title = None

                response = {
                    'status': status.HTTP_200_OK,
                    'time_elapsed': "{0} seconds".format((datetime.datetime.now() - startTime).total_seconds()),
                    'navigation_type': navigation_type,
                    'title': title,

                }
                response['navigation_data'] = {'download': 'TBD', 'results': {}}
                response['navigation_data']['results']['hu_data'] = custom_data.data['results']

                return Response(response)


            return Response({
                "status": status.HTTP_200_OK,
                "message": 'ERROR RESPONSE A22.335.',
                "data" : data
            })

class HUCSubwatershedViewSet(viewsets.ReadOnlyModelViewSet):
    """
        Hydrologic Unit Subwatershed ViewSet; Hydrologic Unit Name: Subwatershed; Hydrologic Unit Digit: 12

        list:
        List all the HUs matching a given string

        retrieve:
        List a single HU matching a given string
    """

    queryset = WBD.objects.all().annotate(
        huc_code_int=Cast('huc_code', IntegerField())
    ).order_by('huc_code_int', 'huc_code')

    serializer_class = WBDSerializer
    lookup_field = 'huc_code'
    pagination_class = WBDCustomPagination
    huc_code = None
    huc_label = 'Subwatershed'
    hudigit = 12

    def get_paginated_data(self, data):
        """
        Return a paginated style `Response` object for the given output data.
        """
        assert self.paginator is not None
        return self.paginator.get_paginated_data(data)

    # this list hu12 HUC12s
    def list(self, request, *args, **kwargs):
        """
        List:
        do something listy

        """
        startTime = datetime.datetime.now()

        if request.method == 'GET':
            if kwargs and 'huc_code' in kwargs:
                self.huc_code = kwargs['huc_code']
                self.hudigit = len(self.huc_code)

                self.queryset = WBD.objects.filter(huc_code__startswith=self.huc_code).annotate(
                    huc_code_int=Cast('huc_code', BigIntegerField())
                ).order_by('huc_code_int')
                self.huc_label = 'Subwatershed'
                self.hudigit = 12

            serializer_context = {
                'request': request,
            }

            data = None
            page = request.GET.get('page')

            try:
                page = self.paginate_queryset(self.queryset)
            except Exception as e:
                page = []
                data = page
                return Response({
                    "status": status.HTTP_404_NOT_FOUND,
                    "message": 'No more record.',
                    "data" : data
                    })

            # def get_paginated_response(data):
            #     return Response(data)

            if page is not None:
                serializer = self.get_serializer(page, many=True)
                # data = serializer.data
                custom_data = self.get_paginated_response(serializer.data)
                navigation_type = 'list'
                if 'navigation_type' in kwargs:
                    navigation_type = kwargs['navigation_type']

                title = None
                if navigation_type == 'detail':
                    title = "10. {} of {}(hu{}) '{}'".format(navigation_type.title(), self.huc_label, self.hudigit, self.huc_code)
                else:
                    title = "11. {} of all {}(hu{}) hydrologic units".format(navigation_type.title(), self.huc_label, self.hudigit)

                response = {
                    'status': status.HTTP_200_OK,
                    'time_elapsed': "{0} seconds".format((datetime.datetime.now() - startTime).total_seconds()),
                    'navigation_type': navigation_type,
                    'title': title,
                    'hudigit_name': self.huc_label,
                    'hudigit_nu': self.hudigit,
                }
                response['navigation_data'] = {'download': 'TBD', 'results': {}}
                response['navigation_data']['results']['hu_data'] = custom_data.data['results']

                return Response(response)


            return Response({
                "status": status.HTTP_200_OK,
                "message": 'ERROR RESPONSE A22.335.',
                "data" : data
            })

    # @action(detail=True)
    def retrieve(self, request, *args, **kwargs):
        """

        Shortcut for a single HU

        :param request:
        :param args:
        :param kwargs:
        :return:
        """
        kwargs['navigation_type'] = 'detail'
        return self.list(request, *args, **kwargs)

    @action(detail=True)
    def csvfer(self, request, *args, **kwargs):
        """

        Placeholder for CSV output format TBD

        :param request:
        :param args:
        :param kwargs:
        :return:
        """
        return Response({
            "status": status.HTTP_200_OK,
            "message": 'ERROR RESPONSE A22.336.',
            "data": 'TBD'
        })

    @action(detail=True)
    def upstream(self, request, *args, **kwargs):
        """
            Navigate Upstream from the HU

        """
        startTime = datetime.datetime.now()
        self.huc_code = kwargs['huc_code']
        self.hudigit = len(self.huc_code)
        attribute_dict = {}

        wbd = WBD.objects.filter(huc_code__exact=self.huc_code).first()

        if wbd == None:
            raise Http404("No WBD matches the given query.")

        # this contains data about the 'selected' huc (this is the node.  not really the parent of the node!!!)
        parent_data = self.get_serializer(wbd, many=False, hudigit_nu=12).data

        # sanitize the boolean asking to return the list of upstream hu12s and hu8s
        nav_kwargs = {}

        # if huc_data is any of these choices, it is set to true.  Otherwise it is false
        if 'summary_data' in request.query_params:
            nav_kwargs['summary_data'] = request.query_params['summary_data'] in ['true', 'True', 'TRUE', '1', 't', 'y', 'yes']
        if 'huc_data' in request.query_params:
            nav_kwargs['huc_data'] = request.query_params['huc_data'] in ['true', 'True', 'TRUE', '1', 't', 'y', 'yes']
        # ibid hu12_data
        if 'hu12_data' in request.query_params:
            nav_kwargs['hu12_data'] = request.query_params['hu12_data'] in ['true', 'True', 'TRUE', '1', 't', 'y', 'yes']

        if 'hu12_data_format' in request.query_params:
            format = 'list'
            if request.query_params['hu12_data_format'] in ['dic', 'dict', 'dictionary']:
                format = 'dictionary'
            elif request.query_params['hu12_data_format'] in ['str', 'string']:
                format = 'string'
            elif request.query_params['hu12_data_format'] in ['csv', 'CSV']:
                format = 'csv'

            nav_kwargs['hu12_data_format'] = format

        """
            ignore if it is not one of these 'sets'
        """
        available_metric_sets = ['metrics2016', 'metrics2017','geography', ]

        if 'download_attributes' in request.query_params:
            if request.query_params['download_attributes'] in available_metric_sets:
                nav_kwargs['download_attributes'] = request.query_params['download_attributes']
        # alias only
        if 'download_metrics' in request.query_params:
            if request.query_params['download_metrics'] in available_metric_sets:
                nav_kwargs['download_attributes'] = request.query_params['download_metrics']

        if 'huc_navigate' in request.query_params:
            if isinstance(request.query_params['huc_navigate'], int) \
                    and int(request.query_params['huc_navigate']) in (2, 4, 6, 8):
                nav_kwargs = {'huc_navigate': int(request.query_params['huc_navigate']) }

        #TBD fieldsets is a list of tuples. ie [['navigation', ['headwater_bool','terminal_bool']],['geography', ['slope_mean_va','slope_max_va']]]
        if 'fieldsets' in request.query_params:
            #TBD sanitize fieldsets here and remove unrecognized,
            # putting any notes in in a node 'errors', ie. {'unrecognized fieldset': 'navigation'}
            nav_kwargs['fieldsets'] = request.query_params['fieldsets']

        if 'attributes' in request.query_params:

            wbdatts = WBDAttributes()
            attribute_dict = wbdatts.clean_attributes(request.query_params['attributes'])
            for attribute_name in attribute_dict['sanitized']['valid_attributes']:
                att = attribute_dict['sanitized']['valid_attributes'][attribute_name]
                serializer = WBDAttributeSerializer(att)
                attribute_dict['sanitized']['valid_attributes'][attribute_name] = serializer.data

            nav_kwargs['attributes'] = request.query_params['attributes']

        # INTERIM since this is how it used to work
        # attribute_dict = {}
        # if 'attribute' in request.query_params:
        #
        #
        #     nav_kwargs['attribute'] = request.query_params['attribute']


        absolute_uri = request.build_absolute_uri().split('?')[0]
        navigation_data = {'direction': 'upstream',
                           'download': { 'download': {
                                                 'title': "Download WBD Navigation Attributes",
                                                  'url': request.build_absolute_uri() + '?hu12_data_format=csv'
                                             },
                                           'metrics2016': {
                                               'title': "Download U.S. EPA WBD Metrics 2016",
                                               'url': absolute_uri + '?download_attributes=metrics2016'
                                           },
                                           'metrics2017': {
                                               'title': "Download U.S. EPA WBD Metrics 2017",
                                               'url': absolute_uri + '?download_attributes=metrics2017'
                                           },
                                           'geography': {
                                               'title': "Download U.S. EPA WBD Geography Attributes",
                                               'url': absolute_uri + '?download_attributes=geography'
                                           },
                                        },
                           'results': wbd.navigate_upstream(**nav_kwargs) }

        parent_data['headwater_bool'] = navigation_data['results'].pop('headwater_bool', None)
        parent_data['terminal_bool'] = navigation_data['results'].pop('terminal_bool', None)

        # there is no 'navigation_data'
        if parent_data['headwater_bool'] == True:
            navigation_data = None

        """
            TBD return the navigation results as CSV
        """
        if 'hu12_data_format' in request.query_params \
                and request.query_params['hu12_data_format'] in ['csv', 'CSV']:
            return self.response_as_csv(wbd.huc_code, navigation_data['results']['hu12_data'])

        """
            TBD return the navigation results as CSV
        """
        # use the already sanitized thing
        if 'download_attributes' in nav_kwargs \
                and nav_kwargs['download_attributes'] in ['metrics2016',
                                                                 'metrics2017',
                                                                 'geography',]:
            metric_source = nav_kwargs['download_attributes']
            return self.metrics_response_as_csv(wbd.huc_code,
                                                navigation_data['results']['hu12_data'],
                                                metric_source)

        # del(navigation_data['results']['headwater_bool'])
        # del(navigation_data['results']['terminal_bool'])

        return Response({
            "status": status.HTTP_200_OK,
            "time_elapsed": "{0} seconds".format((datetime.datetime.now() - startTime).total_seconds()),
            "navigation_type": 'upstream',
            "title": "12. Navigate upstream from '{}'".format(self.huc_code),
            "attributes": attribute_dict,
            "query_params": request.query_params,
            "hu_data": parent_data,
            "navigation_data": navigation_data,
        })

    # http://127.0.0.1:82/huc/110200020401/upstream/?format=json&hu12_data_format=csv&attributes=area_sq_km,distance_km,huc_name
    def response_as_csv(self, hu12_code, hu12_data):
        """
        placeholder for CSV output

        :param hu12_code:
        :param hu12_data:
        :return:
        """
        # Create the HttpResponse object with the appropriate CSV header.
        filename = 'WBD' + hu12_code + '_upstream_atts.csv'
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="{}"'.format(filename)

        writer = csv.writer(response, quoting=csv.QUOTE_NONE)
        field_list = hu12_data['fields'].keys()
        writer.writerow(field_list)

        writer = csv.writer(response, quoting=csv.QUOTE_NONNUMERIC)
        for row in hu12_data['hu12_list']:
            writer.writerow(row)

        return response

    def metrics_response_as_csv(self, hu12_code, hu12_data, metric_source):
        """
        placeholder for CSV output

        :param hu12_code:
        :param hu12_data:
        :return:
        """



        # Create the HttpResponse object with the appropriate CSV header.
        filename = 'WBD' + hu12_code + '_upstream_' + metric_source + '.csv'
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="{}"'.format(filename)

        writer = csv.writer(response, quoting=csv.QUOTE_NONE)
        field_list = hu12_data['fields'].keys()
        writer.writerow(field_list)

        writer = csv.writer(response, quoting=csv.QUOTE_NONNUMERIC)
        for row in hu12_data['metrics_data']:
            writer.writerow(row)

        return response

    @action(detail=True)
    def downstream(self, request, *args, **kwargs):
        """
            Navigate downstream from the HU to the terminal HU

        """
        startTime = datetime.datetime.now()

        self.huc_code = kwargs['huc_code']
        self.hudigit = len(self.huc_code)

        wbd = WBD.objects.filter(huc_code__exact=self.huc_code).first()
        if wbd == None:
            raise Http404("No WBD matches the given query.")

        parent_data = self.get_serializer(wbd, many=False, hudigit_nu=self.hudigit).data

        # sanitize the boolean asking to return the list of upstream hu12s and hu8s
        nav_kwargs = {}

        # if huc_data is any of these choices, it is set to true.  Otherwise it is false
        if 'summary_data' in request.query_params:
            nav_kwargs['summary_data'] = request.query_params['summary_data'] in ['true', 'True', 'TRUE', '1', 't', 'y',
                                                                                  'yes']
        if 'huc_data' in request.query_params:
            nav_kwargs['huc_data'] = request.query_params['huc_data'] in ['true', 'True', 'TRUE', '1', 't', 'y', 'yes']
        # ibid hu12_data
        if 'hu12_data' in request.query_params:
            nav_kwargs['hu12_data'] = request.query_params['hu12_data'] in ['true', 'True', 'TRUE', '1', 't', 'y',
                                                                            'yes']

        if 'hu12_data_format' in request.query_params:
            format = 'list'
            if request.query_params['hu12_data_format'] in ['dic', 'dict', 'dictionary']:
                format = 'dictionary'
            elif request.query_params['hu12_data_format'] in ['str', 'string']:
                format = 'string'
            elif request.query_params['hu12_data_format'] in ['metrics',]:
                format = 'metrics'
            nav_kwargs['hu12_data_format'] = format

        if 'huc_navigate' in request.query_params:
            if isinstance(request.query_params['huc_navigate'], int) \
                    and int(request.query_params['huc_navigate']) in (2, 4, 6, 8):
                nav_kwargs = {'huc_navigate': int(request.query_params['huc_navigate'])}

        if 'hu12_data_fields' in request.query_params:
            nav_kwargs['hu12_data_fields'] = request.query_params['hu12_data_fields']

        download_url = request.build_absolute_uri() + '&hu12_data_format=csv'
        navigation_data = {'direction': 'downstream',
                           'download_url': download_url,
                           'results': wbd.navigate_downstream(**nav_kwargs)}

        #TODO debug internal drainage issue for 160203081300 and great salt lake

        parent_data['headwater_bool'] = navigation_data['results'].pop('headwater_bool', None)
        parent_data['terminal_bool'] = navigation_data['results'].pop('terminal_bool', None)

        # there is no 'navigation_data' TBD: should it be called navigation_results, or just results? (if results, need to rename results.results)
        if parent_data['terminal_bool'] == True:
            navigation_data = None

        return Response({
            "status": status.HTTP_200_OK,
            "time_elapsed": "{0} seconds".format((datetime.datetime.now() - startTime).total_seconds()),
            "navigation_type": 'downstream',
            "title": "13. Navigate downstream from '{}' to '{}'".format(self.huc_code,
                                                                        parent_data['terminal_hu12_ds']['huc_code']),
            "query_params": request.query_params,
            "hu_data": parent_data,
            "navigation_data": navigation_data
        })


# class PageNumberPaginationDataOnly(PageNumberPagination):
#     # Set any other options you want here like page_size
#
#     def get_paginated_response(self, data):
#         return Response(data)

# class HUCSubwatershedList(generics.ListAPIView):
#     serializer_class = WBDSerializer
#
#     def get_queryset(self):
#         """
#         Optionally restricts the returned HU12 (WBD),
#         by filtering against a query parameter in the URL.
#         """
#         queryset = WBD.objects.all()
#         huc_code = None
#         if 'hu12' in self.kwargs:
#             huc_code = self.kwargs['hu12']
#         elif 'huc_code' in self.kwargs:
#             huc_code = self.kwargs['huc_code']
#         if huc_code:
#             if len(huc_code) == 12:
#                 queryset = queryset.filter(huc_code__exact=huc_code)
#                 paginate_by = None
#                 paginate_by_param = None
#             else:
#                 queryset = queryset.filter(huc_code__startswith=huc_code)
#
#         return queryset