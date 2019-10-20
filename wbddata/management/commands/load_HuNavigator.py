from django.core.management.base import BaseCommand

from django.conf import settings
import os
from datetime import datetime as dt
import csv

from wbddata.models import HuNavigator, WBD

# this is slow, but it uses django to load, rather than doing it outside of the ORM
# (venv) C:\inetpub\wwwdjango\wbdtree>python manage.py load_huc12_route
#  Loaded 122974 rows in 3294.452 seconds

# in postgres with simplified structure
# (venv) C:\inetpub\wwwdjango\wbdtree>python manage.py load_huc12_route
#  Loaded 80743 rows in 151.919601 second
#
# C:\inetpub\wwwdjango\wbd\venv\Scripts\python.exe C:/inetpub/wwwdjango/wbdtree/manage.py load_huc12_route --traceback
# Console output is saving to: C:\inetpub\wwwdjango\wbdtree\wbddata\static\log\management.log
#  Loaded 80743 rows in 325.216202 seconds
#

# (venv) C:\inetpub\wwwdjango\wbd>python manage.py load_HuNavigator
#  Loaded 80743 rows in 1906.966155 seconds


# Process finished with exit code 0

class Command(BaseCommand):
    args = '<none>'
    help = 'load data from CSV file settings.HUC12_ATTRIBUTES_FILE into ORM "WBD"'

    def _create_data(self):
        startTime = dt.now()
        path = settings.HUC12_ROUTE_FILE

        if not len(path):
            raise ValueError('settings.HUC12_ROUTE_FILE must be set before calling this function')
        if not os.path.exists(path):
            raise IOError("Unable to route file path\n\t%s" % (path))

        nav_tree = set()
        with open(path) as f:
            # "route_id", "huc12", "huc12_us", "huc12_ds"
            reader = csv.reader(f)
            next(reader, None)  # skip the headers
            for row in reader:
                huc_code = row[1]
                upstream_huc_code = row[2]

                """
                
                this is some strange voodoo. using Node() you don't need
                a navigation element for the leaf nodes - they don't have 
                an upstream node, and Node() can figure that out without the extra entry. 
                
                """
                if upstream_huc_code == '-9999':
                    continue

                nav_tree.add((huc_code, upstream_huc_code))

        for n in sorted(nav_tree):
            # print(n)
            huc_code = n[0]
            upstream_huc_code = n[1]


            hc = WBD.objects.filter(huc_code__exact=huc_code).first()
            uhc = WBD.objects.filter(huc_code__exact=upstream_huc_code).first()
            _, created = HuNavigator.objects.get_or_create(
                huc_code=huc_code,
                upstream_huc_code=upstream_huc_code,
                huc_code_fk=hc,
                upstream_huc_code_fk=uhc,
            )

        #TODO: delete the navigation cache

        print(" Loaded %s rows in %s seconds" % (len(nav_tree), (dt.now() - startTime).total_seconds()))

    def handle(self, *args, **options):
        self._create_data()