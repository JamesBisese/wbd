from django.conf import settings

# https://stackoverflow.com/questions/1271631/how-to-check-the-template-debug-flag-in-a-django-template

def default(context):
  return {'DEBUG': settings.DEBUG}