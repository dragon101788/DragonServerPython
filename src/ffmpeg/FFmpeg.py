
from unittest import result
import os
from src.process import process
from datetime import datetime
from collections import deque

import re
import json


# 导入配置
import src.config as config
ffmpeg_config = config.PythonConfig("config/ffmpeg_server.py",default_config = 
    {
        'path': 'ffmpeg/bin/ffmpeg.exe', 
        'ffprobe': 'ffmpeg/bin/ffprobe.exe', 
        'ffmpeg_option': ' -threads 2  -thread_queue_size 512  -preset fast ', 
        'thumb_pos': 0.3
    }
)



#参考用例
#    info = ffprobe(input_file)
#    print(info.get("format",{}).get("duration","未知"))
class ffprobe():
    class std_err():
        def __init__(self):
            self.error = ""
        def write(self,data):
            self.error += data
        def flush(self):
            pass
    def __init__(self,input_file = None):
        self.input_file = input_file
        
        self.info = {}
        self.buffer = []
        if self.input_file:
            self.immediate(self.input_file)
        
    def immediate(self,input_file):
        self.input_file = input_file
        self.try_count = 3
        while True:
            try:
                self.buffer.clear()
                cmd = ffmpeg_config['ffprobe'] + f" -i \"{self.input_file}\" -show_format -show_streams -of json"
                print(cmd)
                self.stderr = self.std_err()
                ffmpeg_process = process(cmd,stdout=self,stderr=self.stderr)
                result = ffmpeg_process.run()
                if result != 0:
                    raise Exception(f"ffprobe运行失败,返回值: {result}\n" + f"错误信息: {self.stderr.error}\n")
                # 确保在返回前调用flush来解析数据
                self.flush()
                if len(self.info) == 0:
                    raise Exception(f"ffprobe运行成功,但返回空数据\n" + f"错误信息: {self.stderr.error}\n")
            except Exception as e:
                if self.try_count <= 0:
                    raise Exception(f"ffprobe运行失败,{self.try_count}次尝试后仍未成功\n" + f"错误信息: {self.stderr.error}\n")
                self.try_count -= 1
            else:
                break
    def __str__(self):
        ret = ""
        ret += f'文件时长: {self.info.get("format",{}).get("duration","未知")}\n'
        ret += f'流数量: {len(self.info.get("streams",[]))}\n'
        ret += f'音频流数量: {len([s for s in self.info.get("streams",[]) if s.get("codec_type") == "audio"])}\n'
        ret += f'视频流数量: {len([s for s in self.info.get("streams",[]) if s.get("codec_type") == "video"])}\n'
        ret += f'视频流编码: {[s.get("codec_name","未知") for s in self.info.get("streams",[]) if s.get("codec_type") == "video"]}\n'
        ret += f'音频流编码: {[s.get("codec_name","未知") for s in self.info.get("streams",[]) if s.get("codec_type") == "audio"]}\n'
        return ret  

    def write(self,data):
        # 收集输出数据到缓冲区
        self.buffer.append(data)

    def flush(self):
        # 合并缓冲区内容并尝试解析JSON
        full_output = ''.join(self.buffer)
        # 过滤掉可能的非JSON输出（如错误信息），只保留有效的JSON部分
        # 尝试从输出中提取JSON内容
        if full_output.strip():
            self.info = json.loads(full_output)
    def isatty(self):
        return False
    def __getitem__(self,key):
        return self.info.get(key,None)
    def get(self,key,default = None):
        return self.info.get(key,default)

