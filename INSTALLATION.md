

## Installation Notes for django (python) web application 'wbd'

These notes are random as I try to install on a new system running
Windows 2016 Datacenter


## Folder Structure

I download all external (public) software that I'm going to install into  
    `C:\downloads`

I install all new software into folder so admin users can find out what I have installed
    `C:\software`

I use a separate folder in inetpub to hold Django applications  
    `C:\inetpub\wwwdjango`

## Prerequisites

These are the packages required on the web server that are not covered in these notes

1. `git` https://git-scm.com/download/win
This is installed via a GUI
In Select Components you can uncheck all options

2. `IIS with FastCGI installed` https://docs.microsoft.com/en-us/iis/configuration/system.webserver/fastcgi/
	
## Install Python

Download Python 3.8.0 from https://www.python.org/downloads/ (25.2 MB)

Install python version 3.8 into folder  
	`C:\software\Python\Python38`

Python is installed via a GUI
You might have to run the installer as Admin
In Optional Features only check 'pip'
Use Advanced Options uncheck everything, but set the location to install.

Customize install location  
`C:\software\Python\Python38`

Add python to System Environmental Variable 'Path'
Include 2 folders
	`C:\software\Python\Python38` and  
	`C:\software\Python\Python38\Scripts`
	
Install Python in folder
~~~~
user.name@MACHINENAME C:\software\Python\Python38
$ python --version
Python 3.8.0
~~~~
Upgrade Python Installation Program (pip)
~~~~
user.name@MACHINENAME C:\software\Python\Python38
$ python -m pip install --upgrade pip
~~~~
Show version of pip
~~~~
user.name@MACHINENAME C:\software\Python\Python38
$ pip --version
pip 19.3.1 from c:\software\python\python38\lib\site-packages\pip (python 3.8)
~~~~
Install python package virtualenv
~~~~
user.name@MACHINENAME C:\software\Python\Python38
$ pip install virtualenv
Collecting virtualenv
  Downloading https://files.pythonhosted.org/packages/c5/97/00dd42a0fc41e9016b23f07ec7f657f636cb672fad9cf72b80f8f65c6a46/virtualenv-16.7.7-py2.py3-none-any.whl (3.4MB)
     |████████████████████████████████| 3.4MB 939kB/s
Installing collected packages: virtualenv
Successfully installed virtualenv-16.7.7
~~~~


## Download a copy of the application from github
~~~~
user.name@MACHINENAME C:\inetpub\wwwdjango
$ git clone https://github.com/JamesBisese/wbd.git
Cloning into 'wbd'...
remote: Enumerating objects: 286, done.
remote: Counting objects: 100% (286/286), done.
remote: Compressing objects: 100% (158/158), done.
remote: Total 286 (delta 111), reused 276 (delta 107), pack-reused 0
Receiving objects: 100% (286/286), 46.47 MiB | 16.63 MiB/s, done.
Resolving deltas: 100% (111/111), done.
Updating files: 100% (104/104), done.

user.name@MACHINENAME C:\inetpub\wwwdjango
$ chdir wbd

