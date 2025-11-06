from fastapi import APIRouter, FastAPI
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
import os
import multiprocessing
import time
import config
import Resource
from typing import Any


server_config = config.PythonConfig("config/server_config.py",default_config={
    "log_level" : 1,   #日志级别，数字越大,日志越详细，默认1
    "SystemMonitorSpeed" : 1, #系统监控速度，单位秒，默认1秒
    "extra_static" : [], #额外静态路径配置，默认空
})





