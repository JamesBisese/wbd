"""
Django production settings for wbd project.

this is used to store 'sensitive' settings so they are not put in GitHub

first load .settings, then override as necessary

"""

try:
    from .settings import *
except ImportError:
    pass

"""
    Note for running in dev and on IIS
    for dev, this alias (url prefix) is blank
    for IIS - use production.py settings, which loads base, then production where this is set to IIS's name
    for the app

"""
IIS_APP_ALIAS = 'wbd/'

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = 'h9%1nbw#)xl(1(t@-0yyn#f*wym=_hy8et9pz8xofkgyw0#j-o'

DEBUG = False

ALLOWED_HOSTS = ['localhost', '107.162.141.89', 'divs704insweb1.tt.local','insdev1.tetratech.com',]

STATIC_URL = '/' + IIS_APP_ALIAS + 'static/'


