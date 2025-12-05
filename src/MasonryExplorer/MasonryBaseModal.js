import { ContextMenu } from '/ContextMenu.js';
import { AccountManager } from '/AccountManager.js';
import { WebdavApi } from '/webdav/WebdavApi.js'
import { InputDialog, MessageDialog, FileSelectDialog, CopyToClipboardDialog, HTMLElementModal } from '/BaseModal.js';
import { WebdavAdapter } from '/webdav/WebdavAdapter.js';

export class MasonryBaseModal {
    constructor() {
        this.item = undefined;
    }

    doPlay(){ 
        document.dispatchEvent(new CustomEvent('WebdavOpen', {
            detail: {
                path: this.item.path,
                item: this.item,
            }
        }));
    }
    doClose(){ }
    // 转换HSL到十六进制颜色
    static strToHex = (str) => {
        // 使用HSV颜色空间生成更明显区分的颜色
        // 计算文件扩展名的哈希值作为色相基础
        const hash = str.split('').reduce((acc, cur) => acc * 31 + cur.charCodeAt(0), 0);

        const tmp = hash*4;
        // 只使用色相通道变化，保持固定的饱和度和亮度
        const hue = Math.abs(tmp) % 360; // 0-360度色相
        const saturation = 70; // 较高的饱和度确保颜色鲜艳
        const lightness = 20; // 中等亮度确保可读性
            
        const h = hue;
        const s = saturation / 100;
        const l = lightness / 100;
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = l - c / 2;
        let r = 0, g = 0, b = 0;
        
        if (0 <= h && h < 60) { r = c; g = x; b = 0; }
        else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
        else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
        else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
        else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
        else { r = c; g = 0; b = x; }
        
        const toHex = (n) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
        return toHex(r) + toHex(g) + toHex(b);
    };

    // 实现颜色加深函数，为渐变创建更深的颜色
    static darkenColor = (hex, amount = 30) => {
        // 将16进制颜色转换为RGB
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        
        // 降低RGB值来加深颜色
        const factor = (100 - amount) / 100;
        const newR = Math.floor(r * factor);
        const newG = Math.floor(g * factor);
        const newB = Math.floor(b * factor);        
        
        // 转换回16进制
        const toHex = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
        return toHex(newR) + toHex(newG) + toHex(newB);
    };
    static {
        MasonryBaseModal.css = `
            /* 图片查看器样式 */
            .view-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background-color: rgba(0, 0, 0, 0.9);
                z-index: 9999;
                justify-content: center;
                align-items: center;
                cursor: pointer;
            }
            
            .view-modal.active {
                display: flex;
            }
            
            .view-modal-content {
                position: relative;
                display: flex;
                justify-content: center;
                align-items: center;
                width: 100%;
                height: 100%;
            }
            
            .view-modal img {
                max-width: 80%;
                max-height: 90vh;
                object-fit: contain;
                cursor: default;
            }
            
            .view-modal .nav-btn {
                position: absolute;
                top: 50%;
                transform: translateY(-50%);
                background-color: rgba(0, 0, 0, 0.5);
                color: white;
                border: none;
                border-radius: 50%;
                width: 50px;
                height: 50px;
                font-size: 24px;
                cursor: pointer;
                display: flex;
                justify-content: center;
                align-items: center;
                transition: background-color 0.3s;
                z-index: 10;
            }
            
            .view-modal .nav-btn:hover {
                background-color: rgba(0, 0, 0, 0.8);
            }
            
            .view-modal .prev-btn {
                left: 20px;
            }
            
            .view-modal .next-btn {
                right: 20px;
            }
            
            .view-modal .close-btn {
                position: absolute;
                top: 20px;
                right: 20px;
                background-color: rgba(0, 0, 0, 0.5);
                color: white;
                border: none;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                font-size: 20px;
                cursor: pointer;
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10;
            }
            
            .view-modal .close-btn:hover {
                background-color: rgba(0, 0, 0, 0.8);
            }
            
            .view-modal .loading-indicator {
                color: white;
                font-size: 18px;
                position: absolute;
            }
            
            .view-modal .image-counter {
                position: absolute;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background-color: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 14px;
            }
        `;
    }
    loadPrev(){
        this.father.loadPrevItem();
    }
    loadNext(){
        this.father.loadNextItem();
    }
    getAllItems(){
        return this.father.allItems;
    }
    getCurrentIndex(){
        return this.father.getCurrentIndex();
    }
    getCounter(){
        return Object.keys(this.father.allItems).length;
    }

    async doContextMenu(x, y){
        const menu = {}
        const browser = document.querySelector('sidebar-browers');
        const profile = await AccountManager.get_profile();
        if (browser && profile.role.includes('Admin')) {
            menu['删除'] = async () => {

                await WebdavApi.deleteFile(this.item.path);
                await this.father.flush();
                document.dispatchEvent(new CustomEvent('WebdavFlush'));
            }
            menu['刷新缩略图'] = async () => {
                await WebdavApi.deleteThumb(this.item.path);
            }
            menu['属性'] = async () => {
                const propertyElement = await WebdavAdapter.getProperty(this.item);
                HTMLElementModal.open({
                    html: propertyElement,
                    width: '80%',
                    height: '90vh',
                });
            }
        }
        
        
        ContextMenu.open(x, y, menu);
    }
}