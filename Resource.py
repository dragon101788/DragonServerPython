# resource_manager.py
import os
from re import I
import sys
from typing import List, Tuple
from functools import cached_property

from numpy import resize
from numpy._core.multiarray import scalar


_base_path = sys._MEIPASS if hasattr(sys, '_MEIPASS') else os.path.abspath(os.path.dirname(__file__))

def get_executable_path():
    if getattr(sys, 'frozen', False):
        # 如果是打包后的可执行文件
        executable_path = os.path.dirname(sys.executable)
    else:
        # 如果是普通的 Python 脚本
        executable_path = os.path.dirname(os.path.abspath(__file__))
    
    return executable_path
def real_path_math(path):

    pth = os.path.join(get_executable_path(), os.path.normcase(path))
    if(os.path.exists(pth)):
        return pth
    pth = os.path.join(_base_path, os.path.normcase(path))
    if(os.path.exists(pth)):
        return pth
    
    return None

def find_file_by_suffix(suffix):
    print(f"搜索{suffix}后缀文件");
    find_dir  = os.path.abspath(get_executable_path())
    print(f"搜索 {find_dir} 目录");
    for filename in os.listdir(find_dir):
        # 检查文件是否以 .crt 结尾
        if filename.endswith(suffix):
            return (os.path.join(find_dir, filename))
    find_dir  = _base_path
    print(f"搜索 {find_dir} 目录");
    for filename in os.listdir(find_dir):
        # 检查文件是否以 .crt 结尾
        if filename.endswith(suffix):
            return (os.path.join(find_dir, filename))
    print(f"没有找到任何{suffix}文件");
    return None

class version:
    # 打包版本信息
    build_date :str = None
    version :str = None
    try:
        import json
        path  =  real_path_math("packinfo.json") 

        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            build_date = data.get("build_date");
            version = data.get("version");
    except FileNotFoundError:
        print("没有找到packinfo.json文件")
    except Exception as e:
        print(f"读取packinfo.json文件时出错: {e}")

class path:
    # 打包资源路径(static)
    src :str = real_path_math("src")
    static :str = real_path_math("src/static")
    chatroom : str = real_path_math("src/chatroom")
    webdav :str = real_path_math("src/webdav")
    templates :str = real_path_math( "src/templates")
    executable :str = get_executable_path()

debug_path = "路径:\n"
debug_path += "-------------------------\n"
pwd = os.getcwd();
ewd = get_executable_path();
if(pwd != ewd):
    debug_path += f"修正启动目录{pwd} -> {ewd}\n";
    os.chdir(ewd)

debug_path += f"当前目录:{os.getcwd()}\n"
debug_path += f"base_path:{_base_path}\n"
debug_path += f"        也就是程序解包的位置\n"
debug_path += f"exe目录:{get_executable_path()}\n"
debug_path += "-------------------------\n"


import PIL.Image as Image
import io
import base64



def hsv_translate(img, hue=170):
    
    # 检查是否有Alpha通道
    has_alpha = 'A' in img.mode
    alpha = None
    
    if has_alpha:
        # 分离Alpha通道
        rgb = img.convert('RGBA')
        r, g, b, alpha = rgb.split()
        # 使用RGB部分进行HSV转换
        img_rgb = Image.merge('RGB', (r, g, b))
        hsv = img_rgb.convert('HSV')
    else:
        # 直接转换为HSV模式
        hsv = img.convert('HSV')
    
    # 获取图像数据
    width, height = hsv.size
    data = list(hsv.getdata())
    
    # 创建新的HSV数据，将色相调整为指定值
    new_data = []
    for pixel in data:
        # 设置新的色相值
        h, s, v = pixel
        new_data.append((hue, s, v))
    
    # 创建新的HSV图像
    hsv_adjusted = Image.new('HSV', (width, height))
    hsv_adjusted.putdata(new_data)
    
    # 转换回RGB模式
    rgb_result = hsv_adjusted.convert('RGB')
    
    # 如果原始图像有Alpha通道，合并回去
    if has_alpha:
        # 合并RGB和Alpha通道
        r, g, b = rgb_result.split()
        return Image.merge('RGBA', (r, g, b, alpha))
    else:
        return rgb_result

import src.DragonImg 
def DragonImg(**kwargs):
    if not hasattr(DragonImg, "img"):
        img = src.DragonImg.img

        size = kwargs.get("newsize") 
        if(size is not None):
            new_width = size
            img = img.resize((new_width, int(img.height * new_width / img.width)), Image.LANCZOS)

        hue = kwargs.get("hue")
        if(hue is not None):
            img = hsv_translate(img, hue)

        setattr(DragonImg,"img",img)
    
    return getattr(DragonImg,"img")




