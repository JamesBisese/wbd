import os
import sys
import operator
import re
import datetime
import json
import io
import csv
import logging
import pickle
import msgpack
import decimal

from django.db import models
from django.core.exceptions import ValidationError
from django.conf import settings
from django.core.cache import cache, caches

from anytree import Node, RenderTree
from anytree.exporter import JsonExporter, DictExporter
from anytree.walker import Walker
import anytree.search

# from .manager import WBDNavigatorManager

from .attributes import Attribute

logger = logging.getLogger('wbddata.models')


def validate_huc_code(value):
    reg = re.compile('^\d{1,8}$')
    if not reg.match(value):
        raise ValidationError(u'%s huc_code is not valid \d{1,12}' % value)


"""

    hold all Hydrologic Unit Code records
    
    this includes everything from Region to Watershed (HU2 to HU8), 
        but does not contain HU12 subwatershed

"""


class HUC(models.Model):
    huc_code = models.CharField('HUC Code', primary_key=False, unique=True, max_length=8,
                                validators=[validate_huc_code], default=None, blank=False, null=False)
    huc_type = models.CharField('HUC Category', max_length=25, default=None, blank=False, null=False)
    name = models.CharField('HUC Name', max_length=124, default=None, blank=False, null=False)

    def __str__(self):
        return self.huc_code + ' - ' + self.name

    class Meta:
        ordering = ["huc_code"]


"""

    hold all Watershed Boundary Dataset (WBD) records

    this includes HU12 subwatershed

"""