class ffmpeg():
    """
    ffmpeg类：用于执行ffmpeg命令，如视频转码、截图等操作
    参考ffprobe类设计，提供更灵活的ffmpeg命令执行功能
    """
    class std_err():
        def __init__(self):
            self.error = []
        def write(self,data):
            self.error.append(data)
        def flush(self):
            pass
        def __str__(self):
            return "\n".join(self.error)
    
    def __init__(self):
        """
        初始化ffmpeg类
        """
        self.input_file = None
        self.output_file = None
        self.cmd = ""
        self.info = {}
        self.buffer = []
        self.stderr = self.std_err()
        self.progress = 0.0
        self.process = None
        self.error_message = ""
    
    def __str__(self):
        ret += f"进度: {self.progress * 100:.1f}%\n"
        ret += f"输入文件: {self.input_file}\n"
        ret += f"输出文件: {self.output_file}\n"
        ret += f"错误信息: {self.error_message}\n"
        return ret
    
    def write(self,data):
        """
        收集输出数据到缓冲区
        """
        self.buffer.append(data)
        # 尝试解析进度信息
        self._parse_progress(data)
    
    def flush(self):
        """
        刷新缓冲区内容
        """
        pass
    
    def isatty(self):
        return False
    
    def _parse_progress(self, data):
        """
        解析ffmpeg输出的进度信息
        支持两种格式的进度输出：
        1. ffmpeg默认输出格式: frame=  123 fps= 30 q=-1.0 size=   12345kB time=00:00:04.10 bitrate=24567.8kbits/s speed=1.2x
        2. -progress pipe:1格式输出的键值对
        """
        
        # 尝试解析-progress格式的输出
        if "out_time_ms" in data or "total_size" in data or "frame" in data:
            lines = data.strip().split('\n')
            for line in lines:
                if line.startswith("out_time_ms="):
                    try:
                        # 提取时间戳（毫秒）
                        time_ms = int(line.split("=")[1])
                        # 如果我们知道总时长，可以计算进度百分比
                        if hasattr(self, 'total_duration') and self.total_duration > 0:
                            self.progress = min(time_ms / (self.total_duration * 1000), 1.0)
                    except:
                        pass
                elif line.startswith("frame="):
                    try:
                        self.current_frame = int(line.split("=")[1])
                    except:
                        pass
        
        # 尝试解析标准输出格式
        # 匹配类似: frame=  123 fps= 30 q=-1.0 size=   12345kB time=00:00:04.10 bitrate=24567.8kbits/s speed=1.2x
        time_match = re.search(r'time=(\d+):(\d+):(\d+\.\d+)', data)
        if time_match:
            try:
                hours, minutes, seconds = time_match.groups()
                current_time = float(hours) * 3600 + float(minutes) * 60 + float(seconds)
                
                # 如果有总时长信息，计算进度百分比
                if hasattr(self, 'total_duration') and self.total_duration > 0:
                    self.progress = min(current_time / self.total_duration, 1.0)
                    
                    if hasattr(self, 'progress_callback'):
                        self.progress_callback(self)
                
                # 保存当前时间信息
                self.current_time = current_time
            except:
                pass
        
        # 提取帧率信息
        fps_match = re.search(r'fps=(\d+\.?\d*)', data)
        if fps_match:
            try:
                self.current_fps = float(fps_match.group(1))
            except:
                pass
        
        # 提取比特率信息
        bitrate_match = re.search(r'bitrate=(\d+\.?\d*)kbits/s', data)
        if bitrate_match:
            try:
                self.current_bitrate = float(bitrate_match.group(1))
            except:
                pass
        
        # 提取速度信息
        speed_match = re.search(r'speed=(\d+\.?\d*)x', data)
        if speed_match:
            try:
                self.speed = float(speed_match.group(1))
            except:
                pass
            

    
    
    def run(self):
        """
        执行ffmpeg命令
        前提条件：派生类必须在调用此方法前设置好self.cmd
        
        返回:
            bool: 操作是否成功启动
        """
        # 检查是否已设置cmd
        if not hasattr(self, 'cmd') or not self.cmd:
            raise ValueError("命令未设置，请在调用run方法前设置self.cmd")
        
        print(f"执行ffmpeg命令: {self.cmd}")
        
        # 重置状态
        self.buffer = []
        self.stderr = self.std_err()
        self.progress = 0.0
        self.error_message = ""
        self.error_type = None  # 错误类型分类
        
        # 创建并启动进程
        self.process = process(self.cmd, stdout=self, stderr=self.stderr)
        
        # 运行进程
        ret = self.process.run()
        
        # 检查执行结果
        if ret == 0:
            return 
        elif ret == -15 or ret == 137:  # SIGTERM 或 SIGKILL
            self.error_type = "terminated_by_user"
            raise Exception("ffmpeg进程被用户终止")
        else:
            self.error_message = "执行代码:" + self.cmd + "\n"
            self.error_message += str(self.stderr)
            raise Exception(f"ffmpeg执行错误 [代码:{ret}]: {self.error_message}")
                
    
    def stop(self):
        """
        停止当前正在执行的ffmpeg进程
        
        返回:
            bool: 是否成功停止
        """
        self.process.stop()

    
    
    
