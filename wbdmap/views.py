import datetime

from django.http import HttpResponse
from django.shortcuts import render_to_response
from django.views import generic

# def IndexMap (request):
#     return render_to_response('index.html')

class IndexMap(generic.TemplateView):
    template_name = "index.html"

def OldMap (request):
    return render_to_response('indexOLD.html')

def ElevationSlopeMap (request):
    return render_to_response('index_elev_slope.html')

def Index(request):
    now = datetime.datetime.now()
    html = "<html><body>It is now %s.</body></html>" % now
    return HttpResponse(html)