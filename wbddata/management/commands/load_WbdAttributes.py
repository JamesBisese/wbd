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
    help = 'load data from CSV file settings.WBD_ATTRIBUTES into ORM "WBDAttributes"'

    def _create_data(self):
        startTime = dt.now()
        path = settings.WBD_ATTRIBUTES

        if not len(path):
            raise ValueError('settings.WBD_ATTRIBUTES must be set before calling this function')
        if not os.path.exists(path):
            raise IOError("Unable to attributes metadata data file path\n\t%s" % (path))

        print('Reading WBD_ATTRIBUTES metadata file:\n\t%s' % (path))
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

        for row in reader:

            if row['field_nm'] == 'N/A':
                continue

            if not WBDAttributes.objects.filter(field_nm=row['field_nm'],source_tx=row['source_tx']).exists():

                i = WBDAttributes.objects.create(
                                            source_tx=row['source_tx'],
                                            sort_nu=row['sort_nu'],
                                            category_name=row['category_name'],
                                            rest_layer_name=row['rest_layer_name'],
                                            label_tx=row['label_tx'],
                                            field_nm=row['field_nm'],
                                            statistic_cd=row['statistic_cd'],
                                            units_tx=row['units_tx'],
                                            description_tx=row['description_tx']
                                            )
                print('created "{} -- {}"'.format(row['source_tx'], row['field_nm']))
            else:
                c = WBDAttributes.objects.get(field_nm=row['field_nm'],source_tx=row['source_tx'])
                changed_fields = set()

                for field_nm in (
                        'source_tx',
                        'sort_nu',
                        'category_name',
                        'rest_layer_name',
                        'label_tx',
                        'field_nm',
                        'statistic_cd',
                        'units_tx',
                        'description_tx',):

                    row[field_nm] = row[field_nm].strip()

                    if str(getattr(c, field_nm)) != str(row[field_nm]):
                        changed_fields.add(field_nm)
                        print("'{}' ne '{}'".format(getattr(c, field_nm), row[field_nm]))
                        setattr(c, field_nm, row[field_nm])

                if len(changed_fields) > 0:
                    print('updated "{} -- {}" field(s): '.format(row['source_tx'], row['field_nm']) + ', '.join(changed_fields))
                    c.save()
                else:
                    print('no updates for "{} -- {}"'.format(row['source_tx'], row['field_nm']))

        count_nu = WBDAttributes.objects.count()
        self.stdout.write('WBDAttributes.objects.count() == {}'.format(count_nu))
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