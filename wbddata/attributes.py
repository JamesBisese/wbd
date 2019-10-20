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
from django.core.cache import cache, caches
from django.utils.encoding import smart_str
import re

import logging
from collections import defaultdict,OrderedDict
from datetime import datetime as dt


from django.db import models
from django.core.exceptions import ValidationError
from django.conf import settings
from django.core.cache import cache, caches

# from anytree import Node, RenderTree
# from anytree.exporter import JsonExporter, DictExporter
# from anytree.walker import Walker
# import anytree.search

# from .manager import WBDNavigatorManager

logger = logging.getLogger('wbddata.models')


def validate_huc_code(value):
    reg = re.compile('^\d{1,12}$')
    if not reg.match(value):
        raise ValidationError(u'%s huc_code is not valid \d{1,12}' % value)


"""

    This is a no-database model that handles getting attribute information from files
    First time I've used a no attribute model

"""


class Attribute():
    # huc_code = models.CharField('HUC Code', primary_key=False, unique=True, max_length=12,
    #                             validators=[validate_huc_code], default=None, blank=False, null=False)
    # huc_type = models.CharField('HUC Category', max_length=25, default=None, blank=False, null=False)
    # name = models.CharField('HUC Name', max_length=124, default=None, blank=False, null=False)
    #
    # def __str__(self):
    #     return self.huc_code + ' - ' + self.name
    #
    # class Meta:
    #     managed = False
    def __init__(self):
        '''
        Constructor
        '''
        self.args = None

        self.data_path = None

        self.huc_file = None

        self.huc_file_pickle = None

        self.navigation_file = None

        self.attribute_file = None

        self.attribute_file_key = 'HUC_12'

        self.attribute_data = defaultdict(dict)

        self.attribute_data_keys = []

        self.huc_data = defaultdict(dict)

        self.huc12_data = defaultdict(dict)

    def exists(self, attribute_name):
        return True

    """
        given a navigation tree, and a recognized 'metric_set' (right now a file of metrics)
        return all the metrics data for each navigation node (hu12)

        INTERIM: not optimized, and I barely understand what is going on

    """

    def navigation_metrics(self, navigation_tree, attribute_obj):
        metric_set = attribute_obj.source_tx
        metrics_file = ''
        # if metric_set == 'Service2016':
        #     metrics_file = settings.WBD_METRICS_2016
        # elif metric_set == 'Service2017':
        #     metrics_file = settings.WBD_METRICS_2017
        # else:
        # create the ...
        metric_set = os.path.join(attribute_obj.source_tx, attribute_obj.category_name.replace(':', '-'))

        metrics_file = os.path.join(settings.BASE_DIR, 'wbddata', 'static', 'data', metric_set + '.csv')

        '''
        this auto-magically creates and loads 'self.attribute_data'

        TODO: optimize this to just read the fields we want!!!! a single field
        '''
        self.attribute_file = metrics_file

        '''
            we don't need the data as a dictionary, just a list
        '''
        a = self.attribute_file_get_columns(metrics_file)

        # TODO: this is where you could filter out columns 'not to include'
        fields = {a[i]: i for i in range(0, len(a), 1)}

        field_nm = attribute_obj.field_nm
        field_index = fields[attribute_obj.field_nm]

        # set value for clicked/selected HU
        setattr(navigation_tree, field_nm, self.attribute_data[navigation_tree.name][field_index])

        for node in navigation_tree.descendants:
            setattr(node, field_nm, self.attribute_data[node.name][field_index])

        return



    """
        given a navigation tree, and a recognized 'metric_set' (right now a file of metrics)
        return all the metrics data for each navigation node (hu12)
        
        INTERIM: not optimized, and I barely understand what is going on
    
    """
    def metrics(self, navigation_tree, metric_set):
        metrics_file = ''
        if metric_set == 'metrics2016':
            metrics_file = settings.WBD_METRICS_2016
        elif metric_set == 'metrics2017':
            metrics_file = settings.WBD_METRICS_2017
        else:
            metrics_file = os.path.join(settings.BASE_DIR, 'wbddata', 'static', 'data',  metric_set + '.csv')

        '''
        this auto-magically creates and loads 'self.attribute_data'
        '''
        self.attribute_file = metrics_file

        metrics_data = []
        for node in navigation_tree.descendants:
            metrics_data.append(self.attribute_data[node.name])

        '''
            we don't need the data as a dictionary, just a list
        '''
        a = self.attribute_file_get_columns(metrics_file)

        #TODO: this is where you could filter out columns 'not to include'
        fields = { a[i]: i for i in range(0, len(a), 1)}
        return {
            'fields': fields,
            'metrics_data': metrics_data,}

    @property
    def attribute_file(self):
        return self.__attribute_file


    @attribute_file.setter
    def attribute_file(self, attribute_file):
        """

            read the attribute file into an array with 1 entry for each HUC12

        """
        startTime = datetime.datetime.now()

        def read():

            if not len(self.attribute_file):
                logger.warning('you must set the attribute_file (attribute file) before calling this function')
                exit()
            if not len(self.attribute_file_key):
                logger.warning('you must set the attribute_key_field (the column to use to create the attribute table) before calling this function')
                exit()

            self.attribute_data = defaultdict(dict)

            startTime = dt.now()

            '''
                just get the field names using dictreader, then read using reader
            '''
            try:
                with open(self.attribute_file, 'r') as f:
                # infile = open(self.attribute_file, 'r')  # CSV file
                # reader = csv.DictReader(infile) # don't need dict behavior
                    reader = csv.DictReader(f)
                    '''
                        check that the required field is found in CSV file fieldnames
                    '''
                    if not self.attribute_file_key in reader.fieldnames:
                        raise KeyError("required column '%s' not found in CSV file\n\t%s" %
                                       (self.attribute_file_key, self.attribute_file))

                    self.attribute_keys = reader.fieldnames
            except KeyError as err:
                raise
            except:
                ex = sys.exc_info()
                logger.error('Exception 641: %s: %s' % (ex[0], ex[1]))
                exit()

            row_count = 0

            file_key_index = 0
            for i, field in enumerate(self.attribute_keys):
                if field == self.attribute_file_key:
                    file_key_index = i
                    break

            logger.debug('Reading attribute file:\n\t%s' % (self.attribute_file))

            try:
                with open(self.attribute_file, 'r') as f:
                    reader = csv.reader(f)
                    next(reader)

                    for row in reader:
                        row_count += 1

                        '''
                            build the attribute data
                        '''
                        """
                            JAB NOTE: HUC12s suck when your using CSV files and excel
                            the leading zero gets cut off.  Because of that, I have to test
                            here and make sure that the leading zero gets added back on
                        """
                        if (self.attribute_file_key == 'HUC_12' or self.attribute_file_key == 'HUC12') \
                                and len(row[file_key_index]) == 11:
                            row[file_key_index] = '0' + row[file_key_index]
                        """
                            JAB end of HUC12 fix
                        """
                        self.attribute_data[row[file_key_index]] = row
            except:
                print("Unexpected error:", sys.exc_info()[0])
                raise

            logger.debug(" Read %s rows in %s seconds" % (row_count, (dt.now() - startTime).total_seconds()))

            return

        if attribute_file == None:
            pass
        else:
            # this is an alternate to pickle file
            cache_atts = caches['wbddata.attributes']

            """
            
                NOTE:!!!!! USE THIS TO TRIGGER RECREATING THE CACHE IF YOU NEED A SCHEMA CHANGE !!!!
            
            """
            force_refresh_cache = False

            def _smart_key(key):
                return smart_str(''.join([c for c in key if ord(c) > 32 and ord(c) != 127]))

            cache_key = _smart_key(os.path.basename(attribute_file))

            if not force_refresh_cache == True:
                self.attribute_data = cache_atts.get(cache_key)
                if self.attribute_data is not None:
                    logger.debug("read from cache_atts in %s seconds" % (datetime.datetime.now() - startTime).total_seconds())

                    return
                else:
                    logger.debug("attributes are not cached yet. starting at %s seconds" % (datetime.datetime.now() - startTime).total_seconds())

            if os.path.exists(str(attribute_file)):

                logger.debug("init attribute file from disk {}".format(str(attribute_file)))

                self.__attribute_file = str(attribute_file)
                read()

                # using file based disk cache.  fancy stuff
                logger.debug("attributes are ready to store at %s seconds" % (datetime.datetime.now() - startTime).total_seconds())

                logger.debug("storing data in cache_atts at %s seconds" % (datetime.datetime.now() -
                                                                       startTime).total_seconds())
                sys.setrecursionlimit(10000)

                cache_atts.set(cache_key, self.attribute_data)

                logger.debug("done storing in cache_atts at %s seconds" % (datetime.datetime.now() -
                                                                       startTime).total_seconds())

            else:
                raise IOError("Unable to find attribute file\n\t%s" % (attribute_file))


    def attribute_file_get_columns(self, attribute_file):
        """

            open the attribute file and return the column names

        """

        def read():

            fieldnames = []
            try:
                infile = open(attribute_file, 'r')
                reader = csv.DictReader(infile)
                fieldnames = reader.fieldnames
                infile.close()

            except KeyError as err:
                raise
            except IOError as err:
                raise
            except:
                ex = sys.exc_info()
                logger.error('Exception 641: %s: %s' % (ex[0], ex[1]))
                exit()

            return fieldnames

        if attribute_file == None:
            pass
        else:
            if os.path.exists(str(attribute_file)):
                return read()
            else:
                raise IOError("Unable to find attribute file to get columns\n\t%s" % (attribute_file))