class ffmpeg_transcode(ffmpeg):
        
    def __init__(self, **kwargs):
        """
        视频转码功能
        
        参数:
            input_file: 输入文件路径（必需）
            output_file: 输出文件路径（必需）
            video_codec: 视频编码器 (如 h264, h265, vp9 等)
            audio_codec: 音频编码器 (如 aac, mp3 等)
            video_bitrate: 视频比特率 (如 "2M" 表示2Mbps)
            audio_bitrate: 音频比特率 (如 "192k" 表示192kbps)
            resolution: 分辨率 (如 "1280x720")
            fps: 帧率
        
        """
        super().__init__()
        options = []
        
        # 从kwargs中提取参数
        input_file = kwargs.get('input_file')
        output_file = kwargs.get('output_file')
        
        # 验证必需参数
        if not input_file or not output_file:
            raise ValueError("input_file和output_file是必需参数")
        
        
        info = ffprobe(input_file)
        # 智能查找视频流和音频流
        streams = info.get('streams', [])
        # 获取第一个视频流的编码
        video_streams = [s for s in streams if s.get('codec_type') == 'video']
        src_video_codec = video_streams[0].get('codec_name', None) if video_streams else None
        # 获取第一个音频流的编码
        audio_streams = [s for s in streams if s.get('codec_type') == 'audio']
        src_audio_codec = audio_streams[0].get('codec_name', None) if audio_streams else None
        
        # 提取其他可选参数
        video_codec = kwargs.get('video_codec')
        audio_codec = kwargs.get('audio_codec')
        video_bitrate = kwargs.get('video_bitrate')
        audio_bitrate = kwargs.get('audio_bitrate')
        resolution = kwargs.get('resolution')
        fps = kwargs.get('fps')
        
        # 添加视频编码器选项
        if video_codec:
            options.append(f"-c:v {video_codec}")
        else:
            if src_video_codec == "h264":
                options.append("-c:v copy")
            else:
                options.append("-c:v h264")
        
        # 添加音频编码器选项
        if audio_codec:
            options.append(f"-c:a {audio_codec}")
        else:
            if src_audio_codec == "aac":
                options.append("-c:a copy")
            else:
                options.append("-c:a aac")
        
        # 添加视频比特率选项
        if video_bitrate:
            options.append(f"-b:v {video_bitrate}")
        
        # 添加音频比特率选项
        if audio_bitrate:
            options.append(f"-b:a {audio_bitrate}")
        
        # 添加分辨率选项
        if resolution:
            options.append(f"-s {resolution}")
        
        # 添加帧率选项
        if fps:
            options.append(f"-r {fps}")
        
        # 合并选项
        options_str = " ".join(options)
        
        # 设置命令
        self.input_file = input_file
        self.output_file = output_file

        self.total_duration = float(info.get('format', {}).get('duration', 0))
        # 构建基本命令，添加进度显示选项
        self.cmd = f"{ffmpeg_config['path']} -i \"{input_file}\" {options_str} -y -progress pipe:1 \"{output_file}\"{ffmpeg_config['ffmpeg_option']}"
        

class ffmpeg_extract_image(ffmpeg):
    """
    从视频中提取图片帧
    """
    def __init__(self, **kwargs):
        """
        初始化视频帧提取功能
        
        参数:
            input_file: 输入视频文件路径（必需）
            output_pattern: 输出图片路径模式，如 'frame_%04d.jpg'（必需）
            start_time: 开始时间，格式为秒或 'MM:SS'（可选）
            duration: 提取时长，单位为秒（可选）
            frame_rate: 提取帧率，如 1 表示每秒1帧（可选）
            quality: JPEG质量，0-31，数值越小质量越好（可选）
        """
        super().__init__()
        options = []
        
        # 从kwargs中提取参数
        input_file = kwargs.get('input_file')
        output_pattern = kwargs.get('output_pattern')
        
        # 验证必需参数
        if not input_file or not output_pattern:
            raise ValueError("input_file和output_pattern是必需参数")
        
        # 提取其他可选参数
        start_time = kwargs.get('start_time')
        duration = kwargs.get('duration')
        frame_rate = kwargs.get('frame_rate')
        
        # 添加开始时间选项
        if start_time:
            options.append(f"-ss {start_time}")
        
        # 添加时长选项
        if duration:
            options.append(f"-t {duration}")
        
        # 添加帧率选项
        if frame_rate:
            options.append(f"-r {frame_rate}")
        
        
        # 合并选项
        options_str = " ".join(options)
        
        # 设置命令
        self.input_file = input_file
        self.output_file = output_pattern
        
        # 获取视频总时长
        info = ffprobe(input_file)
        self.total_duration = float(info.get('format', {}).get('duration', 0))
        
        # 构建命令
        self.cmd = f"{ffmpeg_config['path']} {options_str} -i \"{input_file}\" -y -progress pipe:1 \"{output_pattern}\"{ffmpeg_config['ffmpeg_option']}"


