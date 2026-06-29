from nt import mkdir
import src.webdav.WebdavService as WebdavService
import src.WebServer as WebServer
import uvicorn
import Resource
import logging
import asyncio
import sys
import os
import time
import argparse
import pystray
import threading
import random
from src.redirect_stdout import redirect_stdout

from datetime import datetime

class UvicornServer:
    def __init__(self):
        self.config = uvicorn.Config(WebServer.app, host="0.0.0.0", port=8800, log_level="error")
        
        self.log_file = None
        self.config_by_args()

        self.server = uvicorn.Server(self.config)
        self.show_info()
    def show_info(self):
        print("version:"+Resource.version.version)
        print("build_date:"+Resource.version.build_date)
        print(Resource.debug_path)
        print("port:"+str(self.config.port))
        print("log_level:"+str(self.config.log_level))
        print("ssl_certfile:"+str(self.config.ssl_certfile))
        print("ssl_keyfile:"+str(self.config.ssl_keyfile))
    def __del__(self):
        if self.log_file:
            self.log_file.close()
    def config_by_args(self):
        # 创建命令行参数解析器
        parser = argparse.ArgumentParser(description='DragonServer配置')

        # 添加参数
        parser.add_argument('--port', type=int, default=8800, help='服务器端口')
        parser.add_argument('--log_level', type=str, default='error', help='日志级别')
        parser.add_argument('--ssl', action='store_true', help='启用SSL')
        parser.add_argument('--certfile', type=str, help='SSL证书文件路径')
        parser.add_argument('--keyfile', type=str, help='SSL密钥文件路径')

        # 解析参数
        self.args = parser.parse_args()
        if self.args.port:
            self.config.port = self.args.port
        if self.args.log_level:
            self.config.log_level = self.args.log_level
        # 处理SSL配置
        if self.args.ssl:
            # 如果没有指定证书和密钥文件，尝试自动查找
            if not self.args.certfile:
                self.args.certfile = Resource.find_file_by_suffix(".crt")
            if not self.args.keyfile:
                self.args.keyfile = Resource.find_file_by_suffix(".key")
            self.config.ssl_certfile = self.args.certfile
            self.config.ssl_keyfile = self.args.keyfile

        if self.args.certfile:
            self.config.ssl_certfile = self.args.certfile
        if self.args.keyfile:
            self.config.ssl_keyfile = self.args.keyfile

        
        start_time = datetime.now().strftime("%y%m%d%H%M%S")
        log_file_path = os.path.join(Resource.get_executable_path(), "log",f"DragonServer{self.config.port}"+"_"+f"{start_time}.txt")
        os.makedirs(os.path.dirname(log_file_path), exist_ok=True)
        redirect_stdout.set_log_file(log_file_path)
        
        
    def run(self):
        self.server.run()



def setup_tray(name,icon,menu):

        tray_menu = []
        for k,item in menu.items():
            meit = pystray.MenuItem(k,item)
            tray_menu.append(meit)
        
        systray = pystray.Icon(
            name,
            icon,
            name,
            menu=pystray.Menu( *tray_menu),
        )
        
        # 立即在独立线程中启动托盘图标
        threading.Thread(target=systray.run, daemon=True).start()



if __name__ == "__main__":
    
    uvicorn_server = UvicornServer()


    hue = random.randint(0,360)
    setup_tray(f"DragonServer{str(uvicorn_server.config.port)}",
        Resource.DragonImg(hue=hue),{
        f"端口:{uvicorn_server.config.port}":lambda: print(f"端口:{uvicorn_server.config.port}"),
        f"SSL:{'开启' if uvicorn_server.config.ssl_certfile and uvicorn_server.config.ssl_keyfile else '关闭'}" :lambda: print("SSL"),
        f"版本:{Resource.version.version}":lambda: print(f"版本:{Resource.version.version}"),
        f"构建日期:{Resource.version.build_date}":lambda: print(f"构建日期:{Resource.version.build_date}"),
        "退出": lambda: os._exit(0),
    })
    uvicorn_server.run()