class WBD(models.Model):

    #display for terminal_outlet_type_code

    TERMINAL_OUTLET_CHOICES = ( (-2, 'Mexico'),
                                (-3, 'Canada'),
                                (-4, 'Atlantic Ocean'),
                                (-5, 'Pacific Ocean'),
                                (-6, 'Gulf of Mexico'),
                                (-7, 'Lake Superior'),
                                (-8, 'Lake St. Clair'),
                                (-9, 'Lake Ontario'),
                                (-10, 'Lake Michigan'),
                                (-11, 'Lake Erie'),
                                (-12, 'Lake Huron'),
                                (-13, 'Sink'),
                                )

    huc_code = models.CharField('HUC Code', primary_key=False, unique=True, max_length=12, default=None, blank=False,
                                null=False)
    name = models.CharField('HUC12 Name', max_length=124, default=None, blank=False, null=False)
    area_sq_km = models.FloatField("Area km2", default=None, blank=True, null=True)
    water_area_sq_km = models.FloatField("Water Area km2", default=None, blank=True, null=True)
    comid = models.IntegerField("COMID", default=None, blank=True, null=True)
    #TODO: mis-named.  this contains a huc_code, should be hu12_ds_huc_code
    huc12_ds = models.CharField('Downstream HUC12', max_length=12, default=None, blank=True, null=True)
    distance_km = models.FloatField("Distance down mainstem km", default=None, blank=True, null=True)
    # traveltime_hrs = models.FloatField("Travel time down mainstem hrs", default=None, blank=True, null=True)
    multiple_outlet_bool = models.NullBooleanField("Multiple Outlets y/n")
    sink_bool = models.NullBooleanField("Sink y/n")
    headwater_bool = models.NullBooleanField("Headwater y/n")
    terminal_bool = models.NullBooleanField("Terminal y/n")
    #TODO: ibid.  should be terminal_hu12_ds_huc_code
    terminal_huc12_ds = models.CharField('Terminal HUC12', max_length=12, default=None, blank=True, null=True)
    terminal_outlet_type_code = models.IntegerField('Terminal Outlet Type', choices=TERMINAL_OUTLET_CHOICES, default=None, blank=True, null=True)
    hu12_ds_count_nu = models.IntegerField("HUC12 Downstream Count", default=None, blank=True, null=True)

    # WHATnavigation_tree = WBDNavigatorManager()
    navigation_tree = None

    node_navigation_tree = None

    # Here are some example HUC12s for testing
    #   	huc12_id = '110200010709' # arkansas river in Salida.
    #  	huc12_id = '110200020401' # downriver near canyon
    #  	huc12_id = '110200050904' # farther downriver near La Junta (upstream 354; time 0.702)
    #  	huc12_id = '110300100207' # even farther near Witchita KS  (upstream nav_results count_nu: 1017; HUC12
    #  	processes Time: 0:00:00.227)
    #  	huc12_id = '080701000103' # mississippi river way down
    #  	huc12_id = '080701000104' # mississippi river further way down (upstream nav_results count_nu: 31204; HUC12
    #  	processes Time: 0:01:40.551)
    # 	huc12_id = '080901000207' # Pass a Loutre.  bottom of mississippii. 31210 upstream HUC12s.  1/2 second to
    # 	navigate
    # 	huc12_id = '100200010601' # Cabin Creek.  this is  a headwater HUC12, that goes 5948.103 km downriver

    def __str__(self):
        return self.huc_code + ' - ' + self.name

    '''
        WBD - HUC 12 navigation.  loads into self.navigation_tree
    
        TODO: I think this is supposed to be in a manager since it is not really working directly
        with the model
    '''

    def init_wbd_navigation_tree(self):

        # pickle_huc_file = r"C:\inetpub\wwwdjango\wbdtree\static\data\april_navigator_huc12.p"

        startTime = datetime.datetime.now()

        if self.navigation_tree is not None:
            logger.debug(
                " self.navigation_tree in memory %s seconds" % (datetime.datetime.now() - startTime).total_seconds())
            return

        # this is an alternate to pickle file
        cache1 = caches['wbddata.navigation']
        force_refresh_cache = False

        if not force_refresh_cache == True:
            self.navigation_tree = cache1.get('navigation_tree')
            if self.navigation_tree is not None:
                logger.debug("read from cache1 in %s seconds" % (datetime.datetime.now() - startTime).total_seconds())

                return
            else:
                logger.debug("navigation_tree is not cached yet. starting at %s seconds" % (datetime.datetime.now() - startTime).total_seconds())

        """
            TODO: this should be a Node() and used as the base node
            i.e. self.navigation_tree = Node('base')
            and then the 13 terminal node types should be children.
            then all the rest are children of those terminal node types
        """
        self.navigation_tree = {}

        # self.node_navigation_tree = Node("ROOT")
        # for tup in self.TERMINAL_OUTLET_CHOICES:
        #     self.navigation_tree[tup[0]] = Node(name=tup[0],
        #                                         parent=self.node_navigation_tree,
        #                                         huc_name=tup[1])


        # self.node_navigation_tree = Node("ULTIMATE ROOT")

        #

        navs = HuNavigator.objects.all()

        # build an array of the wbd objects since we need to refer to it frequently
        wbds = WBD.objects.all()
        wbd_dict = {}
        for wbd in wbds:
            wbd_dict[wbd.huc_code] = wbd

        try:
            for nav in navs:
                child = nav.upstream_huc_code
                parent = nav.huc_code

                """
                parent -> child
                from -> to
                huc12_ds > huc12
                """

                # skip 3 cases where the parent is equal the child is in the table
                if child == parent:
                    continue

                if not parent in self.navigation_tree:
                    self.navigation_tree[parent] = \
                        Node(
                            name=parent,
                            huc_name=wbd_dict[parent].name,
                            area_sq_km=wbd_dict[parent].area_sq_km,
                            water_area_sq_km=wbd_dict[parent].water_area_sq_km,
                            distance_km=wbd_dict[parent].distance_km,
                            headwater_bool=wbd_dict[parent].headwater_bool,
                            terminal_outlet_type_code=wbd_dict[parent].terminal_outlet_type_code,
                        )

                if child in self.navigation_tree:
                    self.navigation_tree[child].parent = self.navigation_tree[parent]
                else:
                    self.navigation_tree[child] = \
                        Node(
                            name=child,
                            parent=self.navigation_tree[parent],
                            huc_name=wbd_dict[child].name,
                            area_sq_km=wbd_dict[child].area_sq_km,
                            water_area_sq_km=wbd_dict[child].water_area_sq_km,
                            distance_km=wbd_dict[child].distance_km,
                            headwater_bool=wbd_dict[parent].headwater_bool,
                            terminal_outlet_type_code=wbd_dict[parent].terminal_outlet_type_code,
                        )

            # using file based disk cache.  fancy stuff
            logger.debug("navigation_tree is ready to store at %s seconds" % (datetime.datetime.now() - startTime).total_seconds())

            logger.debug("storing data in cache1 at %s seconds" % (datetime.datetime.now() -
                                                                   startTime).total_seconds())
            sys.setrecursionlimit(10000)

            cache1.set('navigation_tree', self.navigation_tree, timeout=None)

            logger.debug("done storing in cache1 at %s seconds" % (datetime.datetime.now() -
                                                                   startTime).total_seconds())

            # TODO: dump this navigation_tree into a pickle file and then compare timing of that vs cache  # NOTE:
        #  there is no upstream and downstream navigation in this model - it is a tree, and then the  # code either
        #  navigates upstream or downstream  # # start pickle  # if os.path.exists(pickle_huc_file):  #     os.remove(
        #  pickle_huc_file)  # if not os.path.exists(pickle_huc_file):  #     sys.setrecursionlimit(10000)  #
        #  pickle.dump([self.navigation_tree], open(pickle_huc_file, 'wb'), pickle.HIGHEST_PROTOCOL)  #
        #  logger.debug("created pickle file fresh\n\t%s" % (pickle_huc_file))  # logger.debug(" Read in %s seconds" %
        #  (datetime.datetime.now() - startTime).total_seconds())  # # end pickle
        except:
            logger.critical('failed to initialize navigation')
            raise

    '''
        HUC - 2, 4, 6, or 8 navigation


    '''

    def init_huc_navigation_tree(self, node):
        root_node = node

        # build an array of the wbd objects since we need to refer to it frequently
        hucs = HUC.objects.all()
        huc_dict = {}
        for huc in hucs:
            huc_dict[huc.huc_code] = huc

        def get_area(node):
            return (node.area_sq_km or 0) + sum(get_area(child) for child in node.children)

        def get_state_fip_codes(obj):
            state_codes_tx = obj.name[obj.name.find("(") + 1:obj.name.find(")")]
            return state_codes_tx.split(",")

        hu8 = {}
        hu6 = {}
        hu4 = {}
        hu2 = {}

        # if not root_node.name in hu2:
        #     hu2[root_node.name] = Node(root_node.name)

        for child in node.descendants:
            parent = child.parent

            h8_parent_name = parent.name[0:8]
            h8_child_name = child.name[0:8]

            h6_parent_name = parent.name[0:6]
            h6_child_name = child.name[0:6]

            h4_parent_name = parent.name[0:4]
            h4_child_name = child.name[0:4]

            h2_parent_name = parent.name[0:2]
            h2_child_name = child.name[0:2]

            if h8_parent_name != h8_child_name:
                if not h8_parent_name in hu8:
                    hu8[h8_parent_name] = Node(h8_parent_name, huc_name=huc_dict[h8_parent_name].name,
                                               state_fip_codes=get_state_fip_codes(huc_dict[h8_parent_name]),
                                               upstream_area_sq_km=decimal.Decimal("{:.2f}".format(get_area(
                                                   parent))), )

                if h8_child_name in hu8:
                    try:
                        hu8[h8_child_name].parent = hu8[h8_parent_name]
                    except:
                        pass
                else:
                    hu8[h8_child_name] = Node(h8_child_name, parent=hu8[h8_parent_name],
                                              huc_name=huc_dict[h8_child_name].name,
                                              state_fip_codes=get_state_fip_codes(huc_dict[h8_child_name]),
                                              upstream_area_sq_km=decimal.Decimal("{:.2f}".format(get_area(child))), )
            ## hu6 #########################
            if h6_parent_name != h6_child_name:
                if not h6_parent_name in hu6:
                    hu6[h6_parent_name] = Node(h6_parent_name, huc_name=huc_dict[h6_parent_name].name,
                                               state_fip_codes=get_state_fip_codes(huc_dict[h6_parent_name]),
                                               upstream_area_sq_km=decimal.Decimal("{:.2f}".format(get_area(
                                                   parent))), )
                if h6_child_name in hu6:
                    try:
                        hu6[h6_child_name].parent = hu6[h6_parent_name]
                    except:
                        pass
                else:
                    hu6[h6_child_name] = Node(h6_child_name, parent=hu6[h6_parent_name],
                                              huc_name=huc_dict[h6_child_name].name,
                                              state_fip_codes=get_state_fip_codes(huc_dict[h6_child_name]),
                                              upstream_area_sq_km=decimal.Decimal("{:.2f}".format(get_area(child))), )
            elif not h6_parent_name in hu6:
                hu6[h6_parent_name] = Node(h6_parent_name, huc_name=huc_dict[h6_parent_name].name,
                                           upstream_area_sq_km=decimal.Decimal("{:.2f}".format(get_area(parent))), )
            ## hu4 #########################
            if h4_parent_name != h4_child_name:
                if not h4_parent_name in hu4:
                    hu4[h4_parent_name] = Node(h4_parent_name, huc_name=huc_dict[h4_parent_name].name,
                                               state_fip_codes=get_state_fip_codes(huc_dict[h4_parent_name]),
                                               upstream_area_sq_km=decimal.Decimal("{:.2f}".format(get_area(
                                                   parent))), )
                if h4_child_name in hu4:
                    try:
                        hu4[h4_child_name].parent = hu4[h4_parent_name]
                    except:
                        pass
                else:
                    hu4[h4_child_name] = Node(h4_child_name, parent=hu4[h4_parent_name],
                                              huc_name=huc_dict[h4_child_name].name,
                                              state_fip_codes=get_state_fip_codes(huc_dict[h4_child_name]),
                                              upstream_area_sq_km=decimal.Decimal("{:.2f}".format(get_area(child))), )
            elif not h4_parent_name in hu4:
                hu4[h4_parent_name] = Node(h4_parent_name, huc_name=huc_dict[h4_parent_name].name,
                                           upstream_area_sq_km=decimal.Decimal("{:.2f}".format(get_area(parent))), )

            ## hu2 #########################
            if h2_parent_name != h2_child_name:
                if not h2_parent_name in hu2:
                    hu2[h2_parent_name] = Node(h2_parent_name, huc_name=huc_dict[h2_parent_name].name,
                                               state_fip_codes=get_state_fip_codes(huc_dict[h2_parent_name]),
                                               upstream_area_sq_km=decimal.Decimal("{:.2f}".format(get_area(
                                                   parent))), )

                if h2_child_name in hu2:
                    hu2[h2_child_name].parent = hu2[h2_parent_name]
                else:
                    hu2[h2_child_name] = Node(h2_child_name, parent=hu2[h2_parent_name],
                                              huc_name=huc_dict[h2_child_name].name,
                                              state_fip_codes=get_state_fip_codes(huc_dict[h2_child_name]),
                                              upstream_area_sq_km=decimal.Decimal("{:.2f}".format(get_area(child))), )
            elif not h2_parent_name in hu2:
                hu2[h2_parent_name] = Node(h2_parent_name, huc_name=huc_dict[h2_parent_name].name,
                                           upstream_area_sq_km=decimal.Decimal("{:.2f}".format(get_area(parent))), )

        """
        
        TODO: at this point, you have HU2 - HU8 navigation trees!!!!!!!!!
        And I didn't even remember it
        
        """
        return {"hu8": hu8, "hu6": hu6, "hu4": hu4, "hu2": hu2}

    def huc_navigate(self, huc_navigation_tree, hu_digit):

        huc_nodes = self.init_huc_navigation_tree(huc_navigation_tree)

        exporter = DictExporter()

        return {'hydrologic_digit': 'hu' + str(hu_digit),
                'data': exporter.export(huc_nodes['hu' + str(hu_digit)][self.huc_code[0:hu_digit]])}

    def get_downstream_distance(self, node):
        distance_km = 0
        for n in node.ancestors:
            node_distance = node.distance_km
            if node_distance == -9999:
                node_distance = 0
            distance_km += node_distance
        return distance_km

    def navigate_upstream(self, *args, **kwargs):

        startTime = datetime.datetime.now()

        self.init_wbd_navigation_tree()

        logger.debug("init is done in %s seconds" % (datetime.datetime.now() - startTime).total_seconds())

        def get_distance(node):
            return (0 if node.distance_km < 0 else node.distance_km or 0) + sum(get_distance(child) for child in node.children)

        def get_headwater_count(node):
            return (1 if node.is_leaf else 0) + sum(get_headwater_count(child) for child in node.children)

        def get_area(node):
            return (node.area_sq_km or 0) + sum(get_area(child) for child in node.children)

        def get_water_area(node):
            return (node.water_area_sq_km or 0) + sum(get_water_area(child) for child in node.children)

        def get_PFOR_sum(node, attribute_nm):
            # print ("{} - {} -- {} --{}".format(node.name,
            #                               node.PFOR if hasattr(node, attribute_nm) else "NA",
            #                               getattr(node, attribute_nm) if hasattr(node, attribute_nm) else "NA2",
            #                               getattr(node, attribute_nm) if (hasattr(node, attribute_nm) and getattr(node, attribute_nm).isnumeric()) else 1)
            #        )
            return (float(getattr(node, attribute_nm)) if hasattr(node, attribute_nm) and float(getattr(node, attribute_nm)) else 1) + sum(get_PFOR_sum(child, attribute_nm) for child in node.children)

        """
            this computes a direct sum of the attribute
        """
        def get_attribute_sum(node, attribute_nm):
            return (float(getattr(node, attribute_nm)) if hasattr(node, attribute_nm) and float(getattr(node, attribute_nm)) else 0) + sum(get_attribute_sum(child, attribute_nm) for child in node.children)

        """
            this computes a direct sum of the attribute
        """
        def get_attribute_avg(node, attribute_nm):
            return (node.area_sq_km/float(getattr(node, attribute_nm))
                    if hasattr(node, attribute_nm) and float(getattr(node, attribute_nm)) and node.area_sq_km
                    else 0) + sum(get_attribute_sum(child, attribute_nm) for child in node.children)

        def average(a):
            if len(a) == 1:
                return a[0]
            else:
                n = len(a)
                return (a[0] + (n - 1) * average(a[1:])) / n

        def get_average(node, attribute_nm):
            nvalues = []
            for n in node.descendants:
                value_tx = getattr(n, attribute_nm)
                try:
                    value_va = float(value_tx)
                    nvalues.append(value_va)
                except ValueError:
                    logger.error("unable to cast '{}' as float".format(value_tx))




            return average(nvalues)

        try:
            huc_navigation_tree = self.navigation_tree[self.huc_code]
        except KeyError as err:
            logger.error('Unable to find huc_code=={} in navigation_tree'.format(self.huc_code))
            return { 'Error': 'Unable to find huc_code=={} in navigation_tree'.format(self.huc_code), }

        if 'huc_navigate' in kwargs and kwargs['huc_navigate']:
            """
                do the HUC (hu2 through hu8) navigation and return the results
            """
            return self.huc_navigate(huc_navigation_tree, kwargs['huc_navigate'])

        # dict['navigation_data']['results'] = data

        # NOTE: these 2 get moved into the parent_data to overwrite the stored values
        data = {'headwater_bool': huc_navigation_tree.is_leaf,
                'terminal_bool': huc_navigation_tree.is_root, }

        # trying to put real headwater_bool in nodes instead of using pregenerated headwater_bool
        huc_navigation_tree.headwater_bool = huc_navigation_tree.is_leaf

        if huc_navigation_tree.parent is not None:
            data['huc12_ds'] = {'huc_code': huc_navigation_tree.parent.name,
                                'name': huc_navigation_tree.parent.huc_name}

        # TODO: rename 'name' as 'huc_code'.  I think it is using a attriter or childiter during the export

        if not huc_navigation_tree.is_root:
            data['terminal_huc12_ds'] = {'huc_code': huc_navigation_tree.root.name,
                'name': huc_navigation_tree.root.huc_name, 'distance_km': self.get_downstream_distance(huc_navigation_tree)}

        """
            RETURN!!!  at a headwater - navigating upstream. there are no results
        """
        if huc_navigation_tree.is_leaf:

            attribute_obj = None
            if 'attribute_field_nm' in kwargs:
                attribute_obj = WBDAttributes.objects.filter(field_nm=kwargs['attribute_field_nm'])[0]
                # this adds the attribute data to each node (slow though)

                Attribute().navigation_metrics(huc_navigation_tree, attribute_obj)

                field_nm = attribute_obj.field_nm
                if attribute_obj.units_tx == '%' and attribute_obj.statistic_cd == 'sum':
                    sum_va = getattr(huc_navigation_tree, field_nm)
                    area_va = get_area(huc_navigation_tree) - huc_navigation_tree.area_sq_km
                    sum_va = 100 * sum_va / area_va
                elif attribute_obj.units_tx == '%' and attribute_obj.statistic_cd == 'average':
                    sum_va = getattr(huc_navigation_tree, field_nm)
                elif attribute_obj.units_tx == 'inches per year' and attribute_obj.statistic_cd == 'average':
                    sum_va = getattr(huc_navigation_tree, field_nm)
                elif attribute_obj.statistic_cd == 'average':
                    sum_va = getattr(huc_navigation_tree, field_nm)
                else:
                    sum_va = get_attribute_sum(huc_navigation_tree, field_nm)

                sum_va = round(float(sum_va), 2)

                data['aggregated_attribute'] = {
                    'attribute_field_nm': kwargs['attribute_field_nm'],
                    # 'attribute_meta': attribute_obj,
                    'result_va': sum_va
                }


            return data

        for node in huc_navigation_tree.descendants:
            node.headwater_bool = node.is_leaf

        logger.debug("huc_navigation_tree ready at %s seconds" % (datetime.datetime.now() - startTime).total_seconds())

        """
        
        2019-08-26 figure out how to add in the 'Specific Indicator to Aggregate'
        
        """
        attribute_obj = None
        if 'attribute_field_nm' in kwargs:
            attribute_obj = WBDAttributes.objects.filter(field_nm=kwargs['attribute_field_nm'])[0]
            # this adds the attribute data to each node (slow though)



            Attribute().navigation_metrics(huc_navigation_tree, attribute_obj)

            field_nm = attribute_obj.field_nm
            if attribute_obj.units_tx == '%' and attribute_obj.statistic_cd == 'sum':
                sum_va = get_attribute_avg(huc_navigation_tree, field_nm)
                area_va = get_area(huc_navigation_tree) - huc_navigation_tree.area_sq_km
                sum_va = 100 * sum_va / area_va
            elif attribute_obj.units_tx == '%' and attribute_obj.statistic_cd == 'average':
                sum_va = get_average(huc_navigation_tree, field_nm)
            elif attribute_obj.units_tx == 'inches per year' and attribute_obj.statistic_cd == 'average':
                sum_va = get_average(huc_navigation_tree, field_nm)
            elif attribute_obj.statistic_cd == 'average':
                sum_va = get_average(huc_navigation_tree, field_nm)
            else:
                sum_va = get_attribute_sum(huc_navigation_tree, field_nm)

            sum_va = round(sum_va, 2)

            data['aggregated_attribute'] = {
                'attribute_field_nm': kwargs['attribute_field_nm'],
                # 'attribute_meta': attribute_obj,
                'result_va': sum_va
            }
            if 'attribute_only' in kwargs:
                return data

        upstream_hu12_set = set()

        for node in huc_navigation_tree.descendants:
            upstream_hu12_set.add(node.name)

        upstream_hu12_set_len = len(upstream_hu12_set)

        logger.debug(
            "finished looping for hu12 sets at %s seconds" % (datetime.datetime.now() - startTime).total_seconds())

        # trigger for including/excluding these lists - this is included by default
        if not 'summary_data' in kwargs \
            or ('summary_data' in kwargs and kwargs['summary_data'] == True):
            data['summary_data'] = {'hu12_count_nu': None,
                                    'sum_distance_km': None,
                                    'headwater_count_nu': None,
                                    'area_sq_km': None,
                                    'water_area_sq_km': None, }

            if not data['headwater_bool']:
                data['summary_data']['hu12_count_nu'] = upstream_hu12_set_len
                data['summary_data']['distance_km'] = decimal.Decimal(
                    "{:.2f}".format(get_distance(huc_navigation_tree) - huc_navigation_tree.distance_km))
                data['summary_data']['headwater_count_nu'] = get_headwater_count(huc_navigation_tree)
                data['summary_data']['area_sq_km'] = decimal.Decimal(
                    "{:.2f}".format(get_area(huc_navigation_tree) - huc_navigation_tree.area_sq_km))
                data['summary_data']['water_area_sq_km'] = decimal.Decimal(
                    "{:.2f}".format(get_water_area(huc_navigation_tree) - huc_navigation_tree.water_area_sq_km))





        # trigger for including/excluding these lists
        if 'huc_data' in kwargs and kwargs['huc_data'] == True:
            upstream_hu8_set = set()
            upstream_hu6_set = set()
            upstream_hu4_set = set()
            upstream_hu2_set = set()

            for node_name in upstream_hu12_set:
                upstream_hu8_set.add(node_name[0:8])
                upstream_hu6_set.add(node_name[0:6])
                upstream_hu4_set.add(node_name[0:4])
                upstream_hu2_set.add(node_name[0:2])

            data['huc_data'] = {}
            data['huc_data']['hu8_count_nu'] = len(upstream_hu8_set)
            data['huc_data']['hu6_count_nu'] = len(upstream_hu6_set)
            data['huc_data']['hu4_count_nu'] = len(upstream_hu4_set)
            data['huc_data']['hu2_count_nu'] = len(upstream_hu2_set)

            data['huc_data']['hu8_list'] = sorted(upstream_hu8_set)
            data['huc_data']['hu6_list'] = sorted(upstream_hu6_set)
            data['huc_data']['hu4_list'] = sorted(upstream_hu4_set)
            data['huc_data']['hu2_list'] = sorted(upstream_hu2_set)

        # data['upstream_hu12_list'] = sorted(upstream_hu12_set) # if result_format else []

        # make a list that has attributes but is real simple (for use in JavaScript)
        # trigger for including/excluding these lists - included by deffault
        if not 'hu12_data' in kwargs \
            or ('hu12_data' in kwargs and kwargs['hu12_data'] is True):

            data['hu12_data'] = {}

            if 'hu12_data_format' in kwargs and kwargs['hu12_data_format'] == 'dictionary':
                if upstream_hu12_set_len < 1000:
                    exporter = DictExporter()
                    exported = exporter.export(huc_navigation_tree)
                    data['hu12_data'] = exported['children']
                else:
                    data['hu12_data'] = {
                        'warning': 'too many nodes to export as dict. {} > {}'.format(upstream_hu12_set_len, 1000)}

            elif 'download_attributes' in kwargs \
                    and (kwargs['download_attributes'] == 'metrics2016'
                            or kwargs['download_attributes'] == 'metrics2017'
                            or kwargs['download_attributes'] == 'geography'
                            or kwargs['download_attributes'] == 'wbd_navigation'
            ):
                # get this from the Attributes class
                data['hu12_data'] = Attribute().metrics(huc_navigation_tree,
                                                        kwargs['download_attributes'])

            else:
                data['hu12_data']['fields'] = {'huc_code': 0}

                """
                
                
                
                
                
                
                
                
                
                
                
                
                TODO: figure out where 'headwater_bool' is being set as the only attribute 
                used in Download button
                NOTE: it was in the javascript function where the URL was set.
                
                
                
                
                
                
                
                
                
                
                """

                if 'attributes' in kwargs:
                    attribute_list = kwargs['attributes'].split(',')

                    # and remove the simple list  # del(data['upstream_hu12_list'])

                else:
                    attribute_list = ['headwater_bool', 'distance_km', 'area_sq_km', 'water_area_sq_km', 'huc_name']

                # attribute_list = ['headwater_bool', 'hu12_count_nu', 'distance_km', 'area_sq_km', 'water_area_sq_km', 'huc_name']

                valid_attribute_list = []
                for i in attribute_list:
                    if hasattr(huc_navigation_tree, i):
                        valid_attribute_list.append(i)

                        data['hu12_data']['fields'][i] = len(data['hu12_data']['fields'])
                    else:
                        if i == 'hu12_count_nu':
                            valid_attribute_list.append(i)
                            data['hu12_data']['fields'][i] = len(data['hu12_data']['fields'])

                # in js get these back out via
                upstream_list = []

                # this is putting the 'base node' in the list questionable
                val_list = [huc_navigation_tree.name, ]
                for att in valid_attribute_list:
                    if hasattr(huc_navigation_tree, att):
                        val_list.append(getattr(huc_navigation_tree, att))
                    elif att == 'hu12_count_nu':
                        val_list.append(len(huc_navigation_tree.descendants))
                    else:
                        val_list.append('NA')
                upstream_list.append(val_list)

                if len(valid_attribute_list) > 0:
                    for node in huc_navigation_tree.descendants:
                        val_list = [node.name, ]
                        for att in valid_attribute_list:
                            if hasattr(node, att):
                                val_list.append(getattr(node, att))
                            elif att == 'hu12_count_nu':
                                val_list.append(len(node.descendants))
                            else:
                                val_list.append('NA')

                        upstream_list.append(val_list)
                else:
                    del(data['hu12_data']['fields'])
                    for node in huc_navigation_tree.descendants:
                        upstream_list.append(node.name)

                data['hu12_data']['hu12_list'] = upstream_list

        logger.debug("finished all navigation at %s seconds" % (datetime.datetime.now() - startTime).total_seconds())

        return data

    '''
        http://127.0.0.1/wbdtree-cgi/?code=110200130403&navigation_direction=downstream
        and a weak example in wbddata/static/data/downstream-110200130403.json
    '''

    def navigate_downstream(self, **kwargs):
        self.init_wbd_navigation_tree()

        huc_navigation_tree = self.navigation_tree[self.huc_code]

        # NOTE: these 2 get moved into the parent_data to overwrite the stored values
        data = {'headwater_bool': huc_navigation_tree.is_leaf,
                'terminal_bool': huc_navigation_tree.is_root, }

        # in WBD syntax, is_leaf == headwater_bool (and is_root == terminal_bool)
        for node in huc_navigation_tree.ancestors:
            node.headwater_bool = node.is_leaf

        if not huc_navigation_tree.is_root:
            data['terminal_huc12_ds'] = {'huc_code': huc_navigation_tree.root.name,
                                        'name': huc_navigation_tree.root.huc_name,
                                         'distance_km': self.get_downstream_distance(huc_navigation_tree),}

        downstream_list = []
        hu12_set = set()
        hu8_set = set()
        distance_km = 0

        data['summary_data'] = {}
        data['hu12_data'] = {}

        # TODO: Attribute stuff
        data['hu12_data']['fields'] = {'huc_code': 0}

        #TODO: Attribute stuff
        if 'hu12_data_fields' in kwargs:
            attribute_list = kwargs['hu12_data_fields'].split(',')

        # and remove the simple list  # del(data['upstream_hu12_list'])

        else:
            attribute_list = ['headwater_bool', 'distance_km', 'area_sq_km', 'water_area_sq_km', ]  # 'huc_name']

        valid_attribute_list = []
        for i in attribute_list:
            if hasattr(huc_navigation_tree, i):
                valid_attribute_list.append(i)

                data['hu12_data']['fields'][i] = len(data['hu12_data']['fields'])

        # this is the simplest format - just a list of quoted hu12 codes
        if 'hu12_data_format' in kwargs and kwargs['hu12_data_format'] == 'string':
            for node in self.navigation_tree[self.huc_code].ancestors:
                downstream_list.append(node.name)
            data['hu12_data'].pop('fields')
            data['hu12_data']['hu12_list'] = reversed(sorted(downstream_list))

        else:
            downstream_list = []
            if len(valid_attribute_list) > 0:

                #TODO: figure out how to sort
                # w = Walker()
                # for node in w.walk(huc_navigation_tree.parent, huc_navigation_tree.root)[0]:
                # 	val_list = [node.name, ]
                # 	for att in valid_attribute_list:
                # 		if hasattr(node, att):
                # 			val_list.append(getattr(node, att))
                # 		else:
                # 			val_list.append('NA')
                #
                # 	downstream_list.append(val_list)

                for node in huc_navigation_tree.ancestors:
                    val_list = [node.name, ]
                    for att in valid_attribute_list:
                        if hasattr(node, att):
                            val_list.append(getattr(node, att))
                        else:
                            val_list.append('NA')

                    downstream_list.append(val_list)
            else:
                del (data['hu12_data']['fields'])
                for node in huc_navigation_tree.descendants:
                    downstream_list.append(node.name)

            downstream_list.sort(key = operator.itemgetter(0), reverse = True)
            data['hu12_data']['hu12_list'] = downstream_list


            # for node in self.navigation_tree[self.huc_code].ancestors:
            # 	node_distance = node.distance_km
            # 	if node_distance == -9999:
            # 		node_distance = 0
            # 	distance_km += node_distance
            # 	downstream_list.append([node.name, node_distance])
            # 	# hu8_set.add(node.name[0:8])
            # 	data['hu12_data']['hu12_list'] = sorted(downstream_list)

        data['summary_data'] = {
                'hu12_count_nu': len(downstream_list),
                'distance_km': "{:.2f}".format(self.get_downstream_distance(huc_navigation_tree)),
            }

        if huc_navigation_tree.parent is not None:
            data['huc12_ds'] = {'huc_code': huc_navigation_tree.parent.name,
                                'name': huc_navigation_tree.parent.huc_name}



        return data

    class Meta:
        ordering = ["huc_code"]


