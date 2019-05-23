from django.db import models
import datetime
from django.conf import settings
from django.core.cache import cache
import logging
from anytree import Node, RenderTree
from anytree.exporter import JsonExporter, DictExporter
from anytree.importer import JsonImporter
import anytree.search

# from .models import WBD, HuNavigator
#
# logger = logging.getLogger('wbddata.models')
#
# class WBDNavigatorManager(models.Manager):
#
#     navigation_tree = None
#
#     def navigator_nodes(self):
#         startTime = datetime.datetime.now()
#
#         if self.navigation_tree is not None:
#             return
#         self.navigation_tree = {}
#         # output_file = settings.HUC12_NAVIGATION_TREE_JSON
#
#
#         # self.navigation_tree = {}
#
#         # 170601070807 this has 2853 and is taking 15-20 seconds
#
#         navs = HuNavigator.objects.all()
#
#         # build an array of the wbd objects since we need to refer to it frequently
#         wbds = WBD.objects.all()
#         wbd_dict = {}
#         for wbd in wbds:
#             wbd_dict[wbd.huc_code] = wbd
#
#         # try:
#         for nav in navs:
#             child = nav.upstream_huc_code
#             parent = nav.huc_code
#
#             # these are available now
#             # nav.huc_code_fk.area_sq_km
#             # nav.huc_code_fk.water_area_sq_km
#             # nav.huc_code_fk.distance_km
#             # nav.huc_code_fk.name
#
#             # skip 3 cases where the parent is equal the child is in the table
#             if child == parent:
#                 continue
#
#             if not parent in self.navigation_tree:
#                 self.navigation_tree[parent] = Node(parent,
#                                                     huc_name=wbd_dict[parent].name,
#                                                     area_sq_km=wbd_dict[parent].area_sq_km,
#                                                     water_area_sq_km=wbd_dict[parent].water_area_sq_km,
#                                                     distance_km=wbd_dict[parent].distance_km,
#                                                     )
#
#             if child in self.navigation_tree:
#                 self.navigation_tree[child].parent = self.navigation_tree[parent]
#             else:
#                 self.navigation_tree[child] = Node(child,
#                                                    parent=self.navigation_tree[parent],
#                                                    huc_name=wbd_dict[child].name,
#                                                    area_sq_km=wbd_dict[child].area_sq_km,
#                                                    water_area_sq_km=wbd_dict[child].water_area_sq_km,
#                                                    distance_km=wbd_dict[child].distance_km,
#                                                    )
#
#         # TODO: figure how to write this to disk and see it if can be read in faster
#         # generating the nodes for all the country is taking 4 seconds. 3.98 seconds too long
#         # output_file = settings.HUC12_NAVIGATION_TREE_JSON
#         #
#
#         # cache.set('navigation_tree', self.navigation_tree, 300)
#
#         # exporter = JsonExporter(indent=2) # probably slows things down - TODO unsort, and dont intent
#         # f = open(output_file, 'w')
#         # edata = {}
#         # root = Node('root')
#         # logger.debug(" gonna try stroing in %s seconds" % (datetime.datetime.now() - startTime).total_seconds())
#         # for huc_code in sorted(list(self.navigation_tree)):
#         #     if self.navigation_tree[huc_code].is_root:
#         #         cache.set("navigation_tree_{0}".format(huc_code), self.navigation_tree[huc_code], 300)
#         # logger.debug(" done storing in %s seconds" % (datetime.datetime.now() - startTime).total_seconds())
#         #         self.navigation_tree[huc_code].parent = root
#         #
#         # exporter.write(root, f)
#         # f.close()
#         # huc_json = exporter.export(self.navigation_tree[huc_code])
#         # edata[huc_code] = huc_json
#         # exporter.write({'huc_code': huc_code, 'data': self.navigation_tree[huc_code]}, f)
#         #         break
#         #
#         # f.close()
#         # with open(output_file, 'w') as outfile:
#         #     msgpack.pack(self.navigation_tree, outfile)
#         # json.dump(edata, f)
#         # f.close()
#
#         logger.debug(" Read in %s seconds" % (datetime.datetime.now() - startTime).total_seconds())
#         return self.navigation_tree