class ffmpeg_extract_audio(ffmpeg):
    """
    从视频中提取音频
    """
    def __init__(self, **kwargs):
        """
        初始化音频提取功能
        
        参数:
            input_file: 输入视频文件路径（必需）
            output_file: 输出音频文件路径（必需）
            audio_codec: 音频编码器，如 'aac', 'mp3', 'opus' 等（可选）
            audio_bitrate: 音频比特率，如 '192k'（可选）
            start_time: 开始时间，格式为秒或 'MM:SS'（可选）
            duration: 提取时长，单位为秒（可选）
        """
        super().__init__()
        options = []
        
        # 从kwargs中提取参数
        input_file = kwargs.get('input_file')
        output_file = kwargs.get('output_file')
        
        # 验证必需参数
        if not input_file or not output_file:
            raise ValueError("input_file和output_file是必需参数")
        
        # 提取其他可选参数
        audio_codec = kwargs.get('audio_codec', 'aac')
        audio_bitrate = kwargs.get('audio_bitrate')
        start_time = kwargs.get('start_time')
        duration = kwargs.get('duration')
        
        options.append(f"-i \"{input_file}\"")

        # 添加开始时间选项
        if start_time:
            options.append(f"-ss {start_time}")
        
        # 添加时长选项
        if duration:
            options.append(f"-t {duration}")
        
        # 添加音频编码器选项
        options.append(f"-c:a {audio_codec}")
        
        # 添加音频比特率选项
        if audio_bitrate:
            options.append(f"-b:a {audio_bitrate}")
        
        # 仅提取音频流
        options.append("-vn")  # 禁用视频
        
        # 合并选项
        options_str = " ".join(options)
        
        # 设置命令
        self.input_file = input_file
        self.output_file = output_file
        
        # 获取视频总时长
        info = ffprobe(input_file)
        self.total_duration = float(info.get('format', {}).get('duration', 0))
        
        # 构建命令
        self.cmd = f"{ffmpeg_config['path']} {options_str}  -y -progress pipe:1 \"{output_file}\"{ffmpeg_config['ffmpeg_option']}"


