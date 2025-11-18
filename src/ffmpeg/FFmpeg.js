import { AccountManager } from "/AccountManager.js";

export class FFmpeg {
    static {
        AccountManager.init();
    }

    // 连接到FFmpeg服务
    static async connect(callback) {
        await AccountManager.Interact("ffmpeg_connect", {}, (body) => {
            callback(body);
        });
    }

    static async transcodeFile(path){
        const body = await AccountManager.Fetch('ffmpeg_transcode', { 'input_file': path });
                
        if (body.status === 'ok') {
            document.getElementById('input_file').value = '';
        } else {
            alert(body.msg || '添加转码任务失败');
        }
    }

}