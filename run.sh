#!/bin/bash
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
    python3 -m venv .venv
    .venv/bin/pip install -q -r requirements.txt
fi

.venv/bin/uvicorn main:app --reload --host 0.0.0.0 --port 8000
