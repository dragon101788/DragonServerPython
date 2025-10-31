import { AccountManager } from '/AccountManager.js';
import '/webdav/SidebarBrowers.js';

export class MobileVideo extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.isRotated = false;
        this.startX = null;
        this.startY = null;
        this.startTime = null;
        this.startVolume = null;
    }
    connectedCallback() {
        console.log("MobileVideo::connectedCallback")
        this.render();
        this.bindEvents();
        const path = this.getAttribute("path");
        if(path){
            this.play(path);
        }
            
    }
    disconnectedCallback(){
        console.log("MobileVideo::disconnectedCallback");
        this.close();
    }

    render() {
        this.shadowRoot.innerHTML = /*html*/`
            <style>
                #background{
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: rgb(24, 24, 24);
                    z-index: 99998;
                }
                #videoContainer {
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: #000;
                    z-index: 99999;
                }
                #fullscreenVideo {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                }
                #backButton,
                #rotateButton {
                    position: absolute;
                    top: 20px;
                    padding: 10px;
                    background: rgba(0,0,0,0.5);
                    color: white;
                    border: none;
                    border-radius: 5px;
                    z-index: 100000;
                }
                #backButton {
                    left: 20px;
                }
                #rotateButton {
                    right: 20px;
                }
            </style>
            <div id="background"></div>
            <div id="videoContainer">
                <video id="fullscreenVideo" controls autoplay></video>
                <button id="backButton">返回</button>
                <button id="rotateButton">旋转</button>
            </div>
        `;
    }

    bindEvents() {
        this.videoContainer = this.shadowRoot.getElementById('videoContainer');
        this.video = this.shadowRoot.getElementById('fullscreenVideo');
        this.backButton = this.shadowRoot.getElementById('backButton');
        this.rotateButton = this.shadowRoot.getElementById('rotateButton');

        this.backButton.addEventListener('click', () => this.close());
        this.rotateButton.addEventListener('click', () => {
            console.log("rotateButton");
            this.rotate()
        });
        this.videoContainer.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.videoContainer.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.videoContainer.addEventListener('touchend', this.handleTouchEnd.bind(this));
        
        
    }

    play(path) {
        const browers = document.getElementById('sidebar-browers');
        const url = browers.getFileUrl(path);
        this.video.src = url;
        // 添加错误事件监听
        //this.video.addEventListener('error', this.handleVideoError.bind(this));
        this.videoContainer.style.display = 'block';
        
        this.video.addEventListener('loadedmetadata', () => {
            this.checkAspectRatio();
        });

        this.video.play().catch(error => {
            console.error('播放视频时出错:', error);
            this.next();
        });
    }


    

    close() {
        this.videoContainer.style.display = 'none';
        this.video.pause();
        this.video.src = '';
        this.isRotated = false;
        this.videoContainer.style.transform = 'rotate(0)';
        this.videoContainer.style.width = '100%';
        this.videoContainer.style.height = '100%';
        this.videoContainer.style.left = '0';
        this.videoContainer.style.top = '0';
        this.videoContainer.style.marginLeft = '0';
        this.videoContainer.style.marginTop = '0';
        this.remove(); // 销毁元素
    }

    handleVideoError(e) {
        console.error('Video loading error:', e);
        //this.next();
    }

    rotate(forceState = null) {
        if (forceState !== null) {
            this.isRotated = forceState;
        } else {
            this.isRotated = !this.isRotated;
        }
        if (this.isRotated) {
                this.rotate_str = 'rotate(90deg)'
                this.videoContainer.style.transform = `${this.rotate_str}`;
                this.videoContainer.style.transformOrigin = 'center';
                this.videoContainer.style.width = '100vh';
                this.videoContainer.style.height = '100vw';
                this.videoContainer.style.left = '50%';
                this.videoContainer.style.top = '50%';
                this.videoContainer.style.marginLeft = '-50vh';
                this.videoContainer.style.marginTop = '-50vw';
            } else {
                this.rotate_str='rotate(0)';
                this.videoContainer.style.transform = `${this.rotate_str}`;
                this.videoContainer.style.width = '100%';
                this.videoContainer.style.height = '100%';
                this.videoContainer.style.left = '0';
                this.videoContainer.style.top = '0';
                this.videoContainer.style.marginLeft = '0';
                this.videoContainer.style.marginTop = '0';
        }
    }

    checkAspectRatio() {
        const width = this.video.videoWidth;
        const height = this.video.videoHeight;
        // 如果视频高度大于宽度，自动旋转
        if (height > width ) {
            this.rotate(false);
        } else if (height <= width ) {
            this.rotate(true);
        }
    }

    previous() {
       const browers = document.getElementById('sidebar-browers');
        const path = this.getAttribute("path");
        browers.OpenPrevFile(path);
    }

    next() {
        const browers = document.getElementById('sidebar-browers');
        let path = this.getAttribute("path");
        while(path){
            path = browers.NextFile(path);
            if(path){
                if(MobileVideo.is_supported_format(path)){
                    browers.openFile(path);
                    return;
                }
            }
        }
    }
    static is_supported_format(item){
        if (item.contentType === "video/mp4" ||
            item.contentType ===  "video/x-ms-wmv" ||
            item.contentType ===  "video/x-msvideo" ||
            item.contentType ===  "video/avi" ||
            item.contentType ===  "video/x-matroska" ||
            item.contentType ===  "video/x-flv" ||
            item.contentType ===  "video/quicktime" ||
            item.contentType ===  "video/x-ms-asf" ||
            item.contentType ===  "video/mpeg" ||
            item.path.endsWith(".flv") ||
            item.path.endsWith(".rmvb") ||
            item.path.endsWith(".rm") 
        ){
            return true
        }else{
            return false

        }
    }
    touchMoveRL(LRDiff){
        const timeAdjustment = LRDiff / 100 * 5;
        const newTime = this.startTime + timeAdjustment;
        this.video.currentTime = Math.max(0, Math.min(this.video.duration, newTime));
    }
    TouchMoveUD(UDDiff){
        if(this.isRotated) UDDiff = -UDDiff;
        this.videoContainer.style.transition = 'none';
        this.videoContainer.style.transform = `${this.rotate_str} translateY(${UDDiff}px)`;
       
    }
    TouchFreeRL(LRDiff){

    }
    TouchFreeUD(UDDiff){
        this.videoContainer.style.transition = 'transform 0.3s ease';

        if(this.isRotated) UDDiff = -UDDiff;
        // 判断滑动距离是否超过100px
        if (Math.abs(UDDiff) > 100) {
            if (UDDiff > 0) {
                
                this.previous();
            } else {
                this.next();
            }
        }
        // 界面回到原点
        this.videoContainer.style.transform = `${this.rotate_str} translateY(0)`;
    }
    TouchClick(touchDuration){
        if(touchDuration<300){
            if(this.video.paused){
                this.video.play();
            }else{
                this.video.pause();
            }
        }
    }
    handleTouchStart(e) {
        this.startX = e.touches[0].clientX;
        this.startY = e.touches[0].clientY;
        this.startTime = this.video.currentTime;
        this.startVolume = this.video.volume;
        this.touchStartTime = Date.now();
    }

    handleTouchMove(e) {
        e.preventDefault(); // 防止滑动时页面滚动
        if (!this.startX || !this.startY || this.startVolume === null) return;
        
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const diffX = currentX - this.startX;
        const diffY = currentY - this.startY;
        
        const { LRDiff, UDDiff } = this.isRotated 
            ? { LRDiff: diffY, UDDiff: diffX }  
            : { LRDiff: diffX, UDDiff: diffY }; 
        
        // 优先处理更显著的滑动
        if (Math.abs(LRDiff) > Math.abs(UDDiff)) {
                this.touchMoveRL(LRDiff)
        } else {
                this.TouchMoveUD(UDDiff);
        }
    }

    handleTouchEnd(e) {

        const currentX = e.changedTouches[0].clientX;
        const currentY = e.changedTouches[0].clientY;
        const diffX = currentX - this.startX;
        const diffY = currentY - this.startY;
        
        const { LRDiff, UDDiff } = this.isRotated 
            ? { LRDiff: diffY, UDDiff: diffX }  
            : { LRDiff: diffX, UDDiff: diffY }; 

        if (Math.abs(LRDiff) > Math.abs(UDDiff)) {
            this.touchFreeRL(LRDiff)
        } else {
            this.TouchFreeUD(UDDiff);
        }
        
        const touchDuration = Date.now() - this.touchStartTime;
        if (Math.abs(LRDiff) < 10 && Math.abs(UDDiff) < 10 ) {
            this.TouchClick(touchDuration);
        }
        
        // 重置触摸跟踪
        this.startX = null;
        this.startY = null;
        this.startTime = null;
        this.startVolume = null;
    }

}

customElements.define('mobile-video', MobileVideo);