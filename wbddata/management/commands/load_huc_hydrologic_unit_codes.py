from django.core.management.base import BaseCommand
from wbddata.models import HUC, WBD
from django.conf import settings
import os
from datetime import datetime as dt
import csv
from adaptor.model import CsvDbModel

"""
(venv) C:\inetpub\wwwdjango\wbd>python manage.py load_huc_hydrologic_unit_codes
 Loaded 2908 rows in 47.644426 seconds

"""

class Command(BaseCommand):
    args = '<foo bar ...>'
    help = 'our help string comes here'

    def _create_data(self):
        startTime = dt.now()
        path = settings.HUC_FILE

        if not len(path):
            raise ValueError('settings.HUC_FILE must be set before calling this function')
        if not os.path.exists(path):
            raise IOError("Unable to huc file path\n\t%s" % (path))
        row_count = 0
        with open(path) as f:
            reader = csv.reader(f)
            for row in reader:
                row_count += 1

                huc_code = row[0]
                if len(huc_code) % 2 != 0:
                    huc_code = '0' + huc_code
                _, created = HUC.objects.get_or_create(
                    huc_code=huc_code,
                    huc_type=row[1],
                    name=row[2],
                )
                # creates a tuple of the new object or
                # current object and a boolean of if it was created



        print(" Loaded %s rows in %s seconds" % (row_count, (dt.now() - startTime).total_seconds()))


    def handle(self, *args, **options):
        self._create_data()