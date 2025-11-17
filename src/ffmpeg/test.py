from FFmpeg import ffprobe, ffmpeg_transcode, ffmpeg_merger_video_list ,ffmpeg_extract_image,ffmpeg_extract_audio,ffmpeg_create_thumbnail

import os
import time

# 测试文件路径（请根据实际情况修改）
test_video_file = "account/dragon/webdav/aa.rm"  # 替换为实际的测试视频文件路径

# 确保测试文件存在
if not os.path.exists(test_video_file):
    print(f"警告：测试文件 '{test_video_file}' 不存在，请修改测试代码中的文件路径。")
    # 尝试找一个默认的测试文件
    for root, dirs, files in os.walk("."):
        for file in files:
            if file.lower().endswith((".mp4", ".avi", ".mkv", ".rm", ".rmvb")):
                test_video_file = os.path.join(root, file)
                print(f"找到测试文件：{test_video_file}")
                break
        else:
            continue
        break

if not os.path.exists(test_video_file):
    print("未找到可用的视频文件，请手动指定测试文件路径。")
    exit(1)
    



def test_ffprobe():  
    # 1. 测试ffprobe功能
    print("\n1. 测试ffprobe功能")
    try:
        info = ffprobe(test_video_file)
        print(str(info))
        print(f"视频时长: {info.get('format', {}).get('duration', '未知')}")
        print(f"视频编码: {[s.get('codec_name', '未知') for s in info.get('streams', []) if s.get('codec_type') == 'video']}")
    except Exception as e:
        print(f"ffprobe测试失败: {e}")

def test_ffmpeg_transcode():  
    # 2. 测试ffmpeg_transcode功能
    print("\n2. 测试视频转码功能")
    try:
        output_file = os.path.splitext(test_video_file)[0] + "_transcoded.mp4"
        print(f"转码输出文件: {output_file}")
        
        transcode_task = ffmpeg_transcode(
            input_file=test_video_file,
            output_file=output_file,
            video_codec="h264",
            audio_codec="aac",
            video_bitrate="1M",
            audio_bitrate="192k"
        )
        
        # 定义进度回调函数
        def progress_callback(ffmpeg):
            percent = ffmpeg.progress * 100
            print(f"转码进度: {percent:.1f}% ", end="\r")
        
        transcode_task.progress_callback = progress_callback
        print("开始转码...")
        start_time = time.time()
        success = transcode_task.run()
        end_time = time.time()
        
        if success:
            print(f"\n转码成功！耗时: {end_time - start_time:.2f}秒")
            if os.path.exists(output_file):
                print(f"输出文件大小: {os.path.getsize(output_file) / (1024 * 1024):.2f} MB")
        else:
            print(f"\n转码失败: {transcode_task.error_message}")
    except Exception as e:
        print(f"转码测试失败: {e}")
    
def test_ffmpeg_extract_image():
    # 3. 测试ffmpeg_extract_image功能
    print("\n3. 测试视频帧提取功能")
    try:
        output_pattern = os.path.splitext(test_video_file)[0] + "_frame_%04d.jpg"
        print(f"帧输出模式: {output_pattern}")
        
        extract_task = ffmpeg_extract_image(
            input_file=test_video_file,
            output_pattern=output_pattern,
            start_time=10,  # 从第10秒开始
            duration=5,     # 提取5秒
            frame_rate=2,   # 每秒提取2帧
            quality=2       # JPEG质量
        )
        
        print("开始提取视频帧...")
        start_time = time.time()
        success = extract_task.run()
        end_time = time.time()
        
        if success:
            print(f"\n视频帧提取成功！耗时: {end_time - start_time:.2f}秒")
            # 检查生成的文件
            output_dir = os.path.dirname(test_video_file)
            base_name = os.path.splitext(os.path.basename(test_video_file))[0]
            frame_files = [f for f in os.listdir(output_dir) if f.startswith(base_name + "_frame_")]
            print(f"共提取 {len(frame_files)} 帧图片")
        else:
            print(f"\n视频帧提取失败: {extract_task.error_message}")
    except Exception as e:
        print(f"视频帧提取测试失败: {e}")

def test_ffmpeg_extract_audio():
    # 4. 测试ffmpeg_extract_audio功能
    print("\n4. 测试音频提取功能")
    try:
        output_audio = os.path.splitext(test_video_file)[0] + "_audio.mp3"
        print(f"音频输出文件: {output_audio}")
        
        audio_task = ffmpeg_extract_audio(
            input_file=test_video_file,
            output_file=output_audio,
            audio_codec="mp3",
            audio_bitrate="192k"
        )
        
        # 定义进度回调函数
        def audio_progress_callback(ffmpeg):
            percent = ffmpeg.progress * 100
            print(f"音频提取进度: {percent:.1f}%", end="\r")
        
        audio_task.progress_callback = audio_progress_callback
        print("开始提取音频...")
        start_time = time.time()
        success = audio_task.run()
        end_time = time.time()
        
        if success:
            print(f"\n音频提取成功！耗时: {end_time - start_time:.2f}秒")
            if os.path.exists(output_audio):
                print(f"输出音频大小: {os.path.getsize(output_audio) / (1024 * 1024):.2f} MB")
        else:
            print(f"\n音频提取失败: {audio_task.error_message}")
    except Exception as e:
        print(f"音频提取测试失败: {e}")
    
