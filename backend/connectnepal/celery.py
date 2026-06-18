import os 
from celery import Celery

# set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'connectnepal.settings.dev')

app = Celery('connectnepal')


app.config_from_object('django.conf:settings', namespace='CELERY')

# Task loading from the django apps 
app.autodiscover_tasks()

@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """
    Debug Task to test Celery is working
    """
    print(f'Request: {self.request!r}')

