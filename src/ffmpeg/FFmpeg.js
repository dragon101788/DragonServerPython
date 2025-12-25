import { AccountManager } from "/AccountManager.js";

await AccountManager.init();
export class FFmpeg {
    static {
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
            console.log( `添加转码任务成功,任务名称:${path}`);
        } else {
            console.error(body.msg || '添加转码任务失败');
        }
    }
    static async mergerVideo(input_vir_path_list,output_vir_path){
        const body = await AccountManager.Fetch('ffmpeg_merger_video_list', { 
            'input_file_list': input_vir_path_list,
           // 'output_path': output_vir_path,
        });
                
        if (body.status === 'ok') {
        } else {
            alert(body.msg || '添加合并任务失败');
        }
    }
    static async get_media_info(path){
        const body = await AccountManager.Fetch('ffmpeg_get_media_info', { 'path': path });
        if (body.status === 'ok') {
            return body.info;
        } else {
            throw `${path}获取媒体信息失败:${body.msg}`;
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
    
    static async cancelTask(name) {
        try {
            const body = { "name": name }
            await AccountManager.Fetch("ffmpeg_cancel_task", body);
            // 取消后不需要额外操作，WebSocket会推送更新
        } catch (error) {
            console.error("取消任务失败:", error);
            alert("取消任务失败，请重试");
        }
    }

}