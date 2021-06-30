import EventEmitter from './EventEmitter.js'
import {
    GLTFLoader
} from 'three/examples/jsm/loaders/GLTFLoader.js'
import {
    FBXLoader
} from 'three/examples/jsm/loaders/FBXLoader.js'
import {
    DRACOLoader
} from 'three/examples/jsm/loaders/DRACOLoader.js'

export default class Resources extends EventEmitter {
    /**
     * Constructor
     */
    constructor() {
        super()

        this.setLoaders()

        this.toLoad = 0
        this.loaded = 0
        this.items = {}
    }

    /**
     * Set loaders   设置加载器
     */
    setLoaders() {
        this.loaders = [] // 几种文件格式

        // Images
        this.loaders.push({
            extensions: ['jpg', 'png'],
            action: (_resource) => {
                const image = new Image()

                image.addEventListener('load', () => {
                    this.fileLoadEnd(_resource, image)
                })

                image.addEventListener('error', () => {
                    this.fileLoadEnd(_resource, image)
                })

                image.src = _resource.source
            }
        })

        // Draco
        const dracoLoader = new DRACOLoader()
        dracoLoader.setDecoderPath('draco/')
        dracoLoader.setDecoderConfig({
            type: 'js'
        })

        this.loaders.push({
            extensions: ['drc'],
            action: (_resource) => {
                dracoLoader.load(_resource.source, (_data) => {
                    this.fileLoadEnd(_resource, _data)

                    DRACOLoader.releaseDecoderModule()
                })
            }
        })

        // GLTF
        const gltfLoader = new GLTFLoader()
        gltfLoader.setDRACOLoader(dracoLoader)

        this.loaders.push({
            extensions: ['glb', 'gltf'],
            action: (_resource) => {
                gltfLoader.load(_resource.source, (_data) => {
                    this.fileLoadEnd(_resource, _data)
                })
            }
        })

        // FBX
        const fbxLoader = new FBXLoader()

        this.loaders.push({
            extensions: ['fbx'],
            action: (_resource) => {
                fbxLoader.load(_resource.source, (_data) => {
                    this.fileLoadEnd(_resource, _data)
                })
            }
        })
    }

    /**
     * Load   开始加载
     */
    load(_resources = []) {
        for (const _resource of _resources) {
            this.toLoad++

            const extensionMatch = _resource.source.match(/\.([a-z]+)$/)

            // console.log(`加载${this.toLoad}`)

            if (typeof extensionMatch[1] !== 'undefined') {
                const extension = extensionMatch[1]
                // console.log('文件类型：', extension)
                // 根据设置好的文件格式，去查找出对应的文件格式，只会通过loaders里面设定的文件格式，返回对应的extensions和action方法赋值给loader
                const loader = this.loaders.find((_loader) => _loader.extensions.find((_extension) => _extension === extension))
                // debugger
                if (loader) {
                    // 执行加载
                    loader.action(_resource)
                } else {
                    console.warn(`Cannot found loader for ${_resource}`)
                }
            } else {
                console.warn(`Cannot found extension of ${_resource}`)
            }
        }
        // debugger
    }

    /**
     * File load end  文件加载完成
     */
    fileLoadEnd(_resource, _data) {
        this.loaded++
        this.items[_resource.name] = _data

        this.trigger('fileEnd', [_resource, _data])

        if (this.loaded === this.toLoad) {
            // 当loaded 等于 toLoad 就相当于加载完成了，触发end方法
            this.trigger('end')
        }
    }
}
