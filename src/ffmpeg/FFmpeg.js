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
        } else {
            alert(body.msg || '添加转码任务失败');
        }
    }
    static async delTask(name) {
        try {
            const body = { "name": name }
            
            await AccountManager.Fetch("ffmpeg_del_task_item", body);
            // 删除后不需要额外操作，WebSocket会推送更新
        } catch (error) {
            console.error("删除任务失败:", error);
            alert("删除任务失败，请重试");
        }
    }
    static async delTaskWithFile(name) {
        try {
            const body = { 
                "name": name ,
                "del_file":true
             }
            await AccountManager.Fetch("ffmpeg_del_task_item", body);
            // 删除后不需要额外操作，WebSocket会推送更新
        } catch (error) {
            console.error("删除任务失败:", error);
            alert("删除任务失败，请重试");
        }
    }

}