"""

    This is the navigation - but only needs to include from-to (huc_code-upstream_huc_code)
    all the leaf (headwater) nodes are determined at runtime.

"""


class HuNavigator(models.Model):
    huc_code_fk = models.ForeignKey(WBD, on_delete=models.DO_NOTHING, related_name='wbd_huc_code', blank=True,
                                    null=True)
    upstream_huc_code_fk = models.ForeignKey(WBD, on_delete=models.DO_NOTHING, related_name='wbd_huc_code_upstream',
                                             blank=True, null=True)
    huc_code = models.CharField('HUC Code', max_length=12, default=None, blank=False, null=False)
    upstream_huc_code = models.CharField('Upstream HUC Code', max_length=12, default=None, blank=False, null=False)

    def __str__(self):
        return self.huc_code + ' - US-' + self.upstream_huc_code

    class Meta:
        ordering = ["huc_code"]
        unique_together = (('huc_code', 'upstream_huc_code'),)
        indexes = [models.Index(fields=['huc_code'], name='huc_code_idx'),
            models.Index(fields=['upstream_huc_code'], name='upstream_huc_code_idx'), ]


"""

    This is a look-up table for WBD Attributes.  The attributes are available from external sources
    This doesn't store the data since it is akward and easier to keep external to the db, it
    just used to reference and find the attributes
"""


