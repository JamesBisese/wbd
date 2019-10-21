import csv
from datetime import datetime as dt
import os
import sys

from django.core.management.base import BaseCommand
from django.db.models import Count
from django.conf import settings

from wbddata.models import WBDAttributes
from wbddata.attributes import Attribute

"""
    indicator data is found using
    category_name > field_nm
    
    data is going to be stored in files
    source_tx > category_name


    create files in folder data/{source_tx}/{category_name}.csv
    as a way to speed up the loading of indicators

                        'source_tx',
                        'sort_nu',
                        'category_name',
                        'rest_layer_name',
                        'label_tx',
                        'field_nm',
                        'statistic_cd',
                        'units_tx',
                        'description_tx',

"""


class Command(BaseCommand):
    args = '<none>'
    help = 'create sub-CSV files in folders as "data/{source_tx}/{category_name}.csv"'

    def _create_data(self):
        startTime = dt.now()

        attributes = Attribute()

        for source_obj in WBDAttributes.objects.values('source_tx').annotate(count_nu=Count('source_tx')).order_by('source_tx'):

            source_tx = source_obj['source_tx']

            # debug
            # if source_tx == 'Service2016':
            #     continue

            print("{} -- {}".format(source_tx, source_obj['count_nu']))
            path = os.path.join(settings.BASE_DIR, r"wbddata\static\data\{}/".format(source_tx))
            path = os.path.abspath(path)

            if not os.path.exists(path):
                print("Creating path\n\t%s" % (path))
                os.mkdir(os.path.abspath(path))
            if not os.path.exists(path):
                raise IOError("Unable to create folder path\n\t%s" % (os.path.abspath(path)))

            '''
                this loads the attribute file automatically
            '''
            metrics_file = ''
            if source_tx == 'Service2016':
                 metrics_file = settings.WBD_METRICS_2016
            elif source_tx == 'Service2017':
                metrics_file = settings.WBD_METRICS_2017
            elif source_tx == 'Geography':
                metrics_file = settings.WBD_GEOGRAPHY

            if metrics_file == '':
                raise IOError("unable to find metric file for source_tx=={}".format(source_tx))

            '''
                we don't need the data as a dictionary, just a list
            '''
            attributes.attribute_file = metrics_file

            a = attributes.attribute_file_get_columns(metrics_file)

            # TODO: this is where you could filter out columns 'not to include'
            attributes_fields_dict = {a[i]: i for i in range(0, len(a), 1)}


            for obj in WBDAttributes.objects.filter(source_tx=source_tx).values('category_name').annotate(count_nu=Count('category_name')).order_by('category_name'):

                # !!!! change colons to hyphens !!!!
                category_name = obj['category_name'].replace(':', '-')

                print("{} -- {} -- {}".format(source_tx, category_name, obj['count_nu']))


                if not os.path.exists(path):
                    print("Creating path\n\t%s" % (path))
                    os.mkdir(os.path.abspath(path))
                if not os.path.exists(path):
                    raise IOError("Unable to create path\n\t%s" % (os.path.abspath(path)))

                # !!!! change colons to hyphens !!!!
                # category_name = obj['category_name'].replace(':', '-')
                file_path = os.path.join(path, category_name + '.csv')

                if not os.path.exists(file_path):
                    outfile = open(file_path, 'w', newline='')
                    writer = csv.writer(outfile, quoting=csv.QUOTE_ALL)
                    field_list = ['HUC_12',]
                    for field_obj in WBDAttributes.objects.filter(source_tx=source_tx,category_name=obj['category_name']).values('field_nm').order_by('sort_nu'):
                        field_list.append(field_obj['field_nm'])
                    writer.writerow(field_list)

                    for hu12_tx in attributes.attribute_data:
                        hu12_list = attributes.attribute_data[hu12_tx]
                        field_values = []
                        for field_nm in field_list:
                            value = attributes_fields_dict[field_nm]
                            field_values.append(hu12_list[value])
                        writer.writerow(field_values)

                    print("\t{}".format(file_path))

        # path = settings.WBD_ATTRIBUTES_LOOKUPLIST
        #
        # if not len(path):
        #     raise ValueError('settings.WBD_ATTRIBUTES_LOOKUPLIST must be set before calling this function')
        # if not os.path.exists(path):
        #     raise IOError("Unable to attributes metadata data file path\n\t%s" % (path))
        #
        # print('Reading WBD_ATTRIBUTES_LOOKUPLIST metadata file:\n\t%s' % (path))
        # try:
        #     infile = open(path, 'r')  # CSV file
        #     reader = csv.DictReader(infile)
        # except:
        #     ex = sys.exc_info()
        #     print('Exception 641: %s: %s' % (ex[0], ex[1]))
        #     exit()
        #
        # # need to delete all one time
        # if 1 == 2:
        #     WBDAttributes.objects.all().delete()
        #
        # row_count = 0
        # try:
        #     for row in reader:
        #         row_count += 1
        #
        #         print(row['source'] + '--' + row['alias'])
        #
        #         _, created = WBDAttributes.objects.get_or_create(
        #             row_nu = row['row_nu'],
        #             attribute_name = row['attribute_nm'],
        #             source = row['source'],
        #             alias = row['alias'],
        #             # description = row[0],
        #             field_type = row['field_type'],
        #             is_served = False if row['is_served'] == 'FALSE' else True,
        #             comments = row['comments'],
        #         )
        # except:
        #     print
        #     "Unexpected error:", sys.exc_info()[0]
        #     raise




        # print(" Loaded %s rows in %s seconds" % (row_count, (dt.now() - startTime).total_seconds()))


    def handle(self, *args, **options):
        self._create_data()