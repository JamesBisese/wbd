from django.core.management.base import BaseCommand
from wbddata.models import WBDAttributes
from django.conf import settings
import os
import sys
from datetime import datetime as dt
import csv

#
#


class Command(BaseCommand):
    args = '<none>'
    help = 'load data from CSV file settings.WBD_ATTRIBUTES_LOOKUPLIST into ORM "WBDAttribute"'

    def _create_data(self):
        startTime = dt.now()
        path = settings.WBD_ATTRIBUTES_LOOKUPLIST

        if not len(path):
            raise ValueError('settings.WBD_ATTRIBUTES_LOOKUPLIST must be set before calling this function')
        if not os.path.exists(path):
            raise IOError("Unable to attributes metadata data file path\n\t%s" % (path))

        print('Reading WBD_ATTRIBUTES_LOOKUPLIST metadata file:\n\t%s' % (path))
        try:
            infile = open(path, 'r')  # CSV file
            reader = csv.DictReader(infile)
        except:
            ex = sys.exc_info()
            print('Exception 641: %s: %s' % (ex[0], ex[1]))
            exit()

        # need to delete all one time
        if 1 == 2:
            WBDAttributes.objects.all().delete()

        row_count = 0
        try:
            for row in reader:
                row_count += 1

                print(row['source'] + '--' + row['alias'])

                _, created = WBDAttributes.objects.get_or_create(
                    row_nu = row['row_nu'],
                    attribute_name = row['attribute_nm'],
                    source = row['source'],
                    alias = row['alias'],
                    # description = row[0],
                    field_type = row['field_type'],
                    is_served = False if row['is_served'] == 'FALSE' else True,
                    comments = row['comments'],
                )
        except:
            print
            "Unexpected error:", sys.exc_info()[0]
            raise




        print(" Loaded %s rows in %s seconds" % (row_count, (dt.now() - startTime).total_seconds()))


    def handle(self, *args, **options):
        self._create_data()