class WBDAttributes(models.Model):

    sort_nu = models.IntegerField("Row Nu", default=None, blank=True, null=True)
    source_tx = models.CharField('Source', max_length=50, default=None, blank=False, null=False)

    category_name = models.CharField('Category', max_length=124, default=None, blank=False, null=False)
    rest_layer_name = models.CharField('Alias', max_length=256, default=None, blank=False, null=False)
    label_tx = models.CharField('Label', max_length=124, default=None, blank=False, null=False)
    field_nm = models.CharField('Attribute Name', max_length=124, default=None, blank=False, null=False)
    statistic_cd= models.CharField('Statistic', max_length=25, default=None, blank=False, null=False)
    units_tx = models.CharField('Units', max_length=50, default=None, blank=False, null=False)
    description_tx = models.CharField('Description', max_length=1000, default=None, blank=True, null=True)
    # field_type = models.CharField('Field Type', max_length=24, default=None, blank=False, null=False)
    # is_served = models.BooleanField("Is served")
    # comments = models.CharField('Attribute Name', max_length=124, default=None, blank=True, null=True)

    def __str__(self):
        return self.source_tx + ' - US-' + self.field_nm

    """
        given an attribute_string, see if there is a source_tx, category_tx, or field_nm that match it
    """
    def clean_attributes(self, attributes_string):
        if len(attributes_string) == 0 or attributes_string == None:
            return None
        # from .serializers import WBDAttributeSerializer
        attribute_list = [x.strip() for x in attributes_string.split(',')]
        sanitized_atts = {'valid_set': {},
                            'valid_attributes': {},
                          'invalid_attributes': {}}
        for attribute in attribute_list:
            # see if it is an attribute set
            att_set = WBDAttributes.objects.filter(source_tx=attribute)
            if len(att_set):
                sanitized_atts['valid_set'][attribute] = {'attribute_set': attribute, 'count_nu': len(att_set)}
            else:
                att = WBDAttributes.objects.filter(field_nm=attribute)
                if len(att):
                    #
                    sanitized_atts['valid_attributes'][attribute] = att[0]
                else:
                    sanitized_atts['invalid_attributes'][attribute] = {'message': "not found"}




        return {
            'attributes_tx': attributes_string,
            'sanitized': sanitized_atts
        }

    class Meta:
        ordering = ["sort_nu"]
        unique_together = (('source_tx', 'field_nm'),)




