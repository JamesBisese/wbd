from django.core.management.base import BaseCommand
from wbddata.models import WBD
from django.conf import settings
import os
import sys
from datetime import datetime as dt
import csv
from django.db import transaction

# this is slow, but it uses django to load, rather than doing it outside of the ORM
# (venv) C:\inetpub\wwwdjango\wbdtree>python manage.py load_huc12_attributes
#
#  Loaded 83018 rows in 1646.9344 seconds

# with change to using transaction.atomic (don't save each update)
# Loaded 83018 rows in 278.039801 seconds

# (venv) C:\inetpub\wwwdjango\wbd>python manage.py load_huc12_attributes
#  Loaded 83018 rows in 1820.038178 seconds


# this is the same thing using postgres
# (venv) C:\inetpub\wwwdjango\wbdtree>python manage.py load_huc12_attributes
#  Loaded 83018 rows in 249.326001 seconds

# C:\inetpub\wwwdjango\wbd\venv\Scripts\python.exe C:/inetpub/wwwdjango/wbdtree/manage.py load_huc12_attributes --traceback
#  Loaded 83018 rows in 259.411402 seconds

# TODO: change to use DictReader a la load_wbd_attribute_lookuplist
# the terminal_outlet_type_code is shown in two different ways
# TODO: add code to set terminal_outlet_type_code = terminal_outlet_type_code / 10 if terminal_outlet_type_code <= -20

#
def transform_traveltime_hr(traveltime_hrs):
    try:
        return float(traveltime_hrs)
    except:
        return None

def transform_area_sq_km(area_sq_km):
    try:
        return float(area_sq_km)
    except:
        return None

class Command(BaseCommand):
    args = '<none>'
    help = 'load data from CSV file settings.HUC12_ATTRIBUTES_FILE into ORM "WBD"'

    # @transaction.commit_on_success
    def _create_data(self):
        startTime = dt.now()
        path = settings.HUC12_ATTRIBUTES_FILE

        if not len(path):
            raise ValueError('settings.HUC12_ATTRIBUTES_FILE must be set before calling this function')
        if not os.path.exists(path):
            raise IOError("Unable to attributes file path\n\t%s" % (path))

        print('Reading HUC12_ATTRIBUTES_FILE metadata file:\n\t%s' % (path))
        try:
            infile = open(path, 'r')  # CSV file
            reader = csv.DictReader(infile)
        except:
            ex = sys.exc_info()
            print('Exception 641: %s: %s' % (ex[0], ex[1]))
            exit()

        row_count = 0

        with transaction.atomic():
            for row in reader:
                row_count += 1

                print(row['huc12'] + '--' + row['name'])

                # protect from excel stripping leading zero
                if len(row['huc12']) % 2 != 0:
                    row['huc12'] = '0' + row['huc12']

                if row['distance_km'] == "-9999":
                    row['distance_km'] = None

                if int(row['terminal_outlet_type_code']) <= -20:
                    row['terminal_outlet_type_code'] = int(row['terminal_outlet_type_code']) / 10
                else:
                    row['terminal_outlet_type_code'] = int(row['terminal_outlet_type_code'])

                _, created = WBD.objects.update_or_create(

                    huc_code=row['huc12'],
                    defaults = {
                        'name': row['name'],
                        'area_sq_km': transform_area_sq_km(row['area_sq_km']),
                        'water_area_sq_km': row['water_area_sq_km'],
                        'comid': row['comid'],
                        'huc12_ds': row['huc12_ds'],
                        'distance_km': row['distance_km'],
                        'multiple_outlet_bool': row['multiple_outlet_bool'],
                        'sink_bool': row['sink_bool'],
                        'headwater_bool': row['headwater_bool'],
                        'terminal_bool': row['terminal_bool'],
                        'terminal_huc12_ds': row['terminal_huc12_ds'],
                        'terminal_outlet_type_code': row['terminal_outlet_type_code'],
                        'hu12_ds_count_nu': row['hu12_ds_count_nu'],
                    }

                )

        #TODO: delete the navigation cache

        print(" Loaded %s rows in %s seconds" % (row_count, (dt.now() - startTime).total_seconds()))


    def handle(self, *args, **options):
        self._create_data()