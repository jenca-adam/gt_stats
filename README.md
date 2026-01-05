# gt\_stats

A stats viewer for Geotastic.

## Hosting locally

1. [Install Python 3](https://www.python.org/downloads), if not yet installed.
1. [Set up a virtualenv](https://virtualenv.pypa.io/en/latest/user_guide.html). If virtualenv didn't come with your Python install, [Install it](https://virtualenv.pypa.io/en/latest/installation.html).
1. Install the requirements: run `python -m pip install requirements.txt` from the command line in this directory.
1. Create a `credentials.json` file in this directory: should be `{"username":"<your username here>", "password":"<your password here>"}`. It's recommended to create a separate account for this, as you will be logged out from any active sessions.
1. Run `python app/server.py`
1. Open the address printed to the console in your browser of choice.
