import PIL.Image as Image
import base64
import io
import json
import sys

def convert_img_to_python(path):
    pypath = path.replace(".png", ".py")
    img = Image.open(path)
    print(img.size)
    print(img.mode)

    # 正确的图像base64编码方法：先保存到BytesIO中，保留完整格式信息
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')  # 保存为PNG格式，保留完整图像信息
    buffer.seek(0)
    img_str = base64.b64encode(buffer.read()).decode("utf-8")

    with open(pypath, "wb") as f:
        f.write(
f"""
import PIL.Image as Image
import io
import base64

img_data = "{img_str}"
img = Image.open(io.BytesIO(base64.b64decode(img_data)))

def hsv(img, hue=170):
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

if __name__ == "__main__":
    img.show()
    # 调整为蓝色色相
    blue_img = hue(img)
    blue_img.show()
""".encode("utf-8"))

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python convert_img_to_python.py <image_path>")
        sys.exit(1)

    convert_img_to_python(sys.argv[1])