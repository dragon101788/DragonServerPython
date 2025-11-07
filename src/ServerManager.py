import statistics
import sys
import threading
import Resource
import queue
import os
from datetime import datetime, timedelta
import time
import timestamp
from src.server_config import *
import importlib
import multiprocessing
from fastapi import FastAPI
import uvicorn
from typing import Any

import account
import src.WebServer as WebServer
import src.webdav.WebdavService as WebdavService

log_config = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "[%(levelname)s] %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S"
        }
    },
    "handlers": {
        "default": {
            "formatter": "default",
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stdout"
        }
    },
    "loggers": {
        "uvicorn": {
            "handlers": ["default"],
            "level": "ERROR"
        },
        "uvicorn.error": {
            "level": "INFO"
        }
    }
}


class UvicornService():
    def __init__(self, app : FastAPI, options = {}):
        self.app = app
        self.port = options["port"]
        self.host = options.get("host","0.0.0.0")
        if "ssl" in options:
            if options["ssl"] == "search_file":
                self.ssl_certfile = Resource.find_file_by_suffix(".crt")
                self.ssl_keyfile = Resource.find_file_by_suffix(".key")
            elif isinstance(options["ssl"],dict):
                self.ssl_certfile = options["ssl"]["certfile"]
                self.ssl_keyfile = options["ssl"]["keyfile"]
            else:
                self.ssl_certfile = None
                self.ssl_keyfile = None
        else:
            self.ssl_certfile = None
            self.ssl_keyfile = None
        # 自动获取 CPU 核心数并计算 workers 数量
        self.workers = options.get("workers",multiprocessing.cpu_count() + 1)
        # 设置 backlog 参数
        self.backlog = options.get("backlog", 100)
        self.is_running = False
        self.thread = None

    def start(self):
        if not self.is_running:
            self.is_running = True
            self.thread = threading.Thread(
                target=self.run,
                daemon=True
            )
            self.thread.start()

    def run(self):
        while True:
            try:
                config = uvicorn.Config(
                    self.app,
                    host=self.host,
                    port=self.port,
                    log_config=log_config,
                    ssl_certfile=self.ssl_certfile,
                    ssl_keyfile=self.ssl_keyfile,
                    workers=self.workers,
                    backlog=self.backlog  # 设置 backlog 参数
                )
                self.server = uvicorn.Server(config)
                self.server.run()
                
                if self.server.should_exit:
                    print(f"{self.host}:{self.port} 正常退出...");
                    break  
                if self.server.force_exit:
                    print(f"{self.host}:{self.port} 强制退出...");
                    break  
                print("重启UvicornService...");
            except Exception as e:
                self.is_running = False
                print(f"UvicornService 启动失败，错误信息: {str(e)}，即将重试...")
                time.sleep(1)  # 短暂延迟避免 CPU 占用过高

    def stop(self):
        if self.is_running:
            self.server.should_exit = True
            self.server.force_exit = True
            if self.thread.is_alive():
                self.thread.join(timeout=0)
            self.is_running = False

def import_app(app_path: str) -> Any:
    """
    根据指定的路径导入 FastAPI 应用实例。

    :param app_path: 应用实例的路径，格式为 "module:app"
    :return: FastAPI 应用实例
    """
    try:
        old = os.getcwd()
        os.chdir(Resource._base_path)
        module_name, app_name = app_path.split(':')
        module = importlib.import_module(module_name)
        os.chdir(old)
        return getattr(module, app_name)
    except (ImportError, AttributeError) as e:
        raise ImportError(f"无法导入应用实例 {app_path}: {str(e)}")

history_log = []
# 服务管理类，处理服务线程管理
class ServerManager:
    

    def __init__(self  ,name ):
        self.services = {}
        self.is_running = False
        self.log_callback = []
        self.original_stderr = None
        self.original_stdout = None
        self.name = name
        

        self.redirect_output()
        self.register_log_callback(self.send_log_to_clients)

    def send_log_to_clients(self, log):
        history_log.append(log)
        account.send_to_all_clients("system_log",log)

    def add_server(self, port,server):
        self.services[port] = server
    def add_uvicorn_server(self, app, options = {}):
        self.add_server(options["port"], UvicornService(app, options))
    def get_servers_by_port(self, port):
        return self.services.get(port, None)
    def scan_config(self):

        self.add_uvicorn_server(WebServer.app, {   
                "host" : "0.0.0.0",#主机地址，默认0.0.0.0
                "port" : 8443, #端口号，默认8443
                "ssl" : "search_file",#启用ssl证书，search_file是搜索文件，默认不启用
                "backlog" : 100,  #连接队列长度，默认100
            })
        self.add_uvicorn_server(WebServer.app, {   
                "host" : "0.0.0.0",#主机地址，默认0.0.0.0
                "port" : 8800, #端口号，默认8800
                "backlog" : 100,  #连接队列长度，默认100
            })
        self.add_uvicorn_server(WebdavService.app, {   
                "host" : "0.0.0.0",#主机地址，默认0.0.0.0
                "port" : 8901, #端口号，默认8901
                "ssl" : "search_file",#启用ssl证书，search_file是搜索文件，默认不启用
                "backlog" : 100,  #连接队列长度，默认100
            })
        self.add_uvicorn_server(WebdavService.app, {   
                "host" : "0.0.0.0",#主机地址，默认0.0.0.0
                "port" : 8900, #端口号，默认8900
                "ssl" : "search_file",#启用ssl证书，search_file是搜索文件，默认不启用
                "backlog" : 100,  #连接队列长度，默认100
            })

    def start_server_by_config(self):
        self.scan_config()
        self.start_server()

    def reboot_server(self):
        self.stop_server()
        time.sleep(2)  # 等待服务完全停止
        self.services = {}
        self.scan_config()
        self.start_server()

    def start_server(self):
        if not self.is_running:
            self.is_running = True
            # 调用每个服务的 start 方法
            for port, service in self.services.items():
                service.start()

    def stop_server(self):
        if self.is_running:
            self.is_running = False
            # 停止所有服务
            for service in self.services.values():
                service.stop()

    def restart_server(self):
        self.stop_server()
        time.sleep(1)  # 等待服务完全停止
        self.start_server()

    def run(self):
        self.start_server()
        while self.is_running:
            time.sleep(1)  # 保持主线程运行，避免程序退出

    def format_log(self, message):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        output = f"[{timestamp}] {message}"
        return output
    def add_log(self, message):
        if self.original_stdout is not None:
            self.original_stderr.write(message + "\n")
        for callback in self.log_callback:
            callback(message)

    def register_log_callback(self, callback):
        self.log_callback.append(callback)
    def redirect_output(self):
        if self.original_stdout is not None and self.original_stderr is not None:
            return
        # 创建自定义的日志处理类
        class LogHandler:
            def __init__(self, callback):
                self.callback = callback

            def write(self, text):
                if text == "\n":
                    return
                if text.endswith("\n"):
                    text = text[:-1]
                
                self.callback(text)

            def flush(self):
                pass
        
        self.original_stdout = sys.stdout
        self.original_stderr = sys.stderr
        sys.stdout = LogHandler(self.add_log)
        sys.stderr = LogHandler(self.add_log)

    def restore_output(self):
        if self.original_stdout is not None and self.original_stderr is not None:
            sys.stdout = self.original_stdout
            sys.stderr = self.original_stderr
            self.original_stderr = None
            self.original_stdout = None