def test_ffmpeg_create_thumbnail():
    # 5. 测试ffmpeg_create_thumbnail功能
    print("\n5. 测试缩略图创建功能")
    try:
        output_thumbnail = os.path.splitext(test_video_file)[0] + "_thumbnail.jpg"
        print(f"缩略图输出文件: {output_thumbnail}")
        
        thumbnail_task = ffmpeg_create_thumbnail(
            input_file=test_video_file,
            output_file=output_thumbnail,
            position=0.3,  # 在视频30%的位置
            width=800,     # 宽度800像素
            quality=2      # JPEG质量
        )
        
        print("开始创建缩略图...")
        start_time = time.time()
        success = thumbnail_task.run()
        end_time = time.time()
        
        if success:
            print(f"缩略图创建成功！耗时: {end_time - start_time:.2f}秒")
            if os.path.exists(output_thumbnail):
                print(f"缩略图大小: {os.path.getsize(output_thumbnail) / 1024:.2f} KB")
        else:
            print(f"\n缩略图创建失败: {thumbnail_task.error_message}")
    except Exception as e:
        print(f"缩略图创建测试失败: {e}")
    
def test_ffmpeg_merge_audio_video():
    # 6. 测试ffmpeg_merge_audio_video功能（需要先有分离的音频文件）
    print("\n6. 测试音视频合并功能")
    try:
        # 使用前面提取的音频文件
        audio_file = os.path.splitext(test_video_file)[0] + "_audio.mp3"
        if not os.path.exists(audio_file):
            print("跳过音视频合并测试，因为没有找到音频文件")
        else:
            output_merged = os.path.splitext(test_video_file)[0] + "_merged.mp4"
            print(f"合并输出文件: {output_merged}")
            
            merge_task = ffmpeg_merge_audio_video(
                video_file=test_video_file,
                audio_file=audio_file,
                output_file=output_merged
            )
            
            # 定义进度回调函数
            def merge_progress_callback(ffmpeg):
                percent = ffmpeg.progress * 100
                print(f"合并进度: {percent}%", end="\r")
            
            merge_task.progress_callback = merge_progress_callback
            print("开始合并音视频...")
            start_time = time.time()
            success = merge_task.run()
            end_time = time.time()
            
            if success:
                print(f"\n音视频合并成功！耗时: {end_time - start_time:.2f}秒")
                if os.path.exists(output_merged):
                    print(f"输出文件大小: {os.path.getsize(output_merged) / (1024 * 1024):.2f} MB")
            else:
                print(f"\n音视频合并失败: {merge_task.error_message}")
    except Exception as e:
        print(f"音视频合并测试失败: {e}")
    
    print("\n=== 测试完成 ===")

def test_ffmpeg_merger_video_list():
    # 7. 测试ffmpeg_merger_video_list功能
    print("\n7. 测试视频合并功能")
    try:
        video_list = [test_video_file, test_video_file]  # 合并两个相同视频
        output_merged = os.path.splitext(test_video_file)[0] + "_merged_list.mp4"
        print(f"合并输出文件: {output_merged}")
        
        merge_task = ffmpeg_merger_video_list(
            video_list=video_list,
            output_file=output_merged,
        )
        
        # 定义进度回调函数
        def merge_progress_callback(ffmpeg):
            percent = ffmpeg.progress * 100
            print(f"合并进度: {percent:.1f}%", end="\r")
        
        merge_task.progress_callback = merge_progress_callback
        print("开始合并视频...")
        start_time = time.time()
        success = merge_task.run()
        end_time = time.time()
        
        if success:
            print(f"\n视频合并成功！耗时: {end_time - start_time:.2f}秒")
            if os.path.exists(output_merged):
                print(f"输出文件大小: {os.path.getsize(output_merged) / (1024 * 1024):.2f} MB")
        else:
            print(f"\n视频合并失败: {merge_task.error_message}")
    except Exception as e:
        print(f"视频合并测试失败: {e}")
    #
if __name__ == "__main__":

    print("=== FFmpeg功能测试程序 ===")
    print(f"使用测试文件：{test_video_file}")
    test_ffprobe()
    test_ffmpeg_transcode()
    test_ffmpeg_extract_image()
    test_ffmpeg_extract_audio()
    test_ffmpeg_create_thumbnail()
    test_ffmpeg_merge_audio_video()
    test_ffmpeg_merger_video_list()