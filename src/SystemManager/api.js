// 使用默认导入语法
import { AccountManager } from '/AccountManager.js';



/**
 * 获取系统的多项指标，包括网络速度、CPU 使用率、内存使用率、系统运行时间和网速统计数据。
 * 仅管理员用户有权限调用。
 * @returns {Promise<Object>} 包含多项系统指标的对象
 */
export async function getSystemInfo() {
    try {
        // 获取用户会话，确保 token 有效
        const session = await AccountManager.getUserSession();

        const url = '/api/get_system_info';
        const options = {
            credentials: 'include'
        };
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP 请求失败，状态码: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('网络请求出错:', error);
        throw error;
    }
}


