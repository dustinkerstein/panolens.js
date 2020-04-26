import { Panorama } from './Panorama';
import { TextureLoader } from '../loaders/TextureLoader';
import * as THREE from 'three';

/**
 * @classdesc Equirectangular based image panorama
 * @constructor
 * @param {string} image - Image url or HTMLImageElement
 */
function ImagePanorama ( image, options = {} ) {

    this.options = Object.assign( {
        plane: false
    }, options );

    Panorama.call( this );

    this.src = image;
    this.type = 'image_panorama';

    this.addEventListener( 'panolens-camera', data => this.onPanolensCamera( data ) );

}

ImagePanorama.prototype = Object.assign( Object.create( Panorama.prototype ), {

    constructor: ImagePanorama,

    /**
     * When camera reference dispatched
     * @param {THREE.Camera} camera 
     */
    onPanolensCamera: function( { camera } ) {

        this.camera = camera;

    },

    /**
     * Load image asset
     * @param  {*} src - Url or image element
     * @memberOf ImagePanorama
     * @instance
     */
    load: function ( src ) {

        Panorama.prototype.load.call( this, false );

        src = src || this.src;

        if ( !src ) { 

            console.warn( 'Image source undefined' );

            return; 

        } else if ( typeof src === 'string' ) {

            TextureLoader.load( src, this.onLoad.bind( this ), this.onProgress.bind( this ), this.onError.bind( this ) );

        } else if ( src instanceof HTMLImageElement ) {

            this.onLoad( new THREE.Texture( src ) );

        }

    },

    /**
     * This will be called when image is loaded
     * @param  {THREE.Texture} texture - Texture to be updated
     * @memberOf ImagePanorama
     * @instance
     */
    onLoad: function ( texture ) {

        if (this.options.plane) {
            this.camera.add(this);
            this.position.set(0,0,-2);
            var windowAspectRatio = window.innerWidth / window.innerHeight;
            var imageAspectRatio = texture.image.width / texture.image.height;
            var distanceToPlane = Math.abs(this.position.z);
            var limit;
            if (imageAspectRatio < windowAspectRatio) {
                limit = (Math.tan (THREE.Math.degToRad(this.camera.fov * 0.5)) * distanceToPlane * 2.0) * imageAspectRatio; 
            } else {
                limit = (Math.tan (THREE.Math.degToRad(this.camera.fov * 0.5)) * distanceToPlane * 2.0) * windowAspectRatio 
            }
            var calcScale = new THREE.Vector3 (limit, limit / imageAspectRatio, 1);
            this.scale.set(calcScale.x,calcScale.y,1);
        }

        texture.minFilter = texture.magFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
		
        if (this.options.plane) {
            this.material.map = texture;
        } else {
            this.updateTexture( texture );
        }

        window.requestAnimationFrame( Panorama.prototype.onLoad.bind( this ) );

    },

    /**
     * Reset
     * @memberOf ImagePanorama
     * @instance
     */
    reset: function () {

        Panorama.prototype.reset.call( this );

    },

    /**
     * Dispose
     * @memberOf ImagePanorama
     * @instance
     */
    dispose: function () {

        // Release cached image
        THREE.Cache.remove( this.src );

        Panorama.prototype.dispose.call( this );

    }

} );

export { ImagePanorama };