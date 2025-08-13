# TeMoto Action Assistant

## System requirements

Tarkvara: Node.js 18+, React 18+, Python 3.10+, ROS 2 Humble or newer

Hardware: Minimum – 4 core CPU, 8 GB RAM; Recommended – 8 core CPU, 16 GB RAM.

## Project setup

Install the repository

`git clone https://github.com/temoto-framework/temoto_action_assistant/edit/master/README.md`

Navigate to the root folder 

`cd temoto_action_assistant`

## Start the backend

Navigate to the backend folder 

`cd backend/`

Install dependencies

`pip install -r requirements.txt`

Run the server in Runtime mode (using ROS 2)

`python3 app.py --runtime`

Or run the server in Developer mode (without ROS 2)

`python3 app.py`

## Start the frontend 

Navigate to the root folder

`cd temoto_action_assistant`

Install dependencies

`npm install`

Run Frontend

`npm start`

Open [http://localhost:3000](http://localhost:3000) to view it the GUI in your browser.
