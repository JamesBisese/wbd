from django.core.management.base import BaseCommand

from django.conf import settings
import os
import logging
from datetime import datetime as dt
import json

from wbddata.models import HuNavigator, WBD
from anytree import Node, RenderTree
import anytree
from collections import defaultdict
logger = logging.getLogger('wbddata.management.commands')
from django.core.cache import cache

class Command(BaseCommand):
    args = '<none>'
    help = 'load data from CSV file settings.HUC12_ATTRIBUTES_FILE into ORM "WBD"'

    def _navigate(self):
        startTime = dt.now()
        wbd_count = {}
        wbd_count['all'] = WBD.objects.count()
        logger.debug("there are {} WBDs".format(wbd_count['all']))

        navigation_tree = {}
        node_navigation_tree = Node(0, huc_name="Root")

        wbd_count['root'] = 1
        logger.debug("there is {} WBD root named '{}'".format(wbd_count['root'], 0))

        for tup in WBD.TERMINAL_OUTLET_CHOICES:
            navigation_tree[tup[0]] = Node(name=tup[0],
                                                parent=node_navigation_tree,
                                                huc_name=tup[1])

        wbd_count['pseudo'] = len(node_navigation_tree.descendants)
        logger.debug("there are {} pseudo nodes".format(wbd_count['pseudo']))
        # print("there are {} WBDs that are pseudo terminal nodes".format(len(node_navigation_tree.descendants)))

        wbds = WBD.objects.filter(terminal_bool=True)
        wbd_count['terminal'] = len(wbds)
        logger.debug("there are {} WBDs that are terminal nodes".format(wbd_count['terminal']))

        for wbd in wbds:
            # if len(wbd.huc_code) > 12:
            #     logger.warning("mis-formed wbd.huc_code '{}'".format(wbd.huc_code))
            # if len(wbd.huc_code) > 12:
            #     logger.warning("mis-formed wbd.huc_code '{}'".format(wbd.huc_code))
            # this takes a long time
            # parent = anytree.find_by_attr(node_navigation_tree, str(wbd.terminal_outlet_type_code), name="name")

            # this is really quick
            parent = navigation_tree[wbd.terminal_outlet_type_code]

            #jab - my first use of assert in python 2019-05-11
            assert not wbd.huc_code in navigation_tree, "already loaded {} in navigation_tree".format(wbd.huc_code)

            navigation_tree[wbd.huc_code] = Node(name=wbd.huc_code,
                                            parent=parent,
                                            huc_name=wbd.name)

        # print("the WBDs that are terminal nodes are loaded")
        wbd_count['wbd_terminal_nodes'] = len(node_navigation_tree.descendants) - len(node_navigation_tree.children)
        logger.debug("there are {} wbd_terminal_nodes".format(wbd_count['wbd_terminal_nodes']))

        wbds = WBD.objects.filter(terminal_bool=False)
        wbd_count['non_terminal'] = len(wbds)
        logger.debug("there are {} WBDs that are NOT terminal nodes".format(wbd_count['non_terminal']))

        wbd_count['wbd_parent_eq_child'] = 0

        for wbd in wbds:
            if len(wbd.huc_code) < 12:
                logger.warning("mis-formed wbd.huc_code '{}'".format(wbd.huc_code))
            if len(wbd.huc12_ds) < 12:
                logger.warning("mis-formed wbd.huc12_ds '{}'".format(wbd.huc12_ds))
            # this takes a long time
            # parent = anytree.find_by_attr(node_navigation_tree, str(wbd.terminal_outlet_type_code), name="name")

            # this is really quick #TODO the name should be hu_ds_huc_code
            parent = None

            # skip 3 cases where the parent is equal the child is in the table
            if wbd.huc_code == wbd.huc12_ds:
                logger.warning("skipping {} because wbd.huc_code and wbd.hu12_ds are equal".format(wbd.huc_code))
                wbd_count['wbd_parent_eq_child'] += 1
                continue

            if not wbd.huc12_ds in navigation_tree:
                navigation_tree[wbd.huc12_ds] = \
                    Node(
                        name=wbd.huc_code,
                        huc_name=wbd.name,
                        area_sq_km=wbd.area_sq_km,
                        water_area_sq_km=wbd.water_area_sq_km,
                        distance_km=wbd.distance_km,
                        headwater_bool=wbd.headwater_bool,
                        terminal_outlet_type_code=wbd.terminal_outlet_type_code,
                    )

            if wbd.huc_code in navigation_tree:
                navigation_tree[wbd.huc_code].parent = navigation_tree[wbd.huc12_ds]
            else:
                navigation_tree[wbd.huc_code] = \
                    Node(
                        name=wbd.huc_code,
                        parent=navigation_tree[wbd.huc12_ds],
                        huc_name=wbd.name,
                        area_sq_km=wbd.area_sq_km,
                        water_area_sq_km=wbd.water_area_sq_km,
                        distance_km=wbd.distance_km,
                        headwater_bool=wbd.headwater_bool,
                        terminal_outlet_type_code=wbd.terminal_outlet_type_code,
                    )



        logger.debug("there are {} huc_codes in the navigation_tree DICT".format(len(navigation_tree)))
        logger.debug("there are {} WBDs where wbd_parent_eq_child - not nav".format(wbd_count['wbd_parent_eq_child']))

        # one pass through the navigation_tree for any that don't have parent
        wbds = WBD.objects.all()
        for wbd in wbds:
            if len(wbd.huc12_ds) == 12:
                if not wbd.huc12_ds in navigation_tree:
                    logger.debug("1. unable to find wbd.huc12_ds {} as key in navigation_tree".format(wbd.huc12_ds))
                # elif not wbd.huc_code in navigation_tree:
                #     logger.debug("2. unable to find wbd.huc_code {} as key in navigation_tree".format(wbd.huc12_ds))
            if len(wbd.huc_code) == 12:
                # if not wbd.huc12_ds in navigation_tree:
                #     logger.debug("3. unable to find wbd.huc12_ds {} as key in navigation_tree".format(wbd.huc12_ds))
                # el
                if not wbd.huc_code in navigation_tree:
                    logger.debug("4. unable to find wbd.huc_code {} as key in navigation_tree".format(wbd.huc12_ds))

        wbd_count['node_navigation_tree'] = len(node_navigation_tree.descendants)
        logger.debug("there are {} WBDs nodes in the node_navigation_tree".format(wbd_count['node_navigation_tree']))

        wbds = WBD.objects.all()

        # for wbd in wbds:
        #     wbd_node = anytree.search.find(node_navigation_tree, lambda node: node.name == wbd.huc_code, \
        #                                    stop = lambda node: node.name == wbd.huc_code)
        #     if wbd_node == None:
        #         logger.debug("unable to find {} in nav".format(wbd.huc_code))


        logger.debug(" Read in %s seconds" % (dt.now() - startTime).total_seconds())
        #
        # sink = anytree.search.find(node_navigation_tree, lambda node: node.name == -12)
        # for pre, _, node in RenderTree(sink):
        #     if node.is_leaf == False:
        #         print("{} {} is NOT headwater {}".format(node.name, node.huc_name, len(node.descendants)))
        #     else:
        #         print("{} {} is headwater".format(node.name, node.huc_name))

        # print("the Sink nodes")
        # # sink = node_navigation_tree(-13) # anytree.find_by_attr(node_navigation_tree, -13, name="parent")
        # sink = anytree.search.find(node_navigation_tree, lambda node: node.name == -13)
        # for pre, _, node in RenderTree(sink):
        #     print("%s%s - %s" % (pre, node.name, node.huc_name))

        # hu = "03"
        # print("find all the nodes in hu {}".format(hu))
        # # sink = anytree.search.findall(node_navigation_tree, lambda node: str(node.name)[0:len(hu)] == hu)
        # for node in node_navigation_tree:
        #     if node.is_leaf == False:
        #         print("{} {} is headwater {}".format(node.name, node.huc_name, node.descendants))
        # for pre, _, node in RenderTree(sink):
        #     print("%s%s - %s" % (pre, node.name, node.huc_name))

        # this shows all
        # for pre, _, node in RenderTree(node_navigation_tree):
        #     print("%s%s - %s" % (pre, node.name, node.huc_name))

        # cache.set('my_key', {'a': 1, 'b': 2}, 30)
        # t = cache.get('my_key')
        # print(t)
        # exit()

        # wbd = WBD.objects.filter(huc_code__exact='070700030705').first()
        #
        # data = wbd.navigate_upstream()
        #
        # print(data)

        # build an array of the wbd objects since we need to refer to it frequently
        # wbds = WBD.objects.all()
        # wbd_dict = {}
        # for wbd in wbds:
        #     wbd_dict[wbd.huc_code] = wbd
        #
        # nav_tree = {}
        # logger.debug('test')
        #
        # try:
        #     for nav in navs:
        #         child = nav.upstream_huc_code
        #         parent = nav.huc_code
        #
        #         # these are available now
        #         # nav.huc_code_fk.area_sq_km
        #         # nav.huc_code_fk.water_area_sq_km
        #         # nav.huc_code_fk.distance_km
        #         # nav.huc_code_fk.name
        #
        #         # skip 3 cases where the parent is equal the child is in the table
        #         if child == parent:
        #             continue
        #
        #         if not parent in nav_tree:
        #             nav_tree[parent] = Node(parent,
        #                                     huc_name=wbd_dict[parent].name,
        #                                     area_sq_km=wbd_dict[parent].area_sq_km,
        #                                     )
        #
        #         if child in nav_tree:
        #             nav_tree[child].parent = nav_tree[parent]
        #         else:
        #             nav_tree[child] = Node(child,
        #                                    parent=nav_tree[parent],
        #                                    huc_name=wbd_dict[child].name,
        #                                    area_sq_km=wbd_dict[child].area_sq_km,
        #                                    # water_area_sq_km=wbd_dict[nav.huc_code].water_area_sq_km,
        #                                    # distance_km=wbd_dict[nav.huc_code].distance_km,
        #                                    )
        #
        # except:
        #     print('what is going on??')
        #     raise
        #
        # # logger.debug(" Read in %s seconds" % (dt.now() - startTime).total_seconds())
        # # for pre, fill, node in RenderTree(nav_tree['070700030705']):
        # #
        # #     print("{0}{1}{2} {3} {4} km2".format(pre, node.name, '*' if node.is_leaf else '', node.huc_name, node.area_sq_km))
        #
        # def get_leaves(node):
        #     if not node.children:
        #         yield node
        #     for child in node.children:
        #         for leaf in get_leaves(child):
        #             yield leaf

        # nodes_set = set()
        # for pre, fill, node in RenderTree(nav_tree['170601070807']):
        #     nodes_set.add(node.name)
        # print("count of nodes=={0}".format(len(list(nodes_set))))
        # print(list(nodes_set))

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
        # for huc_code in sorted(list(nav_tree)):
        #     i = len(nav_tree[huc_code].descendants)
        #     print ("{0}\t{1}\t{2:.2f}".format(huc_code, i, get_area(nav_tree[huc_code])))

        # leaves_set = set()
        # for huc_code in nav_tree:
        #     huc_code_nav = nav_tree[huc_code]
        #     if huc_code_nav.is_leaf:
        #         leaves_set.add(huc_code)
        # print ("USA count of leaves nodes=={0}".format(len(list(leaves_set))))
        # print(list(leaves_set))

    def handle(self, *args, **options):
        self._navigate()