user.name@MACHINENAME C:\inetpub\wwwdjango\wbd
$ dir
 Volume in drive C is Windows
 Volume Serial Number is 9AA8-C0AB`

 Directory of C:\inetpub\wwwdjango\wbd

10/25/2019  12:24 PM    <DIR>          .
10/25/2019  12:24 PM    <DIR>          ..
10/25/2019  12:24 PM               577 manage.py
10/25/2019  12:24 PM             1,568 README.md
10/25/2019  12:24 PM               685 requirements.txt
10/25/2019  12:24 PM    <DIR>          wbd
10/25/2019  12:24 PM    <DIR>          wbdchart
10/25/2019  12:24 PM    <DIR>          wbddata
10/25/2019  12:24 PM    <DIR>          wbdmap
               3 File(s)          2,830 bytes
               6 Dir(s)  108,194,848,768 bytes free
~~~~

## Create a virtualenv for the application

This python virtual environment is used to sandbox all changes just for this single application
~~~~
user.name@MACHINENAME C:\inetpub\wwwdjango
$ chdir C:\software\Python\virtualenvs

user.name@MACHINENAME C:\software\Python\virtualenvs
# virtualenv wbd
Using base prefix 'c:\\software\\python\\python38'
New python executable in C:\software\Python\virtualenvs\wbd\Scripts\python.exe
Installing setuptools, pip, wheel...
done.
~~~~
Go into that folder and 'activate' the virtual environment.
  Note that the prompt changes to indicate that the virtual env is active
~~~~
user.name@MACHINENAME C:\software\Python\virtualenvs
# chdir wbd\Scripts

user.name@MACHINENAME C:\software\Python\virtualenvs\wbd\Scripts
# activate

(wbd) user.name@MACHINENAME C:\software\Python\virtualenvs\wbd\Scripts
#
~~~~
## Install all required python packages 

Using the virtual environment, all the packages will be installed on the virtual environment 
folder `C:\software\Python\virtualenvs\wbd` and will not affect the system-wide python installation.

The file `C:\inetpub\wwwdjango\wbd\requirements.txt` contains a list of all the external python packages needed  to run the django app

From experience, I know that there is one package called `lxml` that you need to get a pre-compiled version for windows
See: 'https://www.lfd.uci.edu/~gohlke/pythonlibs/#lxml'

On that page download `lxml-4.4.1-cp38-cp38-win32.whl` to 
	`C:\downloads\lxml-4.4.1-cp38-cp38-win32.whl`

Install pre-compiled python lxml package
~~~~
(wbd) user.name@MACHINENAME C:\software\Python\virtualenvs\wbd\Scripts
# pip install C:\downloads\lxml-4.4.1-cp38-cp38-win32.whl
Processing c:\downloads\lxml-4.4.1-cp38-cp38-win32.whl
Installing collected packages: lxml
Successfully installed lxml-4.4.1
~~~~
Install all the rest of the required packages using the requirements file

NOTE: the output will vary a bit from this, since I repeated these commands during testing and so have 'caches' of the files
~~~~
(wbd) user.name@MACHINENAME C:\software\Python\virtualenvs\wbd\Scripts
# pip install -r C:\inetpub\wwwdjango\wbd\requirements.txt
Processing c:\users\james.bisese\appdata\local\pip\cache\wheels\6b\e2\88\ffb3e712f4e961427fd2dab733bf86dcd725d35b659fc18072\anytree-2.6.0-py2.py3-none-any.whl
Collecting backports.csv==1.0.7
  Using cached https://files.pythonhosted.org/packages/8e/26/a6bd68f13e0f38fbb643d6e497fc3462be83a0b6c4d43425c78bb51a7291/backports.csv-1.0.7-py2.py3-none-any.whl
Collecting certifi==2019.9.11
  Using cached https://files.pythonhosted.org/packages/18/b0/8146a4f8dd402f60744fa380bc73ca47303cccf8b9190fd16a827281eac2/certifi-2019.9.11-py2.py3-none-any.whl
Collecting chardet==3.0.4
  Using cached https://files.pythonhosted.org/packages/bc/a9/01ffebfb562e4274b6487b4bb1ddec7ca55ec7510b22e4c51f14098443b8/chardet-3.0.4-py2.py3-none-any.whl
Collecting coreapi==2.3.3
  Using cached https://files.pythonhosted.org/packages/fc/3a/9dedaad22962770edd334222f2b3c3e7ad5e1c8cab1d6a7992c30329e2e5/coreapi-2.3.3-py2.py3-none-any.whl
Processing c:\users\james.bisese\appdata\local\pip\cache\wheels\10\7b\ba\04fcd6b33e6123ca11a5f5ab56decb1a2d87ced028377a1377\coreschema-0.0.4-cp38-none-any.whl
Collecting defusedxml==0.6.0
  Using cached https://files.pythonhosted.org/packages/06/74/9b387472866358ebc08732de3da6dc48e44b0aacd2ddaa5cb85ab7e986a2/defusedxml-0.6.0-py2.py3-none-any.whl
Collecting Django==2.2.5
  Using cached https://files.pythonhosted.org/packages/94/9f/a56f7893b1280e5019482260e246ab944d54a9a633a01ed04683d9ce5078/Django-2.2.5-py3-none-any.whl
Processing c:\users\james.bisese\appdata\local\pip\cache\wheels\25\c6\73\c7f5490c9b4efcdc915e0cbecc190ffd3c6c85507a6ebfeb83\django_adaptors-0.2.5-cp38-none-any.whl
Collecting django-tables2==2.1.1
  Using cached https://files.pythonhosted.org/packages/10/15/614b4945666806817fb6ad4c9470c0fd1c029135ef01814159de7ced451e/django_tables2-2.1.1-py2.py3-none-any.whl
Collecting djangorestframework==3.10.3
  Using cached https://files.pythonhosted.org/packages/33/8e/87a4e0025e3c4736c1dc728905b1b06a94968ce08de15304417acb40e374/djangorestframework-3.10.3-py3-none-any.whl
Processing c:\users\james.bisese\appdata\local\pip\cache\wheels\05\b0\fb\72b63fe28135764321aaee160ed211c36ea5bc979bb6cbdfda\djangorestframework_csv-2.1.0-cp38-none-any.whl
Collecting djangorestframework-datatables==0.5.0
  Using cached https://files.pythonhosted.org/packages/7f/3d/515911b8975bcc47ce52bf0c60185adc0b2ed828dee660273de8390bea4d/djangorestframework_datatables-0.5.0-py2.py3-none-any.whl
Collecting djangorestframework-xml==1.4.0
  Using cached https://files.pythonhosted.org/packages/c3/29/321c2be2995d28d0daf7c91093520b00ed2c7ac1bd5a5b5a744eed76214a/djangorestframework_xml-1.4.0-py2.py3-none-any.whl
Processing c:\users\james.bisese\appdata\local\pip\cache\wheels\2a\77\35\0da0965a057698121fc7d8c5a7a9955cdbfb3cc4e2423cad39\et_xmlfile-1.0.1-cp38-none-any.whl
Collecting idna==2.8
  Using cached https://files.pythonhosted.org/packages/14/2c/cd551d81dbe15200be1cf41cd03869a46fe7226e7450af7a6545bfc474c9/idna-2.8-py2.py3-none-any.whl
Processing c:\users\james.bisese\appdata\local\pip\cache\wheels\7b\52\af\4e27324812e7ab7bbbc30f748d317f3739477562325cb4c723\itypes-1.1.0-cp38-none-any.whl
Collecting jdcal==1.4.1
  Using cached https://files.pythonhosted.org/packages/f0/da/572cbc0bc582390480bbd7c4e93d14dc46079778ed915b505dc494b37c57/jdcal-1.4.1-py2.py3-none-any.whl
Collecting Jinja2==2.10.1
  Using cached https://files.pythonhosted.org/packages/1d/e7/fd8b501e7a6dfe492a433deb7b9d833d39ca74916fa8bc63dd1a4947a671/Jinja2-2.10.1-py2.py3-none-any.whl
Requirement already satisfied: lxml==4.4.1 in c:\software\python\virtualenvs\wbd\lib\site-packages (from -r C:\inetpub\wwwdjango\wbd\requirements.txt (line 20)) (4.4.1)
Processing c:\users\james.bisese\appdata\local\pip\cache\wheels\f2\aa\04\0edf07a1b8a5f5f1aed7580fffb69ce8972edc16a505916a77\markupsafe-1.1.1-cp38-none-any.whl
Processing c:\users\james.bisese\appdata\local\pip\cache\wheels\27\e6\c7\adc38b19993e22e1f7bea6ff388c7fcda941a2a17258d6e8f3\msgpack-0.6.2-cp38-cp38-win32.whl
Processing c:\users\james.bisese\appdata\local\pip\cache\wheels\06\2d\19\f5a4eed468fecff295ff8ac49e5dd5fb22d7ffc7ff072deabf\odfpy-1.4.0-py2.py3-none-any.whl
Processing c:\users\james.bisese\appdata\local\pip\cache\wheels\51\fa\dc\7eb403214c40a01befafce3ec0d215176d451d106a431d6781\openpyxl-2.6.3-py2.py3-none-any.whl
Collecting pytz==2019.2
  Using cached https://files.pythonhosted.org/packages/87/76/46d697698a143e05f77bec5a526bf4e56a0be61d63425b68f4ba553b51f2/pytz-2019.2-py2.py3-none-any.whl
Processing c:\users\james.bisese\appdata\local\pip\cache\wheels\d9\45\dd\65f0b38450c47cf7e5312883deb97d065e030c5cca0a365030\pyyaml-5.1.2-cp38-cp38-win32.whl
Collecting requests==2.22.0
  Using cached https://files.pythonhosted.org/packages/51/bd/23c926cd341ea6b7dd0b2a00aba99ae0f828be89d72b2190f27c11d4b7fb/requests-2.22.0-py2.py3-none-any.whl
Collecting six==1.12.0
  Using cached https://files.pythonhosted.org/packages/73/fb/00a976f728d0d1fecfe898238ce23f502a721c0ac0ecfedb80e0d88c64e9/six-1.12.0-py2.py3-none-any.whl
Collecting sqlparse==0.3.0
  Using cached https://files.pythonhosted.org/packages/ef/53/900f7d2a54557c6a37886585a91336520e5539e3ae2423ff1102daf4f3a7/sqlparse-0.3.0-py2.py3-none-any.whl
Collecting tablib==0.13.0
  Using cached https://files.pythonhosted.org/packages/7b/c7/cb74031b330cd94f3580926dc707d148b4ba9138449fc9f433cb79e640d8/tablib-0.13.0-py3-none-any.whl
Collecting tzlocal==2.0.0
  Using cached https://files.pythonhosted.org/packages/ef/99/53bd1ac9349262f59c1c421d8fcc2559ae8a5eeffed9202684756b648d33/tzlocal-2.0.0-py2.py3-none-any.whl
Processing c:\users\james.bisese\appdata\local\pip\cache\wheels\a6\09\e9\e800279c98a0a8c94543f3de6c8a562f60e51363ed26e71283\unicodecsv-0.14.1-cp38-none-any.whl
Collecting uritemplate==3.0.0
  Using cached https://files.pythonhosted.org/packages/e5/7d/9d5a640c4f8bf2c8b1afc015e9a9d8de32e13c9016dcc4b0ec03481fb396/uritemplate-3.0.0-py2.py3-none-any.whl
Collecting urllib3==1.25.6
  Using cached https://files.pythonhosted.org/packages/e0/da/55f51ea951e1b7c63a579c09dd7db825bb730ec1fe9c0180fc77bfb31448/urllib3-1.25.6-py2.py3-none-any.whl
Processing c:\users\james.bisese\appdata\local\pip\cache\wheels\41\08\4c\ca04f4a87b91080dc6a631bbd82390e4412dfefb7a236d5f94\wfastcgi-3.0.0-py2.py3-none-any.whl
Collecting xlrd==1.2.0
  Using cached https://files.pythonhosted.org/packages/b0/16/63576a1a001752e34bf8ea62e367997530dc553b689356b9879339cf45a4/xlrd-1.2.0-py2.py3-none-any.whl
Collecting xlwt==1.3.0
  Using cached https://files.pythonhosted.org/packages/44/48/def306413b25c3d01753603b1a222a011b8621aed27cd7f89cbc27e6b0f4/xlwt-1.3.0-py2.py3-none-any.whl
Installing collected packages: six, anytree, backports.csv, certifi, chardet, idna, urllib3, requests, itypes, uritemplate, MarkupSafe, Jinja2, coreschema, 
coreapi, defusedxml, pytz, sqlparse, Django, django-adaptors, django-tables2, djangorestframework, unicodecsv, djangorestframework-csv, djangorestframework-datatables, 
djangorestframework-xml, et-xmlfile, jdcal, msgpack, odfpy, openpyxl, PyYAML, xlrd, xlwt, tablib, tzlocal, wfastcgi
Successfully installed Django-2.2.5 Jinja2-2.10.1 MarkupSafe-1.1.1 PyYAML-5.1.2 anytree-2.6.0 backports.csv-1.0.7 certifi-2019.9.11 chardet-3.0.4 coreapi-2.3.3 
coreschema-0.0.4 defusedxml-0.6.0 django-adaptors-0.2.5 django-tables2-2.1.1 djangorestframework-3.10.3 djangorestframework-csv-2.1.0 djangorestframework-datatables-0.5.0 
djangorestframework-xml-1.4.0 et-xmlfile-1.0.1 idna-2.8 itypes-1.1.0 jdcal-1.4.1 msgpack-0.6.2 odfpy-1.4.0 openpyxl-2.6.3 pytz-2019.2 requests-2.22.0 six-1.12.0 
sqlparse-0.3.0 tablib-0.13.0 tzlocal-2.0.0 unicodecsv-0.14.1 uritemplate-3.0.0 urllib3-1.25.6 wfastcgi-3.0.0 xlrd-1.2.0 xlwt-1.3.0

(wbd) user.name@MACHINENAME C:\software\Python\virtualenvs\wbd\Scripts
#
~~~~

## Configure the Application

The web application software is now installed.  Now the backend database needs 
to be created and populated.

## Create the Database

Now the backend database needs to be created and all 
lookup data needs to be loaded from CSV text files into the database.

**NOTE:** *this documentation is for using SQLLite database,
it will vary a bit depending on the ODBMS used.*

Using SQLLite database, the database is stored in file  
    `C:\inetpub\wwwdjango\wbd\db.sqlite3`

Run the python django process to make a set of standard tables
used for authorization and managing sessions
~~~~
(wbd) C:\inetpub\wwwdjango\wbd>python manage.py migrate
Operations to perform:
  Apply all migrations: admin, auth, contenttypes, sessions, wbddata
Running migrations:
  Applying contenttypes.0001_initial... OK
  Applying auth.0001_initial... OK
  Applying admin.0001_initial... OK
  Applying admin.0002_logentry_remove_auto_add... OK
  Applying admin.0003_logentry_add_action_flag_choices... OK
  Applying contenttypes.0002_remove_content_type_name... OK
  Applying auth.0002_alter_permission_name_max_length... OK
  Applying auth.0003_alter_user_email_max_length... OK
  Applying auth.0004_alter_user_username_opts... OK
  Applying auth.0005_alter_user_last_login_null... OK
  Applying auth.0006_require_contenttypes_0002... OK
  Applying auth.0007_alter_validators_add_error_messages... OK
  Applying auth.0008_alter_user_username_max_length... OK
  Applying auth.0009_alter_user_last_name_max_length... OK
  Applying auth.0010_alter_group_name_max_length... OK
  Applying auth.0011_update_proxy_permissions... OK
  Applying sessions.0001_initial... OK

~~~~

Run python django process to make migration scripts that automate the 
process of creating tables and related objects in the database.
~~~~
(wbd) user.name@MACHINENAME C:\inetpub\wwwdjango\wbd
# python manage.py makemigrations wbddata
Migrations for 'wbddata':
  wbddata\migrations\0001_initial.py
    - Create model HUC
    - Create model WBD
    - Create model WBDAttributes
    - Create model HuNavigator
    - Create index huc_code_idx on field(s) huc_code of model hunavigator
    - Create index upstream_huc_code_idx on field(s) upstream_huc_code of model hunavigator
    - Alter unique_together for hunavigator (1 constraint(s))
~~~~

Run the python django process to run the migration scripts 
and create tables and related objects in the database.

~~~~
(wbd) user.name@MACHINENAME C:\inetpub\wwwdjango\wbd
# python manage.py migrate wbddata
Operations to perform:
  Apply all migrations: wbddata
Running migrations:
  Applying wbddata.0001_initial... OK

(wbd) user.name@MACHINENAME C:\inetpub\wwwdjango\wbd
#
~~~~

## Populate the Database

Now you have to load the data into the tables using 
python django 'command' scripts.

The data that is loaded into the database is all in folder  
    `C:\inetpub\wwwdjango\wbd\wbddata\static\data`

All the files are CSV (text files)

~~~~
user.name@MACHINENAME C:\Data_and_Tools\django_install\wbd
$ chdir C:\inetpub\wwwdjango\wbd\wbddata\static\data

user.name@MACHINENAME C:\inetpub\wwwdjango\wbd\wbddata\static\data
$ dir
...
10/22/2019  05:24 PM         6,917,283 geography.csv
10/22/2019  05:24 PM        11,123,358 huc12_attributes.csv
10/22/2019  05:24 PM         6,313,002 huc12_route.csv
10/22/2019  05:24 PM           134,008 huc_hydrologic_unit_codes.csv
10/22/2019  05:24 PM        77,923,289 metrics2016.csv
10/22/2019  05:24 PM        30,412,333 metrics2017.csv
10/22/2019  05:24 PM         6,917,283 metrics2020.csv
10/22/2019  05:24 PM            98,822 wbd_attributes.csv
10/22/2019  05:24 PM        11,123,359 wbd_navigation.csv
...

~~~~

The command scripts are in folder  
    `C:\inetpub\wwwdjango\wbd\wbddata\management\commands`

The scripts have to be run in a particular order to deal with dependencies.

The output from the command scripts has been removed.
~~~~
(wbd) user.name@MACHINENAME C:\inetpub\wwwdjango\wbd
# python manage.py load_HUC
...

(wbd) user.name@MACHINENAME C:\inetpub\wwwdjango\wbd
# python manage.py load_WBD
...

(wbd) user.name@MACHINENAME C:\inetpub\wwwdjango\wbd
# python manage.py load_WbdAttributes

(wbd) user.name@MACHINENAME C:\inetpub\wwwdjango\wbd
# python manage.py load_HuNavigator
~~~~

Then run a command does not load data into the database, but 
 instead makes a set of folders and files that improve 
 the performance of the system used to export Attribute data
~~~~
(wbd) user.name@MACHINENAME C:\inetpub\wwwdjango\wbd
# python manage.py create_source_category_indicator_files
~~~~

This command will create additional sub-folders so that the data 
folder now contains  

~~~~
user.name@MACHINENAME C:\Data_and_Tools\django_install\wbd
$ chdir C:\inetpub\wwwdjango\wbd\wbddata\static\data

user.name@MACHINENAME C:\inetpub\wwwdjango\wbd\wbddata\static\data
$ dir
...
10/22/2019  06:09 PM    <DIR>          django_cache
10/22/2019  06:04 PM    <DIR>          Geography
10/22/2019  05:24 PM         6,917,283 geography.csv
10/22/2019  05:24 PM        11,123,358 huc12_attributes.csv
10/22/2019  05:24 PM         6,313,002 huc12_route.csv
10/22/2019  05:24 PM           134,008 huc_hydrologic_unit_codes.csv
10/22/2019  05:24 PM        77,923,289 metrics2016.csv
10/22/2019  05:24 PM        30,412,333 metrics2017.csv
10/22/2019  05:24 PM         6,917,283 metrics2020.csv
10/22/2019  06:04 PM    <DIR>          Service2016
10/22/2019  06:04 PM    <DIR>          Service2017
10/22/2019  05:24 PM            98,822 wbd_attributes.csv
10/22/2019  05:24 PM        11,123,359 wbd_navigation.csv
...

~~~~

Now run a command to collect all the files that will be 
served from IIS as 'static' files (not django application).
Static files include images, javascript, and css.

~~~~
(wbd) james.bisese@DIVS704INSWEB1 C:\inetpub\wwwdjango\wbd
$ python manage.py collectstatic

You have requested to collect static files at the destination
location as specified in your settings:

    C:\inetpub\wwwdjango\wbd\static

This will overwrite existing files!
Are you sure you want to do this?

Type 'yes' to continue, or 'no' to cancel: yes

222 static files copied to 'C:\inetpub\wwwdjango\wbd\static'.

~~~~

### Run the application using the django development server

The application is now setup.  

It can be run in a development mode, and viewed in a web browser
locally using this command.

~~~~
(wbd) user.name@MACHINENAME C:\inetpub\wwwdjango\wbd
$ python manage.py runserver 8000
Performing system checks...

System check identified no issues (0 silenced).

You have 17 unapplied migration(s). Your project may not work properly until you apply the migrations for app(s): admin, auth, contenttypes, sessions.
Run 'python manage.py migrate' to apply them.

October 25, 2019 - 13:32:09
Django version 2.2.5, using settings 'wbd.development_settings'
Starting development server at http://127.0.0.1:8000/
Quit the server with CTRL-BREAK.
~~~~

### Test local access via django development server

Then us a web-browser (running on the web server) and visit  
    [http://127.0.0.1:8000](http://127.0.0.1:8000 "http://127.0.0.1:8000")

#  Configure application in IIS

**Note:** *In these notes the application is installed as a 
Application under the Default Web Site in IIS.*

In IIS, add the folder `C:\inetpub\wwwdjango\wbd` as an Application

Set the `Alias` to **wbd** and set the `Physical path` to `C:\inetpub\wwwdjango\wbd`

In IIS, double-click the 'wbd' application and open the **Handler Mappings** feature.

Set the fields:  
1. Request path: `*`    
2. Module: `FastCgiModule`  
3. Executable: 
    `C:\software\Python\virtualenvs\wbd\Scripts\python.exe|C:\software\Python\virtualenvs\wbd\Lib\site-packages\wfastcgi.py`  
4. Name: `WBD FastCGI Module`

When you close this dialog it will prompt to save a FastCGI application.  Click 'yes'

In IIS, select the server machine node (first line after Start Page)

Then double-click 'FastCGI Settings' feature.

Select the row with the Full Path `C:\software\Python\virtualenvs\wbd\Scripts\python.exe` 

Click Edit... from the Actions menu 

In the Edit FastCGI Application menu, select the 'Environment Variables' row
and double-click the '...' button on the right side.

Now add 3 entries:

Name: `PYTHONPATH`  
Value: `C:\inetpub\wwwdjango\wbd`

Name: `WSGI_HANDLER`  
Value: `django.core.wsgi.get_wsgi_application()`

Name: `DJANGO_SETTINGS_MODULE`  
Value: `wbd.production_settings`

Now make sure the 'static' folder is configured correctly

In IIS, expand the 'wbd' node, and then click the 'static' subfolder.

Click the 'Handler Mappings' feature, and click 'View ordered list'
The 'StaticFile' handler should be at the top of the list.  If not, use
the 'Move Up' option to move it to the top.

### Test local access via IIS

Now use a web-browser (on the web server) and visit  
    [http://localhost/wbd](http://localhost/wbd "http://localhost/wbd")

# Configure for external access

Now you should be able to view the web application from 
another computer after making 1 edit.

Django has a security feature that requires setting the HTTP name
of the server the application is running on.

Edit the file
    `C:\inetpub\wwwdjango\wbd\wbd\production_settings.py`

Find the line that looks like this

ALLOWED_HOSTS = ['localhost',]

and add the hostname that users will use to reach the application.

For example

ALLOWED_HOSTS = ['localhost', 'insdev1.tetratech.com',]

### Test external access via IIS

Now use a web-browser (on the web server) and visit  
    [https://insdev1.tetratech.com/wbd](https://insdev1.tetratech.com/wbd "https://insdev1.tetratech.com/wbd")


