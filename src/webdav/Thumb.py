from PIL import Image
import io
import mimetypes
import os
import hashlib
import subprocess
import shutil
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
import Resource
import src.config as config


def get_cache_path(full_path, size):
    """
    生成缓存文件路径
    
    Args:
        full_path: 文件的完整路径
        size: 缩略图尺寸
        
    Returns:
        str: 缓存文件的完整路径
    """
    # 缓存目录
    cache_dir = os.path.join(Resource.get_executable_path(), 'cache', f"thumb{size}")
    
    # 确保缓存目录存在
    os.makedirs(cache_dir, exist_ok=True)
    
    # 生成缓存文件名
    file_hash = hashlib.md5(full_path.encode('utf-8')).hexdigest()
    cache_filename = f"{file_hash}.png"
    cache_path = os.path.join(cache_dir, cache_filename)
    
    return cache_path

def get_cache(full_path, size):
    """
    从缓存中获取数据
    
    Args:
        full_path: 原始文件的完整路径
        cache_path: 缓存文件的路径
        
    Returns:
        io.BytesIO or None: 如果缓存有效则返回包含缓存数据的BytesIO对象，否则返回None
    """
    cache_path = get_cache_path(full_path, size)
    # 检查缓存是否存在且有效
    if os.path.exists(cache_path):
        # 检查原始文件的修改时间是否早于缓存文件
        if os.path.getmtime(full_path) <= os.path.getmtime(cache_path):
            try:
                # 从缓存读取数据
                with open(cache_path, 'rb') as f:
                    data = io.BytesIO(f.read())
                data.seek(0)
                return data
            except Exception:
                # 缓存文件读取失败
                pass
    return None

def save_cache(full_path, size, data):
    """
    保存数据到缓存
    
    Args:
        full_path: 原始文件的完整路径
        cache_path: 缓存文件的路径
        data: 要保存的数据，可以是io.BytesIO对象或bytes
    """
    # 获取缓存路径
    cache_path = get_cache_path(full_path, size)
    try:
        # 如果data是BytesIO对象，获取其值
        if isinstance(data, io.BytesIO):
            content = data.getvalue()
        else:
            content = data
            
        # 保存到缓存
        with open(cache_path, 'wb') as f:
            f.write(content)
        # 更新缓存文件的修改时间，使其与原始文件一致
        os.utime(cache_path, (os.path.getmtime(full_path), os.path.getmtime(full_path)))
    except Exception:
        # 缓存保存失败，静默处理
        pass
def remove_cache(full_path):
    """
    删除对应所有尺寸缓存文件
    
    Args:
        full_path: 原始文件的完整路径
    """
    cache_dir = os.path.join(Resource.get_executable_path(), 'cache')
    for size_dir in os.listdir(cache_dir):
        if size_dir.startswith("thumb"):
            size = int(size_dir[5:])
            cache_path = get_cache_path(full_path, size)
            if os.path.exists(cache_path):
                os.remove(cache_path)
def getImageThumb(full_path, size=128):
    """
    生成图片文件的缩略图
    
    Args:
        full_path: 图片文件的完整路径
        size: 缩略图的尺寸，默认为128x128
        
    Returns:
        io.BytesIO: 包含缩略图的字节流
        
    Raises:
        Exception: 如果文件不是图片或无法生成缩略图
    """
    # 检查文件是否存在
    if not os.path.exists(full_path):
        raise Exception(f"File not found: {full_path}")
    
    
    # 尝试从缓存获取
    cached_data = get_cache(full_path, size)
    if cached_data:
        return cached_data
    
    # 生成缩略图
    try:
        img = Image.open(full_path)
        # 生成缩略图
        img.thumbnail((size, size))
        img_byte_arr = io.BytesIO()
        img_format = 'PNG'
        img.save(img_byte_arr, format=img_format)
        img_byte_arr.seek(0)
    except Exception as e:
        raise Exception(f"Failed to generate image thumbnail: {str(e)}")
    
    # 保存到缓存
    save_cache(full_path, size, img_byte_arr)
    
    # 重置文件指针
    img_byte_arr.seek(0)
    
    return img_byte_arr

