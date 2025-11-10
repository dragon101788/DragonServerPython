import src.webdav.WebdavService as WebdavService
import src.WebServer as WebServer
import uvicorn
import Resource
import logging
import asyncio
import sys
import argparse


if __name__ == "__main__":
    # 创建命令行参数解析器
    parser = argparse.ArgumentParser(description='DragonServer配置')
    
    # 添加参数
    parser.add_argument('--port', type=int, default=8900, help='服务器端口')
    parser.add_argument('--log_level', type=str, default='error', help='日志级别')
    parser.add_argument('--ssl', action='store_true', help='启用SSL')
    parser.add_argument('--certfile', type=str, help='SSL证书文件路径')
    parser.add_argument('--keyfile', type=str, help='SSL密钥文件路径')
    
    # 解析参数
    args = parser.parse_args()
    
    # 创建配置
    config = uvicorn.Config(WebServer.app, host="0.0.0.0", port=8900, log_level="error")
    

    if args.port:
        config.port = args.port
    if args.log_level:
        config.log_level = args.log_level
    # 处理SSL配置
    if args.ssl:
        # 如果没有指定证书和密钥文件，尝试自动查找
        if not args.certfile:
            args.certfile = Resource.find_file_by_suffix(".crt")
        if not args.keyfile:
            args.keyfile = Resource.find_file_by_suffix(".key")
    
    # 设置SSL配置
    if args.certfile:
        config.ssl_certfile = args.certfile
    if args.keyfile:
        config.ssl_keyfile = args.keyfile
    
    server = uvicorn.Server(config)
    server.run()
