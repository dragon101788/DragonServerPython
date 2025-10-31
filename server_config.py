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
    "server_list" : [ #服务列表，每个服务都是一个字典
        {
            "type" : "uvicorn",#服务类型uvicorn
            "enabled" : True, #是否启用，默认True
            "app" : "WebServer:app",#app的路径，格式为 module:app，例如 WebServer:app，WebServer是模块名，app是应用实例名
            "config" :{   
                "host" : "0.0.0.0",#主机地址，默认0.0.0.0
                "port" : 8443, #端口号，默认8443
                "ssl" : "search_file",#启用ssl证书，search_file是搜索文件，默认不启用
                "backlog" : 100,  #连接队列长度，默认100
            },
        },
        {
            "type" : "uvicorn",#服务类型uvicorn
            "enabled" : True, #是否启用，默认True
            "app" : "WebServer:app",
            "config" :{
                "host" : "0.0.0.0",
                "port" : 8800,
                "backlog" : 100,  
            },
        },
        {
            "type" : "uvicorn",#服务类型uvicorn
            "enabled" : True, #是否启用，默认True
            "app" : "src.webdav.WebdavService:app",
            "config" :{
                "host" : "0.0.0.0",
                "port" : 8901,
                "ssl" : "search_file",
                "backlog" : 100,
            }, 
        },
        {
            "type" : "uvicorn",#服务类型uvicorn
            "enabled" : True, #是否启用，默认True
            "app" : "src.webdav.WebdavService:app",
            "config" :{
                "host" : "0.0.0.0",
                "port" : 8980,
                "backlog" : 100,
            },
        },
        {
            "type" : "Hosted Service",#服务类型Hosted Service 
            "enabled" : True, #是否启用，默认True
            "path" : "D:/aaa.exe",
            "cwd"  : None, #工作目录，默认None
            "args" : None, #启动参数，默认None
        }
    ]
})





