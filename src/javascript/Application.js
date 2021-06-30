import * as THREE from 'three' // 引入THREE
import * as dat from 'dat.gui' // GUI操作面板

import Sizes from './Utils/Sizes.js' // 设置尺寸相关
import Time from './Utils/Time.js' // 设置时间相关
import World from './World/index.js' // 创建世界
import Resources from './Resources.js' // 资源库

import {
    EffectComposer
} from 'three/examples/jsm/postprocessing/EffectComposer.js' // 特效
import {
    ShaderPass
} from 'three/examples/jsm/postprocessing/ShaderPass.js' // 特效
import {
    RenderPass
} from 'three/examples/jsm/postprocessing/RenderPass.js' // 特效
import BlurPass from './Passes/Blur.js' // 模糊特效
import GlowsPass from './Passes/Glows.js' // 发光特效
import Camera from './Camera.js' // 摄像机

export default class Application {
    /**
     * Constructor
     */
    constructor(_options) {
        // Options
        this.$canvas = _options.$canvas

        // Set up
        this.time = new Time()
        this.sizes = new Sizes()
        this.resources = new Resources()
        // console.log('资源加载完了吗，为什么会等待加载完才执行下面的代码？')
        this.setConfig() // 调试模式、换车、手机端事件监听
        this.setDebug() // 根据上面方法判断是否显示GUI调试窗口
        this.setRenderer() // 创建场景、渲染器
        this.setCamera() // 设置相机
        this.setPasses() // 设置 自定义shader着色器
        this.setWorld() // 设置、创建世界
        this.setTitle() // 设置动态title，根据小车前进后退更改title小车
    }

    /**
     * Set config
     */
    setConfig() {
        this.config = {}
        this.config.debug = window.location.hash === '#debug' // 开启debug模式 出现gui操作菜单
        this.config.cyberTruck = window.location.hash === '#cybertruck' // 把汽车换成一辆特斯拉卡车
        this.config.touch = false // PC模式 关闭触控

        // 监听触摸事件 兼容手机端
        window.addEventListener('touchstart', () => {
            this.config.touch = true
            this.world.controls.setTouch()

            this.passes.horizontalBlurPass.strength = 1
            this.passes.horizontalBlurPass.material.uniforms.uStrength.value = new THREE.Vector2(this.passes.horizontalBlurPass.strength, 0)
            this.passes.verticalBlurPass.strength = 1
            this.passes.verticalBlurPass.material.uniforms.uStrength.value = new THREE.Vector2(0, this.passes.verticalBlurPass.strength)
        }, {
            once: true
        })
    }

    /**
     * Set debug  调试面板
     */
    setDebug() {
        if (this.config.debug) {
            this.debug = new dat.GUI({
                width: 420
            })
        }
    }