class ffmpeg_merge_audio_video(ffmpeg):
    """
    合并音频和视频
    """
    def __init__(self, **kwargs):
        """
        初始化音视频合并功能
        
        参数:
            video_file: 输入视频文件路径（必需）
            audio_file: 输入音频文件路径（必需）
            output_file: 输出文件路径（必需）
            video_codec: 视频编码器，使用 'copy' 表示直接复制流（可选）
            audio_codec: 音频编码器，使用 'copy' 表示直接复制流（可选）
            start_time: 开始时间，格式为秒或 'MM:SS'（可选）
            duration: 合并时长，单位为秒（可选）
        """
        super().__init__()
        options = []
        
        # 从kwargs中提取参数
        video_file = kwargs.get('video_file')
        audio_file = kwargs.get('audio_file')
        output_file = kwargs.get('output_file')
        
        # 验证必需参数
        if not video_file or not audio_file or not output_file:
            raise ValueError("video_file、audio_file和output_file是必需参数")
        
        info = ffprobe(video_file)
        # 智能查找视频流和音频流
        streams = info.get('streams', [])
        # 获取第一个视频流的编码
        video_streams = [s for s in streams if s.get('codec_type') == 'video']
        src_video_codec = video_streams[0].get('codec_name', None) if video_streams else None

        audio_info = ffprobe(audio_file)
        # 智能查找音频流
        audio_streams = audio_info.get('streams', [])
        # 获取第一个音频流的编码
        audio_streams = [s for s in audio_streams if s.get('codec_type') == 'audio']
        src_audio_codec = audio_streams[0].get('codec_name', None) if audio_streams else None

        # 提取其他可选参数
        video_codec = kwargs.get('video_codec')
        audio_codec = kwargs.get('audio_codec')
        start_time = kwargs.get('start_time')
        duration = kwargs.get('duration')
        
        # 添加开始时间选项
        if start_time:
            options.append(f"-ss {start_time}")
        
        # 添加时长选项
        if duration:
            options.append(f"-t {duration}")

        
        
        
        options.append(f"-i \"{video_file}\"")
        # 输入文件和流指定
        options.append(f"-i \"{audio_file}\"")
        
        # 指定使用的流
        options.append("-map 0:v:0 -map 1:a:0")
        
        # 添加编码器选项
        # 添加视频编码器选项
        if video_codec:
            options.append(f"-c:v {video_codec}")
        else:
            if src_video_codec == "h264":
                options.append("-c:v copy")
            else:
                options.append("-c:v h264")
        
        # 添加音频编码器选项
        if audio_codec:
            options.append(f"-c:a {audio_codec}")
        else:
            if src_audio_codec == "aac":
                options.append("-c:a copy")
            else:
                options.append("-c:a aac")
        
        # 合并选项
        options_str = " ".join(options)
        
        # 设置命令
        self.input_file = f"视频: {video_file}, 音频: {audio_file}"
        self.output_file = output_file
        
        # 获取视频总时长（使用视频文件的时长作为参考）
        self.total_duration = float(info.get('format', {}).get('duration', 0))
        
        # 构建命令
        self.cmd = f"{ffmpeg_config['path']} {options_str} -y -progress pipe:1 \"{output_file}\"{ffmpeg_config['ffmpeg_option']}"


class ffmpeg_create_thumbnail(ffmpeg):
    """
    创建视频缩略图
    """
    def __init__(self, **kwargs):
        """
        初始化缩略图创建功能
        
        参数:
            input_file: 输入视频文件路径（必需）
            output_file: 输出缩略图路径（必需）
            position: 缩略图位置，0-1之间的小数，表示视频进度位置，默认为配置中的thumb_pos（可选）
            width: 缩略图宽度，高度会按比例自动调整（可选）
            quality: JPEG质量，0-31，数值越小质量越好（可选）
        """
        super().__init__()
        options = []
        
        # 从kwargs中提取参数
        input_file = kwargs.get('input_file')
        output_file = kwargs.get('output_file')
        
        # 验证必需参数
        if not input_file or not output_file:
            raise ValueError("input_file和output_file是必需参数")
        
        # 提取其他可选参数
        position = kwargs.get('position', ffmpeg_config['thumb_pos'])
        width = kwargs.get('width')
        quality = kwargs.get('quality', 2)
        
        # 获取视频信息
        info = ffprobe(input_file)
        duration = float(info.get('format', {}).get('duration', 0))
        
        # 计算缩略图时间点
        thumbnail_time = duration * position
        
        # 添加时间点选项
        options.append(f"-ss {thumbnail_time}")
        
        options.append(f"-i \"{input_file}\"")
        # 只提取一帧
        options.append("-vframes 1")
        
        # 添加宽度选项
        if width:
            options.append(f"-vf scale={width}:-1")
        
        # 添加质量选项
        options.append(f"-q:v {quality}")
        
        # # 禁用音频处理
        # options.append("-vn")
        
        options.append(f"{ffmpeg_config['ffmpeg_option']}")

        options.append(f"-y -progress pipe:1  \"{output_file}\"")
        # 合并选项
        options_str = " ".join(options)
        
        # 设置命令
        self.input_file = input_file
        self.output_file = output_file
        
        # 设置总时长和当前进度（对于缩略图，我们直接设为100%完成）
        self.total_duration = 1.0
        
        # 构建命令
        self.cmd = f"{ffmpeg_config['path']} {options_str}"