def getVideoThumb(full_path, size=128):
    """
    生成视频文件的缩略图
    
    Args:
        full_path: 视频文件的完整路径
        size: 缩略图的尺寸，默认为128x128
        
    Returns:
        io.BytesIO: 包含缩略图的字节流
        
    Raises:
        Exception: 如果文件不是视频或无法生成缩略图
    """
    # 检查文件是否存在
    if not os.path.exists(full_path):
        raise Exception(f"File not found: {full_path}")
    
    
    # 尝试从缓存获取
    cached_data = get_cache(full_path, size)
    if cached_data:
        return cached_data
    
    # 生成缩略图 - 合并了extract_frame_from_video的功能
    try:
        # 获取FFmpeg配置
        ffmpeg_config = config.PythonConfig(f"config/ffmpeg_server.py", default_config={
            "path": 'ffmpeg/bin/ffmpeg.exe',
            "ffprobe": 'ffmpeg/bin/ffprobe.exe',
            "thumb_pos" : 0.3,
        })
        
        ffmpeg_path = ffmpeg_config.get('path', 'ffmpeg')
        
        # 确保FFmpeg存在
        if not os.path.exists(ffmpeg_path) and not shutil.which(ffmpeg_path):
            # 如果配置的路径不存在，尝试使用系统PATH中的ffmpeg
            ffmpeg_path = 'ffmpeg'
            if not shutil.which(ffmpeg_path):
                raise Exception("FFmpeg not found. Please install FFmpeg or configure its path.")
        ffprobe_path = ffmpeg_config.get('ffprobe', 'ffprobe')
        #确保ffprobe存在
        if not os.path.exists(ffprobe_path) and not shutil.which(ffprobe_path):
            # 如果配置的路径不存在，尝试使用系统PATH中的ffprobe
            ffprobe_path = 'ffprobe'
            if not shutil.which(ffprobe_path):
                raise Exception("FFprobe not found. Please install FFprobe or configure its path.")
                
        # 创建临时内存缓冲区
        img_byte_arr = io.BytesIO()
        
        # 构建FFmpeg命令：提取视频中间帧并调整大小
        # 1. 首先获取视频时长
        duration_cmd = [
            ffprobe_path,
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1', full_path
        ]
        
        # 获取视频时长
        duration_process = subprocess.Popen(
            duration_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        duration_output, _ = duration_process.communicate()
        
        # 计算中间时间点（尝试从视频中间提取帧）
        try:
            duration = float(duration_output.strip())
            # 使用视频中间位置或至少1秒的位置
            seek_time = max(1.0, duration * ffmpeg_config.get('thumb_pos', 0.3))
        except:
            # 如果无法获取时长，默认从1秒位置开始
            seek_time = 1.0
        
        # 构建提取帧的命令
        cmd = [
            ffmpeg_path,
            '-ss', str(seek_time),  # 从视频中间位置开始
            '-i', full_path,
            '-vf', f'scale={size}:-1:force_original_aspect_ratio=decrease',
            '-vframes', '1',  # 只提取一帧
            '-f', 'image2pipe',  # 输出到管道
            '-c:v', 'png',  # 使用PNG格式
            '-'
        ]
        
        # 执行FFmpeg命令
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        # 读取输出到内存缓冲区
        output, error = process.communicate()
        
        # returncode == 4294967274 是Windows系统中-20的无符号整数表示，通常表示进程被强制终止
        # 可能的原因：权限不足、文件被占用、路径访问受限等
        if process.returncode != 0:
            error_msg = error.decode('utf-8', errors='ignore')
            print(f"FFmpeg error: {error_msg}")
            raise Exception(f"FFmpeg error: {error_msg}")
        
        # 将输出写入BytesIO
        img_byte_arr.write(output)
        img_byte_arr.seek(0)
        
        
    except Exception as e:
        # 如果FFmpeg命令失败，尝试使用更简单的命令
        try:
            # 尝试一个更简单的命令，不使用精确的时间点
            simple_cmd = [
                ffmpeg_path,
                '-i', full_path,
                '-vf', f'scale={size}:-1:force_original_aspect_ratio=decrease',
                '-vframes', '1',
                '-f', 'image2pipe',
                '-c:v', 'png',
                '-'
            ]
            
            process = subprocess.Popen(
                simple_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            output, error = process.communicate()
            
            if process.returncode != 0:
                raise Exception(f"Simple FFmpeg command failed: {error.decode('utf-8', errors='ignore')}")
            
            img_byte_arr = io.BytesIO()
            img_byte_arr.write(output)
            img_byte_arr.seek(0)
            
        except Exception as e2:
            # 如果两次尝试都失败，抛出更详细的错误
            raise Exception(f"Failed to extract frame from video: {str(e)}\nSimple method also failed: {str(e2)}")
    
    # 保存到缓存
    save_cache(full_path, size, img_byte_arr)
    
    # 重置文件指针
    img_byte_arr.seek(0)
    
    return img_byte_arr

def getFloderThumb(full_path, size=128):
    """
    生成文件夹的缩略图
    
    Args:
        full_path: 文件夹的完整路径
        size: 缩略图的尺寸，默认为128x128
        
    Returns:
        io.BytesIO: 包含缩略图的字节流
        
    Raises:
        Exception: 如果路径不是文件夹或无法生成缩略图
    """
    # 检查路径是否存在且是文件夹
    if not os.path.exists(full_path) or not os.path.isdir(full_path):
        raise Exception(f"Path not found or not a directory: {full_path}")
    
    # 尝试从缓存获取
    cached_data = get_cache(full_path, size)
    if cached_data:
        return cached_data
    
    # 创建缩略图
    try:
        # 定义支持的图片和视频扩展名
        image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}
        video_extensions = {'.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv'}
        
        # 使用os.walk遍历文件夹及其子目录中的所有文件
        media_files = []
        for root, dirs, files in os.walk(full_path):
            # 对文件进行排序，确保顺序一致
            files.sort()
            for item in files:
                item_path = os.path.join(root, item)
                if os.path.isfile(item_path):
                    _, ext = os.path.splitext(item.lower())
                    if ext in image_extensions or ext in video_extensions:
                        media_files.append((item_path, ext))
                        # 最多取4个文件来创建缩略图网格
                        if len(media_files) >= 4:
                            break
            # 如果已经找到4个文件，停止遍历
            if len(media_files) >= 4:
                break
        
        # 创建组合缩略图
        if len(media_files) == 0:
            raise Exception(f"Folder don't contain any media files: {full_path}")
        else:
            # 创建大的画布
            combined_img = Image.new('RGB', (size, size), color=(240, 240, 240))
            
            # 处理每个媒体文件并放置到网格中
            num_files = min(4, len(media_files))
            
            for i, (file_path, ext) in enumerate(media_files):
                if i >= 4:  # 最多处理4个文件
                    break
                
                try:
                    # 根据文件数量确定每个缩略图的尺寸和位置
                    if num_files == 1:
                        # 单个文件 - 填充整个画布
                        target_size = size
                        x, y = 0, 0
                    elif num_files == 2:
                        # 两个文件 - 左右排列，无白边
                        target_size = size
                        x = (i % 2) * size
                        y = 0
                    elif num_files == 3:
                        # 三个文件 - 上面一个大的，下面两个小的，无白边
                        if i == 0:
                            # 上面的大文件
                            target_size = size
                            x, y = 0, 0
                        else:
                            # 下面的小文件
                            target_size = size // 2
                            x = (i - 1) * target_size
                            y = target_size
                    else:  # num_files == 4
                        # 四个文件 - 2x2网格，无白边
                        target_size = size // 2
                        x = (i % 2) * target_size
                        y = (i // 2) * target_size
                    
                    # 根据文件类型获取缩略图
                    if ext in image_extensions:
                        small_thumb = getImageThumb(file_path, target_size)
                    else:  # video
                        small_thumb = getVideoThumb(file_path, target_size)
                    
                    # 打开缩略图
                    small_img = Image.open(small_thumb)
                    
                    # 裁剪图像以填满目标区域，保持宽高比
                    img_width, img_height = small_img.size
                    target_width, target_height = target_size, target_size
                    
                    # 计算裁剪区域以确保填充目标区域
                    # 计算缩放比例
                    scale = max(target_width / img_width, target_height / img_height)
                    
                    # 计算新的尺寸
                    new_width = int(img_width * scale)
                    new_height = int(img_height * scale)
                    
                    # 调整图像大小
                    resized_img = small_img.resize((new_width, new_height), Image.LANCZOS)
                    
                    # 计算裁剪区域
                    left = (new_width - target_width) // 2
                    top = (new_height - target_height) // 2
                    right = left + target_width
                    bottom = top + target_height
                    
                    # 裁剪图像
                    cropped_img = resized_img.crop((left, top, right, bottom))
                    
                    # 粘贴到组合图中，确保没有白边
                    combined_img.paste(cropped_img, (x, y))
                except Exception:
                    # 如果无法处理某个文件，跳过
                    pass
            
            # 保存组合图
            img_byte_arr = io.BytesIO()
            combined_img.save(img_byte_arr, format='PNG')
        
        img_byte_arr.seek(0)
        
    except Exception as e:
        raise Exception(f"Failed to generate folder thumbnail: {str(e)}")
    
    # 保存到缓存
    save_cache(full_path, size, img_byte_arr)
    
    # 重置文件指针
    img_byte_arr.seek(0)
    
    return img_byte_arr


def ResponseThumb(full_path, size=128,mimetype=None):
    """
    生成并返回图片、视频或文件夹的缩略图，带有缓存功能
    
    Args:
        full_path: 文件的完整路径
        size: 缩略图的尺寸，默认为128x128
        mimetype: 文件的MIME类型，如果为None则自动检测
        
    Returns:
        StreamingResponse: 包含缩略图的响应
        
    Raises:
        HTTPException: 如果文件不是支持的类型或者无法生成缩略图
    """
    # 检查是否是文件夹
    if os.path.isdir(full_path):
        try:
            img_byte_arr = getFloderThumb(full_path, size)
            return StreamingResponse(
                img_byte_arr,
                media_type=f"image/png",
                headers={"Content-Length": str(len(img_byte_arr.getvalue()))}
            )
        except Exception as e:
            raise HTTPException(status_code=300, detail=f"Failed to generate folder thumbnail: {str(e)}")
    
    if mimetype is None:   
        mimetype, _ = mimetypes.guess_type(full_path)
    
    # 根据文件类型生成缩略图
    try:
        if mimetype and mimetype.startswith('image/'):
            # 调用图片缩略图生成函数
            img_byte_arr = getImageThumb(full_path, size)
        elif mimetype and mimetype.startswith('video/'):
            # 调用视频缩略图生成函数
            img_byte_arr = getVideoThumb(full_path, size)
        else:
            # 其他文件类型，返回空响应
            raise HTTPException(status_code=400, detail="Unsupported file type")
    except Exception as e:
        # 生成缩略图失败
        raise HTTPException(status_code=500, detail=f"Failed to generate thumbnail: {str(e)}")
    
    return StreamingResponse(
        img_byte_arr,
        media_type=f"image/png",
        headers={"Content-Length": str(len(img_byte_arr.getvalue()))}
    )