    /**
     * Set renderer 设置渲染器
     */
    setRenderer() {
        // Scene
        this.scene = new THREE.Scene()

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.$canvas,
            alpha: true
        })
        // this.renderer.setClearColor(0x414141, 1)
        this.renderer.setClearColor(0x000000, 1) // 设置渲染器颜色
        // this.renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio, 1.5), 2))
        this.renderer.setPixelRatio(2)
        this.renderer.setSize(this.sizes.viewport.width, this.sizes.viewport.height)
        this.renderer.physicallyCorrectLights = true
        this.renderer.gammaFactor = 2.2
        this.renderer.gammaOutPut = true
        this.renderer.autoClear = false

        // Resize event
        this.sizes.on('resize', () => {
            this.renderer.setSize(this.sizes.viewport.width, this.sizes.viewport.height)
        })
    }

    /**
     * Set camera
     */
    setCamera() {
        this.camera = new Camera({
            time: this.time,
            sizes: this.sizes,
            renderer: this.renderer,
            debug: this.debug,
            config: this.config
        })

        this.scene.add(this.camera.container)

        this.time.on('tick', () => {
            if (this.world && this.world.car) {
                this.camera.target.x = this.world.car.chassis.object.position.x
                this.camera.target.y = this.world.car.chassis.object.position.y
            }
        })
    }

    setPasses() {
        this.passes = {}

        // Debug
        if (this.debug) {
            this.passes.debugFolder = this.debug.addFolder('postprocess')
            // this.passes.debugFolder.open()
        }

        this.passes.composer = new EffectComposer(this.renderer)

        // Create passes
        this.passes.renderPass = new RenderPass(this.scene, this.camera.instance)

        this.passes.horizontalBlurPass = new ShaderPass(BlurPass)
        this.passes.horizontalBlurPass.strength = this.config.touch ? 0 : 1
        this.passes.horizontalBlurPass.material.uniforms.uResolution.value = new THREE.Vector2(this.sizes.viewport.width, this.sizes.viewport.height)
        this.passes.horizontalBlurPass.material.uniforms.uStrength.value = new THREE.Vector2(this.passes.horizontalBlurPass.strength, 0)

        this.passes.verticalBlurPass = new ShaderPass(BlurPass)
        this.passes.verticalBlurPass.strength = this.config.touch ? 0 : 1
        this.passes.verticalBlurPass.material.uniforms.uResolution.value = new THREE.Vector2(this.sizes.viewport.width, this.sizes.viewport.height)
        this.passes.verticalBlurPass.material.uniforms.uStrength.value = new THREE.Vector2(0, this.passes.verticalBlurPass.strength)

        // Debug
        if (this.debug) {
            const folder = this.passes.debugFolder.addFolder('blur')
            folder.open()

            folder.add(this.passes.horizontalBlurPass.material.uniforms.uStrength.value, 'x').step(0.001).min(0).max(10)
            folder.add(this.passes.verticalBlurPass.material.uniforms.uStrength.value, 'y').step(0.001).min(0).max(10)
        }

        this.passes.glowsPass = new ShaderPass(GlowsPass)
        this.passes.glowsPass.color = '#ffcfe0'
        this.passes.glowsPass.material.uniforms.uPosition.value = new THREE.Vector2(0, 0.25)
        this.passes.glowsPass.material.uniforms.uRadius.value = 0.7
        this.passes.glowsPass.material.uniforms.uColor.value = new THREE.Color(this.passes.glowsPass.color)
        this.passes.glowsPass.material.uniforms.uAlpha.value = 0.55

        // Debug
        if (this.debug) {
            const folder = this.passes.debugFolder.addFolder('glows')
            folder.open()

            folder.add(this.passes.glowsPass.material.uniforms.uPosition.value, 'x').step(0.001).min(-1).max(2).name('positionX')
            folder.add(this.passes.glowsPass.material.uniforms.uPosition.value, 'y').step(0.001).min(-1).max(2).name('positionY')
            folder.add(this.passes.glowsPass.material.uniforms.uRadius, 'value').step(0.001).min(0).max(2).name('radius')
            folder.addColor(this.passes.glowsPass, 'color').name('color').onChange(() => {
                this.passes.glowsPass.material.uniforms.uColor.value = new THREE.Color(this.passes.glowsPass.color)
            })
            folder.add(this.passes.glowsPass.material.uniforms.uAlpha, 'value').step(0.001).min(0).max(1).name('alpha')
        }

        // Add passes
        this.passes.composer.addPass(this.passes.renderPass)
        this.passes.composer.addPass(this.passes.horizontalBlurPass)
        this.passes.composer.addPass(this.passes.verticalBlurPass)
        this.passes.composer.addPass(this.passes.glowsPass)

        // Time tick
        this.time.on('tick', () => {
            this.passes.horizontalBlurPass.enabled = this.passes.horizontalBlurPass.material.uniforms.uStrength.value.x > 0
            this.passes.verticalBlurPass.enabled = this.passes.verticalBlurPass.material.uniforms.uStrength.value.y > 0

            // Renderer
            this.passes.composer.render()
            // this.renderer.domElement.style.background = 'black'
            // this.renderer.render(this.scene, this.camera.instance)
        })

        // Resize event
        this.sizes.on('resize', () => {
            this.renderer.setSize(this.sizes.viewport.width, this.sizes.viewport.height)
            this.passes.composer.setSize(this.sizes.viewport.width, this.sizes.viewport.height)
            this.passes.horizontalBlurPass.material.uniforms.uResolution.value.x = this.sizes.viewport.width
            this.passes.horizontalBlurPass.material.uniforms.uResolution.value.y = this.sizes.viewport.height
            this.passes.verticalBlurPass.material.uniforms.uResolution.value.x = this.sizes.viewport.width
            this.passes.verticalBlurPass.material.uniforms.uResolution.value.y = this.sizes.viewport.height
        })
    }

    /**
     * Set world 拿到配置，去创建整个世界
     */
    setWorld() {
        this.world = new World({
            config: this.config,
            debug: this.debug,
            resources: this.resources,
            time: this.time,
            sizes: this.sizes,
            camera: this.camera,
            renderer: this.renderer,
            passes: this.passes
        })
        this.scene.add(this.world.container)
        // debugger
    }

    /**
     *  设置动态title，根据小车前进后退更改title小车
     */
    setTitle() {
        this.title = {}
        this.title.frequency = 300
        this.title.width = 20
        this.title.position = 0
        this.title.$element = document.querySelector('title')
        this.title.absolutePosition = Math.round(this.title.width * 0.25)

        this.time.on('tick', () => {
            if (this.world.physics) {
                this.title.absolutePosition += this.world.physics.car.forwardSpeed

                if (this.title.absolutePosition < 0) {
                    this.title.absolutePosition = 0
                }
            }
        })

        window.setInterval(() => {
            this.title.position = Math.round(this.title.absolutePosition % this.title.width)

            document.title = `${'_'.repeat(this.title.width - this.title.position)}🚗${'_'.repeat(this.title.position)}`
        }, this.title.frequency)
    }

    /**
     * Destructor   销毁函数
     */
    destructor() {
        this.time.off('tick')
        this.sizes.off('resize')

        this.camera.orbitControls.dispose()
        this.renderer.dispose()
        this.debug.destroy()
    }
}