class ffmpeg_merger_video_list(ffmpeg):
    """
    合并视频列表
    """
    def __init__(self, **kwargs):
        """
        初始化视频合并功能
        
        参数:
            video_list: 视频文件路径列表（必需）
            output_file: 输出合并视频路径（必需）
            video_codec: 视频编码器（可选）
            audio_codec: 音频编码器（可选）
            method: 合并方法，'concat'或'filter_complex'（可选，默认'concat'）
        """
        super().__init__()
        options = []
        
        # 从kwargs中提取参数
        video_list = kwargs.get('video_list')
        output_file = kwargs.get('output_file')
        video_codec = kwargs.get('video_codec')
        audio_codec = kwargs.get('audio_codec')
        method = kwargs.get('method', 'concat')
        
        # 验证必需参数
        if not video_list or not output_file:
            raise ValueError("video_list和output_file是必需参数")
        
        # 确保video_list是列表
        if not isinstance(video_list, list):
            raise ValueError("video_list必须是一个列表")
        
        # 验证所有视频文件都存在
        for video_file in video_list:
            if not os.path.exists(video_file):
                raise FileNotFoundError(f"视频文件不存在: {video_file}")
        

        info_list = []
        # 计算总时长用于进度显示
        total_duration = 0
        src_video_codec = None
        src_audio_codec = None
        max_video_height = 0
        max_video_width = 0
        all_same_resolution = True
        all_same_codec = True

        # 第一次遍历：获取所有视频信息，计算最大分辨率，检查是否所有视频参数相同
        for i, video_file in enumerate(video_list):
            try:
                info = ffprobe(video_file)
                duration = float(info.get('format', {}).get('duration', 0))
                total_duration += duration
                info_list.append(info)
                
                # 获取视频流和音频流信息
                stream_info = info.get('streams', [{}])
                video_streams = [s for s in stream_info if s.get('codec_type') == 'video']
                audio_streams = [s for s in stream_info if s.get('codec_type') == 'audio']
                
                current_video_codec = video_streams[0].get('codec_name', 'h264')
                current_audio_codec = audio_streams[0].get('codec_name', 'aac')
                current_height = video_streams[0].get('height', 0)
                current_width = video_streams[0].get('width', 0)
                
                # 记录第一个视频的编码器参数
                if i == 0:
                    src_video_codec = current_video_codec
                    src_audio_codec = current_audio_codec
                    max_video_height = current_height
                    max_video_width = current_width
                else:
                    # 检查是否所有视频编码器相同
                    if current_video_codec != src_video_codec or current_audio_codec != src_audio_codec:
                        # 打印不同编码器的视频信息
                        print(f"视频 {video_file} 编码器为 {current_video_codec}/{current_audio_codec}，与其他视频不同")
                        all_same_codec = False
                    
                    # 检查是否所有视频分辨率相同
                    if current_height != max_video_height or current_width != max_video_width:
                        # 打印不同分辨率的视频信息
                        print(f"视频 {video_file} 分辨率为 {current_width}x{current_height}，与其他视频不同")
                        all_same_resolution = False
                    
                    # 更新最大分辨率
                    if current_width > max_video_width:
                        max_video_width = current_width
                    if current_height > max_video_height:
                        max_video_height = current_height

            except Exception as e:
                print(f"获取视频时长失败 {video_file}: {e}")
        
        self.total_duration = total_duration
        self.input_file = video_list
        self.output_file = output_file
        
        if method == 'concat' and all_same_resolution and all_same_codec:
            # 使用concat协议（更高效，要求视频编码参数和分辨率都相同）
            # 创建临时文件列表
            temp_list_file = output_file + f'合并列表.txt'
            
            # 写入视频文件列表
            with open(temp_list_file, 'w', encoding='utf-8') as f:
                for video_file in video_list:
                    # Windows路径需要转义反斜杠
                    file_path = video_file.replace('\\', '\\\\')
                    f.write(f"file '{file_path}'\n")
            
            # 设置concat选项
            options_str = f"-f concat -safe 0 -i \"{temp_list_file}\" -c copy"
            
            # 构建命令
            self.cmd = f"{ffmpeg_config['path']} {options_str} -y -progress pipe:1 \"{output_file}\"{ffmpeg_config['ffmpeg_option']}"
            
            # 保存临时文件路径以便稍后清理
            self.temp_list_file = temp_list_file
        else:
            print(f"视频 {video_file} 使用filter_complex concat过滤器 因为 all_same_resolution={all_same_resolution} and all_same_codec={all_same_codec} ")
            # 使用filter_complex concat过滤器（更通用，可以处理不同编码参数和分辨率的视频）
            # 添加所有输入文件
            for video_file in video_list:
                options.append(f"-i \"{video_file}\"")
            
            # 计算输出分辨率：保持原始宽高比，最小化黑边
            # 1. 收集所有视频的宽高比
            video_aspects = []
            for info in info_list:
                stream_info = info.get('streams', [{}])
                video_streams = [s for s in stream_info if s.get('codec_type') == 'video']
                if video_streams:
                    width = video_streams[0].get('width', 0)
                    height = video_streams[0].get('height', 0)
                    if width and height:
                        aspect = width / height
                        video_aspects.append(aspect)
            
            # 2. 选择最常见的宽高比，或者使用最大视频的宽高比作为输出宽高比
            if video_aspects:
                # 使用最大视频的宽高比作为输出宽高比
                max_video_aspect = max_video_width / max_video_height
                
                # 3. 计算输出分辨率
                # 为了最小化黑边，我们选择一个能让所有视频尽可能填满画面的分辨率
                # 基于最大视频的尺寸和宽高比
                output_width = max_video_width
                output_height = max_video_height
            else:
                # 默认使用最大宽高
                output_width = max_video_width
                output_height = max_video_height
            
            # 构建filter_complex参数
            # 为每个输入创建视频流的引用，并添加scale和pad滤镜以统一分辨率
            video_filters = []
            scaled_video_labels = []
            
            for i in range(len(video_list)):
                # 为每个视频添加scale和pad滤镜，调整到输出分辨率并填充黑边
                # scale=iw*min(output_width/iw,output_height/ih):ih*min(output_width/iw,output_height/ih)
                # pad=output_width:output_height:(output_width-iw*min(output_width/iw,output_height/ih))/2:(output_height-ih*min(output_width/iw,output_height/ih))/2:black
                # 这种方式会保持原始宽高比，同时将视频缩放到能填满输出分辨率的最大尺寸，黑边最小化
                video_filter = (f'[{i}:v]'  # 输入视频流
                                f'scale=iw*min({output_width}/iw\\,{output_height}/ih):ih*min({output_width}/iw\\,{output_height}/ih),'  # 保持宽高比缩放
                                f'pad={output_width}:{output_height}:'  # 填充到输出分辨率
                                f'({output_width}-iw*min({output_width}/iw\\,{output_height}/ih))/2:'  # 水平居中
                                f'({output_height}-ih*min({output_width}/iw\\,{output_height}/ih))/2:black,'  # 垂直居中，黑边填充
                                f'setsar=1:1'  # 统一采样宽高比
                                f'[{i}:scaled]')  # 输出标记
                video_filters.append(video_filter)
                scaled_video_labels.append(f'[{i}:scaled]')
            
            # 创建音频流的引用
            audio_inputs = [f'[{i}:a]' for i in range(len(video_list))]
            
            # 创建视频concat过滤器
            video_concat_filter = ''.join(scaled_video_labels) + f'concat=n={len(video_list)}:v=1:a=0[outv]'
            video_filters.append(video_concat_filter)
            
            # 创建音频concat过滤器
            audio_filter = ''.join(audio_inputs) + f'concat=n={len(video_list)}:v=0:a=1[outa]'
            video_filters.append(audio_filter)
            
            # 组合所有过滤器
            filter_complex = f'-filter_complex \"{";".join(video_filters)}\" -map "[outv]" -map "[outa]"'
            
            # 添加编码器选项
            codec_options = []
            
            codec_options.append("-c:v h264")
            codec_options.append("-c:a aac")
            
            # 合并所有选项
            options_str = " ".join(options) + f" {filter_complex} " + " ".join(codec_options)
            
            # 构建命令
            self.cmd = f"{ffmpeg_config['path']} {options_str} -y -progress pipe:1 \"{output_file}\"{ffmpeg_config['ffmpeg_option']}"
    
    def run(self):
        """
        执行视频合并操作
        
        返回:
            bool: 操作是否成功
        """
        try:
            # 调用父类的run方法
            result = super().run()
            return result
        finally:
            # 清理临时文件
            if hasattr(self, 'temp_list_file') and os.path.exists(self.temp_list_file):
                try:
                    os.remove(self.temp_list_file)
                except Exception as e:
                    print(f"清理临时文件失败: {e}")
        





