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

def DragonImg(**kwargs):
    if not hasattr(DragonImg, "img"):
        img_data = "iVBORw0KGgoAAAANSUhEUgAAAGQAAABwCAYAAADopdXZAAAKMWlDQ1BJQ0MgUHJvZmlsZQAAeJydlndUU9kWh8+9N71QkhCKlNBraFICSA29SJEuKjEJEErAkAAiNkRUcERRkaYIMijggKNDkbEiioUBUbHrBBlE1HFwFBuWSWStGd+8ee/Nm98f935rn73P3Wfvfda6AJD8gwXCTFgJgAyhWBTh58WIjYtnYAcBDPAAA2wA4HCzs0IW+EYCmQJ82IxsmRP4F726DiD5+yrTP4zBAP+flLlZIjEAUJiM5/L42VwZF8k4PVecJbdPyZi2NE3OMErOIlmCMlaTc/IsW3z2mWUPOfMyhDwZy3PO4mXw5Nwn4405Er6MkWAZF+cI+LkyviZjg3RJhkDGb+SxGXxONgAoktwu5nNTZGwtY5IoMoIt43kA4EjJX/DSL1jMzxPLD8XOzFouEiSniBkmXFOGjZMTi+HPz03ni8XMMA43jSPiMdiZGVkc4XIAZs/8WRR5bRmyIjvYODk4MG0tbb4o1H9d/JuS93aWXoR/7hlEH/jD9ld+mQ0AsKZltdn6h21pFQBd6wFQu/2HzWAvAIqyvnUOfXEeunxeUsTiLGcrq9zcXEsBn2spL+jv+p8Of0NffM9Svt3v5WF485M4knQxQ143bmZ6pkTEyM7icPkM5p+H+B8H/nUeFhH8JL6IL5RFRMumTCBMlrVbyBOIBZlChkD4n5r4D8P+pNm5lona+BHQllgCpSEaQH4eACgqESAJe2Qr0O99C8ZHA/nNi9GZmJ37z4L+fVe4TP7IFiR/jmNHRDK4ElHO7Jr8WgI0IABFQAPqQBvoAxPABLbAEbgAD+ADAkEoiARxYDHgghSQAUQgFxSAtaAYlIKtYCeoBnWgETSDNnAYdIFj4DQ4By6By2AE3AFSMA6egCnwCsxAEISFyBAVUod0IEPIHLKFWJAb5AMFQxFQHJQIJUNCSAIVQOugUqgcqobqoWboW+godBq6AA1Dt6BRaBL6FXoHIzAJpsFasBFsBbNgTzgIjoQXwcnwMjgfLoK3wJVwA3wQ7oRPw5fgEVgKP4GnEYAQETqiizARFsJGQpF4JAkRIauQEqQCaUDakB6kH7mKSJGnyFsUBkVFMVBMlAvKHxWF4qKWoVahNqOqUQdQnag+1FXUKGoK9RFNRmuizdHO6AB0LDoZnYsuRlegm9Ad6LPoEfQ4+hUGg6FjjDGOGH9MHCYVswKzGbMb0445hRnGjGGmsVisOtYc64oNxXKwYmwxtgp7EHsSewU7jn2DI+J0cLY4X1w8TogrxFXgWnAncFdwE7gZvBLeEO+MD8Xz8MvxZfhGfA9+CD+OnyEoE4wJroRIQiphLaGS0EY4S7hLeEEkEvWITsRwooC4hlhJPEQ8TxwlviVRSGYkNimBJCFtIe0nnSLdIr0gk8lGZA9yPFlM3kJuJp8h3ye/UaAqWCoEKPAUVivUKHQqXFF4pohXNFT0VFysmK9YoXhEcUjxqRJeyUiJrcRRWqVUo3RU6YbStDJV2UY5VDlDebNyi/IF5UcULMWI4kPhUYoo+yhnKGNUhKpPZVO51HXURupZ6jgNQzOmBdBSaaW0b2iDtCkVioqdSrRKnkqNynEVKR2hG9ED6On0Mvph+nX6O1UtVU9Vvuom1TbVK6qv1eaoeajx1UrU2tVG1N6pM9R91NPUt6l3qd/TQGmYaYRr5Grs0Tir8XQObY7LHO6ckjmH59zWhDXNNCM0V2ju0xzQnNbS1vLTytKq0jqj9VSbru2hnaq9Q/uE9qQOVcdNR6CzQ+ekzmOGCsOTkc6oZPQxpnQ1df11Jbr1uoO6M3rGelF6hXrtevf0Cfos/ST9Hfq9+lMGOgYhBgUGrQa3DfGGLMMUw12G/YavjYyNYow2GHUZPTJWMw4wzjduNb5rQjZxN1lm0mByzRRjyjJNM91tetkMNrM3SzGrMRsyh80dzAXmu82HLdAWThZCiwaLG0wS05OZw2xljlrSLYMtCy27LJ9ZGVjFW22z6rf6aG1vnW7daH3HhmITaFNo02Pzq62ZLde2xvbaXPJc37mr53bPfW5nbse322N3055qH2K/wb7X/oODo4PIoc1h0tHAMdGx1vEGi8YKY21mnXdCO3k5rXY65vTW2cFZ7HzY+RcXpkuaS4vLo3nG8/jzGueNueq5clzrXaVuDLdEt71uUnddd457g/sDD30PnkeTx4SnqWeq50HPZ17WXiKvDq/XbGf2SvYpb8Tbz7vEe9CH4hPlU+1z31fPN9m31XfKz95vhd8pf7R/kP82/xsBWgHcgOaAqUDHwJWBfUGkoAVB1UEPgs2CRcE9IXBIYMj2kLvzDecL53eFgtCA0O2h98KMw5aFfR+OCQ8Lrwl/GGETURDRv4C6YMmClgWvIr0iyyLvRJlESaJ6oxWjE6Kbo1/HeMeUx0hjrWJXxl6K04gTxHXHY+Oj45vipxf6LNy5cDzBPqE44foi40V5iy4s1licvvj4EsUlnCVHEtGJMYktie85oZwGzvTSgKW1S6e4bO4u7hOeB28Hb5Lvyi/nTyS5JpUnPUp2Td6ePJninlKR8lTAFlQLnqf6p9alvk4LTduf9ik9Jr09A5eRmHFUSBGmCfsytTPzMoezzLOKs6TLnJftXDYlChI1ZUPZi7K7xTTZz9SAxESyXjKa45ZTk/MmNzr3SJ5ynjBvYLnZ8k3LJ/J9879egVrBXdFboFuwtmB0pefK+lXQqqWrelfrry5aPb7Gb82BtYS1aWt/KLQuLC98uS5mXU+RVtGaorH1futbixWKRcU3NrhsqNuI2ijYOLhp7qaqTR9LeCUXS61LK0rfb+ZuvviVzVeVX33akrRlsMyhbM9WzFbh1uvb3LcdKFcuzy8f2x6yvXMHY0fJjpc7l+y8UGFXUbeLsEuyS1oZXNldZVC1tep9dUr1SI1XTXutZu2m2te7ebuv7PHY01anVVda926vYO/Ner/6zgajhop9mH05+x42Rjf2f836urlJo6m06cN+4X7pgYgDfc2Ozc0tmi1lrXCrpHXyYMLBy994f9Pdxmyrb6e3lx4ChySHHn+b+O31w0GHe4+wjrR9Z/hdbQe1o6QT6lzeOdWV0iXtjusePhp4tLfHpafje8vv9x/TPVZzXOV42QnCiaITn07mn5w+lXXq6enk02O9S3rvnIk9c60vvG/wbNDZ8+d8z53p9+w/ed71/LELzheOXmRd7LrkcKlzwH6g4wf7HzoGHQY7hxyHui87Xe4Znjd84or7ldNXva+euxZw7dLI/JHh61HXb95IuCG9ybv56Fb6ree3c27P3FlzF3235J7SvYr7mvcbfjT9sV3qID0+6j068GDBgztj3LEnP2X/9H686CH5YcWEzkTzI9tHxyZ9Jy8/Xvh4/EnWk5mnxT8r/1z7zOTZd794/DIwFTs1/lz0/NOvm1+ov9j/0u5l73TY9P1XGa9mXpe8UX9z4C3rbf+7mHcTM7nvse8rP5h+6PkY9PHup4xPn34D94Tz+6TMXDkAACXlSURBVHic7X0JnF1leffzLme569w7S2bIZCGQBAwpJCaQPZmwGVEWtUFLi1Sl9KsCfoDaUpUQ/MDWiqJCrVoUKPbTCVAQRdbMkslKAgkJqNkzmSSTWTJz93uW9337e849JwyRQDJbAuT5Mb8J99459z3v/3325QCcxKQASAMAP9HrOEWn6OTjDAVAto4fH18Rjf7j+mnTNPiAEIWTkJYBUEKIamttvVcvFv8lXlUVwtcRpBO9tg8c1QMw/N1SUTF9AyWqkbONSin6QQHjpOQQIATcTPpbEamAavrThBDZ6AN1ik4AdzSXlV20hhLVQonbUlU1BV9TJ+vheT+TAqBKKdKoay2vAUj8jf+/5AMExklzowqAEQC5Mhm/3HTdORYBwgzt56jc606idQ41nTQ3ugxBWbKEurn8HbpUMkvZXjJy9DJU5nUA4kSv7wNFgTfeHIt9bi0haj0B1RQO3973vVM0nHoDgKwdO7ZmBWcdawFEE2f7Xj1vbCJwEE/0Gj94lhUh0Gjov1oHoF6mRDVHo18M9MqRn0cFfwqkITZzV1RWTmthVK1Gy4qzjetvuEELOKcvEEeztk4BNNi6I2zegXpjFfoesdhlR3JHABxyUktNxfRVEybU+p95W5P4FED9JM/ZIwSadO33mwBUI+ebjwyTBGA01pR/aIWp/765rOyWjedWRxCI4L31F19cVr94McPrHQbvze8g+BqCH/wc+ZkPNAWKOtj0rYsWGY2c7XwNQDXr/D/7ck6wcS9Eo1eu5cxpNs07gusEn1lTUz5pVU3VdX2tsfUTJ1ZumTQp+l7klGE3KYmHSUknID4HN22qBqVGCNw6Xe8F24UAjKsBREN52cUVveknexn/n/m2fdd6AG0nAFkIYL9YUz7J6snWs2js0oWEuGsrK6fYhdznrEzmmekHDz4HlMJrY8dWZ7PZ8U5v7yim6yMppVwZ7A/GzLnLM7/9rd0IIJcCSPgAAoJbrjaee24kPHKkO+HZZ52lpderCEAYd0TajuG9AEDrAJymMWNOY/v3PWoppWQo9O36dFqfBiCmA4hVVck5oa7UU1mN/4dIJNi6bPZR1XPoChYvu87S9U2rTP1r0hVXplpbJ2lKJTAMQKTbxHTz9yRZ9cb03/0uHyws4EQ8APBBAaQBgOEpTm3ffk9q61YyEeBmfF0dOpTgShHviArXRDGDXvtkSlVz+4GHDFdUFyiRjFL7aiD21ptuNFY9+OBtpDv1rTwoBzQtRHft2hSWMtlF6UFmWdN5OvVzQ4iErQBsAmArUIrSgwB0v2s5U+iuXWetCoX2KMNYU3baaS9P/sMfDoFSnjjFXMyJBGbYZCzKeASk2TB+IV3nqgVf/0YVWbrUbSkv/xTv7XmMSAVFw3h6gWVdgaKm2dTvjxSKX0oDINtoNmfrqGkuVwXrirAQk3JKCUWAjVAAFgHoJSRNKbWSQlQ5+Jp/d7izAkAyABoOlApyCwA4hIBNaQdl/HkSMR+e3Zt5EaT0jI07AeBEiLLhBQTAbQ6Hr41axUesivh5szp6X2sOG38XKto/daQCW9c2aNOmX6Ze3XBPyHa+kFXKVQAclY6JKgYA8qq0yTECkKcsRzh/BgxjBdGYzhg7001npimlXIk6SoiEUqrWUCqGYg+lor8cT4/hxjMF1EDgCAHg/CUVCn97Tjr9ks8xFAOe8H4MLnb6m8Cj0Y0osN108RL8fylJOVMKRYsA1z3HeXndG4ZlfyGtlEQwglNjAYgsAEQJgMZYT9EM/RtPJqfOte2rozNm/FowupHkCg8kLr9i3jxXzFnguLPGfP0bU42KyrnCDC1hBA07737x67n/QxEHJE0pSNrORYl0+sWVOn+msbz8QwjGcFtqw/ZleGNoYb163nmJzJbNnZLS5jpXXNQcDX87ms39UxrAxTOKTohAcPr4CgpAMQDCCD0Apvnvoz/2sXvHPP54AU9x6QP+7z60YfTokbnOjpdI0RrjEugiACP9ED8JrslRzxPaRXStCYTb7rrCoaaZ4K6YSDmVUJa8e1Z7+3N3ApDhEl98uJF/cuPG9IUabyNSzkJdIbN5HrynkHMIKHIkGIgmZ70yGvkvLhTf9cRj9zdrvAI458p1LVAqRZm2X+P8T8Q0N4+47LI/jnvkkf0r4vG/YVLeE3HFpUpKyKE+IfhfyfwOE8KLZWU3z+nt/f+HQS162gfUuR/WGru6KnwzXQ33Pg3f9zGmmjhbV2Hb5/eOqL5QpHo+E7fsG1IA7jsdEAUgdQAa8RUByhLcJW9z/WMvCYE8IUAJ3U44b+Km+ciMbLZ5TWXlJHHo0FelEJ8MSxl3lYI8AYF6ydW0F93b//njdUuXym0A2oTSOvBQnBDfZFgB8cQWpQjI6ojtzMwyegCUCjGlEuLN/T0qIQa+4fQW36bP+4gNw8gkKmpVsqL+xMzQ92dkMj/bcPnlpt24/BphO9dSIeZzIb0L2Ib2pJp49ufnbd7cg8YHJsTwzwMxC8NIwx9aoBSaON+s2fZkVBq4AHfwFyJ9JqKGAhpCzmF0H4SMO+bkij/HrV6dSMyFXPbrzHUXaVJBjrM/krLojXMOHbawUN8Muz8ybFZWYK1snDw5ooRb4csE4ZZO/VDcFycA1CYgU6Bc5YracK7w4ErOmlcnkzNmpVIts1zxUTseuSrHWEfcFWernsxzLab53YYFC9CYE0FgEt6PHIKxK7RU1o0ZcUZ+X9cfiZCaLCnwYVmDKokeGQZgRUoVJXQb5/R5WZb8iV1R0aVv2/aLiOMs8jx7xv9Aw8ads7OFenQUkXxRJodayQ8bh5zjb7yVss4wlUIw8OaG7UAQX78U8ORLSZjrTtQt+0bW2bk5tH3rD5zRo7+WNfUHkB2I636IZ/O/XsXZyjWJxJX19fUMnVpf0aNu8cL5RybRBmmdw+ypR8xbo/niveh3nIhos0/BKUc9w+IAxCY075ZFbyWOrOS57P8rKpAmOo6UgEPZJtD1ehKL/WZ2e/vraJj09X1QrC0u/TPgoJMfEC+cToho0vnjEdv5ZAbAQecP5fyxXkO9aY7SwVw7+qIMgMUAoBAK/1CYehfvSf2TDUqTAMxUQFEhFSi1gNA3COdrqKatJqHQxspPf3rrxPvvR1/Iu1ZfK60/axku+e2Zj1sWLIh2rWzZzlxRBQQo9hgUjnERymenkALI+QaBD+ag3EMAdkIBS5l6I0ZSdMs+D40C/O4IlNar+z94KlKEQIHQ/ZSxZh7Sl3XOq3v2it/+Nt83n3NSAoKnBhNBF8diH+O57FNMKlLgrA0I7OWumGWXNoO802bpJbGyn2q8hbruVWEp9YzvMB4Pl70b4fVCyrPOvN0kfthG6PqjLBRer6SMqkIhDJSOIlJOVFJMiiuIo5PZTUmacP6gXVH5vYX79rX15/vJcHDHBgA+nRBnuc5/U2M5lx/StJdJbcVilXGmhHsOPZlW6t28dIXKllKaMadMPdvav7uM9GRulY57vS4lyZW4ZTDN00Aset+tITub5j36RRfdM93ngFJ4gMD6qVPLnL17x7rF4mSwi3OZlPMJYUxo2qMyGv3pS+3t3XeWDpw64YCgqesthhDVHI9fFc2k/yfHaHPqtNqrPt7a2tMQDt0bLxRuzRyDglcAogyApXX913WW/RncjOcmjB4X27XvIdMV81PvwmUDIQSlDIAUKMswXb+vd9y4+xa98cahnwBof1/ShW8SpbBldEVNqrcwE5KVh+yxY1fVNTWJEw5IoDcalizh2ne/c5deKN7uErJHjp/wF3P/9KfMioqKOtLb85QSMuqSw+GodyKFAXTKqEvPmTxK7NjxmYRSZT2TJj3Et2z5JrWKX7CG0JT3FL8Chh5jgfFtMh7+0ryezAsNSnFMLVT56x+IQkcaqhPlxfw2jBlTbbUfqNcdZy4a7Nlw+Hazquoh0dHxJWlbXwEpTef4TrYbB+CZUPhvCaXb44V8S1ZB2jWM56hVvEIpZaihdSw9YEwFHBiVrmHePr9Q+E69UqjAPR8luH9MBb8OoI43bE+GOF37s/Ji8fpOAhYF0BWlHZhjikkZwWSTPH4x48YV8LTOX6lzxLQXysvPj6R6n4m7orKzFFYf9DAH7jAjBBhmNEvOLJ4tpSkgXowsEvr+vHzx1gYpPT9roN83qOztx350XNiq8bW1xLGvOVTaKN1LaUhZTaWMpAHEEWCgFa+CU/gOip3lGNvHwqFHGubP55d0d7/sjKw9N63zLWiuooU0mPeDZwbLYFQ4vNrhbEdYlcAASotC47uLSkE4X7ilyTDuxgM4GJX6gwII2tz4g7LzagDbSzzt7fimKWXYN8S9jUfxhGF2PMk+EhjA86xLPHGa8grojrqpCKAiQEP/+t1/39rURJrj8b+KW5ahX/mJuXlNewpN4z5588EgggUSWj4/UUuW3W0zuiekgJhKUYiEH3QZXSmlAtMq/nNzNHotHsSBBiP7LbLwxGMj5sLShipUy2vHjKlxu7o+pWz7OuK659ug/kwk+X4D/vCQX0WQpVQCpV3II6aUI/DkHSU54pYB8JRh/rjOsr7YZOjLoo7zqTSlDVTT/0iKhb+XuFmD68XLKAAtcraejx55i9qz7zdcyKTF6H5tzNjPuHtb/z3kisk5RtNmReXU8zs6dvlGcb8OxjEvHPeusVTA5omVw7kCSmF1RdlclSl8VjjOJ8NSVGAZTuGtkVwUR7hAgmEI3asYoTZhrAF043Gm6y3upEntIdOU+ZUrP6tZxR/apSIHP9v65jLwRnVKSSFZfkG8vHxPccf2g4aQFD+FKdqhIIwKVAKwHsP4gYzFHzIOda8NC6n3GNozxoKF16rlL61OuGJih6E9vtB2/xLrk4cUkD/LnBECr5x5ZpXd3v5JYVvXgStmmUp6JTpuqUABP0+DRBFRwMMonygBl7LXqa7X62Vl9dPb2//4dgUKjWHza+Gi9a95hRLuz4qnMZVLFGNt2YlnTTHb9ixKZvK/7MWcxxAGKwmAGyWEW4nkDFs61aF09jd4g8VIdBarqdlLdu9qNl33DLu84vwZ3d3rhyx0EoDROCL5F3pP9i9sIVyi8zrmir8MCVnlKBVwgwiqOnxuULoCZpa4ocA4/60KRx6cffPNL2GBXOA4YkNnnf/5O0v9hHQhpW4TgVcNKacU3iY04oU3AKikbBetqLjGymQ+alrFrxUVfqWneGWf/O6x+DjvSnhNUwGxONtTJ9W4plDoxup87kftmvZine1c8tL48Wcm9uxuyQK8vMAVV/im8OACEhSKYUMN6+1ZaQhheHIHg4J/zg1IXpYNY0GcECgyuotp+n9Befmjs/bv39Y3InqUImeyBIDcWV9PGq75qy2mK86yiceZ9GhFD4QQcAz9V8QV06jrnukAkAgeCt9aQOT9siI6UGAkgFsJwHtC5h0L8ta3Gk3jhxWOfVN3ReW5dR0dm38/evQ54c6Ox/Uyc9Gsg6ndQVLueL7jHVkcdYaXMygWLwoJYaQAilhT5ukE4nED6wtEWAHD/IHN2CvSNH+cmDbtV5ObmrKwb1/fgmZ5NHt9Pca8AJy6669flJDy7OybJ/ztIrOePDOkgmTB+gwGmHBxhIDKc/4SpSyipKhQUtbGlAqjoYBBTNpPUDwOAWAZTV9LmcbXn5YMT29vv3mlzk8nqV5sUL3mo3v3vr7+jDMWSyGSAKnd/fmeY5K5lCgH/Qb/86yPOPDQjyhgEhM5Gl8OYeOHc3oy3jgMaGo6zA1HY9/DXj0AQzCenTmzPPLyup/ZXHtFKWUajjPJ6mMg4HdqCqhJCcsR2mVx9sZB1zlIKYsrpc7iSo1ljKeNs8/+h6lXXrnrlYcfri10dV0CxcKSkCtGoXjtJygE8/+acCdApPym6QcO5LEYLy/lPbS39wvrY/HTpnV1HSQ7d24O/qA/xXXHJrKqEuex7tRGp1QzG+gJr94WRYbg/EUSid47O5V6NshB+y1pR8ugoQPpiaHDQBECK0aMOMfo7nqCKFWbn/rhD8Frm34Zsp15WEOFBwGlUEgBcxk7yEKhu7SRI+unb9/e5X0nIbD1xhuNzvr6CVo2dY4b1jfM7kxvD76wacyYcWz/vhUgxEjc2P74YHgY0DlEPRKrHTUll80KaRXvI5ztDl3ykR9OW7YsjSGTxQPIHJJjzfQ1GsaPyq3ijd1YNA5AOYLF2GsQi//jnFTqOb9q/F3L+d9SwOxv4sFf/nIqzWevMxz3/7iEtGcTyY9FYrF9buvuvVIqzF3jARAoEh2db1Y15VfNa+3YiZdAOY35+sVvX9zmHZxtAPpEAKshErolni9871iiy++kRxIAPG2YD9QVizdiDwsc2L8duHbbgkLhP/prXR1e8Lt9IBApy+rrSc11n/1J1LK+kJUKCKOuVjvqvJmtrW8gN2BPx7st5PBiKYWVkcjHwbKulUJcEgeVzBJSBI3/qHv02O9csXVrV4NhPByzrc9mAkMBrSrGdrgja+ctaG09gJ1U00qFB28plAuKGftyJ34vBvouLi+/UE/1vpCXciBJLRR52K+iIFl+wZyurlcbI5Evg219fYHtVOMh8ze1XxzyrovyCgAB1OKrr5bzi9b1+XDkBsZYZ5WU3OrqOh8/s+EYmlwQNPzMi5WVH15FyaZ4Pve0lOISQmlTLhL66/x5U2rmFO2vIRgrKsrqTMf+m6zvTKItKylNFysqr0QwUC+hvjlSLPhrxc1+SwgcQ+OYl1GWVYmV9gMs48HmImVKyd1M5qsIwIKvTH+AMrZnVSIxJah47O/Fj/WUeMVsaFvPzWZ/JseOnZ7WtceIY9/7Sk1NFW7OOy3Cj3OJxlDoimTPoQ0UiOiOl30s+fVv1Mx13U/MTuf++5ING1J4/dWTx1WTVPYXSnrpD1yg1CmhVjT2+YsOHnw9qF453hv1Nko484lSA64MwcOVw7oT1/3Y+tGjTyNLm1zK+COuEDP6WKf9ouP5Qwwces7fvJ07Wy+w3cXE1G/NFfO3rzzjjBHo1L0dKIGYaonFZnHX+bWjG7fOlPLDdT09z0xeutRGEFD84Oem3HQTd7e2PWEIcbpVKi6QMQCeN8zvXphOP94fMPyYm1xzwQVx5Ygr3VLEdqABQIJV+hEl4sVU6mx8jSaTTzBdL/pJqn4HOI8bSTzp3ngLpei8TP4RWl75L0TTqlEkvN3HUXY3jB2bUErcLCPmopmFwveXSBn0k6MyljvRLCZEdPz0P/477Dizc75uiCngWU1rXpDP/+MSpbzymuNdLwZA0fy0trz2xRFSjMxzthNN8oF4iOgHGQAYfthDY7GtuB9tbW3t4cmTV+J8r4FUzg/Ic303iyIIu6yprR0lCVGz29r29T3lgRImlMpmjT8Ute3rsIAOXzcVMMHZXnNk7Yzpra3t6MEfr10feMqrq6tPZ92du2zGflfxkY/+Vcezzz4YcezFaDD0I6kl0MBwNH25OuusxVgxf/gd724HlrMcjBhP0EepjgdAvwACEIwVIeOnkXzx79KlACHVFVDCWY9Ili+c19m5qb+mJF7r9+PHa9H2/Y/oQuycaTm3o3nekkjMY+lUs6XU4eqS47imxIp6i7Ntsc9/4ZxpP/2pu27s2Oq8ENGFbW3bB9rCMOAEVWCFHctnUXz503y8k4uiY4Wu/yKSLxwGQ8M1UZpzYuGPIxiBddbPtcmQ4xCz+rSvzCxYt2NNr8d9Z565oUjIAfT43ylLeZRrUowcGFJOsJYtOx/vvdjZuUjvOPgcTqU4mi49qYqtdy1YYK6prZ25lBAvoIgbtWrx4tBKzh+LWMW/9cUUQ0+NUFpwQqHLF/RkVqF4G2iPxsI9e4oX7Nix17f0vJ2a/uqrec75fl9WHfdpxjUZoEAUi+fh/1MK1TWOc8aBFU1/h/c3kAmqQw4InpbTv/Qlx+ru/M91On9yTXX1uNXjxlXDk0++GHKdT/W+6TUrkxDqRKLX1+VyDWh5DUbRQLAGn8sOtxIIhSGx/hOygZJyPP5bOs4ILM5Wlv33OFrKz6KenIDgaSFXXy1AqReTtnNlsatzvdW6ZyN3ndkpzFmVwBBYO5vT+GN1mcx/YwEa+jaDtYZApAZDb9aPr64EIU/30e5v9BfjzVXIHkD5CKsUEjqdrV07whsf2c+9Hb4OKqV6sNpESZnkUtbkSqIrYG2lYamNbv5+SSknPiS0DEBDcPL7M5+ISRXHfE5/cySeMaXpWDAPyrGSnsKS0sm3t3sH6ShuwIkHxBsYgJ2xlF0g0HoqtbG9JZaE3I8WjygWr0E9M/EYGkCPkwiKQKyIeXHUqFpaLNxVQIeh/9/hRRFACO7FrhgvR4AoIbZh234BZf9oGDkECFaR+zmUvmBgqT/2YdCI61zUGIncgLpjCw5XGCAoKDb8WimFIrC5pmaS2X7gWe6KGucomchjJi8hJKnXIOq68ZLtT1LTnngid1IDgmFxXLReVvZPRUZTEeW1VwTJLVcnRBUj4ftszpo4ENAK+Z80VZZ9eHJpkM/xsr1X/osgBE4hgvvMokXGykjky7SzczV3xeSCX4E4kPsqWWzUKekQGvfuidIucuGF7kB8kSEHxJ8XwmZ1dLzmaHq9EzLqgZA0JnpMrzZLEVeIQp1Qdbmysqs4ZU8Z6fyv10Sjt68dOXLikiVL3m2Nh0f4BWVCCMJSQuXqsWNPRyDiL76wwcjn75NCxAcDjKDwGxjLKcdhIEQEAaKEeAmxgZi9w9Xj51kdWiLxqJw2bTNd/uI/gyM+bhGy1ZHi0qTt3L62vPyhGV1dTwEhT20cN26E094+3bHt6NK77nrbcElQsYKbHziOqBZerqqa4uTzFynXudRua5sTlSJsYaE3ARerHn0ZeNwe+pHksYDjZDdcfXUUCIkgbxLG3wBlv4cGB/ixnhfOOKPMoLR2/o4db6yqrR2vd3XdlmOMnXbaaTelt2+X72Ty/tn0N0phTSIx0y0UrpKOs0gpeW5YSoJyo+gZFCU/hysgXuO675rjtg0gwuhVUGZ07V94Vex+sb+nDSs/RCx+8ZxU6qWBZA2HtwvWn9pGdu5MYYseLnx2W9t2APIPa2pHjrJ13VO+b1PO7+Xg/Vy18PLvo0efQbu6rlaufbXo7Z0aUtLLDXjmGSmN1tAJITYQzQaFKb5MUal2ynkvIYRJ151AhYj5xRvHDY2XkqT8AEC4PAw9kCYkFauu3gSpFOpN+Z4agtknIOmF8u/EJivsydu37/BnSoPg3gxIBqnfNcnkQpnN3iD2tV1uShnBMX5FAtgTh+/3ACN/BMY2E8L+pAD2UF1PUYBWvaamXLa1LVaMVbrCqSGCjMXr99u+JgTndu0X6XRNVCnIML52+rZtXXg/Jyz8Pph0pGVS34ftsQvL+P73P6kKhZuoFNjHh3W8nuTBv9EUcGloO1kk8hAAzQKlBeDcIdHo/lk7drywesSI01VX5/OGkBOCrhp0Frw5Tf0jESWE5auSMyFdmDGqWPjBvnDo/87LFX7Q34xmQCfNkwf6jo+9MyjmVoqsLiv7tPz23V/VXPFhLP1HILC2N4r9JgQM6tcM54Sc6KaztxFKdhLOXlGa8XwxkXgFucruOfRYTMgJKeIByPpUv/QXEoapwVgidjDVk559iBIwKqqehlzrgLKFJxUgSA3+6VqKI8WTsUupod/JXXeWi0CUrCRlVlRgycjafC6/nxG6mxC1izFtW9Q0d4lR53dMf+V3ebAdeO6MkSOS7fs+2qSx2cx2pqVK5q7nAyH1FwlvEp0C4lKSkuFyG8TeBVlK19ft3btzoOLqpAHEf76UwgrzltGjz6QdHXfT3uynMZmUJWDj2DMdgGP1iZ7NQgpgOlFqhyKSK43bRMpivlgk/MArmQalbC2ZvJS37nmCC2mEQUG2dO1B8bk8EelVnpCd+e7u0xJK1aTN0Fchk0PuOO5a3pMOkMNzqbBWKxT6Muzff6cuRSLj33hcgW5jvTAh+1zKNheV3KSA7iWUHRS2bWvRmFCWBVAohIqRSHghQPcK254ddoXRRaBISwHFwew9RJEJNuebRXfnp3OEZviiyx6HZcsG5UlAJ1Kpe2EOrzyopuZD+qHu+w3HvTCnFMoW7JRWlNEdTDdegnC4mcdiu5TrKjuXS3DTDFuHOqNEQEg6jgDTtPRY6JBWdDOqvByLGMqcva0bHem1CA7afQYT7UIKeNE0n6Cus1Awfn+dZd0xUGV+QgFBi8qb9EmIbIlG/4bm8/drQpR5esJP45JodIdUcp1ynAS4cpxSarQOKmIoDBkfUUxAiCcn0Ju0CU1JThukKxZwKZP+gLTBqB3wRmxgXWuRlCYFOZR209pRE+a2tvZ6yxiEOVrDDsjhnglKocUwvmtYxdsKUgXTQlnfhWEPojcCkJQ2228YPdwP3peCChYcjIzPaS0M4hTLoOLeZTRNGN1NHXdyGBNq4cit83O57w/mOMBhfUpbUNxQP3NmaKWmPREpFm7LK+UKfzSs6tMajb+x6j1HQGAIxAeDHDEI+fCP39lL8Vr4N74HPhhrlrhJBiXAyxKfB8p2lymgGcbfGD19+o99g0S+FwcpeyZhy1lnxcjOHU+FXHdhqnTwcTO9EUgGbrY/y/1k8FiDcRomJZAJhf86kki8Tg7s3+jNF07EPjL3UPr5gVa7nxAry7fPFYKhdm5/NuSK2T4YnnMWwUA2EEhRso1QSrVSa9qwzWM8WttBWAFXjGataPjzF6Vzy16yrWdrpYIDIfPnC3syzw/F5NJhqTrB/g11ww1c7dz5RMQRs9MlJtBiCASlwuLab+14/BO8PHG3oTzFPqyzco8gL0aZBOCC8012snzBvFR2WXN5/KKkKz7SydmexMSzbvNz/4M+bHlYqk6wbrf54YcejLrOxb0EiiEFBidU2Yb5C628YtpcKS+37OJMvavnIeW6Z7mD1DnbDyCwQ4rplELOMH+QXbhwzoKurlewAI6ksv8GBJSKxq6bumlT7zlDNGR5SG86sM0bIpFbygr576WlKsYImBbXXoZo9JbZvb0rUY03h4y7KovWNzsOD3EbHmMjGB2L3xfBzAn20XO+HCLRO3BtwQCAhrD5jTGF4rf2hCO3XZjLfW+wfI5hBSRQdthSTXsOrRZCQogSzdGNB+KXX37r5GXLbLwxNn58Uu3etY26IuZHX4cDjMMDDTD3ahMKkrPl1DDvm53LPY0hmy0A+mQAZ0V19aRYV8eWtKY9NN9yPofzsYYKjKEc9uVtLVbxub09P2NCaholWjES/spsy7px8rJlTlCZSFOpWiJlmVPy7WTQWj4U6wqG3aBPgXO3KKM5SzcelfH4/LmuuGh2JvO0X//LzsHoPLatdXc9VaB0Vfsjj16PvSxD/aDkoTqNXotb4Ze//FJMiKkoCpxQ+OZ52fy9eMJQTmB/oDf7hPM2SUi+XAGPAnBs0AmVfJJBId+38TYR9QPmMRRnOwtm6C4ysva8ObZ97dze3hUIRDDRqLGkH0STpt1HGZUHz5+xCFv6MIM51MP5yVBxx7qzzy4vbtv6ekLK6rQZuntesfiN9Uphiaj3OIi+XntLLHyZXrCvL3C2V1G2iUh3rm7ZnysOYOJoEHeivljKU6oIY8upGfp5eMaMp6a88ELu7XL0gahtjIUvI478Lhk1asH87ds7h+vxR4MOSKDw8PHbNfn8Pe2G9vQCW1zRoOQxDxhePXlctfOHPa1KSE292aN+TCH0QFFrCljIG37Meoim/ZpHIg/O6OlZ33eW+5HjPYKs5UuJxFhNuN/hZYlbscloOJ9FNaiOoX9D7vpp08KFja/e1MNoj1kz8ga1Z89b2pSPpOCU9gBQLCOtqRiT2kNaD2gAYzQAbhEC+Gg9rBR5JzRRNHEFLEyAFThrtzX9J5GKip9N3bdvHxSLQTYyWMufKWZ8b9XMmSbs2TOHue6XZ7S1tQ/3g8HIUHBHSzT6qcp87rEDkei1CzOZR4/HTFTecAiiGilZmZRqdo+hPUCM0M+p684nhfz3cPrQUYaiUW9UOGXd1DB+pMbX/HjOazs7+kyVOKan5my85JJIz8iRYuHDDxdPxFPahuTZ6E2a9nwTZxsxonu8I+/qvWtQ9E1WNRna94LRMy1nnTWykVHRhEqXgGwk3m/8cdZiWIZRd6Vp/rChtnZUcC3/CQb9bTc4IWEbPsjiSrTMmhgTL++YSSPRT2KN0vHSYjyRSgI1w49Edf2/Gg4e9ObiygNt8yNK0dybOsV73AWarwVNa5Gx2Ffm9/SsxVKiPgPx++svDPujjgadAk5oCYcvbTL0dXhL/W1aeTuuazb0X+Ez15sIOMsJiJUAaiWjcmU4/E18vsdAOeJ9R8GI1KZo+BvN0egX+77WH1J+ihf/vWrSpPJGxg61EFDLCThrANQqzg60lMcvDT77fnlG+qCJrKAeiVLuEk17ErJZb+x2f69HcOCAP+JJ7N398ZiSyRSAHQHQXUa32cnyyxZ2dm7H9rc3E4qn6C2kliyh6849d+qgXQ+AekaCri1fQ0C2EJArOWttqC47Hd8fjMHFp+gYSfniak1NzaQVjDpN6NEzmm+srJz6fgZj0G9qsB7G2Ojnqp1UzzU4CgkD4YVQ+Ja6rq5X1w9yl+4penci+LNl8WK9kbM/bEJ9omvPI9TvV844qanet5hWJZNzVlMiV1JSRNHVV5S9X+mkvLkq35cQxfxlFUoRh2u/mNne/oY/auO9G8p4r5LyBiErspyzzWspcVdVVY3v65ecomGkJf6mrzy9ZuxaRmWDpj2BuuP94vi9G510J67OX5PozMyOgiJ6OPwAcov/JM33PZ10gAQkHWdhN6GpfZdeuiKYNnr4zVM0zCKLEGjibHOTrj+Cr50ydU8QKd+6wsK0Ro2nV0Sjn/Bf/0Doj5NOZN3pA9L72msjKKVZPRRa7b/1gRFXJxUgARVtO6QY2zKjqwtz2u/9ZNF7FZA7g/F7jNlM42v8LqkPVMLpfwFYJRTa4hbFfgAAAABJRU5ErkJggg=="
        img = Image.open(io.BytesIO(base64.b64decode(img_data)))
        hue = kwargs.get("hue")
        if(hue is not None):
            img = hsv_translate(img, hue)

        setattr(DragonImg,"img",img)
    
    return getattr(DragonImg,"img")




