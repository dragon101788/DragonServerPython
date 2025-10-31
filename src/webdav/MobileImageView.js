import { AccountManager } from '/AccountManager.js';
import '/webdav/SidebarBrowers.js';

export class MobileImageView extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.isRotated = false;
        this.scale = 1;
        this.startX = null;
        this.startY = null;
        this.offsetX = 0;
        this.offsetY = 0;
    }
    
    connectedCallback() {
        console.log("MobileImageView::connectedCallback");
        this.render();
        this.bindEvents();
        const path = this.getAttribute("path");
        if (path) {
            this.loadImage(path);
        }
    }
    
    disconnectedCallback() {
        console.log("MobileImageView::disconnectedCallback");
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
                #imageContainer {
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: #000;
                    z-index: 99999;
                    overflow: hidden;
                }
                #fullscreenImage {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    transition: transform 0.2s ease;
                    max-width: 100%;
                    max-height: 100%;
                }
                #backButton,
                #rotateButton,
                #zoomInButton,
                #zoomOutButton {
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
                #zoomInButton {
                    right: 100px;
                }
                #zoomOutButton {
                    right: 180px;
                }
            </style>
            <div id="background"></div>
            <div id="imageContainer">
                <img id="fullscreenImage" alt="Fullscreen Image">
                <button id="backButton">返回</button>
                <button id="zoomOutButton">缩小</button>
                <button id="zoomInButton">放大</button>
                <button id="rotateButton">旋转</button>
            </div>
        `;
    }

    bindEvents() {
        this.imageContainer = this.shadowRoot.getElementById('imageContainer');
        this.image = this.shadowRoot.getElementById('fullscreenImage');
        this.backButton = this.shadowRoot.getElementById('backButton');
        this.rotateButton = this.shadowRoot.getElementById('rotateButton');
        this.zoomInButton = this.shadowRoot.getElementById('zoomInButton');
        this.zoomOutButton = this.shadowRoot.getElementById('zoomOutButton');

        this.backButton.addEventListener('click', () => this.close());
        this.rotateButton.addEventListener('click', () => this.rotate());
        this.zoomInButton.addEventListener('click', () => this.zoom(0.2));
        this.zoomOutButton.addEventListener('click', () => this.zoom(-0.2));
        this.imageContainer.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.imageContainer.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.imageContainer.addEventListener('touchend', this.handleTouchEnd.bind(this));
    }

    loadImage(path) {
        const browers = document.getElementById('sidebar-browers');
        const url = browers.getFileUrl(path);
        this.image.src = url;
        this.imageContainer.style.display = 'block';
        // 确保图片加载完成后应用变换
        this.image.onload = () => {
            this.image.style.transform = `translate(-50%, -50%) translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.scale}) ${this.isRotated ? 'rotate(90deg)' : ''}`;
        };
        // 处理图片已缓存的情况
        if (this.image.complete) {
            this.image.onload();
        }
    }

    close() {
        this.imageContainer.style.display = 'none';
        this.image.src = '';
        this.isRotated = false;
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.remove();
    }

    rotate() {
        this.isRotated = !this.isRotated;
        this.image.style.transform = `translate(-50%, -50%) translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.scale}) ${this.isRotated ? 'rotate(90deg)' : ''}`;
    }

    zoom(delta) {
        this.scale = Math.max(0.1, Math.min(this.scale + delta, 5));
        this.image.style.transform = `translate(-50%, -50%) translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.scale}) ${this.isRotated ? 'rotate(90deg)' : ''}`;
    }


    handleTouchStart(e) {
        if (e.touches.length === 1) {
            this.startX = e.touches[0].clientX - this.offsetX;
            this.startY = e.touches[0].clientY - this.offsetY;
        }
    }

    handleTouchMove(e) {
        e.preventDefault(); // 防止滑动时页面滚动
        if (e.touches.length === 1 && this.startX !== null && this.startY !== null) {
            this.offsetX = e.touches[0].clientX - this.startX;
            this.offsetY = e.touches[0].clientY - this.startY;
            // 应用拖动变换实现动画效果
            this.image.style.transform = `translate(-50%, -50%) translateY(${this.offsetY}px)`;
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
            // 左右滑动，不处理
        } else {
            this.TouchFreeUD(UDDiff);
        }
        
        this.startX = null;
        this.startY = null;

        this.image.style.transform = `translate(-50%, -50%)`;
    }

    TouchFreeUD(UDDiff) {
        // 判断滑动距离是否超过100px
        if (Math.abs(UDDiff) > 50) {
            if (UDDiff > 0) {
                this.previous();
            } else {
                this.next();
            }
        }
    }

    previous() {
        const browers = document.getElementById('sidebar-browers');
        let path = this.getAttribute("path");
        while(path){
            path = browers.PrevFile(path);
            if (path && MobileImageView.is_supported_format(path)){
                browers.openFile(path);
                return;
            }
        }
    }

    next() {
        const browers = document.getElementById('sidebar-browers');
        let path = this.getAttribute("path");
        while(path){
            path = browers.NextFile(path);
            if(path && MobileImageView.is_supported_format(path)){
                browers.openFile(path);
                return;
            }
        }
    }

    static is_supported_format(path) {
        const ext = path.split('.').pop().toLowerCase();
        return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext);
    }
}

customElements.define('mobile-image-view', MobileImageView);