# TODO: dump this navigation_tree into a pickle file and then compare
#  timing of that vs cache
# NOTE: there is no upstream and downstream navigation in this model
# - it is a tree, and then the
# code either navigates upstream or downstream
# # start write pickle
# if os.path.exists(pickle_huc_file):
#     os.remove(pickle_huc_file)
# if not os.path.exists(pickle_huc_file):
#     sys.setrecursionlimit(10000)
#     pickle.dump([self.navigation_tree], open(pickle_huc_file,
#     'wb'), pickle.HIGHEST_PROTOCOL)
#     logger.debug("created pickle file from cache\n\t%s" % (
#     pickle_huc_file))
# # end write pickle


# # testing using pickle rather than other
# logger.debug('Reading navigation route pickle file:\n\t%s' % (
#     pickle_huc_file))
#
# startTime = datetime.datetime.now()
# pkl_file = open(pickle_huc_file, 'rb')
#
# [self.navigation_tree] = pickle.load(pkl_file)
#
# pkl_file.close()
#
# logger.debug(" Read in %s seconds" % (
#     (datetime.datetime.now() - startTime).total_seconds()))
# # end testing using pickle rather than other

# other available Node() attributes include ...
# 'height': my_navigation_tree.height,
# 'depth': my_navigation_tree.depth,

