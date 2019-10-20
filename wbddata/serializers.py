import re
from rest_framework import routers, serializers, viewsets
from rest_framework.reverse import reverse

from .models import HUC, WBD, WBDAttributes


# Serializers define the API representation.

'''
    return HU type name for any 2-digit HU level
'''
def huc_type(argument):
    switcher = {
        2: "Region",
        4: "Subregion",
        6: "AccountingUnit",
        8: "CatalogingUnit",
        12: "Subwatershed",
    }
    return switcher.get(argument, "Invalid month")

class EmbeddedHU12Downstream(serializers.Field):
    def to_representation(self, value):

        ret = {
            "huc_code": value.huc12_ds,
            "name": 'n/a',
        }
        return ret

class EmbeddedTerminalOutlet(serializers.Field):

    # outlet_type_code_display = serializers.SerializerMethodField()
    # def get_outlet_type_code_display(self, obj):
    #     return obj.get_terminal_outlet_type_code_display()

    def to_representation(self, value):
        #
        # self.huc_code = value

        ret = {
            "huc_code": value.terminal_huc12_ds,
            "name": 'n/a',
            "hu12_ds_count_nu": value.hu12_ds_count_nu,
            "outlet_type": value.get_terminal_outlet_type_code_display(),
            "outlet_type_code": value.terminal_outlet_type_code,

        }
        return ret




'''
    create all the navigation resources with labels (URLs)
'''
class EmbeddedResources(serializers.Field):

    huc_code = None
    hu_level = None

    def to_representation(self, value):
        #
        ret = {}

        self.huc_code = value
        self.hu_level = len(self.huc_code)

        for level in [2, 4, 6, 8]:
            if self.hu_level >= level:
                ret["h" + str(level)] = {
                    "title": "5. Detail of {}(hu{}) '{}'".format(huc_type(level), level, self.huc_code[0:level]),
                    "url": reverse('wbddata:' + huc_type(level).lower() + '-list',
                                   kwargs={ 'huc_code': self.huc_code[0:level] },
                                   request=self.context['request']),
                }

        if self.hu_level <= 8:
            next_level = self.hu_level + 2
            if next_level == 10:
                next_level += 2

            ret['drilldown'] = {
                # 'Description': "4. Drilldown from {}(hu{}) '{}' to {}(hu{})".format(
                #                                                                                   huc_type(self.hu_level), self.hu_level,
                #                                                                                   self.huc_code,  huc_type(next_level), next_level),
                                'title': "4. Drilldown to {}(hu{}) within {}(hu{}) '{}' ".format(huc_type(next_level), next_level,
                                                                                 huc_type(self.hu_level), self.hu_level,
                                                                                 self.huc_code,

                                                                                 ),
                                 'url': reverse('wbddata:' + huc_type(self.hu_level).lower() + '-drilldown',
                                                kwargs={'huc_code': self.huc_code,},
                                                request=self.context['request'])
                                 }
        else:
            ret["h12"] = {
                "title": "7. Detail of {}(hu{}) '{}'".format(huc_type(12), 12, self.huc_code),
                "url": reverse('wbddata:' + huc_type(12).lower() + '-udetail',
                               kwargs={ 'huc_code': self.huc_code },
                               request=self.context['request']),
            }
            ret["upstream"] = {
                "title": "API JSON Upstream from '{}'".format(self.huc_code),
                "url": reverse('wbddata:' + huc_type(12).lower() + '-upstream',
                               kwargs={ 'huc_code': self.huc_code },
                               request=self.context['request']),
            }
            if not isinstance(self.parent.instance, list):
                terminal_huc12_ds = self.parent.instance.terminal_huc12_ds
            else:
                terminal_huc12_ds = self.parent.instance[0].terminal_huc12_ds
            ret["downstream"] = {
                "title": "API JSON Downstream from '{}'".format(self.huc_code),
                "url": reverse('wbddata:' + huc_type(12).lower() + '-downstream',
                               kwargs={ 'huc_code': self.huc_code },
                               request=self.context['request']),
            }

        return ret

'''
    serialize HU2 - HU8 hydrologic units
'''
class HUCSerializer(serializers.HyperlinkedModelSerializer):

    '''
        embed the resources (things available online)
    '''
    resources = EmbeddedResources(source='huc_code')

    '''
        the list of states is attached to each region name. this removes them
        "New England Region (CT,ME,MA,NH,NY,RI,VT)"
        and it prepends the HUC Code
    '''
    name = serializers.SerializerMethodField()
    def get_name(self, obj):
        return re.sub(r'\s+\([^)]*\)', '', obj.name)

    long_name = serializers.SerializerMethodField()
    def get_long_name(self, obj):
        return obj.huc_code + ' ' + obj.name

    state_fip_codes = serializers.SerializerMethodField()
    def get_state_fip_codes(self, obj):
        state_codes_tx = obj.name[obj.name.find("(")+1:obj.name.find(")")]
        return state_codes_tx.split(",")

    class Meta:
        model = HUC
        fields = ('huc_code',
                  'name',
                  'long_name',
                  'state_fip_codes',
                  'resources', )

    '''
        not necessary to override, but provides example of pre- and post- changes to results
    '''
    def __init__(self, *args, **kwargs):

        hudigit_nu = kwargs.pop('hudigit_nu', None)

        super(HUCSerializer, self).__init__(*args, **kwargs)

        # if hudigit_nu and hudigit_nu > 0:
        #     for hud in (2, 4, 6, 8):
        #         if hud > hudigit_nu:
        #             self.fields.pop('h' + str(hud) + '_url')
        # if hudigit_nu and hudigit_nu == 8:
        #     self.fields.pop('drilldown_url')


'''
    serializer for WBD (hu12) hydrologic units
'''
class WBDSerializer(serializers.ModelSerializer):

    '''
        embed the resources (urls for other navigation items)
    '''
    resources = EmbeddedResources(source='huc_code')

    terminal_hu12_ds = EmbeddedTerminalOutlet(source='*')

    hu12_ds = EmbeddedHU12Downstream(source='*')

    class Meta:
        model = WBD
        fields = (
                # "comid", #TODO: consider using this or not
                "huc_code",
                "name",
                "distance_km",
                "area_sq_km",
                "water_area_sq_km",
                "multiple_outlet_bool",
                "sink_bool",
                "headwater_bool",
                "terminal_bool",
                "hu12_ds",
                "terminal_hu12_ds",
                "resources",
        )
        read_only_fields = [f.name for f in WBD._meta.get_fields()]

    def __init__(self, *args, **kwargs):

        # remove this so the base class doesn't complain
        hudigit_nu = kwargs.pop('hudigit_nu', None)

        # huc_code = kwargs.pop('huc_code', None)
        super(WBDSerializer, self).__init__(*args, **kwargs)

'''

    serializer for WBD Attributes (Metadata)

'''
class WBDAttributeSerializer(serializers.ModelSerializer):

    class Meta:
        model = WBDAttributes
        fields = [
                    'sort_nu',
                    'source_tx',
                    'category_name',
                    'field_nm',
                    'label_tx',
                    'rest_layer_name',
                    'units_tx',

                    'statistic_cd',

                    'description_tx',
                ]
        read_only_fields = [f.name for f in WBDAttributes._meta.get_fields()]

    def __init__(self, *args, **kwargs):

        super(WBDAttributeSerializer, self).__init__(*args, **kwargs)