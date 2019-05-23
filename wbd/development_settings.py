"""
Django development settings for wbd project.

this is used to store 'sensitive' settings so they are not put in GitHub

first load .settings, then override as necessary

"""

try:
    from .settings import *
except ImportError:
    pass

import os
from django.conf import settings

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = 'h9%1nbw#)xl(1(t@-0yyn#f*wym=_hy8et9pz8xofkgyw0#j-o'

DEBUG = True

ALLOWED_HOSTS = []