# def get_leaves(node):
#     if not node.children:
#         yield node
#     for child in node.children:
#         for leaf in get_leaves(child):
#             yield leaf

# for pre, fill, node in RenderTree(self.navigation_tree[self.huc_code]):
#     print("{0}{1}{2} {3} {4} km2 {5} km".format(pre, node.name, '*' if node.is_leaf else '',
#                                          node.huc_name, node.area_sq_km, node.distance_km))
# exporter = JsonExporter(indent=2, sort_keys=True)
# print(exporter.export(self.navigation_tree[self.huc_code]))

# leaves = get_leaves(nav_tree['170601070807'])
# leaves_set = set()
# for l in leaves:
#     leaves_set.add(l.name)
#
# print ("count of leaves=={0}".format(len(list(leaves_set))))
# print(list(leaves_set))

# this is for the entire data set - there are 905 'root' nodes
# print ('list of roots???')
# root_set = set()
# for huc_code in nav_tree:
#     huc_code_nav = nav_tree[huc_code]
#     if huc_code_nav.is_root:
#         root_set.add(huc_code)
# print ("USA count of root nodes=={0}".format(len(list(root_set))))
# print(list(root_set))

# def get_area(node):
#     return (node.area_sq_km or 0) + sum(get_area(child) for child in node.children)
#
# for huc_code in sorted(list(self.navigation_tree)):
#     i = len(self.navigation_tree[huc_code].descendants)
#     print ("{0}\t{1}\t{2:.2f}".format(huc_code, i, get_area(self.navigation_tree[huc_code])))

# leaves_set = set()
# for huc_code in nav_tree:
#     huc_code_nav = nav_tree[huc_code]
#     if huc_code_nav.is_leaf:
#         leaves_set.add(huc_code)
# print ("USA count of leaves nodes=={0}".format(len(list(leaves_set))))
# print(list(leaves_set))
